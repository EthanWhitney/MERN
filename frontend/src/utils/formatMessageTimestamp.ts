/**
 * Formats a message timestamp based on whether it's from today or a previous date.
 * - Same day: Returns time only in 12-hour format (e.g., "2:30 PM")
 * - Different day: Returns date and time in MM/DD/YY HH:MM AM/PM format (e.g., "04/10/26 2:30 PM")
 *
 * @param createdAt - ISO 8601 timestamp string
 * @returns Formatted timestamp string, or "Just now" if timestamp is missing/invalid
 */
export function formatMessageTimestamp(createdAt?: string): string {
  if (!createdAt) {
    return 'Just now';
  }

  try {
    const messageDate = new Date(createdAt);
    const today = new Date();

    // Check if the message is from today (same calendar day in user's local timezone)
    const isSameDay =
      messageDate.getFullYear() === today.getFullYear() &&
      messageDate.getMonth() === today.getMonth() &&
      messageDate.getDate() === today.getDate();

    if (isSameDay) {
      // Format as time only (e.g., "2:30 PM")
      return messageDate.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else {
      // Format as date and time (e.g., "04/10/26 2:30 PM")
      const month = String(messageDate.getMonth() + 1).padStart(2, '0');
      const day = String(messageDate.getDate()).padStart(2, '0');
      const year = String(messageDate.getFullYear()).slice(-2);
      const time = messageDate.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      return `${month}/${day}/${year} ${time}`;
    }
  } catch {
    return 'Just now';
  }
}
