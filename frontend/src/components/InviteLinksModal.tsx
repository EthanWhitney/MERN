import { useState } from 'react';
import { authFetch } from '../utils/authFetch';
import './InviteLinksModal.css';

interface InviteLinksModalProps {
  serverId: string;
  onClose: () => void;
  onInviteCreated?: () => void;
}

const InviteLinksModal = ({ serverId, onClose, onInviteCreated }: InviteLinksModalProps) => {
  const [maxUsesEnabled, setMaxUsesEnabled] = useState(false);
  const [maxUses, setMaxUses] = useState('1');
  const [expirationEnabled, setExpirationEnabled] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      setGeneratedLink('');

      const body: Record<string, any> = {};
      if (maxUsesEnabled && maxUses) {
        body.maxUses = parseInt(maxUses, 10);
      }
      if (expirationEnabled && expiresInDays) {
        body.expiresInDays = parseInt(expiresInDays, 10);
      }

      const response = await authFetch(`api/servers/${serverId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create invite link');
        return;
      }

      setGeneratedLink(data.link);
      onInviteCreated?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create invite link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      const fullUrl = `${window.location.origin}${generatedLink}`;
      navigator.clipboard.writeText(fullUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleCreateAnother = () => {
    setGeneratedLink('');
    setMaxUsesEnabled(false);
    setMaxUses('1');
    setExpirationEnabled(false);
    setExpiresInDays('7');
  };

  return (
    <div className="invite-links-modal-overlay" onClick={onClose}>
      <div className="invite-links-modal" onClick={(e) => e.stopPropagation()}>
        {!generatedLink ? (
          <>
            <div className="invite-links-header">
              <h2>Create Invite Link</h2>
              <button className="invite-links-close" onClick={onClose}>×</button>
            </div>

            <form onSubmit={handleCreateLink} className="invite-links-form">
              <div className="invite-links-body">
                <div className="invite-links-section">
                  <label className="invite-links-checkbox-label">
                    <input
                      type="checkbox"
                      checked={maxUsesEnabled}
                      onChange={(e) => setMaxUsesEnabled(e.target.checked)}
                    />
                    <span>Limit to maximum uses</span>
                  </label>
                  {maxUsesEnabled && (
                    <input
                      type="number"
                      min="1"
                      max="999999"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      className="invite-links-input"
                      placeholder="1"
                    />
                  )}
                </div>

                <div className="invite-links-section">
                  <label className="invite-links-checkbox-label">
                    <input
                      type="checkbox"
                      checked={expirationEnabled}
                      onChange={(e) => setExpirationEnabled(e.target.checked)}
                    />
                    <span>Set expiration</span>
                  </label>
                  {expirationEnabled && (
                    <div className="invite-links-expiration">
                      <span>Expires in</span>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={expiresInDays}
                        onChange={(e) => setExpiresInDays(e.target.value)}
                        className="invite-links-input-small"
                        placeholder="7"
                      />
                      <span>days</span>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="invite-links-error">{error}</div>
                )}
              </div>

              <div className="invite-links-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Link'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="invite-links-header">
              <h2>Link Created!</h2>
              <button className="invite-links-close" onClick={onClose}>×</button>
            </div>

            <div className="invite-links-body">
              <div className="invite-links-success">
                <p className="invite-links-success-message">Your invite link has been created successfully!</p>

                <div className="invite-links-generated">
                  <p className="invite-links-label">Link:</p>
                  <div className="invite-links-display">
                    <code>{`${window.location.origin}${generatedLink}`}</code>
                    <button
                      type="button"
                      className="invite-links-copy-btn"
                      onClick={handleCopyLink}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="invite-links-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
              >
                Done
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreateAnother}
              >
                Create Another
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InviteLinksModal;
