/**
 * Desktop File Sync Module - Phase 2.4B
 * Manages bi-directional sync between desktop folders and cloud project files
 * Uses File System Access API for browser-based folder access
 */

import { cache } from "./cache.js";

/**
 * Compute SHA256 hash of content
 * @param {string|Uint8Array} content
 * @returns {Promise<string>} hex string
 */
async function hashContent(content) {
  const encoder = new TextEncoder();
  const data =
    typeof content === "string" ? encoder.encode(content) : content;
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get all files from a directory handle recursively
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} prefix path prefix
 * @returns {Promise<Map<string, File>>} Map of path -> File object
 */
async function getDirectoryFiles(dirHandle, prefix = "") {
  const files = new Map();

  for await (const [name, handle] of dirHandle.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;

    if (handle.kind === "file") {
      files.set(path, handle);
    } else if (handle.kind === "directory") {
      const subFiles = await getDirectoryFiles(handle, path);
      for (const [subPath, file] of subFiles) {
        files.set(subPath, file);
      }
    }
  }

  return files;
}

/**
 * Read file content from FileSystemFileHandle
 * @param {FileSystemFileHandle} fileHandle
 * @returns {Promise<string>}
 */
async function readFileContent(fileHandle) {
  const file = await fileHandle.getFile();
  return file.text();
}

/**
 * Write content to file in directory
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} filePath relative path
 * @param {string} content
 */
