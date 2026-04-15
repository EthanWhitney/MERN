import React, { createContext, useState, useCallback } from 'react';

export interface ActiveVoiceChannel {
  serverId: string;
  channelId: string;
  channelName: string;
}

interface VoiceChannelContextType {
  activeVoiceChannel: ActiveVoiceChannel | null;
  setActiveVoiceChannel: (channel: ActiveVoiceChannel | null) => void;
  joinVoiceChannel: (serverId: string, channelId: string, channelName: string) => void;
  leaveVoiceChannel: () => void;
  swapVoiceChannel: (serverId: string, channelId: string, channelName: string) => void;
}

export const VoiceChannelContext = createContext<VoiceChannelContextType | undefined>(undefined);

export const VoiceChannelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<ActiveVoiceChannel | null>(null);

  const joinVoiceChannel = useCallback((serverId: string, channelId: string, channelName: string) => {
    setActiveVoiceChannel({ serverId, channelId, channelName });
  }, []);

  const leaveVoiceChannel = useCallback(() => {
    setActiveVoiceChannel(null);
  }, []);

  const swapVoiceChannel = useCallback((serverId: string, channelId: string, channelName: string) => {
    setActiveVoiceChannel({ serverId, channelId, channelName });
  }, []);

  return (
    <VoiceChannelContext.Provider
      value={{
        activeVoiceChannel,
        setActiveVoiceChannel,
        joinVoiceChannel,
        leaveVoiceChannel,
        swapVoiceChannel,
      }}
    >
      {children}
    </VoiceChannelContext.Provider>
  );
};

export const useVoiceChannel = () => {
  const context = React.useContext(VoiceChannelContext);
  if (!context) {
    throw new Error('useVoiceChannel must be used within VoiceChannelProvider');
  }
  return context;
};
