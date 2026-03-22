# Discord Clone API Functions

## Authentication & User Management

### 1. **Register User**
- **POST** `/api/auth/register`
- **Purpose**: Create a new user account
- **Payload**: `{ email, username, password }`
- **Returns**: User ID, auth token

### 2. **Login User**
- **POST** `/api/auth/login`
- **Purpose**: Authenticate user and return session token
- **Payload**: `{ email, password }`
- **Returns**: User ID, auth token, user profile

### 3. **Get User Profile**
- **GET** `/api/users/:userId`
- **Purpose**: Retrieve user profile information (email, username, profile picture)
- **Returns**: UserProfile object

### 4. **Update User Profile**
- **PATCH** `/api/users/:userId`
- **Purpose**: Update user profile data (username, profile picture)
- **Payload**: `{ username?, profilePicture? }`
- **Returns**: Updated UserProfile

---

## Friends Management

### 5. **Add Friend**
- **POST** `/api/users/:userId/friends/:friendId`
- **Purpose**: Send or accept a friend request between two users
- **Returns**: Updated friends list for user

### 6. **Remove Friend**
- **DELETE** `/api/users/:userId/friends/:friendId`
- **Purpose**: Remove a user from friends list
- **Returns**: Updated friends list

### 7. **Get Friends List**
- **GET** `/api/users/:userId/friends`
- **Purpose**: Retrieve all friends of a user
- **Returns**: Array of friend UserProfile objects

---

## Server Management

### 8. **Create Server**
- **POST** `/api/servers`
- **Purpose**: Create a new server
- **Payload**: `{ serverName, description? }`
- **Returns**: Server object with generated serverID

### 9. **Get Server**
- **GET** `/api/servers/:serverId`
- **Purpose**: Retrieve server information and member list
- **Returns**: Server object with profiles, channels, and roles

### 10. **Update Server**
- **PATCH** `/api/servers/:serverId`
- **Purpose**: Update server settings (name, icon, etc.)
- **Payload**: `{ serverName?, serverIcon?, description? }`
- **Returns**: Updated Server object

### 11. **Delete Server**
- **DELETE** `/api/servers/:serverId`
- **Purpose**: Delete a server (owner only)
- **Returns**: Confirmation message

### 12. **Get User's Servers**
- **GET** `/api/users/:userId/servers`
- **Purpose**: Retrieve all servers a user is a member of
- **Returns**: Array of Server objects

---

## Server Membership

### 13. **Join Server**
- **POST** `/api/servers/:serverId/join`
- **Purpose**: Add user to a server and create ServerProfile entry
- **Payload**: `{ userId }`
- **Returns**: New ServerProfile object

### 14. **Leave Server**
- **DELETE** `/api/servers/:serverId/leave`
- **Purpose**: Remove user from server and delete ServerProfile
- **Returns**: Confirmation message

### 15. **Get Server Members**
- **GET** `/api/servers/:serverId/members`
- **Purpose**: Retrieve all members/ServerProfiles in a server
- **Returns**: Array of ServerProfile objects

### 16. **Update Server Profile**
- **PATCH** `/api/servers/:serverId/profile/:userId`
- **Purpose**: Update user-specific server settings (nickname, muted status, etc.)
- **Payload**: `{ serverSpecificName?, isServerMuted?, isServerDeafened?, isTimedOut? }`
- **Returns**: Updated ServerProfile

### 17. **Assign Server Role to User**
- **POST** `/api/servers/:serverId/members/:userId/roles/:roleId`
- **Purpose**: Add a role to a server member
- **Returns**: Updated ServerProfile with new role

### 18. **Remove Server Role from User**
- **DELETE** `/api/servers/:serverId/members/:userId/roles/:roleId`
- **Purpose**: Remove a role from a server member
- **Returns**: Updated ServerProfile

---

## Server Roles

### 19. **Create Role**
- **POST** `/api/servers/:serverId/roles`
- **Purpose**: Create a new role within a server
- **Payload**: `{ roleName, roleColor, permissions? }`
- **Returns**: ServerRole object

### 20. **Update Role**
- **PATCH** `/api/servers/:serverId/roles/:roleId`
- **Purpose**: Update role properties (name, color, permissions)
- **Payload**: `{ roleName?, roleColor?, permissions? }`
- **Returns**: Updated ServerRole

### 21. **Delete Role**
- **DELETE** `/api/servers/:serverId/roles/:roleId`
- **Purpose**: Delete a role from server
- **Returns**: Confirmation message