async function writeFileContent(dirHandle, filePath, content) {
  const parts = filePath.split("/");
  const fileName = parts.pop();

  let currentDir = dirHandle;
  for (const part of parts) {
    currentDir = await currentDir.getDirectoryHandle(part, {
      create: true,
    });
  }

  const fileHandle = await currentDir.getFileHandle(fileName, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Delete file from directory
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} filePath relative path
 */
async function deleteFileFromDisk(dirHandle, filePath) {
  const parts = filePath.split("/");
  const fileName = parts.pop();

  let currentDir = dirHandle;
  for (const part of parts) {
    try {
      currentDir = await currentDir.getDirectoryHandle(part);
    } catch {
      return; // Parent dir doesn't exist
    }
  }

  try {
    await currentDir.removeEntry(fileName);
  } catch {
    // File already deleted
  }
}

export const desktopSync = {
  // ────────────────────────────────────────────────────────────────
  // Folder Management
  // ────────────────────────────────────────────────────────────────

  /**
   * Request user to select a desktop folder via File System Access API
   * @returns {Promise<FileSystemDirectoryHandle|null>}
   */
  async selectFolder() {
    try {
      if (!window.showDirectoryPicker) {
        console.warn("File System Access API not supported");
        return null;
      }

      const dirHandle = await window.showDirectoryPicker({
        mode: "readwrite",
        startIn: "documents",
      });
      return dirHandle;
    } catch (e) {
      if (e.name !== "AbortError") console.error("Folder picker error:", e);
      return null;
    }
  },

  /**
   * Save folder handle for persistence (requires user activation)
   * Uses IndexedDB to store handle metadata
   * @param {string} projectId
   * @param {FileSystemDirectoryHandle} dirHandle
   * @returns {Promise<string>} handle key for persistence
   */
  async saveFolderHandle(projectId, dirHandle) {
    try {
      // Get permission before storing
      const permission = await dirHandle.requestPermission({
        mode: "readwrite",
      });
      if (permission !== "granted") {
        throw new Error("Permission denied");
      }

      // Store handle in IndexedDB for persistence
      const handleKey = `sync_folder_${projectId}`;
      if ("storage" in navigator && "getDirectory" in navigator.storage) {
        // Store in browser's persistent storage
        const dbRequest = indexedDB.open("brain_sync_storage");

        return new Promise((resolve, reject) => {
          dbRequest.onsuccess = () => {
            const db = dbRequest.result;
            const transaction = db.transaction("handles", "readwrite");
            const store = transaction.objectStore("handles");

            store.put({
              key: handleKey,
              handle: dirHandle,
              timestamp: new Date().toISOString(),
            });

            transaction.oncomplete = () => resolve(handleKey);
            transaction.onerror = () =>
              reject(new Error("IndexedDB error"));
          };

          dbRequest.onerror = () =>
            reject(new Error("IndexedDB open error"));
        });
      }

      return handleKey;
    } catch (e) {
      console.error("Save folder handle error:", e);
      throw e;
    }
  },

  /**
   * Retrieve folder handle from persistence
   * @param {string} projectId
   * @returns {Promise<FileSystemDirectoryHandle|null>}
   */
  async getFolderHandle(projectId) {
    try {
      const handleKey = `sync_folder_${projectId}`;
      const dbRequest = indexedDB.open("brain_sync_storage");

      return new Promise((resolve) => {
        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          const transaction = db.transaction("handles", "readonly");
          const store = transaction.objectStore("handles");
          const request = store.get(handleKey);

          request.onsuccess = () => {
            const result = request.result;
            resolve(result ? result.handle : null);
          };

          request.onerror = () => resolve(null);
        };

        dbRequest.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  // ────────────────────────────────────────────────────────────────
  // File Detection & Hashing
  // ────────────────────────────────────────────────────────────────

  /**
   * Detect changes in desktop folder compared to last sync state
   * @param {FileSystemDirectoryHandle} dirHandle
   * @param {Map<string, {desktopHash, cloudHash}>} previousState
   * @returns {Promise<{added: [], modified: [], deleted: []}>}
   */
  async detectChanges(dirHandle, previousState = new Map()) {
    const desktopFiles = await getDirectoryFiles(dirHandle);
    const currentState = new Map();
    const added = [];
    const modified = [];

    // Compute hashes for all desktop files
    for (const [path, fileHandle] of desktopFiles) {
      const content = await readFileContent(fileHandle);
      const hash = await hashContent(content);
      currentState.set(path, {
        hash,
        content,
        modified: (await fileHandle.getFile()).lastModified,
      });

      const previousHash = previousState.get(path)?.desktopHash;

      if (!previousHash) {
        added.push({ path, hash, content });
      } else if (previousHash !== hash) {
        modified.push({ path, hash, content });
      }
    }

    // Detect deleted files
    const deleted = [];
    for (const [path, state] of previousState) {
      if (!currentState.has(path)) {
        deleted.push(path);
      }
    }

    return {
      added,
      modified,
      deleted,
      currentState,
    };
  },

  // ────────────────────────────────────────────────────────────────
  // Conflict Detection
  // ────────────────────────────────────────────────────────────────

  /**
   * Detect conflicts between desktop and cloud versions
   * @param {Object} changes from detectChanges()
   * @param {Array} cloudFiles from project
   * @returns {Array} conflicts with both versions
   */
  async detectConflicts(changes, cloudFiles) {
    const conflicts = [];

    // Check each modified file for cloud changes
    for (const file of changes.modified) {
      const cloudFile = cloudFiles.find((f) => f.path === file.path);
      if (!cloudFile) continue;

      const cloudHash = await hashContent(cloudFile.content);
      const previousDesktopHash = this._getSyncState(file.path)
        ?.desktopHash;

      // Conflict if both changed since last sync
      if (
        previousDesktopHash &&
        previousDesktopHash !== cloudHash &&
        cloudHash !== file.hash
      ) {
        conflicts.push({
          path: file.path,
          desktop: { hash: file.hash, content: file.content },
          cloud: { hash: cloudHash, content: cloudFile.content },
          desktopModified: file.modified,
          cloudModified: cloudFile.updated_at,
        });
      }
    }

    return conflicts;
  },

  // ────────────────────────────────────────────────────────────────
  // Bi-directional Sync
  // ────────────────────────────────────────────────────────────────

  /**
   * Perform bi-directional sync with conflict resolution
   * @param {FileSystemDirectoryHandle} dirHandle
   * @param {string} projectId
   * @param {Array} cloudFiles from project
   * @param {Function} onConflict callback for conflict resolution
   * @returns {Promise<{synced, failed, conflicts}>}
   */
  async syncFiles(
    dirHandle,
    projectId,
    cloudFiles,
    onConflict = null
  ) {
    const syncState = cache.getCollection("sync_state");
    const state = syncState.data.find((s) => s.project_id === projectId);

    if (!state) {
      throw new Error("Sync state not found for project");
    }

    // Detect changes on desktop
    const previousState = this._loadPreviousSyncState(projectId);
    const changes = await this.detectChanges(dirHandle, previousState);

    // Detect conflicts
    const conflicts = await this.detectConflicts(changes, cloudFiles);

    // Handle conflicts
    let conflictResolutions = {};
    if (conflicts.length > 0 && onConflict) {
      conflictResolutions = await onConflict(conflicts);
    }

    let synced = 0;
    let failed = 0;

    // Apply desktop → cloud (uploads)
    for (const file of changes.added) {
      try {
        await this._uploadFile(projectId, file.path, file.content);
        synced++;
      } catch (e) {
        console.error(`Upload failed for ${file.path}:`, e);
        failed++;
      }
    }

    for (const file of changes.modified) {
      const resolution = conflictResolutions[file.path];

      if (resolution === "desktop" || !resolution) {
        // Desktop wins or no conflict
        try {
          await this._uploadFile(projectId, file.path, file.content);
          synced++;
        } catch (e) {
          console.error(`Upload failed for ${file.path}:`, e);
          failed++;
        }
      } else {
        // Cloud wins - will be downloaded below
        synced++;
      }
    }

    // Apply cloud → desktop (downloads)
    for (const cloudFile of cloudFiles) {
      // Check if this file was in our deleted list
      if (changes.deleted.includes(cloudFile.path)) {
        continue; // User deleted locally, don't download
      }

      const desktopPath = cloudFile.path;
      const previousDesktopHash = previousState.get(desktopPath)?.hash;
      const cloudHash = await hashContent(cloudFile.content);

      // Download if new on cloud or if cloud version is newer (in conflict)
      const resolution = conflictResolutions[desktopPath];
      const shouldDownload =
        !previousDesktopHash || resolution === "cloud";

      if (shouldDownload) {
        try {
          await writeFileContent(dirHandle, desktopPath, cloudFile.content);
          synced++;
        } catch (e) {
          console.error(`Download failed for ${desktopPath}:`, e);
          failed++;
        }
      }
    }

    // Delete files on desktop if deleted in cloud
    for (const path of changes.deleted) {
      // Only delete if not re-created locally after sync
      if (!changes.added.find((f) => f.path === path)) {
        try {
          await deleteFileFromDisk(dirHandle, path);
          synced++;
        } catch (e) {
          console.error(`Delete failed for ${path}:`, e);
          failed++;
        }
      }
    }

    // Update sync state
    await this._updateSyncState(projectId, changes.currentState);

    return {
      synced,
      failed,
      conflicts: conflicts.length,
      details: {
        uploaded: changes.added.length + changes.modified.length,
        downloaded: cloudFiles.filter(
          (f) => !changes.deleted.includes(f.path)
        ).length,
        deleted: changes.deleted.length,
      },
    };
  },

  // ────────────────────────────────────────────────────────────────
  // Internal State Management
  // ────────────────────────────────────────────────────────────────

  /**
   * Load previous sync state for a project
   * @private
   * @param {string} projectId
   * @returns {Map}
   */
  _loadPreviousSyncState(projectId) {
    const syncFiles = cache.getCollection("sync_file_state");
    const state = new Map();

    if (syncFiles.data) {
      syncFiles.data
        .filter((f) => f.project_id === projectId)
        .forEach((f) => {
          state.set(f.file_path, {
            desktopHash: f.desktop_content_hash,
            cloudHash: f.cloud_content_hash,
          });
        });
    }

    return state;
  },

  /**
   * Update sync state after successful sync
   * @private
   * @param {string} projectId
   * @param {Map} currentState
   */
  async _updateSyncState(projectId, currentState) {
    // Update last_sync_at in database via API
    try {
      const response = await fetch("/api/data?resource=sync_state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          last_sync_at: new Date().toISOString(),
          sync_status: "idle",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e) {
      console.error("Failed to update sync state:", e);
    }
  },

  /**
   * Get cached sync state for a file
   * @private
   * @param {string} filePath
   * @returns {Object|null}
   */
  _getSyncState(filePath) {
    // This would be retrieved from actual sync state in production
    // For now, returning null means file is new
    return null;
  },

  /**
   * Upload file to cloud
   * @private
   * @param {string} projectId
   * @param {string} filePath
   * @param {string} content
   */
  async _uploadFile(projectId, filePath, content) {
    const response = await fetch("/api/data?resource=project_files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        path: filePath,
        content,
      }),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: HTTP ${response.status}`);
    }
  },

  // ────────────────────────────────────────────────────────────────
  // Utilities
  // ────────────────────────────────────────────────────────────────

  /**
   * Format file size for display
   * @param {number} bytes
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  },

  /**
   * Check if File System Access API is supported
   * @returns {boolean}
   */
  isSupported() {
    return typeof window !== "undefined" && "showDirectoryPicker" in window;
  },
};

export default desktopSync;
