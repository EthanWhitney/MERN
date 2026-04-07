require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

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
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

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
    console.log('User disconnected:', socket.id);
  });
});

httpServer.listen(5000); // start HTTP server with Socket.IO on port 5000
