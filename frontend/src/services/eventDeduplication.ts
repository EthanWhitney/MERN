/**
 * PHASE 4.1: Event Deduplication
 * 
 * Tracks recently received events and skips duplicates.
 * Prevents duplicate updates when the same event fires multiple times.
 * 
 * Usage:
 *   if (eventDeduplication.isDuplicate(eventName, data)) {
 *     return; // Skip processing
 *   }
 */

interface DeduplicationEntry {
  id: string;
  eventName: string;
  hash: string;
  timestamp: number;
}

const TTL_MS = 5000; // 5 second TTL for deduplication
const MAX_TRACKED_EVENTS = 1000;

class EventDeduplication {
  private events: DeduplicationEntry[] = [];
  private hashCache: Map<string, string> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start periodic cleanup of old entries
    this.startCleanup();
  }

  /**
   * Check if an event is a duplicate based on hash
   * Returns true if duplicate, false if new/unique event
   */
  isDuplicate(eventName: string, data: any): boolean {
    const hash = this.hashData(eventName, data);
    const now = Date.now();

    // Check if we've seen this exact event recently
    const existing = this.events.find(
      e => e.eventName === eventName && e.hash === hash && (now - e.timestamp) < TTL_MS
    );

    if (existing) {
      console.log(`[EventDeduplication] Duplicate detected: ${eventName} (${(now - existing.timestamp).toFixed(0)}ms ago)`);
      return true;
    }

    // Record this event
    this.addEvent(eventName, hash);
    return false;
  }

  /**
   * Generate a hash of the event data for comparison
   */
  private hashData(eventName: string, data: any): string {
    // Use cached hash if available
    const cacheKey = `${eventName}:${JSON.stringify(data)}`;
    if (this.hashCache.has(cacheKey)) {
      return this.hashCache.get(cacheKey)!;
    }

    // For browser environments that don't have crypto-js, use simple hash
    const dataStr = JSON.stringify(data);
    let hash = 0;
    let charCode: number;

    for (let i = 0; i < dataStr.length; i++) {
      charCode = dataStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + charCode;
      hash = hash & hash; // Convert to 32bit integer
    }

    const hashStr = Math.abs(hash).toString(36);
    this.hashCache.set(cacheKey, hashStr);

    // Cleanup cache if it gets too large
    if (this.hashCache.size > 100) {
      const firstKey = this.hashCache.keys().next().value;
      if (firstKey) this.hashCache.delete(firstKey);
    }

    return hashStr;
  }

  /**
   * Add event to deduplication tracker
   */
  private addEvent(eventName: string, hash: string): void {
    const entry: DeduplicationEntry = {
      id: `${Date.now()}-${Math.random()}`,
      eventName,
      hash,
      timestamp: Date.now()
    };

    this.events.push(entry);

    // Keep list under max size by removing oldest
    if (this.events.length > MAX_TRACKED_EVENTS) {
      this.events.shift();
    }

    console.log(`[EventDeduplication] Tracking new event: ${eventName} (${this.events.length} tracked)`);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const beforeCount = this.events.length;

    // Remove entries older than TTL
    this.events = this.events.filter(e => (now - e.timestamp) < TTL_MS);

    if (this.events.length < beforeCount) {
      console.log(`[EventDeduplication] Cleaned up ${beforeCount - this.events.length} expired entries`);
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 1000);

    console.log('[EventDeduplication] Cleanup started (1s interval)');
  }

  /**
   * Stop cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[EventDeduplication] Cleanup stopped');
    }
  }

  /**
   * Get current deduplication state for debugging
   */
  getState() {
    return {
      trackedEvents: this.events.length,
      cachedHashes: this.hashCache.size,
      events: this.events.map(e => ({
        eventName: e.eventName,
        age: Date.now() - e.timestamp,
        hash: e.hash
      }))
    };
  }

  /**
   * Clear all tracked events
   */
  clear(): void {
    console.log(`[EventDeduplication] Clearing ${this.events.length} tracked events`);
    this.events = [];
    this.hashCache.clear();
  }
}

// Export singleton instance
const eventDeduplication = new EventDeduplication();

export default eventDeduplication;
