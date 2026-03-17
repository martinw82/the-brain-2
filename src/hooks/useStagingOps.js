import { staging as stagingApi } from '../api.js';

/**
 * Hook for staging operations: add, update status, move to folder.
 */
export default function useStagingOps(deps) {
  const { staging, setStaging, hubId, hub, setProjects, showToast } = deps;

  const addStaging = async (item) => {
    const tmp = {
      ...item,
      id: `tmp-${Date.now()}`,
      status: 'in-review',
      added: new Date().toISOString().slice(0, 7),
    };
    setStaging((prev) => [...prev, tmp]);
    try {
      const res = await stagingApi.create({
        ...item,
        project_id: item.project,
      });
      setStaging((prev) =>
        prev.map((s) => (s.id === tmp.id ? { ...s, id: res.id } : s))
      );
    } catch {
      showToast('⚠ Staging save failed');
    }
  };

  const updateStagingStatus = async (id, status) => {
    setStaging((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    await stagingApi.update(id, { status }).catch(() => {});
  };

  const moveToFolder = async (stagingId, folderId) => {
    const item = staging.find((s) => s.id === stagingId);
    if (!item || !hub) return;

    setStaging((prev) =>
      prev.map((s) =>
        s.id === stagingId
          ? {
              ...s,
              folder_path: `${folderId}/${item.name}`,
              filed_at: new Date().toISOString(),
            }
          : s
      )
    );

    try {
      const res = await stagingApi.moveToFolder(stagingId, folderId, item.name);

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== hubId) return p;
          const files = { ...(p.files || {}) };
          const oldPath = `staging/${item.name}`;
          const newPath = res.folder_path;

          if (files[oldPath]) {
            files[newPath] = files[oldPath];
            delete files[oldPath];
          }
          return { ...p, files };
        })
      );

      showToast(`✓ Filed as ${res.folder_path}`);
    } catch (e) {
      setStaging((prev) =>
        prev.map((s) =>
          s.id === stagingId ? { ...s, folder_path: null, filed_at: null } : s
        )
      );
      showToast('⚠ Failed to file item');
    }
  };

  return { addStaging, updateStagingStatus, moveToFolder };
}
