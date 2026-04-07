const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const {
	getCursorPage,
	buildMessageScopeQuery,
	buildMessageDocument,
	buildDmMessageDocument,
	buildDmConversationQuery,
	buildServerThread,
	buildDmThread,
	makeConversationKey,
} = require('../services/chatThreadService');
require('dotenv').config();

const url = process.env.MONGODB_URI;
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
	client.connect();
}

let indexesReady = false;
const MESSAGE_EDIT_WINDOW_MS = 5 * 60 * 1000;

const normalizeLimit = (value, fallback = 50) => {
	const parsed = parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed <= 0) {
		return fallback;
	}
	return Math.min(parsed, 100);
};

const isWithinMessageEditWindow = (messageDoc) => {
	if (!messageDoc || !messageDoc.createdAt) {
		return false;
	}

	const createdAt = new Date(messageDoc.createdAt);
	if (Number.isNaN(createdAt.getTime())) {
		return false;
	}

	return (Date.now() - createdAt.getTime()) <= MESSAGE_EDIT_WINDOW_MS;
};

const getBodyUserId = (req) => {
	const { userId } = req.body || {};
	return userId || null;
};

const getRequestUserId = (req) => {
	const bodyUserId = getBodyUserId(req);
	if (bodyUserId) {
		return bodyUserId;
	}

	const authHeader = req.headers.authorization || '';
	if (authHeader.startsWith('Bearer ')) {
		const token = authHeader.slice(7);
		try {
			const payload = jwt.verify(token, process.env.JWT_SECRET);
			return payload.userId || null;
		} catch (e) {
			return null;
		}
	}

	return null;
};

const ensureIndexes = async (db) => {
	if (indexesReady) {
		return;
	}

	await Promise.all([
		db.collection('messages').createIndex({ serverId: 1, channelId: 1, createdAt: -1 }),
		db.collection('messages').createIndex({ serverID: 1, channelID: 1, createdAt: -1 }),
		db.collection('directMessages').createIndex({ conversationKey: 1, createdAt: -1 }),
		db.collection('directMessages').createIndex({ senderId: 1, recieverId: 1, createdAt: -1 }),
		db.collection('directMessages').createIndex({ senderID: 1, recipientID: 1, createdAt: -1 }),
	]);

	indexesReady = true;
};

const findServerAndChannel = async (db, serverId, channelId) => {
	const serverObjId = new ObjectId(serverId);
	const channelObjId = new ObjectId(channelId);

	const server = await db.collection('servers').findOne({ _id: serverObjId });
	if (!server) {
		return { error: 'Server not found', server: null, channel: null };
	}

	const channel = (server.textChannels || []).find((item) => {
		if (!item || !item.channelID) {
			return false;
		}
		return item.channelID.toString() === channelObjId.toString();
	});

	if (!channel) {
		return { error: 'Channel not found', server, channel: null };
	}

	return { error: '', server, channel };
};

const userHasServerAccess = (server, userObjId) => {
	if (!server) {
		return false;
	}

	const userIdString = userObjId.toString();
	const inMembers = (server.members || []).some((memberId) => String(memberId) === userIdString);

	return inMembers;
};

const isServerOwner = (server, userObjId) => {
	if (!server) {
		return false;
	}

	const userIdString = userObjId.toString();
	const ownerCandidates = [server.ownerId, server.serverOwnerUserID, server.serverOwnerUserId];

	return ownerCandidates.some((ownerValue) => ownerValue && ownerValue.toString() === userIdString);
};

const getServerProfileForUser = async (db, server, userObjId) => {
	const embeddedProfile = (server.serverProfiles || []).find((profile) => {
		return profile && profile.userId && profile.userId.toString() === userObjId.toString();
	});

	return embeddedProfile || null;
};

