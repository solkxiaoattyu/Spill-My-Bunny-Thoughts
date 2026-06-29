import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, X } from "lucide-react";
import {
  type AiConfig,
  loadAiConfig,
  resolveApiConfig,
  saveAiConfig,
} from "../data/aiConfig";
import { APP_DISPLAY_NAME } from "../data/brand";
import { testApiConnection } from "../services/chatchat/ai";
import {
  clearBrowseHistory,
  clearCopiedEntries,
  clearFavoriteEntries,
} from "../data/matchQuery";

interface ProfileSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  variant?: "full" | "ai";
  isLoggedIn?: boolean;
  onDataCleared?: () => void;
  onLogout?: () => void;
}

const CLEAR_ACTIONS = [
  {
    key: "favorites",
    label: "清空收藏",
    confirm: "确定清空全部收藏吗？此操作不可恢复。",
    success: "收藏已清空",
  },
  {
    key: "copied",
    label: "清空复制记录",
    confirm: "确定清空全部复制记录吗？此操作不可恢复。",
    success: "复制记录已清空",
  },
  {
    key: "history",
    label: "清空浏览历史",
    confirm: "确定清空全部浏览历史吗？此操作不可恢复。",
    success: "浏览历史已清空",
  },
] as const;

type ClearActionKey = (typeof CLEAR_ACTIONS)[number]["key"];

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "custom", label: "自定义" },
] as const;

