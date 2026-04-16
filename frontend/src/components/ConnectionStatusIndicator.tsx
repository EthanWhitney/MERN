import React from 'react';
import { useConnectionStatus } from '../hooks/useConnectionStatus';

/**
 * PHASE 3.3: Connection Status Indicator Component
 * 
 * Shows visual indicator of socket connection state
 * - Green: Connected
 * - Amber: Reconnecting (pulsing)
 * - Red: Disconnected
 */
export const ConnectionStatusIndicator: React.FC = () => {
  const { status } = useConnectionStatus();

  const getColor = () => {
    switch (status) {
      case 'connected':
        return '#10b981'; // green
      case 'reconnecting':
        return '#f59e0b'; // amber
      case 'disconnected':
        return '#ef4444'; // red
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        fontSize: '12px',
        fontWeight: '500'
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getColor(),
          animation: status === 'reconnecting' ? 'pulse 1.5s ease-in-out infinite' : 'none'
        }}
      />
      <span>{getLabel()}</span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};