### 22. **Get Server Roles**
- **GET** `/api/servers/:serverId/roles`
- **Purpose**: Retrieve all roles in a server
- **Returns**: Array of ServerRole objects

---

## Text Channels

### 23. **Create Text Channel**
- **POST** `/api/servers/:serverId/textChannels`
- **Purpose**: Create a new text channel in server
- **Payload**: `{ channelName, topic?, viewRoles?, textRoles? }`
- **Returns**: TextChannel object

### 24. **Get Text Channels**
- **GET** `/api/servers/:serverId/textChannels`
- **Purpose**: Retrieve all text channels in a server
- **Returns**: Array of TextChannel objects

### 25. **Update Text Channel**
- **PATCH** `/api/servers/:serverId/textChannels/:channelId`
- **Purpose**: Update channel settings (name, topic, permissions)
- **Payload**: `{ channelName?, topic?, viewRoles?, textRoles? }`
- **Returns**: Updated TextChannel

### 26. **Delete Text Channel**
- **DELETE** `/api/servers/:serverId/textChannels/:channelId`
- **Purpose**: Delete a text channel
- **Returns**: Confirmation message

---

## Voice Channels (Stretch Goal, don't know if we will make it to this)

### 27. **Create Voice Channel**
- **POST** `/api/servers/:serverId/voiceChannels`
- **Purpose**: Create a new voice channel in server
- **Payload**: `{ channelName, voiceRoles? }`
- **Returns**: VoiceChannel object

### 28. **Get Voice Channels**
- **GET** `/api/servers/:serverId/voiceChannels`
- **Purpose**: Retrieve all voice channels in a server
- **Returns**: Array of VoiceChannel objects

### 29. **Update Voice Channel**
- **PATCH** `/api/servers/:serverId/voiceChannels/:channelId`
- **Purpose**: Update voice channel settings
- **Payload**: `{ channelName?, voiceRoles? }`
- **Returns**: Updated VoiceChannel

### 30. **Delete Voice Channel**
- **DELETE** `/api/servers/:serverId/voiceChannels/:channelId`
- **Purpose**: Delete a voice channel
- **Returns**: Confirmation message

### 31. **Join Voice Channel**
- **POST** `/api/servers/:serverId/voiceChannels/:channelId/join`
- **Purpose**: Add user to active voice channel
- **Payload**: `{ userId }`
- **Returns**: Updated VoiceChannel with current members

### 32. **Leave Voice Channel**
- **DELETE** `/api/servers/:serverId/voiceChannels/:channelId/leave`
- **Purpose**: Remove user from voice channel
- **Returns**: Updated VoiceChannel

---

## Messages

### 33. **Send Message**
- **POST** `/api/servers/:serverId/textChannels/:channelId/messages`
- **Purpose**: Post a message to a text channel
- **Payload**: `{ userId, content, attachments? }`
- **Returns**: TextLog/Message object with timestamp

### 34. **Get Channel Messages**
- **GET** `/api/servers/:serverId/textChannels/:channelId/messages?limit=50&offset=0`
- **Purpose**: Retrieve message history from a text channel (paginated)
- **Returns**: Array of TextLog/Message objects

### 35. **Update Message**
- **PATCH** `/api/servers/:serverId/textChannels/:channelId/messages/:messageId`
- **Purpose**: Edit a message (author only)
- **Payload**: `{ content }`
- **Returns**: Updated TextLog/Message

### 36. **Delete Message**
- **DELETE** `/api/servers/:serverId/textChannels/:channelId/messages/:messageId`
- **Purpose**: Delete a message
- **Returns**: Confirmation message

---

## Server Settings & Moderation

### 37. **Mute User in Server**
- **PATCH** `/api/servers/:serverId/members/:userId/mute`
- **Purpose**: Mute a user across entire server
- **Payload**: `{ isMuted: boolean }`
- **Returns**: Updated ServerProfile

### 38. **Deafen User in Server**
- **PATCH** `/api/servers/:serverId/members/:userId/deafen`
- **Purpose**: Deafen a user in voice channels
- **Payload**: `{ isDeafened: boolean }`
- **Returns**: Updated ServerProfile

### 39. **Timeout User**
- **PATCH** `/api/servers/:serverId/members/:userId/timeout`
- **Purpose**: Temporarily restrict user activity (timeout)
- **Payload**: `{ isTimedOut: boolean, duration? }`
- **Returns**: Updated ServerProfile

---
