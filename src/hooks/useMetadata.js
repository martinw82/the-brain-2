import { useCallback, useEffect } from 'react';
import {
  fileMetadata as fileMetadataApi,
  aiMetadata as aiMetadataApi,
  tags as tagsApi,
} from '../api.js';

/**
 * Hook for file metadata CRUD + AI metadata suggestions.
 */
export default function useMetadata(deps) {
  const {
    hubId,
    hub,
    projects,
    fileMeta,
    setFileMeta,
    setLoadingMetadata,
    setAiSuggestions,
    setLoadingAiSuggestions,
    userSettings,
    showToast,
    loadEntityTags,
  } = deps;

  const fetchMetadata = async (projId, filePath) => {
    setLoadingMetadata(true);
    try {
      const res = await fileMetadataApi.get(projId, filePath);
      setFileMeta(res.metadata || null);
    } catch (e) {
      console.error('Failed to fetch metadata:', e);
      setFileMeta(null);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const saveMetadata = async (projId, filePath, data) => {
    try {
      if (fileMeta?.id) {
        await fileMetadataApi.update(fileMeta.id, data);
      } else {
        await fileMetadataApi.create({
          project_id: projId,
          file_path: filePath,
          ...data,
        });
      }
      // Fetch fresh to sync state
      await fetchMetadata(projId, filePath);
      showToast('✓ Metadata saved');
    } catch (e) {
      console.error('Failed to save metadata:', e);
      showToast('⚠ Metadata save failed');
    }
  };

  const requestAiSuggestions = useCallback(async () => {
    if (!hubId || !hub?.activeFile) return;
    const content = hub.files?.[hub.activeFile];
    if (!content) return;

    setLoadingAiSuggestions(true);
    try {
      const project = projects.find((p) => p.id === hubId);
      const res = await aiMetadataApi.suggest(
        hubId,
        hub.activeFile,
        content,
        project?.name,
        project?.phase
      );
      setAiSuggestions(res);
    } catch (e) {
      console.error('AI suggestions failed:', e);
      setAiSuggestions({ error: 'Failed to get suggestions' });
    } finally {
      setLoadingAiSuggestions(false);
    }
  }, [hubId, hub?.activeFile, hub?.files, projects]);

  const acceptAiSuggestion = useCallback(
    (type, value) => {
      showToast(`✓ Applied ${type}: ${value}`);
      if (type === 'tag') {
        const fileEntityId = `${hubId}/${hub.activeFile}`;
        tagsApi
          .attachByName(value, 'file', fileEntityId)
          .then(() => {
            loadEntityTags();
          })
          .catch(e => console.error('[sync]', e.message));
      }
    },
    [hubId, hub?.activeFile]
  );

  // Auto-request suggestions when file changes (if enabled)
  useEffect(() => {
    if (hubId && hub?.activeFile && userSettings?.aiMetadataAutoSuggest) {
      const timer = setTimeout(() => requestAiSuggestions(), 500);
      return () => clearTimeout(timer);
    }
  }, [
    hubId,
    hub?.activeFile,
    requestAiSuggestions,
    userSettings?.aiMetadataAutoSuggest,
  ]);

  return {
    fetchMetadata,
    saveMetadata,
    requestAiSuggestions,
    acceptAiSuggestion,
  };
}
