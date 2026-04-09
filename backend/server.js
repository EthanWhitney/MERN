require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('🔍 DEBUG: JWT_SECRET present?', !!process.env.JWT_SECRET);
console.log('🔍 DEBUG: __dirname:', __dirname);
console.log('🔍 DEBUG: .env path:', require('path').join(__dirname, '.env'));

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const socketManager = require('./utils/socketManager');

const { MongoClient, ObjectId } = require('mongodb');
const url = process.env.MONGODB_URI;

const client = new MongoClient(url);
client.connect();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const serverRoutes = require('./routes/serverRoutes');
const sendGridRoutes = require('./routes/sendGridRoutes');
const profileRoutes = require('./routes/profileRoutes');
const chatRoutes = require('./routes/chatRoutes');
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

// Socket.IO connection handling
io.on('connection', async (socket) => {
  const userId = socket.handshake.auth.userId;
  console.log('[Socket.IO] New connection:', socket.id);
  console.log('[Socket.IO] Auth userId:', userId);

  if (userId) {
    userSockets.set(userId, socket.id);
    console.log('[Socket.IO] ✅ User connected:', userId, 'Socket:', socket.id);

    // Look up user's servers to join presence rooms and broadcast online status
    try {
      const db = client.db('discord_clone');
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { servers: 1 } }
      );
      const serverIds = (user?.servers || []).map(id => id.toString());
      socket.data.serverIds = serverIds;

      // Join a presence room for each server the user belongs to
      serverIds.forEach(sid => socket.join(`server-presence:${sid}`));

      // Tell all other members in those servers that this user just came online
      serverIds.forEach(sid => {
        socket.to(`server-presence:${sid}`).emit('member-online', { userId });
      });

      console.log(`[Socket.IO] User ${userId} joined presence rooms for ${serverIds.length} server(s)`);
    } catch (e) {
      console.error('[Socket.IO] Error joining server presence rooms:', e);
      socket.data.serverIds = [];
    }
  } else {
    console.log('[Socket.IO] ❌ No userId in auth, connection not tracked');
  }

  // Handle joining a DM room
  socket.on('join-dm', (recipientId) => {
    const roomId = [socket.handshake.auth.userId, recipientId].sort().join('-');
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined DM room ${roomId}`);
  });

  // Handle sending a direct message
  socket.on('send-dm', (data) => {
    const { recipientId, message } = data;
    const roomId = [socket.handshake.auth.userId, recipientId].sort().join('-');

    io.to(roomId).emit('receive-message', {
      ...message,
      senderId: socket.handshake.auth.userId,
    });

    console.log(`Message sent in room ${roomId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('[Socket.IO] User disconnect event, userId:', userId);
    if (userId) {
      userSockets.delete(userId);
      console.log('[Socket.IO] ✅ Removed user from tracking:', userId);

      // Broadcast offline status to all server presence rooms
      const serverIds = socket.data?.serverIds || [];
      serverIds.forEach(sid => {
        socket.to(`server-presence:${sid}`).emit('member-offline', { userId });
      });

      console.log(`[Socket.IO] Broadcasted offline for user ${userId} to ${serverIds.length} server(s)`);
    }
  });
});

// Export io instance and userSockets mapping for use in controllers
socketManager.setSocketIO(io, userSockets);

module.exports = { httpServer, io, userSockets };

httpServer.listen(5000);
console.log('[Server] Listening on port 5000');
