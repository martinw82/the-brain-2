/**
 * Sync Module - Network detection and write queue sync engine
 * Handles offline/online transitions and syncs changes back to DB on reconnect
 */

import { cache } from "./cache.js";

const NETWORK_CHECK_INTERVAL = 5000; // 5 seconds when offline
const NETWORK_PING_CACHE_TIME = 3000; // 3 seconds
const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // exponential backoff

let monitoringInterval = null;
let lastPingTime = null;
let lastPingResult = null;
let onStatusChangeCallback = null;
let onSyncStartCallback = null;
let onSyncCompleteCallback = null;
let onSyncErrorCallback = null;

export const sync = {
  // ────────────────────────────────────────────────────────────────
  // Online Detection
  // ────────────────────────────────────────────────────────────────

  /**
   * Check if online using hybrid approach
   * Uses navigator.onLine + actual API ping (with caching to avoid hammering)
   * @returns {Promise<boolean>}
   */
  async isOnline() {
    // Quick check: navigator.onLine
    if (!navigator.onLine) {
      cache.setOnline(false);
      return false;
    }

    // Use cached ping result if recent
    const now = Date.now();
    if (lastPingTime && now - lastPingTime < NETWORK_PING_CACHE_TIME) {
      return lastPingResult;
    }

    // Perform actual ping to verify connectivity
    try {
      const response = await fetch("/api/auth?action=me", {
        method: "HEAD",
        cache: "no-store",
      });
      lastPingResult = response.ok || response.status === 401; // 401 means auth issue, not network
      lastPingTime = now;
      cache.setOnline(lastPingResult);
      return lastPingResult;
    } catch (e) {
      // Network error
      lastPingResult = false;
      lastPingTime = now;
      cache.setOnline(false);
      return false;
    }
  },

  // ────────────────────────────────────────────────────────────────
  // Monitoring
  // ────────────────────────────────────────────────────────────────

  /**
   * Start monitoring online/offline events
   * Automatically syncs on reconnect
   */
  startMonitoring() {
    // Listen to browser online/offline events
    window.addEventListener("online", () => this._onOnline());
    window.addEventListener("offline", () => this._onOffline());

    // Periodic check when offline
    if (monitoringInterval) clearInterval(monitoringInterval);
    monitoringInterval = setInterval(async () => {
      const isOnline = await this.isOnline();
      if (isOnline && !cache.isOnline()) {
        this._onOnline();
      }
    }, NETWORK_CHECK_INTERVAL);
  },

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
    window.removeEventListener("online", () => this._onOnline());
    window.removeEventListener("offline", () => this._onOffline());
  },

  /**
   * @private
   */
  async _onOnline() {
    cache.setOnline(true);
    console.log("[Sync] Reconnected to network, starting sync...");
    if (onStatusChangeCallback) onStatusChangeCallback("online");
    await this.fullSync();
  },

  /**
   * @private
   */
  _onOffline() {
    cache.setOnline(false);
    console.log("[Sync] Lost network connection, offline mode active");
    if (onStatusChangeCallback) onStatusChangeCallback("offline");
  },

  // ────────────────────────────────────────────────────────────────
  // Sync Operations
  // ────────────────────────────────────────────────────────────────

  /**
   * Perform full sync: process write queue with diff-based approach
   * Only fetches collections that have queued writes
   * @returns {Promise<void>}
   */
  async fullSync() {
    if (onSyncStartCallback) onSyncStartCallback();

    const writeQueue = cache.getWriteQueue();
    if (writeQueue.length === 0) {
      console.log("[Sync] No pending writes");
      if (onSyncCompleteCallback) onSyncCompleteCallback(0);
      return;
    }

    console.log(`[Sync] Processing ${writeQueue.length} queued writes...`);

    // Get unique resources with queued writes
    const affectedResources = [...new Set(writeQueue.map((w) => w.resource))];
    let syncedCount = 0;
    let failedCount = 0;

    // Process each resource's queued writes
    for (const resource of affectedResources) {
      const queuedWrites = writeQueue.filter((w) => w.resource === resource);
      console.log(`[Sync] Syncing ${queuedWrites.length} writes to ${resource}...`);

      for (const queuedWrite of queuedWrites) {
        try {
          await this._processSingleWrite(queuedWrite);
          syncedCount++;
        } catch (e) {
          console.error(`[Sync] Failed to sync ${queuedWrite.id}:`, e);
          failedCount++;
          // Update retry count
          const retries = (queuedWrite.retries || 0) + 1;
          if (retries < MAX_RETRIES) {
            cache.updateWriteStatus(queuedWrite.id, "pending", retries);
          } else {
            cache.updateWriteStatus(queuedWrite.id, "failed", retries);
          }
        }
      }
    }

    console.log(`[Sync] Completed: ${syncedCount} synced, ${failedCount} failed`);
    if (onSyncCompleteCallback) onSyncCompleteCallback(syncedCount);
  },

  /**
   * Process a single queued write with conflict detection
   * @private
   * @param {Object} queuedWrite
   * @returns {Promise<void>}
   */
  async _processSingleWrite(queuedWrite) {
    const { id, type, resource, action, params } = queuedWrite;

    // Retry logic with exponential backoff
    let retryCount = queuedWrite.retries || 0;
    let lastError = null;

    while (retryCount < MAX_RETRIES) {
      try {
        // Execute API call
        const response = await fetch("/api/projects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...params }),
        });

        if (!response.ok) {
          if (response.status === 409) {
            // Conflict detected - compare timestamps
            const data = await response.json();
            await this._handleConflict(queuedWrite, data);
            cache.dequeueWrite(id);
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        // Success - remove from queue
        cache.dequeueWrite(id);
        console.log(`[Sync] ✓ Synced ${id}`);
        return;
      } catch (e) {
        lastError = e;
        retryCount++;

        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retryCount - 1];
          console.log(
            `[Sync] Retry ${retryCount}/${MAX_RETRIES} for ${id} in ${delay}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    // Max retries exceeded
    throw lastError || new Error("Max retries exceeded");
  },

  /**
   * Handle conflict when same entity modified locally and remotely
   * Uses timestamp-based comparison: whichever is newer wins
   * @private
   * @param {Object} queuedWrite
   * @param {Object} conflictData - Server response with conflict info
   * @returns {Promise<void>}
   */
  async _handleConflict(queuedWrite, conflictData) {
    const { resource, params } = queuedWrite;
    const localVersion = params; // Local entity from write params
    const serverVersion = conflictData.serverVersion; // Server entity

    if (!serverVersion) {
      console.warn("[Sync] Conflict detected but no server version provided");
      return;
    }

    // Compare timestamps (using updated_at)
    const localTime = new Date(localVersion.updated_at || 0).getTime();
    const serverTime = new Date(serverVersion.updated_at || 0).getTime();
    let resolution = "server"; // default

    if (localTime > serverTime) {
      resolution = "local";
      console.log(
        `[Sync] Conflict: local is newer (${localTime} > ${serverTime}), keeping local`
      );
    } else if (serverTime > localTime) {
      resolution = "server";
      console.log(
        `[Sync] Conflict: server is newer (${serverTime} > ${localTime}), keeping server`
      );
    } else {
      resolution = "local"; // equal = local wins as tiebreaker
      console.log("[Sync] Conflict: timestamps equal, keeping local (tiebreaker)");
    }

    // Record conflict for debugging
    cache.recordConflict(resource, localVersion.id, localVersion, serverVersion, resolution);

    // Update local cache with resolved version
    if (resolution === "server") {
      // Update cache with server version
      cache.setEntity(resource, serverVersion);
    }
    // If resolution === "local", keep local version (already in cache)
  },

  /**
   * Manually trigger sync (for "Sync Now" button)
   * @returns {Promise<void>}
   */
  async manualSync() {
    const isOnline = await this.isOnline();
    if (!isOnline) {
      console.log("[Sync] Cannot sync while offline");
      return;
    }
    await this.fullSync();
  },

  // ────────────────────────────────────────────────────────────────
  // Event Callbacks
  // ────────────────────────────────────────────────────────────────

  /**
   * Register callback for status changes
   * @param {Function} callback - (status: "online"|"offline") => void
   */
  onStatusChange(callback) {
    onStatusChangeCallback = callback;
  },

  /**
   * Register callback for sync start
   * @param {Function} callback - () => void
   */
  onSyncStart(callback) {
    onSyncStartCallback = callback;
  },

  /**
   * Register callback for sync completion
   * @param {Function} callback - (syncedCount: number) => void
   */
  onSyncComplete(callback) {
    onSyncCompleteCallback = callback;
  },

  /**
   * Register callback for sync errors
   * @param {Function} callback - (error: Error) => void
   */
  onSyncError(callback) {
    onSyncErrorCallback = callback;
  },

  // ────────────────────────────────────────────────────────────────
  // Utilities
  // ────────────────────────────────────────────────────────────────

  /**
   * Get current sync status
   * @returns {Object} {online: boolean, queuedWrites: number, lastSync: string}
   */
  getStatus() {
    const cacheObj = cache.init();
    return {
      online: cacheObj.isOnline,
      queuedWrites: cacheObj.writeQueue.length,
      lastSync: cacheObj.collections.projects?.synced_at || null,
    };
  },

  /**
   * Clear all sync state (for testing)
   */
  reset() {
    lastPingTime = null;
    lastPingResult = null;
    cache.clearConflictLog();
    cache.getWriteQueue().forEach((w) => cache.dequeueWrite(w.id));
  },
};

export default sync;
