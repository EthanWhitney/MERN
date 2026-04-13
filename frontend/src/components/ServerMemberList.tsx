// src/components/ServerMemberList.tsx
import './ServerMemberList.css';
import { useServerMembers, type MemberProfile } from '../hooks/useServerMembers';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';

interface ServerMemberListProps {
  serverId: string;
}

function MemberRow({
  member,
  isOnline,
}: {
  member: MemberProfile;
  isOnline: boolean;
}) {
  const displayName = member.serverSpecificName || member.username;
  const avatarSrc = normalizeProfilePicturePath(member.profilePicture);

  return (
    <div className={`member-row ${isOnline ? 'member-online' : ''}`}>
      <div className="member-avatar-wrap">
        <div className="member-avatar">
          {avatarSrc ? (
            <img src={avatarSrc} alt={displayName} />
          ) : (
            <span>{(displayName || '?')[0].toUpperCase()}</span>
          )}
        </div>
        <span
          className={`member-presence-dot ${isOnline ? 'online' : 'offline'}`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      </div>
      <span className="member-name">{displayName}</span>
    </div>
  );
}

function ServerMemberList({ serverId }: ServerMemberListProps) {
  const { members, onlineUserIds, loading, error } = useServerMembers(serverId);

  const onlineMembers = members.filter(m => onlineUserIds.has(m.userId));
  const offlineMembers = members.filter(m => !onlineUserIds.has(m.userId));

  return (
    <aside className="member-list">
      <div className="member-list-scroll">
        {loading && (
          <p className="member-list-status">Loading members…</p>
        )}
        {!loading && error && (
          <p className="member-list-status">{error}</p>
        )}

        {!loading && !error && (
          <>
            {/* Online section */}
            {onlineMembers.length > 0 && (
              <div className="member-list-section">
                <div className="member-section-label">
                  Online
                  <span className="member-section-count">
                    — {onlineMembers.length}
                  </span>
                </div>
                {onlineMembers.map(m => (
                  <MemberRow key={m.userId} member={m} isOnline={true} />
                ))}
              </div>
            )}

            {/* Offline section */}
            {offlineMembers.length > 0 && (
              <div className="member-list-section">
                <div className="member-section-label">
                  Offline
                  <span className="member-section-count">
                    — {offlineMembers.length}
                  </span>
                </div>
                {offlineMembers.map(m => (
                  <MemberRow key={m.userId} member={m} isOnline={false} />
                ))}
              </div>
            )}

            {members.length === 0 && (
              <p className="member-list-status">No members found</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

export default ServerMemberList;
