// Socket.IO manager for emitting friend request events
let io = null;
let userSocketsMultiple = null;

const setSocketIO = (ioInstance, userSocketsMultipleMap) => {
  io = ioInstance;
  userSocketsMultiple = userSocketsMultipleMap;
};

const getIO = () => io;

const getUserSocketIds = (userId) => {
  return userSocketsMultiple?.get(userId);
};

const emitToUser = (userId, event, data) => {
  const socketSet = getUserSocketIds(userId);
  console.log(`[socketManager] Attempting to emit ${event} to user ${userId}`);
  console.log(`[socketManager] Socket IDs found: ${socketSet ? socketSet.size : 0}`);
  
  if (socketSet && socketSet.size > 0 && io) {
    console.log(`[socketManager] emitToUser - targeting user ${userId} with ${socketSet.size} socket(s) for event: ${event}`);
    socketSet.forEach(socketId => {
      io.to(socketId).emit(event, data);
      console.log(`[socketManager] ✅ Emitted ${event} to socket ${socketId} for user ${userId}, data:`, data);
    });
  } else {
    console.log(`[socketManager] ❌ FAILED to emit ${event}: userId ${userId} has no active sockets`);
  }
};

const notifyFriendRequest = (recipientId, data) => {
  emitToUser(recipientId, 'friend-request-received', data);
};

const notifyFriendRequestAccepted = (userId, data) => {
  emitToUser(userId, 'friend-request-accepted', data);
};

const notifyFriendRequestDeclined = (userId, data) => {
  emitToUser(userId, 'friend-request-declined', data);
};

const notifyUserOnline = (userId, friends) => {
  // Notify all friends that this user is now online
  if (!friends || friends.length === 0) return;
  
  friends.forEach(friendId => {
    emitToUser(friendId, 'user-online', { userId, username: userId });
  });
};

const notifyUserOffline = (userId, friends) => {
  // Notify all friends that this user is now offline
  if (!friends || friends.length === 0) return;
  
  friends.forEach(friendId => {
    emitToUser(friendId, 'user-offline', { userId, username: userId });
  });
};

module.exports = {
  setSocketIO,
  getIO,
  emitToUser,
  notifyFriendRequest,
  notifyFriendRequestAccepted,
  notifyFriendRequestDeclined,
  notifyUserOnline,
  notifyUserOffline
};
