require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const socketManager = require('./utils/socketManager');
const { MongoClient, ObjectId } = require('mongodb');

const url = process.env.MONGODB_URI;

const client = new MongoClient(url);
client.connect().catch(err => {});

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const serverRoutes = require('./routes/serverRoutes');
const sendGridRoutes = require('./routes/sendGridRoutes');
const profileRoutes = require('./routes/profileRoutes');
const chatRoutes = require('./routes/chatRoutes');
const inviteRoutes = require('./routes/inviteRoutes');
const api = require('./api');

const app = express();
app.use(cors());
app.use(express.json());

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/sendgrid', sendGridRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/', chatRoutes);

// Initialize API endpoints
api.setApp(app, client);

app.use((req, res, next) => {
  app.get("/api/ping", (req, res, next) => {
    res.status(200).json({ message: "Hello World" });
  });
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
  next();
});

// Create HTTP server for Socket.IO
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://syncord.space', 'https://syncord.space'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store mapping of userId to socketId for targeting specific users
const userSockets = new Map();
// Track multiple sockets per user: userId -> Set of socketIds
const userSocketsMultiple = new Map();

const voiceRooms = {};

// Socket.IO connection handling
io.on('connection', async (socket) => {
  const userId = socket.handshake.auth.userId;
  const now = new Date().toISOString();

  if (userId) {
    // Track this socket for the user
    userSockets.set(userId, socket.id);
    
    // Also track multiple connections per user
    if (!userSocketsMultiple.has(userId)) {
      userSocketsMultiple.set(userId, new Set());
    }
    const wasFirstSocket = userSocketsMultiple.get(userId).size === 0;
    userSocketsMultiple.get(userId).add(socket.id);
    
    const socketCount = userSocketsMultiple.get(userId).size;
    
    // Join the status-updates room to receive online/offline notifications
    socket.join('status-updates');

    // Look up user's servers to join presence rooms and broadcast online status
    try {
      const db = client.db('discord_clone');
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { servers: 1, friends: 1, username: 1 } }
      );
      const serverIds = (user?.servers || []).map(id => id.toString());
      socket.data.serverIds = serverIds;

      // Join a presence room for each server the user belongs to
      serverIds.forEach(sid => socket.join(`server-presence:${sid}`));

      // If this is the FIRST socket for this user, notify friends and servers that they came online
      if (wasFirstSocket) {
        // Tell all other members in those servers that this user just came online
        serverIds.forEach(sid => {
          socket.to(`server-presence:${sid}`).emit('member-online', { userId });
        });

        // Notify all friends that they came online
        if (user && user.friends && user.friends.length > 0) {
          // Broadcast to the status-updates room (all connected users)
          io.to('status-updates').emit('user-online', {
            userId: userId,
            username: user.username
          });
        }
      }
    } catch (e) {
      socket.data.serverIds = [];
    }
  }

  // Handle joining a server channel room
  socket.on('join-server-channel', (data) => {
    const { serverId, channelId } = data;
    const roomId = `server-${serverId}-channel-${channelId}`;
    socket.join(roomId);
  });

  // Handle leaving a server channel room
  socket.on('leave-server-channel', (data) => {
    const { serverId, channelId } = data;
    const roomId = `server-${serverId}-channel-${channelId}`;
    socket.leave(roomId);
  });

  // Handle joining a DM room
  socket.on('join-dm', (recipientId) => {
    const roomId = [socket.handshake.auth.userId, recipientId].sort().join('-');
    socket.join(roomId);
  });

  // Handle sending a direct message
  socket.on('send-dm', (data) => {
    const { recipientId, message } = data;
    const roomId = [socket.handshake.auth.userId, recipientId].sort().join('-');

    io.to(roomId).emit('receive-message', {
      ...message,
      senderId: socket.handshake.auth.userId,
    });
  });

  socket.on('join-voice', ({ channelId, userId: vUserId }) => {
    socket.join(channelId);
 
    if (!voiceRooms[channelId]) voiceRooms[channelId] = new Map();
    voiceRooms[channelId].set(socket.id, vUserId);
 
    const existingPeers = [];
    voiceRooms[channelId].forEach((uid, sid) => {
      if (sid !== socket.id) existingPeers.push({ socketId: sid, userId: uid });
    });
    socket.emit('existing-peers', { peers: existingPeers });
 
    // tell existing users someone join
    socket.to(channelId).emit('user-joined', {
      socketId: socket.id,
      userId: vUserId,
    });
 
    console.log(`[voice] ${vUserId} joined channel ${channelId}`);
  });
 
  socket.on('offer', ({ to, offer, userId: oUserId }) => {
    io.to(to).emit('offer', { from: socket.id, userId: oUserId, offer });
  });
 
  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });
 
  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });
 
  socket.on('leave-voice', ({ channelId, userId: vUserId }) => {
    socket.leave(channelId);
    if (voiceRooms[channelId]) {
      voiceRooms[channelId].delete(socket.id);
      if (voiceRooms[channelId].size === 0) delete voiceRooms[channelId];
    }
    io.to(channelId).emit('user-left', { socketId: socket.id, userId: vUserId });
    console.log(`[voice] ${vUserId} left channel ${channelId}`);
  });
 
  socket.on('disconnect', async () => {
    if (userId) {
      if (userSocketsMultiple.has(userId)) {
        userSocketsMultiple.get(userId).delete(socket.id);
        const remainingSockets = userSocketsMultiple.get(userId).size;
 
        if (remainingSockets === 0) {
          userSocketsMultiple.delete(userId);
          userSockets.delete(userId);
 
          try {
            const db = client.db('discord_clone');
            const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
            if (user && user.friends && user.friends.length > 0) {
              io.to('status-updates').emit('user-offline', {
                userId: userId,
                username: user.username,
              });
            }
          } catch (err) {}
 
          const serverIds = socket.data?.serverIds || [];
          serverIds.forEach(sid => {
            socket.to(`server-presence:${sid}`).emit('member-offline', { userId });
          });
        }
      } else {
        userSockets.delete(userId);
      }
    }
 
    for (const [channelId, members] of Object.entries(voiceRooms)) {
      if (members.has(socket.id)) {
        const vUserId = members.get(socket.id);
        members.delete(socket.id);
        if (members.size === 0) delete voiceRooms[channelId];
        io.to(channelId).emit('user-left', { socketId: socket.id, userId: vUserId });
      }
    }
  });

});

// Export io instance and userSockets mapping for use in controllers
socketManager.setSocketIO(io, userSocketsMultiple, voiceRooms);

module.exports = { httpServer, io, userSockets, userSocketsMultiple };

httpServer.listen(5000);
