import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { issueSession, sessionOk, tokenOk } from "../src/console-auth.js";
import { connect, setup } from "../src/db.js";
import { ingestDir } from "../src/knowledge.js";
import type { Answerer } from "../src/llm.js";
import { RateLimiter } from "../src/ratelimit.js";
import { originAllowed, parseOrigins } from "../src/settings.js";

const sql = connect(process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/helpdesk_test");
const TOKEN = "test-admin-token-123";
const answerer: Answerer = {
  answer: async (_q, sources) => ({ answer: "From the docs.", cited_chunk_ids: [sources[0]!.id], needs_human: false, handoff_reason: null }),
};
const BASE = "http://cited.test";

function app(limit = 50, trustProxy = false) {
  return createApp({ sql, answerer, adminToken: TOKEN, limiter: new RateLimiter(limit, 60_000), trustProxy });
}
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

beforeAll(async () => {
  await setup(sql);
  await sql`truncate documents, conversations restart identity cascade`;
  await ingestDir(sql, "knowledge");
});
beforeEach(async () => {
  await sql`truncate conversations restart identity cascade`;
  await sql`update settings set allowed_origins = '' where id = 1`;
});
afterAll(() => sql.end());

describe("settings helpers", () => {
  it("normalises origins and drops junk", () => {
    expect(parseOrigins("https://a.com/path, http://b.com:8080\nnot a url ftp://c.com")).toEqual(["https://a.com", "http://b.com:8080"]);
  });
  it("allows same-origin and listed origins only", () => {
    expect(originAllowed(undefined, BASE, [])).toBe(true);
    expect(originAllowed(BASE, BASE, [])).toBe(true);
    expect(originAllowed("https://a.com", BASE, ["https://a.com"])).toBe(true);
    expect(originAllowed("https://evil.com", BASE, ["https://a.com"])).toBe(false);
  });
});

describe("console sessions", () => {
  it("accepts the right token and rejects defaults", () => {
    expect(tokenOk(TOKEN, TOKEN)).toBe(true);
    expect(tokenOk("nope", TOKEN)).toBe(false);
    expect(tokenOk("change-me", "change-me")).toBe(false);
  });
  it("signs sessions that expire and break when the token rotates", () => {
    const s = issueSession(TOKEN, 1_000);
    expect(sessionOk(s, TOKEN, 2_000)).toBe(true);
    expect(sessionOk(s, TOKEN, 1_000 + 8 * 86_400_000)).toBe(false);
    expect(sessionOk(s, "another-token", 2_000)).toBe(false);
    expect(sessionOk(`${s}x`, TOKEN, 2_000)).toBe(false);
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and reports the wait", () => {
    const r = new RateLimiter(2, 10_000);
    expect(r.check("a", 0)).toBe(0);
    expect(r.check("a", 1)).toBe(0);
    expect(r.check("a", 2)).toBe(10);
    expect(r.check("b", 2)).toBe(0);
    expect(r.check("a", 10_001)).toBe(0);
  });
});

describe("chat API", () => {
  it("answers same-origin requests", async () => {
    const res = await app().request(post("/api/chat", { message: "How much is the Growth plan?" }));
    expect(res.status).toBe(200);
    expect((await res.json()).citations.length).toBe(1);
  });

  it("refuses websites that aren't allowed, before doing any work", async () => {
    const res = await app().request(post("/api/chat", { message: "hi there" }, { Origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    const [{ n }] = (await sql`select count(*)::int as n from conversations`) as unknown as [{ n: number }];
    expect(n).toBe(0);
  });

  it("serves allowed websites with CORS headers", async () => {
    await sql`update settings set allowed_origins = 'https://help.acme.example' where id = 1`;
    const res = await app().request(post("/api/chat", { message: "How do refunds work?" }, { Origin: "https://help.acme.example" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://help.acme.example");
  });

  it("accepts its own https origin behind a proxy", async () => {
    const headers = { Origin: "https://help.cited.example", "X-Forwarded-Proto": "https", "X-Forwarded-Host": "help.cited.example" };
    expect((await app(50, true).request(post("/api/chat", { message: "How do refunds work?" }, headers))).status).toBe(200);
  });

  it("rate limits a visitor", async () => {
    const a = app(2);
    expect((await a.request(post("/api/chat", { message: "refund policy" }))).status).toBe(200);
    expect((await a.request(post("/api/chat", { message: "refund policy" }))).status).toBe(200);
    const third = await a.request(post("/api/chat", { message: "refund policy" }));
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBeTruthy();
  });

  it("validates the message", async () => {
    expect((await app().request(post("/api/chat", { message: "" }))).status).toBe(400);
  });
});

describe("support console", () => {
  const login = async (a: ReturnType<typeof app>, token: string) => {
    const res = await a.request(new Request(`${BASE}/console/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, next: "/console/inbox" }),
    }));
    return res;
  };

  it("requires sign-in", async () => {
    const res = await app().request(`${BASE}/console/inbox`);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/console/login");
  });

  it("rejects a wrong token and accepts the right one", async () => {
    const a = app();
    expect((await login(a, "wrong")).headers.get("location")).toContain("error=1");
    const ok = await login(a, TOKEN);
    expect(ok.headers.get("location")).toBe("/console/inbox");
    const cookie = ok.headers.get("set-cookie")!.split(";")[0]!;
    expect(ok.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    const page = await a.request(`${BASE}/console`, { headers: { Cookie: cookie } });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Resolved by assistant");
  });

  it("resolves and reopens a ticket", async () => {
    const a = app();
    await a.request(post("/api/chat", { message: "I want to talk to a person" }));
    const [t] = (await sql`select id from tickets`) as unknown as [{ id: number }];
    const cookie = (await login(a, TOKEN)).headers.get("set-cookie")!.split(";")[0]!;
    await a.request(new Request(`${BASE}/console/inbox/${t.id}/resolve`, { method: "POST", headers: { Cookie: cookie } }));
    expect((await sql`select status from tickets where id = ${t.id}`)[0]!.status).toBe("resolved");
    await a.request(new Request(`${BASE}/console/inbox/${t.id}/reopen`, { method: "POST", headers: { Cookie: cookie } }));
    expect((await sql`select status, resolved_at from tickets where id = ${t.id}`)[0]).toEqual({ status: "open", resolved_at: null });
  });

  it("saves settings and reports skipped origins", async () => {
    const a = app();
    const cookie = (await login(a, TOKEN)).headers.get("set-cookie")!.split(";")[0]!;
    const res = await a.request(new Request(`${BASE}/console/settings`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ assistantName: "Acme Help", greeting: "Hello!", brandColor: "#112233", allowedOrigins: "https://a.com\nnonsense" }),
    }));
    expect(decodeURIComponent(res.headers.get("location")!)).toContain("1 entry wasn't a valid URL");
    const [s] = await sql`select assistant_name, brand_color, allowed_origins from settings`;
    expect(s).toEqual({ assistant_name: "Acme Help", brand_color: "#112233", allowed_origins: "https://a.com" });
    await sql`update settings set assistant_name = 'Help assistant', brand_color = '#5146d9' where id = 1`;
  });
});
