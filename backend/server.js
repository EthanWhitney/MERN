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

// Async error wrapper for route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

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
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://10.0.2.2:5000', 'http://localhost:5175', 'http://localhost:3000', 'http://syncord.space', 'https://syncord.space'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

console.log('[INITIALIZATION] Socket.IO Server created');

// Add error handler for socket.io
io.on('error', (error) => {
  console.error('[SOCKET.IO ERROR]:', error);
});

io.engine.on('connection_error', (err) => {
  console.error('[SOCKET.IO CONNECTION ERROR]:', err.code, err.message);
});

// Listen for ANY connection attempt (before auth validation)
io.engine.on('initial_headers', (headers, req) => {
  console.log('[ENGINE] Initial headers received from:', req.url);
});

// Log all engine events to see what's happening
io.engine.on('headers', (headers, req) => {
  console.log('[ENGINE] Headers event:', req.url, Object.keys(headers));
});

io.engine.on('connection', (rawSocket) => {
  console.log('[ENGINE.RAW] Raw socket connection received from:', rawSocket._sockets?.socket?.remoteAddress || 'unknown');
});

// Store mapping of userId to socketId for targeting specific users
const userSockets = new Map();
// Track multiple sockets per user: userId -> Set of socketIds
const userSocketsMultiple = new Map();

const voiceRooms = {};

// ========== PHASE 1.1: Initialize socketSessions collection for atomic operations ==========
async function initializeSocketSessions() {
  try {
    const db = client.db('discord_clone');
    
    // Ensure the collection exists
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes('socketSessions')) {
      console.log('[INIT] Creating socketSessions collection...');
      await db.createCollection('socketSessions');
    }
    
    // Create indexes for fast queries
    const collection = db.collection('socketSessions');
    
    // Index on userId for quick session lookups
    await collection.createIndex({ userId: 1 });
    console.log('[INIT] Created index on userId');
    
    // Index on userId + socketId for unique session tracking
    await collection.createIndex({ userId: 1, socketId: 1 }, { unique: true });
    console.log('[INIT] Created unique index on userId + socketId');
    
    // TTL index: auto-delete sessions that haven't been updated in 24 hours
    // This prevents stale sessions from accumulating
    await collection.createIndex(
      { lastHeartbeat: 1 },
      { expireAfterSeconds: 86400 }
    );
    console.log('[INIT] Created TTL index on lastHeartbeat (24 hours)');
    
    console.log('[INIT] socketSessions collection ready');
    
    // ========== PHASE 1.3: Initialize pendingEvents collection ==========
    if (!collectionNames.includes('pendingEvents')) {
      console.log('[INIT] Creating pendingEvents collection...');
      await db.createCollection('pendingEvents');
    }
    
    const eventCollection = db.collection('pendingEvents');
    
    // Index on userId for quick event lookup
    await eventCollection.createIndex({ userId: 1 });
    console.log('[INIT] Created index on userId');
    
    // Index on createdAt for TTL deletion
    await eventCollection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 3600 } // Keep events for 1 hour
    );
    console.log('[INIT] Created TTL index on createdAt (1 hour)');
    
    console.log('[INIT] pendingEvents collection ready');
  } catch (err) {
    console.error('[INIT] Error initializing collections:', err);
  }
}