const buildSenderProfile = (user, serverProfile) => {
	const serverSpecificName = serverProfile?.serverSpecificName || serverProfile?.nickname || user.username;
	const serverSpecificPFP = serverProfile?.serverSpecificPFP || serverProfile?.profilePicture || user.profilePicture || '';
	const arrayOfServerRoles = serverProfile?.arrayOfServerRoles || serverProfile?.roleIDs || [];

	return {
		userId: user._id,
		username: user.username,
		profilePicture: user.profilePicture || '',
		serverSpecificName,
		serverSpecificPFP,
		arrayOfServerRoles,
	};
};

const decorateServerMessage = (messageDoc, senderProfile) => {
	return {
		...messageDoc,
		sender: senderProfile,
	};
};

const sendMessage = async (req, res) => {
	const { serverId, channelId } = req.params;
	const { content, message, attachments = [] } = req.body;
	const bodyContent = content || message;
	const { userId } = req;

	if (!ObjectId.isValid(serverId) || !ObjectId.isValid(channelId)) {
		return res.status(400).json({ message: null, error: 'Invalid server or channel ID' });
	}

	if (!userId || !ObjectId.isValid(userId)) {
		return res.status(401).json({ message: null, error: 'Valid userId is required' });
	}

	if (!bodyContent || !bodyContent.trim()) {
		return res.status(400).json({ message: null, error: 'content is required' });
	}

	try {
		const db = client.db('discord_clone');
		await ensureIndexes(db);

		const { error, server, channel } = await findServerAndChannel(db, serverId, channelId);
		if (error) {
			return res.status(404).json({ message: null, error });
		}

		const thread = buildServerThread({
			serverId: server._id,
			channelId: new ObjectId(channelId),
			channelName: channel.name || '',
			serverName: server.serverName || server.name || '',
		});

		const userObjId = new ObjectId(userId);
		if (!userHasServerAccess(server, userObjId)) {
			return res.status(403).json({ message: null, error: 'User is not a member of this server' });
		}

		const user = await db.collection('users').findOne({ _id: userObjId });
		if (!user) {
			return res.status(404).json({ message: null, error: 'User not found' });
		}

		const serverProfile = await getServerProfileForUser(db, server, userObjId);
		const senderProfile = buildSenderProfile(user, serverProfile);

		const messageDoc = buildMessageDocument({
			serverObjId: server._id,
			channelObjId: new ObjectId(channelId),
			userObjId,
			username: senderProfile.serverSpecificName,
			content: bodyContent,
			attachments,
		});

		messageDoc.sender = senderProfile;
		messageDoc.serverProfile = serverProfile || null;

		const result = await db.collection('messages').insertOne(messageDoc);

		return res.status(201).json({
			thread,
			message: decorateServerMessage({ ...messageDoc, _id: result.insertedId }, senderProfile),
			error: '',
		});
	} catch (e) {
		return res.status(500).json({ message: null, error: e.toString() });
	}
};

const getMessages = async (req, res) => {
	const { serverId, channelId } = req.params;
	const limit = normalizeLimit(req.query.limit, 50);
	const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
	const before = req.query.before;
	const { userId } = req;

	if (!ObjectId.isValid(serverId) || !ObjectId.isValid(channelId)) {
		return res.status(400).json({ messages: [], error: 'Invalid server or channel ID' });
	}

	if (!userId || !ObjectId.isValid(userId)) {
		return res.status(401).json({ messages: [], error: 'Valid userId is required' });
	}

	try {
		const db = client.db('discord_clone');
		await ensureIndexes(db);

		const { error, server, channel } = await findServerAndChannel(db, serverId, channelId);
		if (error) {
			return res.status(404).json({ messages: [], error });
		}

		const thread = buildServerThread({
			serverId: server._id,
			channelId: new ObjectId(channelId),
			channelName: channel.name || '',
			serverName: server.serverName || server.name || '',
		});

		const userObjId = new ObjectId(userId);
		if (!userHasServerAccess(server, userObjId)) {
			return res.status(403).json({ messages: [], error: 'User is not a member of this server' });
		}

		const query = buildMessageScopeQuery(server._id, new ObjectId(channelId));

		const page = await getCursorPage({
			collection: db.collection('messages'),
			baseQuery: query,
			before,
			limit,
			offset,
			useOffset: true,
		});

		if (page.error) {
			return res.status(400).json({ messages: [], error: page.error });
		}

		const docs = page.docs;

		const messagesWithProfiles = await Promise.all(docs.map(async (messageDoc) => {
			const messageUserId = messageDoc.userId;
			const messageUserObjId = messageUserId instanceof ObjectId ? messageUserId : new ObjectId(messageUserId);
			const messageUser = await db.collection('users').findOne({ _id: messageUserObjId });
			const messageServerProfile = await getServerProfileForUser(db, server, messageUserObjId);
			const senderProfile = messageUser ? buildSenderProfile(messageUser, messageServerProfile) : null;

			return decorateServerMessage({
				...messageDoc,
				sender: senderProfile,
			}, senderProfile);
		}));

		const selected = page.hasMore ? messagesWithProfiles.slice(0, limit) : messagesWithProfiles;
		const nextCursor = page.nextCursor;

		return res.status(200).json({
			thread,
			messages: selected.reverse(),
			nextCursor,
			error: '',
		});
	} catch (e) {
		return res.status(500).json({ messages: [], error: e.toString() });
	}
};

