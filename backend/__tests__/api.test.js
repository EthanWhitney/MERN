const request = require('supertest');
const { MongoClient } = require('mongodb');

let app, httpServer;

beforeAll(() => {
  const mod = require('../server');
  httpServer = mod.httpServer;
  app = httpServer; 
});

afterAll((done) => {
  httpServer.close(done);
});

const BASE = '/api';

let token;
let aliceId; 
const BOB_ID = '69cdc50af5a8150ba1dbe97f'; 
let serverId, roleId, tcId, vcId, msgId;

const timestamp = Date.now();
const uniqueEmail = `ryan_${timestamp}@syncord.space`;
const uniqueUsername = `TestUser_${timestamp}`; 
const testPassword = 'password123';

describe('Auth & User Management', () => {
  test('1. POST /api/auth/register - Register User', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/register`)
      .send({ email: uniqueEmail, username: uniqueUsername, password: testPassword });
    expect([201, 409]).toContain(res.status); 
  });

  test('Force Verify Test User in Database', async () => {
    const dbUrl = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
    const client = new MongoClient(dbUrl);
    await client.connect();
    const db = client.db('discord_clone');
    
    const unverified = await db.collection('unverifiedUsers').findOne({ email: uniqueEmail });
    if (unverified) {
      const newUser = {
        email: unverified.email,
        username: unverified.username,
        hashedPassword: unverified.hashedPassword,
        profilePicture: '',
        servers: [],
        friends: [],
        active: true,
        createdAt: unverified.createdAt
      };
      await db.collection('users').insertOne(newUser);
      await db.collection('unverifiedUsers').deleteOne({ email: uniqueEmail });
    }
    await client.close();
  });

  test('2. POST /api/auth/login - Login User', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ emailOrUsername: uniqueEmail, password: testPassword });
    
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    
    token = res.body.accessToken; 
    aliceId = res.body.userId;
  });

    test('3. GET /api/users/:userId - Get User Profile', async () => {
        const res = await request(app)
        .post(`${BASE}/auth/getUserProfile`) 
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: aliceId }); 
        expect(res.status).toBe(200);
    });

});

describe('Friends Management', () => {
  test('5. POST /api/users/friends/:friendId - Add Friend', async () => {
    const res = await request(app)
      .post(`${BASE}/users/friends/${BOB_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 400, 409]).toContain(res.status);
  });

  test('7. GET /api/users/friends - Get Friends List', async () => {
    const res = await request(app)
      .get(`${BASE}/users/friends`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('6. DELETE /api/users/friends/:friendId - Remove Friend', async () => {
    const res = await request(app)
      .delete(`${BASE}/users/friends/${BOB_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Server Management', () => {
  test('8. POST /api/servers - Create Server', async () => {
    const res = await request(app)
      .post(`${BASE}/servers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serverName: `Syncord Test Server_${timestamp}`, serverOwnerUserID: aliceId });
    expect(res.status).toBe(201);
    serverId = res.body.server._id;
  });

  test('9. GET /api/servers/:serverId - Get Server', async () => {
    const res = await request(app)
      .get(`${BASE}/servers/${serverId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('10. PATCH /api/servers/:serverId - Update Server', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serverName: 'Updated Syncord Server' });
    expect(res.status).toBe(200);
  });

  test('12. GET /api/users/servers - Get User\'s Servers', async () => {
    const res = await request(app)
      .get(`${BASE}/users/servers`) 
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Server Membership', () => {
  test('13. POST /api/servers/:serverId/join - Join Server', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: BOB_ID });
    expect([201, 409]).toContain(res.status);
  });

  test('15. GET /api/servers/:serverId/members - Get Server Members', async () => {
    const res = await request(app)
      .get(`${BASE}/servers/${serverId}/members`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('16. PATCH /api/servers/:serverId/profile/:userId - Update Server Profile', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/profile/${BOB_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serverSpecificName: 'BobTheBuilder' });
    expect(res.status).toBe(200);
  });
});

// ── 5. SERVER ROLES ────────────────────────────────────────────────────────────
describe('Server Roles', () => {
  test('19. POST /api/servers/:serverId/roles - Create Role', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleName: 'Admin', roleColor: '#ff0000' });
    expect(res.status).toBe(201);
    roleId = res.body.role._id;
  });

  test('22. GET /api/servers/:serverId/roles - Get Server Roles', async () => {
    const res = await request(app)
      .get(`${BASE}/servers/${serverId}/roles`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('20. PATCH /api/servers/:serverId/roles/:roleId - Update Role', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/roles/${roleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleName: 'Super Admin' });
    expect(res.status).toBe(200);
  });

  test('17. POST /api/servers/:serverId/members/:userId/roles/:roleId - Assign Role', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/members/${BOB_ID}/roles/${roleId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('18. DELETE /api/servers/:serverId/members/:userId/roles/:roleId - Remove Role', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/members/${BOB_ID}/roles/${roleId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('21. DELETE /api/servers/:serverId/roles/:roleId - Delete Role', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/roles/${roleId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Text Channels', () => {
  test('23. POST /api/servers/:serverId/textChannels - Create Text Channel', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/textChannels`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channelName: 'announcements' });
    expect(res.status).toBe(201);
    tcId = res.body.textChannel._id;
  });

  test('24. GET /api/servers/:serverId/textChannels - Get Text Channels', async () => {
    const res = await request(app)
      .get(`${BASE}/servers/${serverId}/textChannels`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('25. PATCH /api/servers/:serverId/textChannels/:channelId - Update Text Channel', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/textChannels/${tcId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'Important server news' });
    expect(res.status).toBe(200);
  });
});

