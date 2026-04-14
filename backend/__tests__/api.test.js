const request = require('supertest');
const { MongoClient, ObjectId } = require('mongodb');

let app;
let httpServer;
beforeAll(() => {
  const mod = require('../server');
  httpServer = mod.httpServer;
  app = httpServer; 
});

afterAll((done) => {
  httpServer.close(done);
});

const BASE = '/api';
let aliceId, bobId, serverId, roleId, vcId, tcId, msgId;

const ALICE_ID = '69cdc4f5f5a8150ba1dbe97d';
const BOB_ID   = '69cdc50af5a8150ba1dbe97f';

describe('Auth', () => {
  test('POST /api/auth/login - valid credentials return userId', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ emailOrUsername: 'testuser', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBeDefined();
    expect(res.body.error).toBe('');
  });

  test('POST /api/auth/login - wrong password returns 401', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ emailOrUsername: 'testuser', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.userId).toBeNull();
  });

  test('POST /api/auth/login - missing fields returns 400', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ emailOrUsername: 'testuser' });
    expect(res.status).toBe(400);
  });
});

describe('Friends', () => {
  test('POST /api/users/:userId/friends/:friendId - add friend', async () => {
    const res = await request(app)
      .post(`${BASE}/users/${ALICE_ID}/friends/${BOB_ID}`);
    expect([200, 409]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.friends).toBeDefined();
      expect(res.body.error).toBe('');
    }
  });

  test('GET /api/users/:userId/friends - returns friends list', async () => {
    const res = await request(app)
      .get(`${BASE}/users/${ALICE_ID}/friends`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.friends)).toBe(true);
    expect(res.body.error).toBe('');
  });

  test('GET /api/users/:userId/friends - Bob also sees Alice (bidirectional)', async () => {
    const res = await request(app)
      .get(`${BASE}/users/${BOB_ID}/friends`);
    expect(res.status).toBe(200);
    const ids = res.body.friends.map((f) => f._id.toString());
    expect(ids).toContain(ALICE_ID);
  });

  test('DELETE /api/users/:userId/friends/:friendId - remove friend', async () => {
    const res = await request(app)
      .delete(`${BASE}/users/${ALICE_ID}/friends/${BOB_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.error).toBe('');
  });

  test('GET /api/users/:userId/friends - empty after removal', async () => {
    const res = await request(app)
      .get(`${BASE}/users/${ALICE_ID}/friends`);
    expect(res.status).toBe(200);
    const ids = res.body.friends.map((f) => f._id.toString());
    expect(ids).not.toContain(BOB_ID);
  });

  test('POST - cannot add yourself', async () => {
    const res = await request(app)
      .post(`${BASE}/users/${ALICE_ID}/friends/${ALICE_ID}`);
    expect(res.status).toBe(400);
  });
});

describe('Server Management', () => {
  test('POST /api/servers - create server', async () => {
    const res = await request(app)
      .post(`${BASE}/servers`)
      .send({ serverName: 'Test Server', ownerId: ALICE_ID });
    expect(res.status).toBe(201);
    expect(res.body.server).toBeDefined();
    expect(res.body.error).toBe('');
    serverId = res.body.server._id;
  });

  test('POST /api/servers - missing serverName returns 400', async () => {
    const res = await request(app)
      .post(`${BASE}/servers`)
      .send({ ownerId: ALICE_ID });
    expect(res.status).toBe(400);
  });

  test('GET /api/servers/:serverId - get server', async () => {
    const res = await request(app).get(`${BASE}/servers/${serverId}`);
    expect(res.status).toBe(200);
    expect(res.body.server.serverName).toBe('Test Server');
    expect(res.body.error).toBe('');
  });

  test('GET /api/servers/:serverId - invalid id returns 400', async () => {
    const res = await request(app).get(`${BASE}/servers/notanid`);
    expect(res.status).toBe(400);
  });

  test('PATCH /api/servers/:serverId - update server name', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}`)
      .send({ serverName: 'Updated Server' });
    expect(res.status).toBe(200);
    expect(res.body.server.serverName).toBe('Updated Server');
  });

  test('GET /api/users/:userId/servers - returns user servers', async () => {
    const res = await request(app).get(`${BASE}/users/${ALICE_ID}/servers`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.servers)).toBe(true);
    const ids = res.body.servers.map((s) => s._id.toString());
    expect(ids).toContain(serverId.toString());
  });
});

describe('Server Membership', () => {
  test('POST /api/servers/:serverId/join - Bob joins', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/join`)
      .send({ userId: BOB_ID });
    expect([201, 409]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.serverProfile).toBeDefined();
    }
  });

  test('GET /api/servers/:serverId/members - lists members', async () => {
    const res = await request(app).get(`${BASE}/servers/${serverId}/members`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.members)).toBe(true);
    const userIds = res.body.members.map((m) => m.userId.toString());
    expect(userIds).toContain(BOB_ID);
  });

  test('PATCH /api/servers/:serverId/profile/:userId - update nickname', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/profile/${BOB_ID}`)
      .send({ serverSpecificName: 'Bobby' });
    expect(res.status).toBe(200);
    expect(res.body.serverProfile.serverSpecificName).toBe('Bobby');
  });
});

