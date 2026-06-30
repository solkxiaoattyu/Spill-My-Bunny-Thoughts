/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 构建时由 GitHub Actions 注入的预置 DeepSeek key（来自仓库 Secret）；本地未设置时为空 */
  readonly VITE_PRESET_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
