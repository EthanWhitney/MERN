require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('🔍 DEBUG: JWT_SECRET present?', !!process.env.JWT_SECRET);
console.log('🔍 DEBUG: __dirname:', __dirname);
console.log('🔍 DEBUG: .env path:', require('path').join(__dirname, '.env'));

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const socketManager = require('./utils/socketManager');
const { ObjectId } = require('mongodb');

const MongoClient = require('mongodb').MongoClient;
const url = process.env.MONGODB_URI;

const client = new MongoClient(url);
console.log('[Server] Connecting to MongoDB...');
client.connect().catch(err => console.error('[Server] MongoDB connection error:', err));
console.log('[Server] MongoDB connect() called (async)');

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
// app.use(bodyParser.json());
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

app.use((req, res, next) => 
{
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
console.log('[Server] HTTP server created');

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://syncord.space', 'https://syncord.space'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
console.log('[Server] Socket.IO server created');

// Store mapping of userId to socketId for targeting specific users
const userSockets = new Map();
// Track multiple sockets per user: userId -> Set of socketIds
const userSocketsMultiple = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId;
  const now = new Date().toISOString();
  console.log(`[Socket.IO] [${now}] New connection: ${socket.id}`);
  console.log('[Socket.IO] Auth userId:', userId);
  
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
    console.log(`[Socket.IO] [${now}] ✅ User connected: ${userId}, Socket: ${socket.id}, Total sockets for user: ${socketCount}`);
    console.log('[Socket.IO] userSockets Map:', Array.from(userSockets.entries()));
    
    // Join the status-updates room to receive online/offline notifications
    socket.join('status-updates');
    console.log(`[Socket.IO] [${now}] Socket ${socket.id} joined status-updates room`);

    // If this is the FIRST socket for this user, notify all friends that they came online
    if (wasFirstSocket) {
      // Run async notification in background without blocking socket handler registration
      (async () => {
        try {
          const db = client.db('discord_clone');
          const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
          if (user && user.friends && user.friends.length > 0) {
            console.log(`[Socket.IO] [${now}] Notifying ${user.friends.length} friends that user ${userId} came online`);
            // Broadcast to the status-updates room (all connected users)
            io.to('status-updates').emit('user-online', {
              userId: userId,
              username: user.username
            });
          }
        } catch (err) {
          console.error('[Socket.IO] Error notifying friends on connect:', err);
        }
      })();
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
    
    // Broadcast message to room (both sender and recipient)
    io.to(roomId).emit('receive-message', {
      ...message,
      senderId: socket.handshake.auth.userId,
    });
    
    console.log(`Message sent in room ${roomId}`);
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    const now = new Date().toISOString();
    console.log(`[Socket.IO] [${now}] User disconnect event, userId: ${userId}, socketId: ${socket.id}`);
    if (userId) {
      const wasTracked = userSockets.has(userId);
      
      // Remove this specific socket
      if (userSocketsMultiple.has(userId)) {
        userSocketsMultiple.get(userId).delete(socket.id);
        const remainingSockets = userSocketsMultiple.get(userId).size;
        console.log(`[Socket.IO] [${now}] Socket removed. Remaining sockets for user ${userId}: ${remainingSockets}`);
        
        // Only set online=false if this was the LAST socket for this user
        if (remainingSockets === 0) {
          userSocketsMultiple.delete(userId);
          userSockets.delete(userId);
          console.log(`[Socket.IO] [${now}] ✅ Last socket disconnected for user ${userId}. Notifying friends.`);

          // Notify all friends that this user went offline
          try {
            const db = client.db('discord_clone');
            const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
            if (user && user.friends && user.friends.length > 0) {
              console.log(`[Socket.IO] [${now}] Notifying ${user.friends.length} friends that user ${userId} went offline`);
              // Broadcast to the status-updates room (all connected users)
              io.to('status-updates').emit('user-offline', {
                userId: userId,
                username: user.username
              });
            }
          } catch (err) {
            console.error('[Socket.IO] Error notifying friends on disconnect:', err);
          }
        } else {
          console.log(`[Socket.IO] [${now}] Socket disconnected but user has ${remainingSockets} other sockets. NOT notifying.`);
        }
      } else {
        userSockets.delete(userId);
        console.log('[Socket.IO] ✅ Removed user from tracking:', userId, 'Was tracked:', wasTracked);
      }
      console.log('[Socket.IO] Remaining users:', Array.from(userSockets.entries()));
    } else {
      console.log('[Socket.IO] ❌ Disconnect event but user was not tracked');
    }
  });
});

// Export io instance and userSockets mapping for use in controllers
socketManager.setSocketIO(io, userSocketsMultiple);

module.exports = { httpServer, io, userSockets, userSocketsMultiple };

httpServer.listen(5000); // start HTTP server with Socket.IO on port 5000
