import { readFile } from "node:fs/promises";
import { getConnInfo } from "@hono/node-server/conninfo";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { z } from "zod";
import { chat } from "./assistant.js";
import type { Sql } from "./db.js";
import { CONSOLE_COOKIE, issueSession, sessionOk, tokenOk } from "./console-auth.js";
import { getArticle, getTicket, listArticles, listConversations, listTickets, overview, setTicketStatus, ticketCounts, transcript } from "./insights.js";
import { ingestDir, search } from "./knowledge.js";
import { type Answerer, RefusalError } from "./llm.js";
import { RateLimiter } from "./ratelimit.js";
import { getSettings, originAllowed, parseOrigins, saveSettings } from "./settings.js";
import * as V from "./views/console.js";
import { DemoHelpCentre, HomePage } from "./views/site.js";

export interface AppDeps {
  sql: Sql;
  answerer: Answerer;
  adminToken: string;
  knowledgeDir?: string;
  limiter?: RateLimiter;
  secureCookies?: boolean;
  // Only trust X-Forwarded-For behind a proxy you control; otherwise clients could dodge the rate limit.
  trustProxy?: boolean;
}

const ChatBody = z.object({ message: z.string().trim().min(1).max(2000), conversationId: z.uuid().optional() });
const asset = (name: string) => readFile(new URL(`../public/${name}`, import.meta.url), "utf8");

