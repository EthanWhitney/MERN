/**
 * PHASE 3.1: Offline Message Queue
 * 
 * Persists outgoing events to localStorage when socket is disconnected.
 * Auto-flushes queue when socket reconnects.
 * 
 * Usage:
 *   offlineQueue.queue('event-name', data)  // Queues or sends immediately if connected
 *   offlineQueue.flush()                     // Manually flush queue
 *   offlineQueue.clear()                     // Clear queue without sending
 */

import { Socket } from 'socket.io-client';

interface QueuedEvent {
  id: string;
  eventName: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

const STORAGE_KEY = 'syncord_offline_queue';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;

class OfflineQueue {
  private socket: Socket | null = null;
  private queue: QueuedEvent[] = [];
  private isFlushing = false;
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Load queue from localStorage on init
    this.loadFromStorage();
  }

  /**
   * Set the socket instance for this queue
   * Should be called after socket creation
   */
  setSocket(socket: Socket | null): void {
    this.socket = socket;

    if (socket) {
      console.log('[OfflineQueue] Socket attached');

      // Start periodic flush attempts (every 10s) in case socket gets disconnected
      this.startFlushInterval();

      // On socket reconnect, flush the queue
      socket.on('connect', () => {
        console.log('[OfflineQueue] Socket connected, flushing queue');
        this.flush();
      });

      // Flush any pending events immediately if socket is connected
      if (socket.connected && this.queue.length > 0) {
        console.log('[OfflineQueue] Socket already connected, flushing pending queue');
        this.flush();
      }
    } else {
      // Socket disconnected - stop flush interval
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
        this.flushInterval = null;
      }
      console.log('[OfflineQueue] Socket detached');
    }
  }

  /**
   * Queue an event for sending
   * If socket is connected, send immediately
   * If disconnected, persist to queue and localStorage
   */
  queueEvent(eventName: string, data: any): void {
    // If socket connected, send immediately
    if (this.socket?.connected) {
      console.log(`[OfflineQueue] Socket connected, emitting ${eventName} immediately`);
      this.socket.emit(eventName, data);
      return;
    }

    // Socket disconnected - queue the event
    const queuedEvent: QueuedEvent = {
      id: `${Date.now()}-${Math.random()}`,
      eventName,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    // Check queue size limit
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      console.warn(`[OfflineQueue] Queue full (${MAX_QUEUE_SIZE}), dropping oldest event`);
      this.queue.shift();
    }

    this.queue.push(queuedEvent);
    console.log(`[OfflineQueue] Queued event ${eventName} (queue size: ${this.queue.length})`);

    // Save to localStorage
    this.saveToStorage();
  }

  /**
   * Flush the entire queue to the socket
   * Events are sent in order
   */
  async flush(): Promise<void> {
    if (!this.queue.length) {
      console.log('[OfflineQueue] Queue empty, nothing to flush');
      return;
    }

    if (!this.socket?.connected) {
      console.warn('[OfflineQueue] Socket not connected, cannot flush queue');
      return;
    }

    if (this.isFlushing) {
      console.log('[OfflineQueue] Flush already in progress, skipping');
      return;
    }

    this.isFlushing = true;

    try {
      const eventsToSend = [...this.queue]; // Copy queue
      console.log(`[OfflineQueue] Flushing ${eventsToSend.length} queued event(s)`);

      for (const event of eventsToSend) {
        if (!this.socket.connected) {
          console.warn('[OfflineQueue] Socket disconnected during flush, stopping');
          break;
        }

        try {
          console.log(`[OfflineQueue] Sending queued event: ${event.eventName}`);
          this.socket.emit(event.eventName, event.data);

          // Remove from queue after successful send
          this.queue = this.queue.filter(e => e.id !== event.id);
          this.saveToStorage();

          // Small delay between events to prevent overwhelming server
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err) {
          console.error(`[OfflineQueue] Error sending queued event ${event.eventName}:`, err);
          event.retryCount++;

          if (event.retryCount >= MAX_RETRIES) {
            console.error(`[OfflineQueue] Max retries reached for ${event.eventName}, dropping event`);
            this.queue = this.queue.filter(e => e.id !== event.id);
            this.saveToStorage();
          }
        }
      }

      console.log(`[OfflineQueue] Flush complete, ${this.queue.length} events remaining`);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Clear the queue without sending
   */
  clear(): void {
    console.log(`[OfflineQueue] Clearing queue (${this.queue.length} events)`);
    this.queue = [];
    this.clearStorage();
  }

  /**
   * Get current queue state for debugging
   */
  getState() {
    return {
      queueLength: this.queue.length,
      socketConnected: this.socket?.connected ?? false,
      isFlushing: this.isFlushing,
      events: this.queue.map(e => ({
        eventName: e.eventName,
        timestamp: e.timestamp,
        retryCount: e.retryCount
      }))
    };
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    try {
      const serialized = JSON.stringify(this.queue);
      localStorage.setItem(STORAGE_KEY, serialized);
      console.log(`[OfflineQueue] Saved ${this.queue.length} events to localStorage`);
    } catch (err) {
      console.error('[OfflineQueue] Error saving to localStorage:', err);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`[OfflineQueue] Loaded ${this.queue.length} events from localStorage`);
      }
    } catch (err) {
      console.error('[OfflineQueue] Error loading from localStorage:', err);
      this.queue = [];
      this.clearStorage();
    }
  }

  /**
   * Clear localStorage
   */
  private clearStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('[OfflineQueue] Error clearing localStorage:', err);
    }
  }

  /**
   * Start periodic flush attempts
   */
  private startFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      if (this.socket?.connected && this.queue.length > 0) {
        console.log('[OfflineQueue] Periodic flush triggered');
        this.flush();
      }
    }, 10000); // Every 10 seconds

    console.log('[OfflineQueue] Flush interval started (10s)');
  }
}

// Export singleton instance
const offlineQueue = new OfflineQueue();

export default offlineQueue;
