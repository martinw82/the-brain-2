/**
 * Cache Module - localStorage abstraction for offline-first architecture
 * Manages full app state cache with write queue and conflict tracking
 *
 * Cache Structure:
 * ```
 * brain_cache: {
 *   version: "2.4.0",
 *   timestamp: "2026-03-11T09:45:00Z",
 *   isOnline: true,
 *   lastNetworkCheck: "2026-03-11T09:45:00Z",
 *   collections: {
 *     projects: { version: 1, synced_at: "...", data: [...], _meta: {...} },
 *     staging: { version: 1, synced_at: "...", data: [...], _meta: {...} },
 *     ideas: { ... },
 *     areas: { ... },
 *     goals: { ... },
 *     templates: { ... },
 *     tags: { ... },
 *     entityTags: { ... }
 *   },
 *   writeQueue: [
 *     { id: "uuid", type: "saveFile", resource: "projects", action: "saveFile",
 *       params: {...}, timestamp: "...", status: "pending" }
 *   ],
 *   conflictLog: [
 *     { id: "uuid", resource: "projects", entityId: "...", timestamp: "...",
 *       localVersion: {...}, serverVersion: {...}, resolution: "local" }
 *   ]
 * }
 * ```
 */

const CACHE_KEY = "brain_cache";
const CACHE_VERSION = "2.4.0";

