export const AI_CONFIG_KEY = "ai-api-config";
export const AI_CONFIG_UPDATED_EVENT = "ai-config-updated";

export interface AiConfig {
  enabled: boolean;
  provider: "openai" | "deepseek" | "custom";
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ApiRuntimeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const PROVIDER_DEFAULTS: Record<AiConfig["provider"], { baseUrl: string; model: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  custom: { baseUrl: "", model: "" },
};

const DEFAULT_CONFIG: AiConfig = {
  enabled: true,
  provider: "deepseek",
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
};

/** 预置 API key：构建时由 GitHub Actions 从仓库 Secret 注入（VITE_PRESET_API_KEY），不在源码中硬编码。
 *  本地开发或未设置时为空，走本地规则模式；用户仍可在设置面板填自己的 key 覆盖。 */
const PRESET_API_KEY = import.meta.env.VITE_PRESET_API_KEY ?? "";

export function loadAiConfig(): AiConfig {
  const stored = localStorage.getItem(AI_CONFIG_KEY);
  if (!stored) {
    return { ...DEFAULT_CONFIG, apiKey: PRESET_API_KEY };
  }
  try {
    const parsed = JSON.parse(stored) as Partial<AiConfig>;
    const apiKey = (parsed.apiKey ?? "").trim() || PRESET_API_KEY;
    return { ...DEFAULT_CONFIG, ...parsed, apiKey };
  } catch {
    return { ...DEFAULT_CONFIG, apiKey: PRESET_API_KEY };
  }
}

export function saveAiConfig(config: AiConfig) {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event(AI_CONFIG_UPDATED_EVENT));
}

export function resolveApiConfig(config: AiConfig = loadAiConfig()): ApiRuntimeConfig {
  const defaults = PROVIDER_DEFAULTS[config.provider];
  return {
    apiKey: config.apiKey.trim(),
    baseUrl: (config.baseUrl.trim() || defaults.baseUrl).replace(/\/$/, ""),
    model: config.model.trim() || defaults.model,
  };
}

export function isAiConfigured(): boolean {
  const config = loadAiConfig();
  return config.enabled && config.apiKey.trim().length > 0;
}

export function getApiModeLabel(): { label: string; detail: string } {
  const config = loadAiConfig();
  if (isAiConfigured()) {
    const providerLabel =
      config.provider === "openai"
        ? "OpenAI"
        : config.provider === "deepseek"
          ? "DeepSeek"
          : "自定义";
    return {
      label: "AI 匹配模式",
      detail: `${providerLabel} · ${config.model || "未指定模型"}`,
    };
  }
  return {
    label: "本地规则模式",
    detail: "基于标签与语义匹配，无需 API",
  };
}