const updateMessage = async (req, res) => {
	const { serverId, channelId, messageId } = req.params;
	const { content, message } = req.body;
	const bodyContent = content || message;
	const { userId } = req;

	if (!ObjectId.isValid(serverId) || !ObjectId.isValid(channelId) || !ObjectId.isValid(messageId)) {
		return res.status(400).json({ message: null, error: 'Invalid server, channel, or message ID' });
	}

	if (!userId || !ObjectId.isValid(userId)) {
		return res.status(401).json({ message: null, error: 'Valid userId is required' });
	}

	if (!bodyContent || !bodyContent.trim()) {
		return res.status(400).json({ message: null, error: 'content is required' });
	}

	try {
		const db = client.db('discord_clone');
		await ensureIndexes(db);

		const { error, server, channel } = await findServerAndChannel(db, serverId, channelId);
		if (error) {
			return res.status(404).json({ message: null, error });
		}

		const userObjId = new ObjectId(userId);
		if (!userHasServerAccess(server, userObjId)) {
			return res.status(403).json({ message: null, error: 'User is not a member of this server' });
		}

		const messageObjId = new ObjectId(messageId);
		const scopeQuery = buildMessageScopeQuery(server._id, new ObjectId(channelId));
		const existingMessage = await db.collection('messages').findOne({
			...scopeQuery,
			_id: messageObjId,
			userId: userObjId,
		});

		if (!existingMessage) {
			return res.status(404).json({ message: null, error: 'Message not found' });
		}

		if (!isWithinMessageEditWindow(existingMessage)) {
			return res.status(403).json({ message: null, error: 'Messages can only be edited within 5 minutes' });
		}

		const updatedMessage = await db.collection('messages').findOneAndUpdate(
			{ _id: messageObjId },
			{
				$set: {
					message: bodyContent.trim(),
					edited: true,
					editedAt: new Date(),
				},
			},
			{ returnDocument: 'after' }
		);

		const updatedMessageDoc = updatedMessage?.value || updatedMessage;
		if (!updatedMessageDoc) {
			return res.status(404).json({ message: null, error: 'Message not found after update' });
		}

		return res.status(200).json({ message: updatedMessageDoc, error: '' });
	} catch (e) {
		return res.status(500).json({ message: null, error: e.toString() });
	}
};

