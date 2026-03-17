import { tags as tagsApi } from '../api.js';
import { C, S } from '../utils/constants.js';
import { TagPill } from '../components/UI/SmallComponents.jsx';

/**
 * Hook for tag operations: get, attach, detach, and QuickTagRow component.
 */
export default function useTagOps(deps) {
  const {
    entityTags,
    setEntityTags,
    userTags,
    setUserTags,
    tagInput,
    setTagInput,
    showToast,
  } = deps;

  const getEntityTags = (type, id) =>
    entityTags.filter(
      (et) => et.entity_type === type && String(et.entity_id) === String(id)
    );

  const attachTag = async (
    entityType,
    entityId,
    tagName,
    color = '#3b82f6'
  ) => {
    try {
      const res = await tagsApi.attachByName(
        tagName.trim(),
        entityType,
        entityId,
        color
      );
      setEntityTags((prev) => [
        ...prev.filter(
          (et) =>
            !(
              et.tag_id === res.tag_id &&
              et.entity_type === entityType &&
              String(et.entity_id) === String(entityId)
            )
        ),
        res,
      ]);
      setUserTags((prev) =>
        prev.find((t) => t.id === res.tag_id)
          ? prev
          : [...prev, { id: res.tag_id, name: res.name, color: res.color }]
      );
    } catch (e) {
      showToast('Failed to attach tag');
    }
  };

  const detachTag = async (entityType, entityId, tagId) => {
    try {
      await tagsApi.detach(tagId, entityType, entityId);
      setEntityTags((prev) =>
        prev.filter(
          (et) =>
            !(
              et.tag_id === tagId &&
              et.entity_type === entityType &&
              String(et.entity_id) === String(entityId)
            )
        )
      );
    } catch (e) {
      showToast('Failed to remove tag');
    }
  };

  const QuickTagRow = ({ entityType, entityId }) => {
    const key = `${entityType}:${entityId}`;
    const tags = getEntityTags(entityType, entityId);
    const inputVal = tagInput[key] || '';
    const suggestions =
      inputVal.length >= 1
        ? userTags.filter(
            (t) =>
              t.name.toLowerCase().includes(inputVal.toLowerCase()) &&
              !tags.find((et) => et.tag_id === t.id)
          )
        : [];
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          alignItems: 'center',
          marginTop: 4,
        }}
      >
        {tags.map((t) => (
          <TagPill
            key={t.id}
            tag={t}
            onRemove={() => detachTag(entityType, entityId, t.tag_id)}
          />
        ))}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <input
            style={{
              ...S.input,
              width: 90,
              padding: '1px 5px',
              fontSize: 9,
              height: 18,
            }}
            placeholder="+ tag"
            value={inputVal}
            onChange={(e) =>
              setTagInput((prev) => ({ ...prev, [key]: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputVal.trim()) {
                attachTag(entityType, entityId, inputVal.trim());
                setTagInput((prev) => ({ ...prev, [key]: '' }));
                e.preventDefault();
              }
            }}
          />
          {suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 20,
                left: 0,
                zIndex: 50,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                minWidth: 120,
              }}
            >
              {suggestions.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '3px 8px',
                    fontSize: 9,
                    cursor: 'pointer',
                    color: t.color,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    attachTag(entityType, entityId, t.name, t.color);
                    setTagInput((prev) => ({ ...prev, [key]: '' }));
                  }}
                >
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return { getEntityTags, attachTag, detachTag, QuickTagRow };
}
