import { useEffect, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { APP_CHANNEL, IS_TEST_BUILD } from "../data/appVersion";
import { AI_CONFIG_UPDATED_EVENT, getApiModeLabel } from "../data/aiConfig";

interface HomeApiStatusBarProps {
  onOpenSettings: () => void;
}

export default function HomeApiStatusBar({ onOpenSettings }: HomeApiStatusBarProps) {
  const [mode, setMode] = useState(getApiModeLabel);

  useEffect(() => {
    const refresh = () => setMode(getApiModeLabel());
    window.addEventListener(AI_CONFIG_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(AI_CONFIG_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <button
      type="button"
      className="home-api-status-bar"
      onClick={onOpenSettings}
      aria-label={`当前模式：${mode.label}，${mode.detail}，打开 AI 配置`}
    >
      <span className="home-api-status-bar-icon" aria-hidden>
        <Sparkles size={13} strokeWidth={2} />
      </span>
      <span className="home-api-status-bar-body">
        <span className="home-api-status-bar-label">
          {mode.label}
          {IS_TEST_BUILD && (
            <span className="home-api-status-bar-beta">{APP_CHANNEL}</span>
          )}
        </span>
        <span className="home-api-status-bar-detail">{mode.detail}</span>
      </span>
      <ChevronRight size={14} strokeWidth={2} className="home-api-status-bar-arrow" aria-hidden />
    </button>
  );
}
