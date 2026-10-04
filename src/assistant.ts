import type postgres from "postgres";
import type { Sql } from "./db.js";
import { type Source, search } from "./knowledge.js";
import type { Answerer, Reply, Turn } from "./llm.js";

export interface Citation {
  id: number;
  title: string;
  heading: string;
  slug: string;
  // The opening of the cited section, shown to the customer as the quoted source.
  excerpt?: string;
}

export function excerptOf(content: string, max = 180): string {
  const text = content.replace(/\s+/g, " ").trim();
  const sentence = text.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? text;
  const pick = sentence.length >= 40 ? sentence : text;
  return pick.length > max ? `${pick.slice(0, max - 1).trimEnd()}…` : pick;
}

export interface ChatResult {
  conversationId: string;
  answer: string;
  citations: Citation[];
  handedOff: boolean;
  ticketId: number | null;
}

const ASKS_FOR_HUMAN = /\b(human|real person|live agent|an agent|representative|speak to (someone|support|a person)|talk to (someone|support|a person))\b/i;

export const HANDOFF_NOTE = "I've passed this to our support team, and a person will reply by email.";
export const NO_ANSWER = "I'm not sure about that one, and I don't want to guess.";

// Decides what the customer sees. The model drafts; this function enforces the rules:
// an answer must cite sections that were actually retrieved, or it becomes a handoff.
export function settle(reply: Reply, sources: Source[]): { answer: string; citations: Citation[]; handoff: string | null } {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const cited = [...new Set(reply.cited_chunk_ids)].filter((id) => byId.has(id));
  const invented = reply.cited_chunk_ids.some((id) => !byId.has(id));
  const citations = cited.map((id) => {
    const s = byId.get(id)!;
    return { id, title: s.title, heading: s.heading, slug: s.slug, excerpt: excerptOf(s.content) };
  });

  let handoff = reply.needs_human ? (reply.handoff_reason?.trim() || "Assistant could not answer from the docs") : null;
  if (!handoff && (citations.length === 0 || invented)) handoff = "Answer was not grounded in the help-centre docs";

  // An ungrounded answer is never shown, even if the model was confident.
  const grounded = citations.length > 0 && !invented;
  const answer = handoff
    ? [grounded && reply.answer.trim() ? reply.answer.trim() : NO_ANSWER, HANDOFF_NOTE].join(" ")
    : reply.answer.trim();
  return { answer, citations: grounded ? citations : [], handoff };
}

export async function chat(
  sql: Sql,
  answerer: Answerer,
  message: string,
  conversationId?: string,
): Promise<ChatResult> {
  const question = message.trim().slice(0, 2000);
  let convoId = conversationId;
  if (convoId) {
    const [exists] = await sql`select 1 from conversations where id = ${convoId}`;
    if (!exists) convoId = undefined;
  }
  if (!convoId) {
    const [row] = await sql<{ id: string }[]>`insert into conversations default values returning id`;
    convoId = row!.id;
  }

  const history = await sql<Turn[]>`
    select role, content from (
      select role, content, id from messages where conversation_id = ${convoId!} order by id desc limit 6
    ) t order by id`;
  await sql`insert into messages (conversation_id, role, content) values (${convoId!}, 'user', ${question})`;

  let settled: ReturnType<typeof settle>;
  if (ASKS_FOR_HUMAN.test(question)) {
    settled = { answer: HANDOFF_NOTE, citations: [], handoff: "Customer asked for a person" };
  } else {
    // Include the previous question so follow-ups like "and on yearly?" still find the right section.
    const lastUser = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
    const sources = await search(sql, `${question} ${lastUser}`);
    if (sources.length === 0) {
      settled = { answer: `${NO_ANSWER} ${HANDOFF_NOTE}`, citations: [], handoff: "No matching help-centre article" };
    } else {
      settled = settle(await answerer.answer(question, sources, history), sources);
    }
  }

  let ticketId: number | null = null;
  if (settled.handoff) {
    const [t] = await sql<{ id: number }[]>`
      insert into tickets (conversation_id, question, reason) values (${convoId!}, ${question}, ${settled.handoff}) returning id`;
    ticketId = t!.id;
  }
  await sql`
    insert into messages (conversation_id, role, content, citations)
    values (${convoId!}, 'assistant', ${settled.answer}, ${sql.json(settled.citations as unknown as postgres.JSONValue)})`;

  return { conversationId: convoId!, answer: settled.answer, citations: settled.citations, handedOff: !!settled.handoff, ticketId };
}