describe('Voice Channels', () => {
  test('27. POST /api/servers/:serverId/voiceChannels - Create Voice Channel', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/voiceChannels`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channelName: 'Gaming Lounge' });
    expect(res.status).toBe(201);
    vcId = res.body.channel._id;
  });

  test('28. GET /api/servers/:serverId/voiceChannels - Get Voice Channels', async () => {
    const res = await request(app)
      .get(`${BASE}/servers/${serverId}/voiceChannels`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('29. PATCH /api/servers/:serverId/voiceChannels/:channelId - Update Voice Channel', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/voiceChannels/${vcId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channelName: 'AFK Lounge' });
    expect(res.status).toBe(200);
  });

  test('31. POST /api/servers/:serverId/voiceChannels/:channelId/join - Join Voice Channel', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/voiceChannels/${vcId}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: aliceId });
    expect(res.status).toBe(200);
  });

  test('32. DELETE /api/servers/:serverId/voiceChannels/:channelId/leave - Leave Voice Channel', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/voiceChannels/${vcId}/leave`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: aliceId });
    expect(res.status).toBe(200);
  });
});

describe('Messages', () => {
  test('33. POST /api/servers/:serverId/textChannels/:channelId/messages - Send Message', async () => {
    const res = await request(app)
      .post(`${BASE}/servers/${serverId}/textChannels/${tcId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: aliceId, content: 'First message!' });
    expect(res.status).toBe(201);
    msgId = res.body.message._id;
  });

  test('34. GET /api/servers/:serverId/textChannels/:channelId/messages - Get Channel Messages', async () => {
    const res = await request(app)
      .get(`${BASE}/servers/${serverId}/textChannels/${tcId}/messages?limit=50`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('35. PATCH /api/servers/:serverId/textChannels/:channelId/messages/:messageId - Update Message', async () => {
    const res = await request(app)
      .patch(`${BASE}/servers/${serverId}/textChannels/${tcId}/messages/${msgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'First message! (edited)' });
    expect(res.status).toBe(200);
  });
});

describe('Cleanup & Teardown', () => {
  test('36. DELETE /api/servers/:serverId/textChannels/:channelId/messages/:messageId - Delete Message', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/textChannels/${tcId}/messages/${msgId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('26. DELETE /api/servers/:serverId/textChannels/:channelId - Delete Text Channel', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/textChannels/${tcId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('30. DELETE /api/servers/:serverId/voiceChannels/:channelId - Delete Voice Channel', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/voiceChannels/${vcId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('14. DELETE /api/servers/:serverId/leave - Leave Server', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}/leave`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: BOB_ID });
    expect(res.status).toBe(200);
  });

  test('11. DELETE /api/servers/:serverId - Delete Server', async () => {
    const res = await request(app)
      .delete(`${BASE}/servers/${serverId}`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 403]).toContain(res.status);
  });
});