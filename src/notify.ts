import { execFile } from "node:child_process";

export function notifyMac(title: string, message: string) {
  if (process.platform !== "darwin") return;
  const esc = (s: string) => s.replace(/["\\]/g, "");
  execFile("osascript", ["-e", `display notification "${esc(message)}" with title "${esc(title)}" sound name "Ping"`], () => {});
}
