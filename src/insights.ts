import type { Citation } from "./assistant.js";
import type { Sql } from "./db.js";

export interface Overview {
  conversations: number;
  questions: number;
  handedOff: number;
  resolvedByAssistant: number;
  automationRate: number; // share of conversations that never needed a person, 0..1
  openTickets: number;
  daily: { day: string; questions: number; handoffs: number }[];
  reasons: { reason: string; n: number }[];
  topSources: { title: string; heading: string; n: number }[];
}

export async function overview(sql: Sql, days = 30): Promise<Overview> {
  const since = sql`now() - make_interval(days => ${days})`;
  const [totals] = await sql<{ conversations: number; questions: number; handed_off: number; open_tickets: number }[]>`
    select
      (select count(*)::int from conversations where created_at >= ${since}) as conversations,
      (select count(*)::int from messages where role = 'user' and created_at >= ${since}) as questions,
      (select count(distinct t.conversation_id)::int from tickets t join conversations c on c.id = t.conversation_id where c.created_at >= ${since}) as handed_off,
      (select count(*)::int from tickets where status = 'open') as open_tickets`;
  const daily = await sql<{ day: string; questions: number; handoffs: number }[]>`
    with days as (select generate_series((now() - make_interval(days => ${days - 1}))::date, now()::date, '1 day')::date as d)
    select to_char(d, 'YYYY-MM-DD') as day,
      (select count(*)::int from messages m where m.role = 'user' and m.created_at::date = d) as questions,
      (select count(*)::int from tickets t where t.created_at::date = d) as handoffs
    from days order by d`;
  const reasons = await sql<{ reason: string; n: number }[]>`
    select reason, count(*)::int as n from tickets where created_at >= ${since} group by reason order by n desc, reason limit 6`;
  const topSources = await sql<{ title: string; heading: string; n: number }[]>`
    select c->>'title' as title, c->>'heading' as heading, count(*)::int as n
    from messages m, jsonb_array_elements(m.citations) c
    where m.role = 'assistant' and m.created_at >= ${since}
    group by 1, 2 order by n desc, 1, 2 limit 6`;
  const t = totals!;
  const resolved = Math.max(0, t.conversations - t.handed_off);
  return {
    conversations: t.conversations,
    questions: t.questions,
    handedOff: t.handed_off,
    resolvedByAssistant: resolved,
    automationRate: t.conversations ? resolved / t.conversations : 0,
    openTickets: t.open_tickets,
    daily,
    reasons,
    topSources,
  };
}

export interface TicketRow {
  id: number;
  question: string;
  reason: string;
  status: "open" | "resolved";
  createdAt: Date;
  resolvedAt: Date | null;
  conversationId: string;
  messages: number;
}

export async function listTickets(sql: Sql, opts: { status?: string; q?: string } = {}): Promise<TicketRow[]> {
  const status = opts.status === "open" || opts.status === "resolved" ? opts.status : null;
  const q = opts.q?.trim() ? `%${opts.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  return sql<TicketRow[]>`
    select t.id, t.question, t.reason, t.status, t.created_at as "createdAt", t.resolved_at as "resolvedAt",
      t.conversation_id as "conversationId",
      (select count(*)::int from messages m where m.conversation_id = t.conversation_id) as messages
    from tickets t
    where (${status}::text is null or t.status = ${status})
      and (${q}::text is null or t.question ilike ${q} or t.reason ilike ${q})
    order by (t.status = 'open') desc, t.id desc
    limit 200`;
}

export async function ticketCounts(sql: Sql): Promise<{ open: number; resolved: number }> {
  const [r] = await sql<{ open: number; resolved: number }[]>`
    select count(*) filter (where status = 'open')::int as open, count(*) filter (where status = 'resolved')::int as resolved from tickets`;
  return r ?? { open: 0, resolved: 0 };
}

export interface TranscriptMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: Date;
}

export async function transcript(sql: Sql, conversationId: string): Promise<TranscriptMessage[]> {
  return sql<TranscriptMessage[]>`
    select id, role, content, citations, created_at as "createdAt" from messages where conversation_id = ${conversationId} order by id`;
}

export async function getTicket(sql: Sql, id: number) {
  const [t] = await sql<TicketRow[]>`
    select id, question, reason, status, created_at as "createdAt", resolved_at as "resolvedAt", conversation_id as "conversationId", 0 as messages
    from tickets where id = ${id}`;
  if (!t) return null;
  return { ticket: t, messages: await transcript(sql, t.conversationId) };
}

export async function setTicketStatus(sql: Sql, id: number, status: "open" | "resolved"): Promise<boolean> {
  const r = await sql`
    update tickets set status = ${status}, resolved_at = ${status === "resolved" ? sql`now()` : null}
    where id = ${id} and status <> ${status}`;
  return r.count === 1;
}

export interface ConversationRow {
  id: string;
  createdAt: Date;
  lastAt: Date;
  firstQuestion: string;
  questions: number;
  handedOff: boolean;
  ticketId: number | null;
}

export async function listConversations(sql: Sql, opts: { outcome?: string; q?: string } = {}): Promise<ConversationRow[]> {
  const outcome = opts.outcome === "answered" || opts.outcome === "handed_off" ? opts.outcome : null;
  const q = opts.q?.trim() ? `%${opts.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  return sql<ConversationRow[]>`
    select * from (
      select c.id, c.created_at as "createdAt",
        coalesce((select max(created_at) from messages m where m.conversation_id = c.id), c.created_at) as "lastAt",
        coalesce((select content from messages m where m.conversation_id = c.id and role = 'user' order by id limit 1), '') as "firstQuestion",
        (select count(*)::int from messages m where m.conversation_id = c.id and role = 'user') as questions,
        exists (select 1 from tickets t where t.conversation_id = c.id) as "handedOff",
        (select min(id) from tickets t where t.conversation_id = c.id) as "ticketId"
      from conversations c
    ) x
    where x.questions > 0
      and (${outcome}::text is null or (${outcome} = 'handed_off') = x."handedOff")
      and (${q}::text is null or exists (select 1 from messages m where m.conversation_id = x.id and m.content ilike ${q}))
    order by x."lastAt" desc
    limit 200`;
}

export interface Article {
  id: number;
  slug: string;
  title: string;
  updatedAt: Date;
  sections: number;
  citations: number;
}

export async function listArticles(sql: Sql): Promise<Article[]> {
  return sql<Article[]>`
    select d.id, d.slug, d.title, d.updated_at as "updatedAt",
      (select count(*)::int from chunks c where c.document_id = d.id) as sections,
      (select count(*)::int from messages m, jsonb_array_elements(m.citations) e where (e->>'slug') = d.slug) as citations
    from documents d order by d.title`;
}

export async function getArticle(sql: Sql, slug: string) {
  const [doc] = await sql<{ id: number; slug: string; title: string; updatedAt: Date }[]>`
    select id, slug, title, updated_at as "updatedAt" from documents where slug = ${slug}`;
  if (!doc) return null;
  const sections = await sql<{ id: number; heading: string; content: string }[]>`
    select id, heading, content from chunks where document_id = ${doc.id} order by ord`;
  return { doc, sections };
}
