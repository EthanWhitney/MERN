require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('🔍 DEBUG: JWT_SECRET present?', !!process.env.JWT_SECRET);
console.log('🔍 DEBUG: __dirname:', __dirname);
console.log('🔍 DEBUG: .env path:', require('path').join(__dirname, '.env'));

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const socketManager = require('./utils/socketManager');

const MongoClient = require('mongodb').MongoClient;
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
io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId;
  console.log('[Socket.IO] New connection:', socket.id);
  console.log('[Socket.IO] Auth userId:', userId);
  
  if (userId) {
    userSockets.set(userId, socket.id);
    console.log('[Socket.IO] ✅ User connected:', userId, 'Socket:', socket.id);
    console.log('[Socket.IO] userSockets Map:', Array.from(userSockets.entries()));
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
  socket.on('disconnect', () => {
    console.log('[Socket.IO] User disconnect event, userId:', userId);
    if (userId) {
      const wasTracked = userSockets.has(userId);
      userSockets.delete(userId);
      console.log('[Socket.IO] ✅ Removed user from tracking:', userId, 'Was tracked:', wasTracked);
      console.log('[Socket.IO] Remaining users:', Array.from(userSockets.entries()));
    } else {
      console.log('[Socket.IO] ❌ Disconnect event but user was not tracked');
    }
  });
});

// httpServer.listen(5000); // start HTTP server with Socket.IO on port 5000

// Connect on port 5000, check for all ports (Allows Mobile Development)
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
})
