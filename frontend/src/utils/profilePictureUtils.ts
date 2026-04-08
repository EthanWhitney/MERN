/**
 * Normalize a profile picture path
 * - If it's just a filename (no path), convert to /avatars/filename
 * - If it's already a full path, return as-is
 * - If it's empty, return empty string
 */
export const normalizeProfilePicturePath = (picture?: string): string => {
  if (!picture) return '';
  // If it starts with / or is a full URL, it's already normalized
  if (picture.startsWith('/') || picture.startsWith('http://') || picture.startsWith('https://')) {
    return picture;
  }
  // Otherwise, it's just a filename - prepend /avatars/
  return `/avatars/${picture}`;
};