const deleteMessage = async (req, res) => {
	const { serverId, channelId, messageId } = req.params;
	const { userId } = req;

	if (!ObjectId.isValid(serverId) || !ObjectId.isValid(channelId) || !ObjectId.isValid(messageId)) {
		return res.status(400).json({ message: null, error: 'Invalid server, channel, or message ID' });
	}

	if (!userId || !ObjectId.isValid(userId)) {
		return res.status(401).json({ message: null, error: 'Valid userId is required' });
	}

	try {
		const db = client.db('discord_clone');
		await ensureIndexes(db);

		const { error, server, channel } = await findServerAndChannel(db, serverId, channelId);
		if (error) {
			return res.status(404).json({ message: null, error });
		}

		const userObjId = new ObjectId(userId);
		if (!userHasServerAccess(server, userObjId)) {
			return res.status(403).json({ message: null, error: 'User is not a member of this server' });
		}

		const messageObjId = new ObjectId(messageId);
		const scopeQuery = buildMessageScopeQuery(server._id, new ObjectId(channelId));
		const existingMessage = await db.collection('messages').findOne({
			...scopeQuery,
			_id: messageObjId,
		});

		if (!existingMessage) {
			return res.status(404).json({ message: null, error: 'Message not found' });
		}

		if (!isWithinMessageEditWindow(existingMessage)) {
			return res.status(403).json({ message: null, error: 'Messages can only be deleted within 5 minutes' });
		}

		const messageOwnerId = existingMessage.userId || existingMessage.userID;
		const isMessageAuthor = messageOwnerId && messageOwnerId.toString() === userObjId.toString();
		const ownerCanDelete = isServerOwner(server, userObjId);

		if (!isMessageAuthor && !ownerCanDelete) {
			return res.status(403).json({ message: null, error: 'Only the message author or server owner can delete this message' });
		}

		await db.collection('messages').deleteOne({ _id: messageObjId });

		return res.status(200).json({ message: 'Message deleted successfully', error: '' });
	} catch (e) {
		return res.status(500).json({ message: null, error: e.toString() });
	}
};

const sendDirectMessage = async (req, res) => {
	const { recipientId } = req.params;
	const { content, message } = req.body;
	const bodyContent = content || message;
	const { userId } = req;

	if (!ObjectId.isValid(recipientId)) {
		return res.status(400).json({ message: null, error: 'Invalid recipient ID' });
	}

	if (!userId || !ObjectId.isValid(userId)) {
		return res.status(401).json({ message: null, error: 'Valid userId is required' });
	}

	if (!bodyContent || !bodyContent.trim()) {
		return res.status(400).json({ message: null, error: 'content is required' });
	}

	if (userId === recipientId) {
		return res.status(400).json({ message: null, error: 'Cannot send a message to yourself' });
	}

	try {
		const db = client.db('discord_clone');
		await ensureIndexes(db);

		const senderObjId = new ObjectId(userId);
		const recipientObjId = new ObjectId(recipientId);

		const [sender, recipient] = await Promise.all([
			db.collection('users').findOne({ _id: senderObjId }),
			db.collection('users').findOne({ _id: recipientObjId }),
		]);

		if (!sender || !recipient) {
			return res.status(404).json({ message: null, error: 'Sender or recipient user was not found' });
		}

		const directMessageDoc = buildDmMessageDocument({
			senderObjId,
			recipientObjId,
			content: bodyContent,
		});

		const senderProfile = buildSenderProfile(sender, null);
		directMessageDoc.sender = senderProfile;

		const thread = buildDmThread({
			userId: senderObjId,
			recipientId: recipientObjId,
			recipientUsername: recipient.username || '',
			recipientProfilePicture: recipient.profilePicture || '',
		});

		const result = await db.collection('directMessages').insertOne(directMessageDoc);

		return res.status(201).json({
			thread,
			message: { ...directMessageDoc, _id: result.insertedId, sender: senderProfile },
			error: '',
		});
	} catch (e) {
		return res.status(500).json({ message: null, error: e.toString() });
	}
};

