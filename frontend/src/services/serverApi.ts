import { authFetch } from '../utils/authFetch';

export interface Server {
  _id: string;
  serverName: string;
  description?: string;
  serverIcon?: string;
  ownerId: string;
  members: string[];
  textChannels: any[];
  voiceChannels: any[];
  createdAt: string;
}

export interface CreateServerRequest {
  serverName: string;
  description?: string;
}

export interface CreateChannelRequest {
  channelName: string;
  topic?: string;
  userId: string;
}

export interface Channel {
  channelID: string;
  name: string;
  topic?: string;
  createdAt: string;
}

// Get all servers the user is a member of
export const getUserServers = async (): Promise<Server[]> => {
  try {
    const response = await authFetch('api/users/servers');
    if (!response.ok) {
      throw new Error('Failed to fetch servers');
    }
    const data = await response.json();
    return data.servers || [];
  } catch (error) {
    console.error('Error fetching servers:', error);
    throw error;
  }
};

// Create a new server
export const createServer = async (serverData: CreateServerRequest): Promise<Server> => {
  try {
    const response = await authFetch('api/servers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serverData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create server');
    }
    
    const data = await response.json();
    return data.server;
  } catch (error) {
    console.error('Error creating server:', error);
    throw error;
  }
};

// Get a specific server
export const getServer = async (serverId: string): Promise<Server> => {
  try {
    const response = await authFetch(`api/servers/${serverId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch server');
    }
    const data = await response.json();
    return data.server;
  } catch (error) {
    console.error('Error fetching server:', error);
    throw error;
  }
};

// Delete a server
export const deleteServer = async (serverId: string): Promise<void> => {
  try {
    const response = await authFetch(`api/servers/${serverId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete server');
    }
  } catch (error) {
    console.error('Error deleting server:', error);
    throw error;
  }
};

// Leave a server
export const leaveServer = async (serverId: string): Promise<void> => {
  try {
    const response = await authFetch(`api/servers/${serverId}/leave`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to leave server');
    }
  } catch (error) {
    console.error('Error leaving server:', error);
    throw error;
  }
};

// Create a text channel in a server
export const createTextChannel = async (serverId: string, channelData: CreateChannelRequest): Promise<Channel> => {
  try {
    const response = await authFetch(`api/servers/${serverId}/textChannels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(channelData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create channel');
    }
    
    const data = await response.json();
    return data.channel;
  } catch (error) {
    console.error('Error creating channel:', error);
    throw error;
  }
};

// Delete a text channel from a server
export const deleteTextChannel = async (serverId: string, channelId: string, userId: string): Promise<void> => {
  try {
    const response = await authFetch(`api/servers/${serverId}/textChannels/${channelId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete channel');
    }
  } catch (error) {
    console.error('Error deleting channel:', error);
    throw error;
  }
};
