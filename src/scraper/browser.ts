import { chromium, type BrowserContext } from "patchright";
import path from "node:path";
import os from "node:os";

export const PROFILE_DIR = path.join(os.homedir(), ".property-finder", "chrome-profile");

// No locale/timezone/userAgent overrides: patchright relies on the real Chrome fingerprint.
export async function launch(): Promise<BrowserContext> {
  return chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "chrome",
    headless: false,
    viewport: null,
    args: ["--window-size=1280,900"],
  });
}
