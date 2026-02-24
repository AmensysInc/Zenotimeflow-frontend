/**
 * URL for the React Native Clock In flow (email + PIN login).
 * Always same-origin /clock so it opens in the same tab (dev: Vite proxies /clock to Expo; prod: dist/clock).
 * Set VITE_MOBILE_APP_URL to use a separate mobile origin (opens in new tab).
 */
const explicitMobileUrl =
  typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_MOBILE_APP_URL;

export const MOBILE_CLOCK_IN_URL = explicitMobileUrl || "";

export const CLOCK_IN_LINK =
  MOBILE_CLOCK_IN_URL === ""
    ? "/clock?intent=clockin"
    : `${MOBILE_CLOCK_IN_URL}?intent=clockin`;

/** True when Clock In is same-origin (/clock); open in same tab. */
export const CLOCK_IN_SAME_ORIGIN = CLOCK_IN_LINK.startsWith("/");
