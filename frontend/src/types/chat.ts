export type ThreadKind = 'server' | 'dm';

export interface Thread {
  id: string;
  kind: ThreadKind;
  title: string;
  subtitle?: string;
  serverId?: string;
  channelId?: string;
  recieverId?: string;
  avatarUrl?: string;
  updatedAt?: string;
  lastMessage?: string;
}

export interface SenderProfile {
  userId?: string;
  username?: string;
  profilePicture?: string;
  serverSpecificName?: string;
  serverSpecificPFP?: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: string;
  edited: boolean;
  sender?: SenderProfile;
  metadata?: {
    type: string;
    serverName?: string;
    linkCode?: string;
    [key: string]: any;
  };
}