export default function ProfileSettingsSheet({
  open,
  onClose,
  variant = "full",
  isLoggedIn = false,
  onDataCleared,
  onLogout,
}: ProfileSettingsSheetProps) {
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => loadAiConfig());
  const [savedHint, setSavedHint] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [pendingClear, setPendingClear] = useState<ClearActionKey | null>(null);
  const [clearSuccess, setClearSuccess] = useState<string | null>(null);
  const aiOnly = variant === "ai";

  useEffect(() => {
    if (!open) return;
    setAiConfig(loadAiConfig());
    setSavedHint(false);
    setTestResult(null);
    setPendingClear(null);
    setClearSuccess(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPendingClear((pending) => {
        if (pending) return null;
        onClose();
        return null;
      });
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const pendingAction = CLEAR_ACTIONS.find((item) => item.key === pendingClear);

  const handleClear = (key: ClearActionKey) => {
    if (key === "favorites") clearFavoriteEntries();
    if (key === "copied") clearCopiedEntries();
    if (key === "history") clearBrowseHistory();
    onDataCleared?.();
  };

  const handleConfirmClear = () => {
    if (!pendingAction) return;
    handleClear(pendingAction.key);
    setPendingClear(null);
    setClearSuccess(pendingAction.success);
    window.setTimeout(() => setClearSuccess(null), 1800);
  };

  const handleSaveAiConfig = () => {
    saveAiConfig(aiConfig);
    setSavedHint(true);
    window.setTimeout(() => setSavedHint(false), 2000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      saveAiConfig(aiConfig);
      await testApiConnection(resolveApiConfig(aiConfig));
      setTestResult("连接成功 ✓");
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : "连接失败");
    } finally {
      setTesting(false);
    }
  };

  const handleProviderChange = (provider: AiConfig["provider"]) => {
    const defaults = {
      openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
      deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
      custom: { baseUrl: "", model: "" },
    } as const;
    setAiConfig((prev) => ({
      ...prev,
      provider,
      baseUrl: prev.baseUrl || defaults[provider].baseUrl,
      model: prev.model || defaults[provider].model,
    }));
  };

  const updateAiConfig = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => {
    setAiConfig((prev) => ({ ...prev, [key]: value }));
  };

  return createPortal(
    <div className="profile-settings-overlay" onClick={onClose} role="presentation">
      <div className="profile-settings-shell" onClick={(event) => event.stopPropagation()}>
        <aside
          className="profile-settings-panel"
          role="dialog"
          aria-modal="true"
          aria-label={aiOnly ? "AI 配置" : "设置"}
        >
        <div className="profile-settings-header">
          <h2 className="profile-settings-title">{aiOnly ? "AI 配置" : "设置"}</h2>
          <button type="button" onClick={onClose} className="profile-settings-close" aria-label="关闭">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="profile-settings-body hide-scrollbar">
          <div className="profile-settings-group">
            {!aiOnly && <p className="profile-settings-group-label">AI 配置</p>}
            <div className="profile-settings-ai-form">
              <label className="profile-settings-ai-toggle">
                <span>启用 AI 生成</span>
                <input
                  type="checkbox"
                  checked={aiConfig.enabled}
                  onChange={(event) => updateAiConfig("enabled", event.target.checked)}
                  className="profile-settings-switch"
                />
              </label>

              <label className="profile-settings-field">
                <span className="profile-settings-field-label">服务商</span>
                <select
                  value={aiConfig.provider}
                  onChange={(event) =>
                    handleProviderChange(event.target.value as AiConfig["provider"])
                  }
                  className="profile-settings-input"
                  disabled={!aiConfig.enabled}
                >
                  {PROVIDER_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="profile-settings-field">
                <span className="profile-settings-field-label">API Key</span>
                <input
                  type="password"
                  value={aiConfig.apiKey}
                  onChange={(event) => updateAiConfig("apiKey", event.target.value)}
                  placeholder="sk-..."
                  className="profile-settings-input"
                  disabled={!aiConfig.enabled}
                  autoComplete="off"
                />
              </label>

              <label className="profile-settings-field">
                <span className="profile-settings-field-label">Base URL（可选）</span>
                <input
                  type="url"
                  value={aiConfig.baseUrl}
                  onChange={(event) => updateAiConfig("baseUrl", event.target.value)}
                  placeholder="https://api.deepseek.com"
                  className="profile-settings-input"
                  disabled={!aiConfig.enabled}
                />
              </label>

              <label className="profile-settings-field">
                <span className="profile-settings-field-label">模型</span>
                <input
                  type="text"
                  value={aiConfig.model}
                  onChange={(event) => updateAiConfig("model", event.target.value)}
                  placeholder="gpt-4o-mini"
                  className="profile-settings-input"
                  disabled={!aiConfig.enabled}
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveAiConfig}
                  className="profile-settings-save flex-1"
                >
                  保存配置
                </button>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={!aiConfig.enabled || testing || !aiConfig.apiKey.trim()}
                  className="profile-settings-save flex-1 opacity-90"
                >
                  {testing ? "测试中…" : "测试连接"}
                </button>
              </div>
              {savedHint && <p className="profile-settings-save-hint">已保存，首页状态条将同步更新</p>}
              {testResult && (
                <p className={`profile-settings-save-hint ${testResult.includes("成功") ? "" : "text-[#E74C3C]"}`}>
                  {testResult}
                </p>
              )}
              <p className="profile-settings-ai-note">
                启用 AI 后，首页需求匹配将调用 API 解析意图，再从 3000+ 条语料中检索。
              </p>
            </div>
          </div>

          {!aiOnly && (
          <>
          <div className="profile-settings-group">
            <p className="profile-settings-group-label">数据管理</p>
            <div className="profile-settings-list">
              {CLEAR_ACTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPendingClear(key)}
                  className="profile-settings-action"
                >
                  <span>{label}</span>
                  <ChevronRight size={16} strokeWidth={2} className="text-ink-light" />
                </button>
              ))}
            </div>
          </div>

          <div className="profile-settings-group">
            <p className="profile-settings-group-label">关于我们</p>
            <div className="profile-settings-about">
              <p className="font-semibold text-[#111]">{APP_DISPLAY_NAME}</p>
              <p className="mt-1.5 leading-relaxed">
                帮你找到适合朋友圈的表达方式，从浏览、收藏到复制，让发圈更省心。
              </p>
            </div>
          </div>
          </>
          )}
        </div>

        {!aiOnly && isLoggedIn && onLogout && (
          <div className="profile-settings-footer">
            <button type="button" onClick={onLogout} className="profile-settings-logout">
              退出登录
            </button>
          </div>
        )}
        </aside>

        {pendingAction && (
          <div
            className="profile-settings-confirm-overlay"
            onClick={() => setPendingClear(null)}
            role="presentation"
          >
            <div
              className="profile-settings-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="profile-settings-confirm-title"
              aria-describedby="profile-settings-confirm-desc"
              onClick={(event) => event.stopPropagation()}
            >
              <p id="profile-settings-confirm-title" className="profile-settings-confirm-title">
                确认清空？
              </p>
              <p id="profile-settings-confirm-desc" className="profile-settings-confirm-desc">
                {pendingAction.confirm}
              </p>
              <div className="profile-settings-confirm-actions">
                <button
                  type="button"
                  onClick={() => setPendingClear(null)}
                  className="profile-settings-confirm-btn profile-settings-confirm-btn--ghost"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClear}
                  className="profile-settings-confirm-btn profile-settings-confirm-btn--danger"
                >
                  清空
                </button>
              </div>
            </div>
          </div>
        )}

        {clearSuccess && (
          <div className="copy-toast" role="status" aria-live="polite">
            {clearSuccess}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