const getDirectMessages = async (req, res) => {
	const { recipientId } = req.params;
	const limit = normalizeLimit(req.query.limit, 50);
	const before = req.query.before;
	const { userId } = req;

	if (!ObjectId.isValid(recipientId)) {
		return res.status(400).json({ messages: [], error: 'Invalid recipient ID' });
	}

	if (!userId || !ObjectId.isValid(userId)) {
		return res.status(401).json({ messages: [], error: 'Valid userId is required' });
	}

	try {
		const db = client.db('discord_clone');
		await ensureIndexes(db);

		const senderObjId = new ObjectId(userId);
		const recipientObjId = new ObjectId(recipientId);

		const query = {
			conversationKey: makeConversationKey(senderObjId, recipientObjId),
		};

		const recipient = await db.collection('users').findOne({ _id: recipientObjId });
		const thread = buildDmThread({
			userId: senderObjId,
			recipientId: recipientObjId,
			recipientUsername: recipient?.username || '',
			recipientProfilePicture: recipient?.profilePicture || '',
		});

		const page = await getCursorPage({
			collection: db.collection('directMessages'),
			baseQuery: query,
			before,
			limit,
		});

		if (page.error) {
			return res.status(400).json({ messages: [], error: page.error });
		}

		const docs = page.docs;

		const messagesWithProfiles = await Promise.all(docs.map(async (messageDoc) => {
			const messageSenderId = messageDoc.senderId || messageDoc.senderID;
			const messageSenderObjId = messageSenderId instanceof ObjectId ? messageSenderId : new ObjectId(messageSenderId);
			const messageSender = await db.collection('users').findOne({ _id: messageSenderObjId });
			const senderProfile = messageSender ? buildSenderProfile(messageSender, null) : null;

			return {
				...messageDoc,
				sender: senderProfile,
			};
		}));

		const selected = page.hasMore ? messagesWithProfiles.slice(0, limit) : messagesWithProfiles;
		const nextCursor = page.nextCursor;

		return res.status(200).json({
			thread,
			messages: selected.reverse(),
			nextCursor,
			error: '',
		});
	} catch (e) {
		return res.status(500).json({ messages: [], error: e.toString() });
	}
};

const updateDirectMessage = async (req, res) => {
	const { recipientId, messageId } = req.params;
	const { content, message } = req.body;
	const bodyContent = content || message;
	const userId = getRequestUserId(req);

	if (!ObjectId.isValid(recipientId) || !ObjectId.isValid(messageId)) {
		return res.status(400).json({ message: null, error: 'Invalid recipient or message ID' });
	}

	if (!userId || !ObjectId.isValid(userId)) {
		return res.status(401).json({ message: null, error: 'Valid userId is required' });
	}

	if (!bodyContent || !bodyContent.trim()) {
		return res.status(400).json({ message: null, error: 'content is required' });
	}

	try {
		const db = client.db('discord_clone');
		await ensureIndexes(db);

		const senderObjId = new ObjectId(userId);
		const recipientObjId = new ObjectId(recipientId);
		const messageObjId = new ObjectId(messageId);

		const conversationKey = makeConversationKey(senderObjId, recipientObjId);
		const existingMessage = await db.collection('directMessages').findOne({
			_id: messageObjId,
			conversationKey,
			$or: [
				{ senderId: senderObjId },
				{ senderID: senderObjId },
			],
		});

		if (!existingMessage) {
			return res.status(404).json({ message: null, error: 'Message not found' });
		}

		const updatedMessage = await db.collection('directMessages').findOneAndUpdate(
			{ _id: messageObjId },
			{
				$set: {
					message: bodyContent.trim(),
					edited: true,
					editedAt: new Date(),
				},
			},
			{ returnDocument: 'after' }
		);

		const updatedMessageDoc = updatedMessage?.value || updatedMessage;
		if (!updatedMessageDoc) {
			return res.status(404).json({ message: null, error: 'Message not found after update' });
		}

		const sender = await db.collection('users').findOne({ _id: senderObjId });
		const senderProfile = sender ? buildSenderProfile(sender, null) : null;

		return res.status(200).json({
			message: {
				...updatedMessageDoc,
				sender: senderProfile,
			},
			error: '',
		});
	} catch (e) {
		return res.status(500).json({ message: null, error: e.toString() });
	}
};

