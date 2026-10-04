import { createHmac, timingSafeEqual } from "node:crypto";

export const CONSOLE_COOKIE = "cited_console";
const DAY = 86_400_000;

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// The console has one shared admin token (ADMIN_TOKEN). Signing in exchanges it for a signed, expiring cookie,
// so the token itself is never stored in the browser. Rotating ADMIN_TOKEN signs everyone out.
export function tokenOk(given: string, adminToken: string): boolean {
  return !!adminToken && adminToken !== "change-me" && !!given && same(given, adminToken);
}

export function issueSession(adminToken: string, now = Date.now()): string {
  const exp = String(now + 7 * DAY);
  return `${exp}.${sign(exp, adminToken)}`;
}

export function sessionOk(cookie: string | undefined, adminToken: string, now = Date.now()): boolean {
  if (!cookie || !adminToken || adminToken === "change-me") return false;
  const [exp, mac] = cookie.split(".");
  if (!exp || !mac || Number(exp) < now) return false;
  return same(mac, sign(exp, adminToken));
}
