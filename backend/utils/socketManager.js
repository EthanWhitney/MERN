let io = null;
let userSocketsMultiple = null;
let voiceRoomsRef = null;

const setSocketIO = (ioInstance, userSocketsMultipleMap, voiceRooms) => {
  io = ioInstance;
  userSocketsMultiple = userSocketsMultipleMap;
  voiceRoomsRef = voiceRooms;
};

const getIO = () => io;

const getUserSocketIds = (userId) => {
  return userSocketsMultiple?.get(userId.toString());
};

const isUserOnline = (userId) => {
  const sockets = getUserSocketIds(userId);
  return sockets ? sockets.size > 0 : false;
};

const emitToUser = (userId, event, data) => {
  const socketSet = getUserSocketIds(userId);
  if (socketSet && socketSet.size > 0 && io) {
    socketSet.forEach(socketId => {
      io.to(socketId).emit(event, data);
    });
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
  if (!friends || friends.length === 0) return;
  friends.forEach(friendId => {
    emitToUser(friendId, 'user-online', { userId, username: userId });
  });
};

const notifyUserOffline = (userId, friends) => {
  if (!friends || friends.length === 0) return;
  friends.forEach(friendId => {
    emitToUser(friendId, 'user-offline', { userId, username: userId });
  });
};


const broadcastMessageToServerChannel = (serverId, channelId, message) => {
  const roomId = `server-${serverId}-channel-${channelId}`;
  if (io) {
    io.to(roomId).emit('receive-message', message);
  }
};

const getVoiceRoomMembers = (channelId) => {
  if (!voiceRoomsRef || !voiceRoomsRef[channelId]) return [];
  const members = [];
  voiceRoomsRef[channelId].forEach((userId, socketId) => {
    members.push({ socketId, userId });
  });
  return members;
};

const broadcastToVoiceChannel = (channelId, event, data) => {
  if (io) {
    io.to(channelId).emit(event, data);
  }
};

module.exports = {
  setSocketIO,
  getIO,
  getUserSocketIds,
  isUserOnline,
  emitToUser,
  notifyFriendRequest,
  notifyFriendRequestAccepted,
  notifyFriendRequestDeclined,
  notifyUserOnline,
  notifyUserOffline,
  broadcastMessageToServerChannel,
  getVoiceRoomMembers,
  broadcastToVoiceChannel,
};