// Initialize on server startup
initializeSocketSessions();

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log(`[SOCKET] New connection received. Socket ID: ${socket.id}`);
  const userId = socket.handshake.auth.userId;
  const now = new Date().toISOString();

  if (userId) {
    console.log(`[CONNECTION] User ${userId} connecting with socket ${socket.id}`);
    
    const db = client.db('discord_clone');
    
    // Create socket session atomically in DB
    try {
      await db.collection('socketSessions').insertOne({
        userId: new ObjectId(userId),
        socketId: socket.id,
        createdAt: now,
        lastHeartbeat: now
      });
      console.log(`[CONNECTION] Socket session created for ${userId}`);
    } catch (err) {
      console.error('[CONNECTION] Error creating socket session:', err);
    }

    // ========== ADD SOCKET TO IN-MEMORY tracking ==========
    // This is needed for isUserOnline() to work correctly
    if (!userSocketsMultiple.has(userId)) {
      userSocketsMultiple.set(userId, new Set());
    }
    userSocketsMultiple.get(userId).add(socket.id);
    console.log(`[CONNECTION] Socket ${socket.id} added to userSocketsMultiple for ${userId}`);
    
    // Track this socket for the user (for backward compat, will remove after Phase 2)
    const userSockets = new Map(); // Temporary - for voice rooms access
    
    // Check if this is the first socket by counting remaining sessions in DB
    try {
      const sessionCount = await db.collection('socketSessions').countDocuments({ 
        userId: new ObjectId(userId) 
      });
      const wasFirstSocket = sessionCount === 1; // Just inserted one
      
      console.log(`[CONNECTION] User ${userId} now has ${sessionCount} session(s). First session: ${wasFirstSocket}`);
      
      // Join the status-updates room to receive online/offline notifications
      socket.join('status-updates');

      // ========== PHASE 1.3: Retrieve and Replay Pending Events ==========
      // Get any events that were queued for this user while they were offline
      try {
        const pendingEvents = await socketManager.getPendingEventsForUser(db, new ObjectId(userId));
        if (pendingEvents.length > 0) {
          console.log(`[RECONNECT] Replaying ${pendingEvents.length} pending events to user ${userId}`);
          pendingEvents.forEach(event => {
            console.log(`[RECONNECT] Replaying ${event.eventName} to socket ${socket.id}`);
            socket.emit(event.eventName, event.eventData);
          });
        }
      } catch (err) {
        console.error('[RECONNECT] Error retrieving pending events:', err);
      }

      // Look up user's servers
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { servers: 1, friends: 1, username: 1 } }
      );
      const serverIds = (user?.servers || []).map(id => id.toString());
      socket.data.serverIds = serverIds;
      socket.data.userId = userId;

      // If this is the FIRST socket for this user, set online and broadcast
      if (wasFirstSocket) {
        console.log(`[ONLINE] User ${userId} coming online - setting isOnline to true (first session: ${socket.id})`);
        
        // Update user document to mark as online
        try {
          const updateResult = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { isOnline: true } }
          );
          console.log(`[ONLINE] User ${userId} isOnline updated: ${updateResult.modifiedCount} documents modified`);
        } catch (err) {
          console.error('[ONLINE] Error updating user isOnline status:', err);
        }

        // Tell all server members that this user came online
        for (const sid of serverIds) {
          await socketManager.broadcastMemberOnline(db, new ObjectId(sid), new ObjectId(userId));
        }

        // Broadcast user online to all friends via socket.io
        await socketManager.broadcastUserOnline(db, userId);
      } else {
        console.log(`[ONLINE] User ${userId} has ${sessionCount} sessions (new session: ${socket.id})`);
      }
    } catch (e) {
      console.error('[CONNECTION] Error during connection setup:', e);
      socket.data.serverIds = [];
    }
  }

  // Handle joining a server channel room
  socket.on('join-server-channel', (data) => {
    const { serverId, channelId } = data;
    const roomId = `server-${serverId}-channel-${channelId}`;
    console.log('[SOCKET] join-server-channel:', roomId, 'socket:', socket.id);
    socket.join(roomId);
  });

  // Handle leaving a server channel room
  socket.on('leave-server-channel', (data) => {
    const { serverId, channelId } = data;
    const roomId = `server-${serverId}-channel-${channelId}`;
    console.log('[SOCKET] leave-server-channel:', roomId, 'socket:', socket.id);
    socket.leave(roomId);
  });

  // Handle joining a DM room
  socket.on('join-dm', (recipientId) => {
    const roomId = [socket.handshake.auth.userId, recipientId].sort().join('-');
    console.log('[SOCKET] join-dm:', roomId, 'socket:', socket.id);
    socket.join(roomId);
  });

  // Handle sending a direct message
  socket.on('send-dm', (data) => {
    const { recipientId, message } = data;
    const roomId = [socket.handshake.auth.userId, recipientId].sort().join('-');
    console.log('[SOCKET] send-dm to room:', roomId, 'message:', message._id);

    io.to(roomId).emit('receive-message', {
      ...message,
      senderId: socket.handshake.auth.userId,
    });
  });

  // ========== PHASE 1.2: Ping/Pong Handlers (Heartbeat Response) ==========
  socket.on('ping', () => {
    console.log(`[HEARTBEAT] Received ping from client ${socket.id} (user: ${userId})`);
    socket.emit('pong');
  });

  socket.on('pong', () => {
    console.log(`[HEARTBEAT] Received pong from client ${socket.id} (user: ${userId})`);
    // Just log it - the health check monitor uses DB queries to verify sessions
  });

  socket.on('join-voice', ({ channelId, userId: vUserId, username: vUsername }) => {
    socket.join(channelId);

    if (!voiceRooms[channelId]) voiceRooms[channelId] = new Map();
    voiceRooms[channelId].set(socket.id, { userId: vUserId, username: vUsername });

    const existingPeers = [];
    voiceRooms[channelId].forEach((data, sid) => {
      if (sid !== socket.id) {
        const uid = typeof data === 'string' ? data : data.userId;
        const uname = typeof data === 'string' ? 'Unknown' : data.username;
        existingPeers.push({ socketId: sid, userId: uid, username: uname });
      }
    });
    socket.emit('existing-peers', { peers: existingPeers });

    socket.to(channelId).emit('user-joined', {
      socketId: socket.id,
      userId: vUserId,
      username: vUsername
    });

    console.log(`[voice] ${vUserId} (${vUsername}) joined channel ${channelId}`);
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
      const db = client.db('discord_clone');
      
      try {
        // Atomically remove this socket session from DB
        await db.collection('socketSessions').deleteOne({
          userId: new ObjectId(userId),
          socketId: socket.id
        });
        console.log(`[OFFLINE] Socket ${socket.id} for user ${userId} session removed from DB`);
        
        // Check if ANY socket sessions remain for this user in DB (atomic query)
        const remainingSessionCount = await db.collection('socketSessions').countDocuments({
          userId: new ObjectId(userId)
        });
        
        console.log(`[OFFLINE] User ${userId} has ${remainingSessionCount} remaining session(s)`);
        
        if (remainingSessionCount === 0) {
          console.log(`[OFFLINE] User ${userId} has NO remaining sockets - setting isOnline to false`);
          
          // Update user document to mark as offline
          const updateResult = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { isOnline: false } }
          );
          console.log(`[OFFLINE] User ${userId} isOnline updated to false: ${updateResult.modifiedCount} documents modified`);
          
          // Broadcast user offline to all friends and servers
          await socketManager.broadcastUserOffline(db, userId);
          
          // Notify members in all servers that this user went offline
          const serverIds = socket.data?.serverIds || [];
          for (const sid of serverIds) {
            await socketManager.broadcastMemberOffline(db, new ObjectId(sid), new ObjectId(userId));
          }
        } else {
          console.log(`[OFFLINE] User ${userId} still has ${remainingSessionCount} session(s) - keeping online`);
        }
      } catch (err) {
        console.error('[OFFLINE] Error handling disconnect:', err);
      }
      
      // Clean up legacy in-memory tracking (can remove after Phase 2)
      if (userSocketsMultiple.has(userId)) {
        userSocketsMultiple.get(userId).delete(socket.id);
        if (userSocketsMultiple.get(userId).size === 0) {
          userSocketsMultiple.delete(userId);
          userSockets.delete(userId);
        }
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

// ========== PHASE 1.2: Health Check Heartbeat (Detect Stale Connections) ==========
// Every 30 seconds, verify all socketSessions are still valid by updating their heartbeat
async function startHealthCheckHeartbeat() {
  setInterval(async () => {
    try {
      const db = client.db('discord_clone');
      const now = new Date().toISOString();
      
      // Find all active socket sessions
      const activeSessions = await db.collection('socketSessions')
        .find({})
        .toArray();
      
      if (activeSessions.length === 0) {
        console.log('[HEARTBEAT] No active sessions to check');
        return;
      }
      
      console.log(`[HEARTBEAT] Checking ${activeSessions.length} active session(s)`);
      
      // For each session, verify the socket is still connected
      for (const session of activeSessions) {
        const socketsForUser = Array.from(io.of('/').sockets.values())
          .filter(s => s.handshake?.auth?.userId === session.userId.toString() && s.id === session.socketId);
        
        if (socketsForUser.length === 0) {
          // Socket is dead - clean up the session
          console.log(`[HEARTBEAT] Socket ${session.socketId} not found for user ${session.userId} - removing stale session`);
          await db.collection('socketSessions').deleteOne({
            _id: session._id
          });
        } else {
          // Socket is alive - update heartbeat timestamp
          await db.collection('socketSessions').updateOne(
            { _id: session._id },
            { $set: { lastHeartbeat: now } }
          );
        }
      }
      
      console.log('[HEARTBEAT] Health check complete');
    } catch (err) {
      console.error('[HEARTBEAT] Error during health check:', err);
    }
  }, 30000); // Every 30 seconds
  
  console.log('[HEARTBEAT] Health check monitor started (30s interval)');
}

// Backend ping emitter: send ping to all connected clients every 30s
function startBackendPingEmitter() {
  setInterval(() => {
    try {
      const connectedClients = io.of('/').sockets.sockets;
      let pingCount = 0;
      
      for (const [socketId, socket] of connectedClients) {
        socket.emit('ping');
        pingCount++;
      }
      
      if (pingCount > 0) {
        console.log(`[HEARTBEAT] Sent ping to ${pingCount} connected client(s)`);
      }
    } catch (err) {
      console.error('[HEARTBEAT] Error sending pings:', err);
    }
  }, 30000); // Every 30 seconds
  
  console.log('[HEARTBEAT] Backend ping emitter started (30s interval)');
}

// Start health check and ping emitter after initialization
setTimeout(() => {
  startHealthCheckHeartbeat();
  startBackendPingEmitter();
}, 2000);

// Export io instance and userSockets mapping for use in controllers
socketManager.setSocketIO(io, userSocketsMultiple, voiceRooms);

module.exports = { httpServer, io, userSockets, userSocketsMultiple };

// Global error handler - catch all errors and return JSON
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR]', err);
  res.status(500).json({ 
    channel: null,
    error: err.message || 'Internal server error',
    message: err.message || 'Internal server error'
  });
});

// Required for mobile emulation

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] HTTP/Socket.IO server listening on port ${PORT}`);
});