describe('Server Roles', () => {
  test('POST /api/servers/:serverId/roles - create role', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/roles`)
      .send({ roleName: 'Moderator', roleColor: '#e74c3c' });
    expect(res.status).toBe(201);
    expect(res.body.role.roleName).toBe('Moderator');
    roleId = res.body.role._id;
  });

  test('GET /api/servers/:serverId/roles - list roles', async () => {
    const res = await request(app).get(`${BASE}/servers/${serverId}/roles`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.roles)).toBe(true);
    const names = res.body.roles.map((r) => r.roleName);
    expect(names).toContain('Moderator');
  });

  test('POST .../members/:userId/roles/:roleId - assign role', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/members/${BOB_ID}/roles/${roleId}`);
    expect(res.status).toBe(200);
    const roleIds = res.body.serverProfile.roles.map((r) => r.toString());
    expect(roleIds).toContain(roleId.toString());
  });

  test('PATCH /api/servers/:serverId/roles/:roleId - update role', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/roles/${roleId}`)
      .send({ roleName: 'Admin' });
    expect(res.status).toBe(200);
    expect(res.body.role.roleName).toBe('Admin');
  });

  test('DELETE .../members/:userId/roles/:roleId - remove role', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/members/${BOB_ID}/roles/${roleId}`);
    expect(res.status).toBe(200);
    const roleIds = res.body.serverProfile.roles.map((r) => r.toString());
    expect(roleIds).not.toContain(roleId.toString());
  });

  test('DELETE /api/servers/:serverId/roles/:roleId - delete role', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/roles/${roleId}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });
});

describe('Voice Channels', () => {
  test('POST /api/servers/:serverId/voiceChannels - create', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/voiceChannels`)
      .send({ channelName: 'General Voice' });
    expect(res.status).toBe(201);
    expect(res.body.channel.channelName).toBe('General Voice');
    vcId = res.body.channel._id;
  });

  test('GET /api/servers/:serverId/voiceChannels - list', async () => {
    const res = await request(app).get(`${BASE}/servers/${serverId}/voiceChannels`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.channels)).toBe(true);
  });

  test('POST .../voiceChannels/:channelId/join - Alice joins', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/voiceChannels/${vcId}/join`)
      .send({ userId: ALICE_ID });
    expect(res.status).toBe(200);
    const members = res.body.channel.activeMembers.map((m) => m.toString());
    expect(members).toContain(ALICE_ID);
  });

  test('DELETE .../voiceChannels/:channelId/leave - Alice leaves', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/voiceChannels/${vcId}/leave`)
      .send({ userId: ALICE_ID });
    expect(res.status).toBe(200);
    expect(res.body.error).toBe('');
  });

  test('PATCH .../voiceChannels/:channelId - update name', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/voiceChannels/${vcId}`)
      .send({ channelName: 'Updated Voice' });
    expect(res.status).toBe(200);
    expect(res.body.channel.channelName).toBe('Updated Voice');
  });

  test('DELETE .../voiceChannels/:channelId - delete', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/voiceChannels/${vcId}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });
});

describe('Cleanup', () => {
  test('DELETE /api/servers/:serverId/leave - Bob leaves', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/leave`)
      .send({ userId: BOB_ID });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/servers/:serverId - delete server', async () => {
    const res = await request(app).delete(`${BASE}/servers/${serverId}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });
});

describe('Text Channels', () => {
  test('POST /api/servers/:serverId/textChannels - create text channel', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/textChannels`)
      .send({ channelName: 'general-chat' });
    expect(res.status).toBe(201);
    expect(res.body.channel.channelName).toBe('general-chat');
    tcId = res.body.channel._id;
  });

  test('GET /api/servers/:serverId/textChannels - list text channels', async () => {
    const res = await request(app).get(`${BASE}/servers/${serverId}/textChannels`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.channels)).toBe(true);
  });

  test('PATCH /api/servers/:serverId/textChannels/:channelId - update channel', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/textChannels/${tcId}`)
      .send({ topic: 'General discussion' });
    expect(res.status).toBe(200);
    expect(res.body.channel.topic).toBe('General discussion');
  });
});

describe('Messages', () => {
  test('POST /api/servers/:serverId/textChannels/:channelId/messages - send message', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/textChannels/${tcId}/messages`)
      .send({ userId: ALICE_ID, content: 'Hello world!' });
    expect(res.status).toBe(201);
    expect(res.body.message.content).toBe('Hello world!');
    msgId = res.body.message._id;
  });

  test('GET /api/servers/:serverId/textChannels/:channelId/messages - get messages', async () => {
    const res = await request(app)
      .get(`${BASE}/servers/${serverId}/textChannels/${tcId}/messages?limit=50`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  test('PATCH /api/servers/:serverId/textChannels/:channelId/messages/:messageId - edit msg', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/textChannels/${tcId}/messages/${msgId}`)
      .send({ content: 'Hello world! (edited)' });
    expect(res.status).toBe(200);
    expect(res.body.message.content).toContain('(edited)');
  });

  test('DELETE /api/servers/:serverId/textChannels/:channelId/messages/:messageId - delete msg', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/textChannels/${tcId}/messages/${msgId}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });
});

describe('Moderation Settings', () => {
  test('PATCH /api/servers/:serverId/members/:userId/mute - mute user', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/members/${BOB_ID}/mute`)
      .send({ isMuted: true });
    expect(res.status).toBe(200);
  });

  test('PATCH /api/servers/:serverId/members/:userId/timeout - timeout user', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/members/${BOB_ID}/timeout`)
      .send({ isTimedOut: true, duration: 60 });
    expect(res.status).toBe(200);
  });
});