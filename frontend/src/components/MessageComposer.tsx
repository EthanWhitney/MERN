import { useState } from 'react';

type MessageComposerProps = {
  disabled?: boolean;
  channelName?: string;
  onSend: (content: string) => Promise<void>;
};

function MessageComposer({ disabled = false, channelName, onSend }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const placeholder = channelName ? `Message #${channelName}` : 'Select a channel to chat';

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || disabled || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setContent('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="message-composer">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void handleSend(); }
        }}
        placeholder={placeholder}
        disabled={disabled || sending}
      />
      <div className="composer-actions">
        <button
          className="composer-send-button"
          onClick={handleSend}
          disabled={disabled || sending || !content.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default MessageComposer;