const deleteDirectMessage = async (req, res) => {
	const { recipientId, messageId } = req.params;
	const userId = getRequestUserId(req);

	if (!ObjectId.isValid(recipientId) || !ObjectId.isValid(messageId)) {
		return res.status(400).json({ message: null, error: 'Invalid recipient or message ID' });
	}

	if (!userId || !ObjectId.isValid(userId)) {
		return res.status(401).json({ message: null, error: 'Valid userId is required' });
	}

	try {
		const db = client.db('discord_clone');
		await ensureIndexes(db);

		const senderObjId = new ObjectId(userId);
		const recipientObjId = new ObjectId(recipientId);
		const messageObjId = new ObjectId(messageId);
		const conversationKey = makeConversationKey(senderObjId, recipientObjId);

		const existingMessage = await db.collection('directMessages').findOne({
			_id: messageObjId,
			conversationKey,
			$or: [
				{ senderId: senderObjId },
				{ senderID: senderObjId },
			],
		});

		if (!existingMessage) {
			return res.status(404).json({ message: null, error: 'Message not found' });
		}

		await db.collection('directMessages').deleteOne({ _id: messageObjId });

		return res.status(200).json({ message: 'Message deleted successfully', error: '' });
	} catch (e) {
		return res.status(500).json({ message: null, error: e.toString() });
	}
};

const getDirectConversations = async (req, res) => {
	const { userId } = req;

	if (!userId || !ObjectId.isValid(userId)) {
		return res.status(401).json({ conversations: [], error: 'Valid userId is required' });
	}

	try {
		const db = client.db('discord_clone');
		await ensureIndexes(db);

		const userObjId = new ObjectId(userId);
		const conversations = await db.collection('directMessages').aggregate([
			{ $match: buildDmConversationQuery(userObjId) },
			{ $sort: { createdAt: -1 } },
			{
				$group: {
					_id: '$conversationKey',
					senderId: { $first: { $ifNull: ['$senderId', '$senderID'] } },
					recieverId: { $first: { $ifNull: ['$recieverId', '$recipientID'] } },
					lastMessage: { $first: '$message' },
					updatedAt: { $first: '$createdAt' },
				},
			},
			{ $sort: { updatedAt: -1 } },
		]).toArray();

		const userIdsToLoad = new Set();
		conversations.forEach((conversation) => {
			const senderId = conversation.senderId?.toString?.() || '';
			const recieverId = conversation.recieverId?.toString?.() || '';
			if (senderId && senderId !== userObjId.toString()) {
				userIdsToLoad.add(senderId);
			}
			if (recieverId && recieverId !== userObjId.toString()) {
				userIdsToLoad.add(recieverId);
			}
		});

		const counterpartIds = Array.from(userIdsToLoad)
			.filter((id) => ObjectId.isValid(id))
			.map((id) => new ObjectId(id));
		const counterpartUsers = counterpartIds.length
			? await db.collection('users').find({ _id: { $in: counterpartIds } }).toArray()
			: [];

		const counterpartMap = new Map(counterpartUsers.map((user) => [user._id.toString(), user]));
		const threads = conversations.map((conversation) => {
			const senderId = conversation.senderId?.toString?.() || '';
			const recieverId = conversation.recieverId?.toString?.() || '';
			const counterpartId = senderId === userObjId.toString() ? recieverId : senderId;
			const counterpart = counterpartMap.get(counterpartId);

			return {
				...buildDmThread({
					userId: userObjId,
					recipientId: counterpartId || userObjId,
					recipientUsername: counterpart?.username || '',
					recipientProfilePicture: counterpart?.profilePicture || '',
				}),
				lastMessage: conversation.lastMessage,
				updatedAt: conversation.updatedAt,
			};
		});

		return res.status(200).json({ conversations: threads, error: '' });
	} catch (e) {
		return res.status(500).json({ conversations: [], error: e.toString() });
	}
};

module.exports = {
	sendMessage,
	getMessages,
	updateMessage,
	deleteMessage,
	sendDirectMessage,
	getDirectMessages,
	updateDirectMessage,
	deleteDirectMessage,
	getDirectConversations,
};
