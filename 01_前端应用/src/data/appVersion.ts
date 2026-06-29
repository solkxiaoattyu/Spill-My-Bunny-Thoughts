/** 当前发布渠道 — 正式版：「不开心」仅标记降权，不再从语料库永久剔除 */
export const APP_CHANNEL: string = "正式版";

export const IS_TEST_BUILD = APP_CHANNEL === "测试版";
