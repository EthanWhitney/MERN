import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/authFetch';
import InviteLinksModal from './InviteLinksModal';
import './InviteLinksPanel.css';

interface InviteLink {
  _id: string;
  link: string;
  maxUses?: number;
  currentUses: number;
  expiresAt?: string;
  createdAt: string;
  isRevoked: boolean;
}

interface InviteLinksPanelProps {
  serverId: string;
  onClose: () => void;
}

const InviteLinksPanel: React.FC<InviteLinksPanelProps> = ({ serverId, onClose }) => {
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetchLinks();
  }, [serverId]);

  const fetchLinks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`api/servers/${serverId}/invites`);
      if (!response.ok) {
        throw new Error('Failed to fetch invite links');
      }
      const data = await response.json();
      setLinks(data.invites || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching links');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (linkCode: string) => {
    setRevoking(linkCode);
    try {
      const response = await authFetch(
        `api/servers/${serverId}/invites/${linkCode}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        throw new Error('Failed to revoke invite link');
      }
      setLinks(links.filter(link => link._id !== linkCode));
      setRevokeConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error revoking link');
    } finally {
      setRevoking(null);
    }
  };

  const formatExpirationDate = (expiresAt?: string): string => {
    if (!expiresAt) return 'Never';
    const date = new Date(expiresAt);
    const today = new Date();
    const daysLeft = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return 'Expired';
    if (daysLeft === 0) return 'Expires today';
    if (daysLeft === 1) return 'Expires tomorrow';
    return `${daysLeft} days`;
  };

  const isExpired = (expiresAt?: string): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (showCreateModal) {
    return (
      <InviteLinksModal
        serverId={serverId}
        onClose={() => {
          setShowCreateModal(false);
          fetchLinks();
        }}
      />
    );
  }

  return (
    <div className="invite-links-panel-overlay">
      <div className="invite-links-panel">
        <div className="invite-links-panel-header">
          <h2>Invite Links</h2>
          <button className="invite-links-panel-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="invite-links-panel-body">
          {error && <div className="invite-links-panel-error">{error}</div>}

          {loading ? (
            <div className="invite-links-panel-loading">Loading invite links...</div>
          ) : links.length === 0 ? (
            <div className="invite-links-panel-empty">
              <p>No invite links yet</p>
            </div>
          ) : (
            <div className="invite-links-list">
              {links.map(link => {
                const expired = isExpired(link.expiresAt);
                const maxReached = !!(link.maxUses && link.currentUses >= link.maxUses);
                const isDisabled = link.isRevoked || expired || maxReached;

                return (
                  <div key={link._id} className={`invite-link-item ${isDisabled ? 'disabled' : ''}`}>
                    <div className="invite-link-info">
                      <div className="invite-link-code">
                        /join/<strong>{link._id.substring(0, 8)}</strong>
                      </div>
                      <div className="invite-link-details">
                        <span className="invite-link-uses">
                          {link.maxUses
                            ? `${link.currentUses}/${link.maxUses} uses`
                            : `${link.currentUses} uses`}
                        </span>
                        <span className="invite-link-expiration">
                          {link.isRevoked
                            ? 'Revoked'
                            : formatExpirationDate(link.expiresAt)}
                        </span>
                      </div>
                    </div>

                    {revokeConfirmId === link._id ? (
                      <div className="invite-link-confirm">
                        <span className="confirm-text">Revoke this link?</span>
                        <button
                          className="confirm-yes"
                          onClick={() => handleRevoke(link._id)}
                          disabled={revoking === link._id}
                        >
                          {revoking === link._id ? 'Revoking...' : 'Yes'}
                        </button>
                        <button
                          className="confirm-no"
                          onClick={() => setRevokeConfirmId(null)}
                          disabled={revoking === link._id}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        className="invite-link-revoke-btn"
                        onClick={() => setRevokeConfirmId(link._id)}
                        disabled={isDisabled}
                        title={isDisabled ? 'This link is already disabled' : 'Revoke this link'}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="invite-links-panel-footer">
          <button
            className="invite-links-panel-create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            Create New Link
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteLinksPanel;
