export const APP_DISPLAY_NAME = "YourWord";
export const LOGGED_IN_DISPLAY_NAME = "文案爱好者";

export function getViewerDisplayName(): string {
  return localStorage.getItem("isLoggedIn") === "true"
    ? LOGGED_IN_DISPLAY_NAME
    : APP_DISPLAY_NAME;
}
