import { useState, useEffect } from 'react';
import { C, S } from '../../utils/constants.js';
import { userAISettings } from '../../api.js';

// ── AI PROVIDER SETTINGS COMPONENT ───────────────────────────
const AIProviderSettings = () => {
  const [aiSettings, setAiSettings] = useState({
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    temperature: 0.7,
    api_key: '',
  });
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    // Load settings on mount
    userAISettings
      .get()
      .then((data) => {
        if (data.settings) {
          setAiSettings((prev) => ({ ...prev, ...data.settings, api_key: '' }));
        }
        if (data.providers) setProviders(data.providers);
      })
      .catch(e => console.error('[sync]', e.message));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await userAISettings.update({
        provider: aiSettings.provider,
        model: aiSettings.model,
        max_tokens: aiSettings.max_tokens,
        temperature: aiSettings.temperature,
        api_key: aiSettings.api_key || undefined, // Only send if provided
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert('Failed to save AI settings');
    } finally {
      setLoading(false);
    }
  };

  const handleClearKey = async () => {
    await userAISettings.deleteKey();
    setAiSettings((prev) => ({ ...prev, api_key: '' }));
    alert('API key cleared - will use server default');
  };

  const selectedProvider = providers.find((p) => p.key === aiSettings.provider);
  const models = selectedProvider?.models || ['claude-sonnet-4-6'];

  return (
    <div
      style={{
        padding: '12px',
        background: `${C.purple}08`,
        border: `1px solid ${C.purple}30`,
        borderRadius: 6,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.text,
          marginBottom: 8,
        }}
      >
        🤖 AI Provider
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Provider Selection */}
        <div>
          <span style={{ ...S.label(C.purple), fontSize: 8 }}>Provider</span>
          <select
            style={S.sel}
            value={aiSettings.provider}
            onChange={(e) => {
              const provider = providers.find((p) => p.key === e.target.value);
              setAiSettings((prev) => ({
                ...prev,
                provider: e.target.value,
                model: provider?.models?.[0] || 'claude-sonnet-4-6',
              }));
            }}
          >
            {providers.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name} {p.freeTier ? '(Free tier)' : ''} - ${p.pricing.input}
                /M tok
              </option>
            ))}
          </select>
          <div style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>
            {selectedProvider?.freeTier
              ? '✅ Free tier available'
              : '💳 Paid service'}
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <span style={{ ...S.label(C.purple), fontSize: 8 }}>Model</span>
          <select
            style={S.sel}
            value={aiSettings.model}
            onChange={(e) =>
              setAiSettings((prev) => ({ ...prev, model: e.target.value }))
            }
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* API Key */}
        <div>
          <span style={{ ...S.label(C.purple), fontSize: 8 }}>
            API Key (optional)
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type={showKey ? 'text' : 'password'}
              style={{ ...S.input, flex: 1, fontFamily: 'monospace' }}
              placeholder="Leave blank to use server default"
              value={aiSettings.api_key}
              onChange={(e) =>
                setAiSettings((prev) => ({ ...prev, api_key: e.target.value }))
              }
            />
            <button
              style={{ ...S.btn('ghost'), padding: '5px 10px' }}
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
          <div style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>
            Your key is encrypted.{' '}
            {aiSettings.api_key
              ? '💾 Will be saved'
              : '🌐 Using server default'}
          </div>
        </div>

        {/* Advanced Settings */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
        >
          <div>
            <span style={{ ...S.label(C.purple), fontSize: 8 }}>
              Max Tokens
            </span>
            <input
              type="number"
              style={S.input}
              value={aiSettings.max_tokens}
              onChange={(e) =>
                setAiSettings((prev) => ({
                  ...prev,
                  max_tokens: Number(e.target.value),
                }))
              }
              min={100}
              max={4000}
            />
          </div>
          <div>
            <span style={{ ...S.label(C.purple), fontSize: 8 }}>
              Temperature
            </span>
            <input
              type="number"
              style={S.input}
              value={aiSettings.temperature}
              onChange={(e) =>
                setAiSettings((prev) => ({
                  ...prev,
                  temperature: Number(e.target.value),
                }))
              }
              min={0}
              max={1}
              step={0.1}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            style={{ ...S.btn('primary'), flex: 1, background: C.purple }}
            onClick={handleSave}
            disabled={loading}
          >
            {loading
              ? '⏳ Saving...'
              : saved
                ? '✓ Saved!'
                : '💾 Save AI Settings'}
          </button>
          <button
            style={{ ...S.btn('ghost') }}
            onClick={handleClearKey}
            title="Clear personal API key"
          >
            🗑️ Clear Key
          </button>
        </div>

        {/* Provider Info */}
        <div
          style={{
            fontSize: 8,
            color: C.muted,
            padding: '8px',
            background: C.bg,
            borderRadius: 4,
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <strong>💡 About {selectedProvider?.name}</strong>
          </div>
          <div>
            Input: ${selectedProvider?.pricing?.input}/M tokens | Output: $
            {selectedProvider?.pricing?.output}/M tokens
          </div>
          {selectedProvider?.key === 'deepseek' && (
            <div>🔥 Cheapest option with great quality</div>
          )}
          {selectedProvider?.key === 'mistral' && (
            <div>🎁 Generous free tier available</div>
          )}
          {selectedProvider?.key === 'moonshot' && (
            <div>🇨🇳 Chinese-optimized, good for Asian markets</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIProviderSettings;
