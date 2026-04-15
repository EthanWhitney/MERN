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

const notifyFriendRemoved = (userId, data) => {
  emitToUser(userId, 'friend-removed', data);
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
  console.log('[socketManager] broadcastMessageToServerChannel:', roomId, 'message:', message._id);
  if (io) {
    io.to(roomId).emit('receive-message', message);
  } else {
    console.warn('[socketManager] io not initialized');
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

/**
 * Emit an event to all members of a server (direct user targeting, not room-based)
 * @param {object} db - MongoDB database instance
 * @param {string} serverId - Server ID
 * @param {string} event - Event name (e.g., 'member-online', 'member-joined-server')
 * @param {object} data - Event data
 * @param {string} excludeUserId - Optional user ID to exclude from emission
 */
const emitToServerMembers = async (db, serverId, event, data, excludeUserId = null) => {
  if (!io || !db) {
    console.warn('[socketManager] emitToServerMembers: io or db not available');
    return;
  }

  try {
    // Get all members of the server
    const server = await db.collection('servers').findOne(
      { _id: serverId },
      { projection: { members: 1 } }
    );

    if (!server || !server.members) {
      console.warn('[socketManager] Server not found or has no members:', serverId);
      return;
    }

    let emitCount = 0;
    // Emit to each member's sockets
    server.members.forEach(memberId => {
      // Skip the excluded user (usually the user who triggered the event)
      if (excludeUserId && memberId.toString() === excludeUserId.toString()) {
        return;
      }

      const socketSet = userSocketsMultiple?.get(memberId.toString());
      if (socketSet && socketSet.size > 0) {
        socketSet.forEach(socketId => {
          io.to(socketId).emit(event, data);
          emitCount++;
        });
      }
    });

    console.log(`[socketManager] ${event} emitted to ${emitCount} socket(s) for server ${serverId}`);
  } catch (err) {
    console.error(`[socketManager] Error in emitToServerMembers:`, err);
  }
};

// Emit to server members AND queue events for offline members (for critical events)
const emitToServerMembersWithQueue = async (db, serverId, event, data, excludeUserId) => {
  try {
    // Get all members of the server
    const server = await db.collection('servers').findOne(
      { _id: serverId },
      { projection: { members: 1 } }
    );

    if (!server || !server.members) {
      console.warn('[socketManager] Server not found or has no members:', serverId);
      return;
    }

    let emitCount = 0;
    // Emit to each member's sockets and queue for offline members
    for (const memberId of server.members) {
      // Skip the excluded user (usually the user who triggered the event)
      if (excludeUserId && memberId.toString() === excludeUserId.toString()) {
        continue;
      }

      const socketSet = userSocketsMultiple?.get(memberId.toString());
      const isOnline = socketSet && socketSet.size > 0;
      
      if (isOnline) {
        // User is online - emit directly
        socketSet.forEach(socketId => {
          io.to(socketId).emit(event, data);
          emitCount++;
        });
      } else {
        // User is offline - queue the event for replay on reconnect
        await queueEventForUser(db, memberId, event, data);
      }
    }

    console.log(`[socketManager] ${event} emitted to ${emitCount} online socket(s) and queued for offline members in server ${serverId}`);
  } catch (err) {
    console.error(`[socketManager] Error in emitToServerMembersWithQueue:`, err);
  }
};

const broadcastMemberJoinedServer = async (db, serverId, memberData) => {
  // Use queuing version for member-joined (critical event)
  await emitToServerMembersWithQueue(db, serverId, 'member-joined-server', memberData);
};

const broadcastMemberLeftServer = async (db, serverId, userId) => {
  // Use queuing version for member-left (critical event)
  await emitToServerMembersWithQueue(db, serverId, 'member-left-server', { userId }, userId);
};

const broadcastMemberOnline = async (db, serverId, userId) => {
  // Use queuing version for member-online (critical event)
  await emitToServerMembersWithQueue(db, serverId, 'member-online', { userId }, userId);
};

const broadcastMemberOffline = async (db, serverId, userId) => {
  // Use queuing version for member-offline (critical event)
  await emitToServerMembersWithQueue(db, serverId, 'member-offline', { userId }, userId);
};

// ========== PHASE 1.3: Event Queue Functions ==========
// Queue an event for a user (for persistence across reconnections)
const queueEventForUser = async (db, userId, eventName, eventData) => {
  try {
    await db.collection('pendingEvents').insertOne({
      userId: userId,
      eventName: eventName,
      eventData: eventData,
      createdAt: new Date()
    });
    console.log(`[socketManager] Queued event ${eventName} for user ${userId}`);
  } catch (err) {
    console.error('[socketManager] Error queueing event:', err);
  }
};

// Retrieve and clear pending events for a user
const getPendingEventsForUser = async (db, userId) => {
  try {
    const pendingEvents = await db.collection('pendingEvents')
      .find({ userId: userId })
      .toArray();
    
    if (pendingEvents.length > 0) {
      // Delete the retrieved events
      await db.collection('pendingEvents').deleteMany({ userId: userId });
      console.log(`[socketManager] Retrieved ${pendingEvents.length} pending events for user ${userId}`);
    }
    
    return pendingEvents;
  } catch (err) {
    console.error('[socketManager] Error retrieving pending events:', err);
    return [];
  }
};

// ========== PHASE 5.1: Profile & Account Change Broadcasting ==========

/**
 * Broadcast profile picture change to all friends and server members
 */
const broadcastProfilePictureChanged = async (db, userId, newAvatarUrl) => {
  try {
    if (!db) {
      console.warn('[socketManager] broadcastProfilePictureChanged: db not available');
      return;
    }

    const userObjId = new (require('mongodb')).ObjectId(userId);
    
    // Get user's friends
    const user = await db.collection('users').findOne(
      { _id: userObjId },
      { projection: { friends: 1, servers: 1, username: 1 } }
    );

    if (!user) return;

    const timestamp = new Date().toISOString();
    const eventData = {
      userId: userId.toString(),
      newAvatarUrl,
      timestamp
    };

    // Broadcast to all friends
    if (user.friends && user.friends.length > 0) {
      user.friends.forEach(friendId => {
        emitToUser(friendId.toString(), 'profile-picture-changed', eventData);
      });
      console.log(`[socketManager] profile-picture-changed broadcast to ${user.friends.length} friend(s)`);
    }

    // Broadcast to all servers where user is member
    if (user.servers && user.servers.length > 0) {
      for (const serverId of user.servers) {
        await emitToServerMembers(db, serverId, 'profile-picture-changed', eventData, userId);
      }
    }
  } catch (err) {
    console.error('[socketManager] Error in broadcastProfilePictureChanged:', err);
  }
};

/**
 * Broadcast server profile update (name/avatar in specific server)
 */
const broadcastServerProfileUpdated = async (db, serverId, userId, updates) => {
  try {
    if (!db) {
      console.warn('[socketManager] broadcastServerProfileUpdated: db not available');
      return;
    }

    const timestamp = new Date().toISOString();
    const eventData = {
      userId: userId.toString(),
      serverId: serverId.toString(),
      ...updates,
      timestamp
    };

    await emitToServerMembers(db, serverId, 'server-profile-updated', eventData);
    console.log(`[socketManager] server-profile-updated broadcast to server ${serverId}`);
  } catch (err) {
    console.error('[socketManager] Error in broadcastServerProfileUpdated:', err);
  }
};

/**
 * Broadcast member voice state change (mute/deafen)
 */
const broadcastMemberVoiceStateChanged = async (db, serverId, userId, voiceState) => {
  try {
    if (!db) {
      console.warn('[socketManager] broadcastMemberVoiceStateChanged: db not available');
      return;
    }

    const timestamp = new Date().toISOString();
    const eventData = {
      userId: userId.toString(),
      serverId: serverId.toString(),
      isMuted: voiceState.isMuted,
      isDeafened: voiceState.isDeafened,
      timestamp
    };

    await emitToServerMembers(db, serverId, 'member-voice-state-changed', eventData);
    console.log(`[socketManager] member-voice-state-changed broadcast to server ${serverId}`);
  } catch (err) {
    console.error('[socketManager] Error in broadcastMemberVoiceStateChanged:', err);
  }
};

/**
 * Broadcast user account deletion to all friends and servers
 */
const broadcastUserAccountDeleted = async (db, userId) => {
  try {
    if (!db || !io) {
      console.warn('[socketManager] broadcastUserAccountDeleted: db or io not available');
      return;
    }

    const userObjId = new (require('mongodb')).ObjectId(userId);
    
    // Get user's friends and servers before deletion
    const user = await db.collection('users').findOne(
      { _id: userObjId },
      { projection: { friends: 1, servers: 1, username: 1 } }
    );

    if (!user) return;

    const timestamp = new Date().toISOString();
    const eventData = {
      userId: userId.toString(),
      username: user.username,
      timestamp
    };

    // Broadcast to all friends
    if (user.friends && user.friends.length > 0) {
      user.friends.forEach(friendId => {
        emitToUser(friendId.toString(), 'user-account-deleted', eventData);
      });
      console.log(`[socketManager] user-account-deleted broadcast to ${user.friends.length} friend(s)`);
    }

    // Broadcast to all servers
    if (user.servers && user.servers.length > 0) {
      for (const serverId of user.servers) {
        await emitToServerMembers(db, serverId, 'user-account-deleted', eventData);
      }
    }
  } catch (err) {
    console.error('[socketManager] Error in broadcastUserAccountDeleted:', err);
  }
};

/**
 * Broadcast user came online to all friends and server members
 */
const broadcastUserOnline = async (db, userId) => {
  try {
    if (!db || !io) {
      console.warn('[socketManager] broadcastUserOnline: db or io not available');
      return;
    }

    const userObjId = new (require('mongodb')).ObjectId(userId);
    
    // Get user's friends, servers, and username
    const user = await db.collection('users').findOne(
      { _id: userObjId },
      { projection: { friends: 1, servers: 1, username: 1 } }
    );

    if (!user) return;

    const timestamp = new Date().toISOString();
    const eventData = {
      userId: userId.toString(),
      username: user.username,
      timestamp
    };

    // Broadcast to all friends
    if (user.friends && user.friends.length > 0) {
      user.friends.forEach(friendId => {
        emitToUser(friendId.toString(), 'user-online', eventData);
      });
      console.log(`[socketManager] user-online broadcast to ${user.friends.length} friend(s)`);
    }

    // Broadcast to all server members
    if (user.servers && user.servers.length > 0) {
      for (const serverId of user.servers) {
        await emitToServerMembers(db, serverId, 'member-online', { userId: userId.toString() });
      }
    }
  } catch (err) {
    console.error('[socketManager] Error in broadcastUserOnline:', err);
  }
};

/**
 * Broadcast user went offline to all friends and server members
 */
const broadcastUserOffline = async (db, userId) => {
  try {
    if (!db || !io) {
      console.warn('[socketManager] broadcastUserOffline: db or io not available');
      return;
    }

    const userObjId = new (require('mongodb')).ObjectId(userId);
    
    // Get user's friends, servers, and username
    const user = await db.collection('users').findOne(
      { _id: userObjId },
      { projection: { friends: 1, servers: 1, username: 1 } }
    );

    if (!user) return;

    const timestamp = new Date().toISOString();
    const eventData = {
      userId: userId.toString(),
      username: user.username,
      timestamp
    };

    // Broadcast to all friends
    if (user.friends && user.friends.length > 0) {
      user.friends.forEach(friendId => {
        emitToUser(friendId.toString(), 'user-offline', eventData);
      });
      console.log(`[socketManager] user-offline broadcast to ${user.friends.length} friend(s)`);
    }

    // Broadcast to all server members
    if (user.servers && user.servers.length > 0) {
      for (const serverId of user.servers) {
        await emitToServerMembers(db, serverId, 'member-offline', { userId: userId.toString() });
      }
    }
  } catch (err) {
    console.error('[socketManager] Error in broadcastUserOffline:', err);
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
  notifyFriendRemoved,
  notifyUserOnline,
  notifyUserOffline,
  broadcastMessageToServerChannel,
  getVoiceRoomMembers,
  broadcastToVoiceChannel,
  emitToServerMembers,
  broadcastMemberJoinedServer,
  broadcastMemberLeftServer,
  broadcastMemberOnline,
  broadcastMemberOffline,
  queueEventForUser,
  getPendingEventsForUser,
  broadcastProfilePictureChanged,
  broadcastServerProfileUpdated,
  broadcastMemberVoiceStateChanged,
  broadcastUserAccountDeleted,
  broadcastUserOnline,
  broadcastUserOffline,
};