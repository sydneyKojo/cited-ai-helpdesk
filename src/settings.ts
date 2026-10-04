import type { Sql } from "./db.js";

export interface Settings {
  assistantName: string;
  greeting: string;
  brandColor: string;
  // Websites allowed to embed the widget, one origin per entry (e.g. https://help.example.com).
  allowedOrigins: string[];
  updatedAt: Date;
}

export async function getSettings(sql: Sql): Promise<Settings> {
  const [row] = await sql<{ assistant_name: string; greeting: string; brand_color: string; allowed_origins: string; updated_at: Date }[]>`
    select assistant_name, greeting, brand_color, allowed_origins, updated_at from settings where id = 1`;
  return {
    assistantName: row?.assistant_name ?? "Help assistant",
    greeting: row?.greeting ?? "Hi! How can I help?",
    brandColor: row?.brand_color ?? "#111111",
    allowedOrigins: parseOrigins(row?.allowed_origins ?? ""),
    updatedAt: row?.updated_at ?? new Date(),
  };
}

// Accepts newline- or comma-separated input; keeps only well-formed http(s) origins, normalised.
export function parseOrigins(raw: string): string[] {
  const out = new Set<string>();
  for (const part of raw.split(/[\s,]+/)) {
    if (!part) continue;
    try {
      const u = new URL(part);
      if (u.protocol === "https:" || u.protocol === "http:") out.add(u.origin);
    } catch {
      /* ignore anything that isn't a URL */
    }
  }
  return [...out];
}

export async function saveSettings(sql: Sql, s: Omit<Settings, "updatedAt">): Promise<void> {
  await sql`
    update settings set assistant_name = ${s.assistantName}, greeting = ${s.greeting}, brand_color = ${s.brandColor},
      allowed_origins = ${s.allowedOrigins.join("\n")}, updated_at = now()
    where id = 1`;
}

// The widget may call the API from its own host, or from any origin the team allowed in settings.
export function originAllowed(origin: string | undefined, selfOrigin: string, allowed: string[]): boolean {
  if (!origin) return true; // same-origin requests and server-to-server calls send no Origin header
  return origin === selfOrigin || allowed.includes(origin);
}