export const cache = {
  // ────────────────────────────────────────────────────────────────
  // Initialization
  // ────────────────────────────────────────────────────────────────

  /**
   * Initialize cache from localStorage or create new
   * @returns {Object} Loaded cache object
   */
  init() {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate version matches
        if (parsed.version !== CACHE_VERSION) {
          console.warn(`Cache version mismatch: ${parsed.version} != ${CACHE_VERSION}, clearing`);
          this.clear();
          return this._createEmpty();
        }
        return parsed;
      }
      return this._createEmpty();
    } catch (e) {
      console.error("Cache init failed:", e);
      return this._createEmpty();
    }
  },

  /**
   * Create empty cache structure
   * @private
   * @returns {Object}
   */
  _createEmpty() {
    return {
      version: CACHE_VERSION,
      timestamp: new Date().toISOString(),
      isOnline: navigator.onLine,
      lastNetworkCheck: new Date().toISOString(),
      collections: {
        projects: { version: 1, synced_at: null, data: [], _meta: {} },
        staging: { version: 1, synced_at: null, data: [], _meta: {} },
        ideas: { version: 1, synced_at: null, data: [], _meta: {} },
        areas: { version: 1, synced_at: null, data: [], _meta: {} },
        goals: { version: 1, synced_at: null, data: [], _meta: {} },
        templates: { version: 1, synced_at: null, data: [], _meta: {} },
        tags: { version: 1, synced_at: null, data: [], _meta: {} },
        entityTags: { version: 1, synced_at: null, data: [], _meta: {} },
      },
      writeQueue: [],
      conflictLog: [],
    };
  },

  /**
   * Save cache to localStorage
   * @private
   */
  _save(cacheObj) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
    } catch (e) {
      console.error("Cache save failed:", e);
      // Quota exceeded - prune old items
      if (e.name === "QuotaExceededError") {
        this.prune();
      }
    }
  },

  // ────────────────────────────────────────────────────────────────
  // Collection Management
  // ────────────────────────────────────────────────────────────────

  /**
   * Get entire collection from cache
   * @param {string} name - Collection name (projects, staging, ideas, etc.)
   * @returns {Object} Collection with {data: [], synced_at, _meta}
   */
  getCollection(name) {
    const cache = this.init();
    return cache.collections[name] || { data: [], synced_at: null, _meta: {} };
  },

  /**
   * Set entire collection in cache
   * @param {string} name - Collection name
   * @param {Array} data - Array of items
   */
  setCollection(name, data) {
    const cacheObj = this.init();
    cacheObj.collections[name] = {
      version: 1,
      synced_at: new Date().toISOString(),
      data: Array.isArray(data) ? data : [],
      _meta: { count: Array.isArray(data) ? data.length : 0, sync_status: "synced" },
    };
    cacheObj.timestamp = new Date().toISOString();
    this._save(cacheObj);
  },

  /**
   * Get single entity from collection
   * @param {string} collectionName
   * @param {string|number} id
   * @returns {Object|null}
   */
  getEntity(collectionName, id) {
    const collection = this.getCollection(collectionName);
    return collection.data.find((item) => item.id === id) || null;
  },

  /**
   * Update single entity in collection
   * @param {string} collectionName
   * @param {string|number} id
   * @param {Object} delta - Properties to merge
   */
  updateEntity(collectionName, id, delta) {
    const cacheObj = this.init();
    const collection = cacheObj.collections[collectionName];
    if (!collection) return;

    const idx = collection.data.findIndex((item) => item.id === id);
    if (idx !== -1) {
      collection.data[idx] = {
        ...collection.data[idx],
        ...delta,
        updated_at: new Date().toISOString(),
      };
    }
    cacheObj.timestamp = new Date().toISOString();
    this._save(cacheObj);
  },

  /**
   * Add or replace entity in collection
   * @param {string} collectionName
   * @param {Object} entity
   */
  setEntity(collectionName, entity) {
    const cacheObj = this.init();
    const collection = cacheObj.collections[collectionName];
    if (!collection) return;

    const idx = collection.data.findIndex((item) => item.id === entity.id);
    if (idx !== -1) {
      collection.data[idx] = { ...collection.data[idx], ...entity };
    } else {
      collection.data.push(entity);
    }
    collection._meta.count = collection.data.length;
    cacheObj.timestamp = new Date().toISOString();
    this._save(cacheObj);
  },

  /**
   * Soft delete entity (mark with deleted_at)
   * @param {string} collectionName
   * @param {string|number} id
   */
  deleteEntity(collectionName, id) {
    this.updateEntity(collectionName, id, {
      deleted_at: new Date().toISOString(),
    });
  },

  // ────────────────────────────────────────────────────────────────
  // Online Status Management
  // ────────────────────────────────────────────────────────────────

  /**
   * Set online status
   * @param {boolean} isOnline
   */
  setOnline(isOnline) {
    const cacheObj = this.init();
    cacheObj.isOnline = isOnline;
    cacheObj.lastNetworkCheck = new Date().toISOString();
    this._save(cacheObj);
  },

  /**
   * Get current online status
   * @returns {boolean}
   */
  isOnline() {
    const cacheObj = this.init();
    return cacheObj.isOnline;
  },

  /**
   * Get last sync time for a collection
   * @param {string} collectionName
   * @returns {string|null} ISO timestamp
   */
  getLastSyncTime(collectionName) {
    const collection = this.getCollection(collectionName);
    return collection.synced_at;
  },

  // ────────────────────────────────────────────────────────────────
  // Write Queue Management
  // ────────────────────────────────────────────────────────────────

  /**
   * Add write operation to queue
   * @param {string} type - Operation type (saveFile, updateProject, etc.)
   * @param {string} resource - Resource type (projects, staging, etc.)
   * @param {string} action - API action
   * @param {Object} params - Operation parameters
   * @returns {string} Queue item ID
   */
  enqueueWrite(type, resource, action, params) {
    const cacheObj = this.init();
    const id = this._generateId();
    cacheObj.writeQueue.push({
      id,
      type,
      resource,
      action,
      params,
      timestamp: new Date().toISOString(),
      status: "pending",
      retries: 0,
      lastAttempt: null,
    });
    cacheObj.timestamp = new Date().toISOString();
    this._save(cacheObj);
    return id;
  },

  /**
   * Get all queued writes
   * @returns {Array}
   */
  getWriteQueue() {
    const cacheObj = this.init();
    return cacheObj.writeQueue || [];
  },

  /**
   * Remove write from queue (after successful sync)
   * @param {string} id - Queue item ID
   */
  dequeueWrite(id) {
    const cacheObj = this.init();
    cacheObj.writeQueue = cacheObj.writeQueue.filter((item) => item.id !== id);
    cacheObj.timestamp = new Date().toISOString();
    this._save(cacheObj);
  },

  /**
   * Update write queue item status
   * @param {string} id - Queue item ID
   * @param {string} status - "pending", "synced", "failed"
   * @param {number} [retries] - Increment retry count
   */
  updateWriteStatus(id, status, retries = null) {
    const cacheObj = this.init();
    const item = cacheObj.writeQueue.find((w) => w.id === id);
    if (item) {
      item.status = status;
      item.lastAttempt = new Date().toISOString();
      if (retries !== null) item.retries = retries;
    }
    cacheObj.timestamp = new Date().toISOString();
    this._save(cacheObj);
  },

  /**
   * Get pending writes for a specific resource
   * @param {string} resource - e.g., "projects", "staging"
   * @returns {Array}
   */
  getQueuedWrites(resource) {
    const cacheObj = this.init();
    return cacheObj.writeQueue.filter(
      (item) => item.resource === resource && item.status === "pending"
    );
  },

  // ────────────────────────────────────────────────────────────────
  // Conflict Detection & Logging
  // ────────────────────────────────────────────────────────────────

  /**
   * Record a conflict for debugging/audit
   * @param {string} resource - Resource type
   * @param {string} entityId - Entity identifier
   * @param {Object} localVersion - Local version of entity
   * @param {Object} serverVersion - Server version of entity
   * @param {string} resolution - How it was resolved
   */
  recordConflict(resource, entityId, localVersion, serverVersion, resolution) {
    const cacheObj = this.init();
    cacheObj.conflictLog.push({
      id: this._generateId(),
      resource,
      entityId,
      timestamp: new Date().toISOString(),
      localVersion,
      serverVersion,
      resolution,
    });
    // Keep only last 100 conflicts to avoid bloat
    if (cacheObj.conflictLog.length > 100) {
      cacheObj.conflictLog = cacheObj.conflictLog.slice(-100);
    }
    cacheObj.timestamp = new Date().toISOString();
    this._save(cacheObj);
  },

  /**
   * Check if there are unresolved conflicts
   * @returns {boolean}
   */
  hasConflicts() {
    const cacheObj = this.init();
    return cacheObj.conflictLog.length > 0;
  },

  /**
   * Get conflict log
   * @returns {Array}
   */
  getConflictLog() {
    const cacheObj = this.init();
    return cacheObj.conflictLog || [];
  },

  /**
   * Clear conflict log
   */
  clearConflictLog() {
    const cacheObj = this.init();
    cacheObj.conflictLog = [];
    cacheObj.timestamp = new Date().toISOString();
    this._save(cacheObj);
  },

  // ────────────────────────────────────────────────────────────────
  // Maintenance
  // ────────────────────────────────────────────────────────────────

  /**
   * Prune old data to manage storage quota
   */
  prune() {
    const cacheObj = this.init();

    // Remove write queue items older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    cacheObj.writeQueue = cacheObj.writeQueue.filter((item) => item.timestamp > sevenDaysAgo);

    // Keep only last 30 days of conflicts
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    cacheObj.conflictLog = cacheObj.conflictLog.filter(
      (item) => item.timestamp > thirtyDaysAgo
    );

    cacheObj.timestamp = new Date().toISOString();
    this._save(cacheObj);
  },

  /**
   * Clear all cached data (on logout)
   */
  clear() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (e) {
      console.error("Cache clear failed:", e);
    }
  },

  /**
   * Get cache size estimate in bytes
   * @returns {number}
   */
  getSize() {
    try {
      const cacheObj = this.init();
      return JSON.stringify(cacheObj).length;
    } catch (e) {
      return 0;
    }
  },

  /**
   * Export cache for debugging
   * @returns {Object}
   */
  export() {
    return this.init();
  },

  // ────────────────────────────────────────────────────────────────
  // Utilities
  // ────────────────────────────────────────────────────────────────

  /**
   * Generate UUID-like ID
   * @private
   * @returns {string}
   */
  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },
};

export default cache;
