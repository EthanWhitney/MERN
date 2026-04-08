// Socket.IO manager for emitting friend request events
let io = null;
let userSockets = null;

const setSocketIO = (ioInstance, userSocketsMap) => {
  io = ioInstance;
  userSockets = userSocketsMap;
};

const getIO = () => io;

const getUserSocketId = (userId) => {
  return userSockets?.get(userId);
};

const emitToUser = (userId, event, data) => {
  const socketId = getUserSocketId(userId);
  console.log(`[socketManager] Attempting to emit ${event} to user ${userId}`);
  console.log(`[socketManager] Socket ID found: ${socketId ? 'YES' : 'NO'}`);
  console.log(`[socketManager] Current userSockets mapping:`, Array.from(userSockets?.entries() || []));
  if (socketId && io) {
    io.to(socketId).emit(event, data);
    console.log(`[socketManager] Successfully emitted ${event} to user ${userId} (socket: ${socketId})`);
  } else {
    console.log(`[socketManager] FAILED to emit ${event}: userId ${userId} not found in userSockets Map`);
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

module.exports = {
  setSocketIO,
  getIO,
  getUserSocketId,
  emitToUser,
  notifyFriendRequest,
  notifyFriendRequestAccepted,
  notifyFriendRequestDeclined
};