export function createApp(deps: AppDeps) {
  const { sql, answerer, adminToken } = deps;
  const limiter = deps.limiter ?? new RateLimiter(20, 5 * 60_000);
  const app = new Hono();
  const selfOrigin = (c: Context) => new URL(c.req.url).origin;

  // ---------- Public site ----------
  app.get("/", (c) => c.html(<HomePage />));
  app.get("/demo", async (c) => c.html(<DemoHelpCentre articles={await listArticles(sql)} />));
  app.get("/demo/articles/:slug", async (c) => {
    const a = await getArticle(sql, c.req.param("slug"));
    if (!a) return c.notFound();
    return c.html(<DemoHelpCentre articles={[]} article={{ title: a.doc.title, slug: a.doc.slug, sections: a.sections }} />);
  });
  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/admin", (c) => c.redirect("/console", 301)); // the old inbox page
  app.get("/assets/:file{[a-z]+\\.(css|js)}", async (c) => {
    const file = c.req.param("file");
    const type = file.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8";
    return c.body(await asset(file), 200, { "Content-Type": type, "Cache-Control": "public, max-age=300" });
  });
  app.get("/widget.js", async (c) =>
    c.body(await asset("widget.js"), 200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" }),
  );

  // ---------- Widget API: CORS limited to allowed sites, rate limited per visitor ----------
  app.use(
    "/api/chat",
    cors({
      origin: async (origin, c) => ((originAllowed(origin, selfOrigin(c), (await getSettings(sql)).allowedOrigins) ? origin : null)),
      allowMethods: ["POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
      maxAge: 600,
    }),
  );
  app.use(
    "/api/config",
    cors({ origin: async (origin, c) => ((originAllowed(origin, selfOrigin(c), (await getSettings(sql)).allowedOrigins) ? origin : null)), allowMethods: ["GET"] }),
  );

  app.get("/api/config", async (c) => {
    const s = await getSettings(sql);
    return c.json({ name: s.assistantName, greeting: s.greeting, color: s.brandColor });
  });

  app.post("/api/chat", async (c) => {
    // CORS headers stop browsers reading the reply; this check stops the request costing anything at all.
    if (!originAllowed(c.req.header("origin"), selfOrigin(c), (await getSettings(sql)).allowedOrigins)) {
      return c.json({ error: "This website isn't allowed to use the assistant." }, 403);
    }
    const ip = (deps.trustProxy && c.req.header("x-forwarded-for")?.split(",")[0]?.trim()) || safeIp(c);
    const wait = limiter.check(ip);
    if (wait > 0) {
      c.header("Retry-After", String(wait));
      return c.json({ error: `You're sending messages quickly. Please wait ${wait} seconds and try again.` }, 429);
    }
    const body = ChatBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Type a message (up to 2,000 characters)." }, 400);
    try {
      return c.json(await chat(sql, answerer, body.data.message, body.data.conversationId));
    } catch (err) {
      console.error(err);
      const msg = err instanceof RefusalError ? "I can't help with that request." : "Something went wrong on our side. Please try again.";
      return c.json({ error: msg }, 502);
    }
  });

  // ---------- Bearer-token API (for scripts and integrations) ----------
  const bearerOk = (h: string | undefined) => tokenOk(h?.replace(/^Bearer\s+/i, "") ?? "", adminToken);
  app.get("/api/tickets", async (c) => {
    if (!bearerOk(c.req.header("authorization"))) return c.json({ error: "unauthorised" }, 401);
    const rows = await sql`
      select t.id, t.question, t.reason, t.status, t.created_at, t.conversation_id,
        (select json_agg(json_build_object('role', m.role, 'content', m.content) order by m.id)
           from messages m where m.conversation_id = t.conversation_id) as transcript
      from tickets t order by (t.status = 'open') desc, t.id desc limit 100`;
    return c.json(rows);
  });
  app.post("/api/tickets/:id/resolve", async (c) => {
    if (!bearerOk(c.req.header("authorization"))) return c.json({ error: "unauthorised" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "bad id" }, 400);
    const ticket = await getTicket(sql, id);
    if (!ticket) return c.json({ error: "not found" }, 404);
    await setTicketStatus(sql, id, "resolved");
    return c.json({ ok: true });
  });

  // ---------- Console ----------
  const signedIn = (c: Context) => sessionOk(getCookie(c, CONSOLE_COOKIE), adminToken);
  const page = async (c: Context, title: string, body: unknown) => {
    const [counts, settings] = await Promise.all([ticketCounts(sql), getSettings(sql)]);
    return c.html(<V.Shell path={c.req.path} title={title} openTickets={counts.open} settings={settings}>{body as never}</V.Shell>);
  };
  const flash = (c: Context) => ({ ok: c.req.query("ok"), err: c.req.query("err") });

  app.get("/console/login", (c) => (signedIn(c) ? c.redirect("/console") : c.html(<V.LoginPage error={c.req.query("error") === "1"} next={c.req.query("next")} />)));
  app.post("/console/login", async (c) => {
    const form = await c.req.parseBody();
    const next = typeof form.next === "string" && form.next.startsWith("/console") && !form.next.startsWith("//") ? form.next : "/console";
    if (!tokenOk(String(form.token ?? "").trim(), adminToken)) return c.redirect(`/console/login?error=1&next=${encodeURIComponent(next)}`, 303);
    setCookie(c, CONSOLE_COOKIE, issueSession(adminToken), { httpOnly: true, sameSite: "Strict", secure: deps.secureCookies, path: "/console", maxAge: 7 * 86_400 });
    return c.redirect(next, 303);
  });
  app.post("/console/logout", (c) => {
    deleteCookie(c, CONSOLE_COOKIE, { path: "/console" });
    return c.redirect("/console/login", 303);
  });
  app.use("/console/*", async (c, next) => {
    if (c.req.path === "/console/login") return next();
    if (!signedIn(c)) return c.redirect(`/console/login?next=${encodeURIComponent(c.req.path)}`, 303);
    return next();
  });
  app.get("/console", async (c) => {
    if (!signedIn(c)) return c.redirect("/console/login", 303);
    const [o, recent] = await Promise.all([overview(sql, 30), listTickets(sql, { status: "all" })]);
    return page(c, "Overview", <V.OverviewPage o={o} recent={recent.slice(0, 5)} days={30} />);
  });

  app.get("/console/inbox", async (c) => {
    const status = ["open", "resolved", "all"].includes(c.req.query("status") ?? "") ? c.req.query("status")! : "open";
    const q = (c.req.query("q") ?? "").slice(0, 100);
    const [rows, counts] = await Promise.all([listTickets(sql, { status, q }), ticketCounts(sql)]);
    return page(c, "Inbox", <V.InboxPage rows={rows} status={status} q={q} counts={counts} ok={flash(c).ok} />);
  });
  app.get("/console/inbox/:id{[0-9]+}", async (c) => {
    const t = await getTicket(sql, Number(c.req.param("id")));
    if (!t) return c.notFound();
    return page(c, `Ticket #${t.ticket.id}`, <V.TicketPage ticket={t.ticket} messages={t.messages} ok={flash(c).ok} />);
  });
  app.post("/console/inbox/:id{[0-9]+}/:action{resolve|reopen}", async (c) => {
    const id = Number(c.req.param("id"));
    const resolve = c.req.param("action") === "resolve";
    await setTicketStatus(sql, id, resolve ? "resolved" : "open");
    return c.redirect(`/console/inbox/${id}?ok=${encodeURIComponent(resolve ? "Ticket resolved." : "Ticket reopened.")}`, 303);
  });

  app.get("/console/conversations", async (c) => {
    const outcome = ["answered", "handed_off"].includes(c.req.query("outcome") ?? "") ? c.req.query("outcome")! : "all";
    const q = (c.req.query("q") ?? "").slice(0, 100);
    return page(c, "Conversations", <V.ConversationsPage rows={await listConversations(sql, { outcome, q })} outcome={outcome} q={q} />);
  });
  app.get("/console/conversations/:id", async (c) => {
    const id = c.req.param("id");
    if (!z.uuid().safeParse(id).success) return c.notFound();
    const messages = await transcript(sql, id);
    if (messages.length === 0) return c.notFound();
    const [t] = await sql<{ id: number }[]>`select min(id) as id from tickets where conversation_id = ${id}`;
    return page(c, "Conversation", <V.ConversationPage id={id} messages={messages} ticketId={t?.id ?? null} />);
  });

  app.get("/console/knowledge", async (c) => {
    const q = (c.req.query("q") ?? "").slice(0, 300);
    const [articles, hits] = await Promise.all([listArticles(sql), q.trim() ? search(sql, q) : Promise.resolve(null)]);
    return page(c, "Knowledge base", <V.KnowledgePage articles={articles} q={q} hits={hits} {...flash(c)} />);
  });
  app.post("/console/knowledge/reindex", async (c) => {
    try {
      const r = await ingestDir(sql, deps.knowledgeDir ?? "knowledge");
      return c.redirect(`/console/knowledge?ok=${encodeURIComponent(`Re-indexed ${r.documents} articles into ${r.chunks} sections.`)}`, 303);
    } catch (e) {
      console.error(e);
      return c.redirect(`/console/knowledge?err=${encodeURIComponent("Couldn't read the knowledge folder. Check it exists and contains .md files.")}`, 303);
    }
  });
  app.get("/console/knowledge/:slug", async (c) => {
    const a = await getArticle(sql, c.req.param("slug"));
    if (!a) return c.notFound();
    return page(c, a.doc.title, <V.ArticlePage title={a.doc.title} slug={a.doc.slug} sections={a.sections} />);
  });

  app.get("/console/install", async (c) => page(c, "Install", <V.InstallPage origin={selfOrigin(c)} settings={await getSettings(sql)} />));
  app.get("/console/settings", async (c) => page(c, "Settings", <V.SettingsPage settings={await getSettings(sql)} {...flash(c)} />));
  app.post("/console/settings", async (c) => {
    const f = await c.req.parseBody();
    const parsed = z
      .object({
        assistantName: z.string().trim().min(1).max(40),
        greeting: z.string().trim().min(1).max(200),
        brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        allowedOrigins: z.string().max(2000),
      })
      .safeParse(f);
    if (!parsed.success) return c.redirect(`/console/settings?err=${encodeURIComponent("Give the assistant a name and greeting, and pick a colour.")}`, 303);
    const origins = parseOrigins(parsed.data.allowedOrigins);
    await saveSettings(sql, { ...parsed.data, allowedOrigins: origins });
    const dropped = parsed.data.allowedOrigins.split(/[\s,]+/).filter(Boolean).length - origins.length;
    const msg = dropped > 0 ? `Settings saved. ${dropped} entr${dropped === 1 ? "y wasn't a valid URL and was" : "ies weren't valid URLs and were"} skipped.` : "Settings saved. The widget uses them on its next load.";
    return c.redirect(`/console/settings?ok=${encodeURIComponent(msg)}`, 303);
  });

  app.notFound((c) => c.html(<V.NotFoundPage />, 404));
  return app;
}

function safeIp(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}
