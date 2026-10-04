import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HANDOFF_NOTE, chat, settle } from "../src/assistant.js";
import { connect, setup } from "../src/db.js";
import { type Source, chunkMarkdown, ingestDir, search } from "../src/knowledge.js";
import type { Answerer, Reply } from "../src/llm.js";

const sql = connect(process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/helpdesk_test");

// Scripted model: answers with whatever the test sets, and records what it was shown.
class FakeAnswerer implements Answerer {
  calls: Source[][] = [];
  constructor(public reply: (sources: Source[]) => Reply) {}
  async answer(_q: string, sources: Source[]) {
    this.calls.push(sources);
    return this.reply(sources);
  }
}

beforeAll(async () => {
  await setup(sql);
  await sql`truncate documents, conversations restart identity cascade`;
  await ingestDir(sql, "knowledge");
});
beforeEach(async () => {
  await sql`truncate conversations restart identity cascade`;
});
afterAll(() => sql.end());

describe("chunkMarkdown", () => {
  it("splits on ## headings and keeps the article title", () => {
    const { title, chunks } = chunkMarkdown("# Billing\n\nIntro text.\n\n## Refunds\nNo partial months.\n\n## Receipts\nEmailed.");
    expect(title).toBe("Billing");
    expect(chunks.map((c) => c.heading)).toEqual(["Overview", "Refunds", "Receipts"]);
  });
});

describe("search", () => {
  it("finds the refunds section for a refund question", async () => {
    const hits = await search(sql, "Can I get a refund on my yearly plan?");
    expect(hits[0]?.heading).toBe("Refunds");
  });

  it("finds password help", async () => {
    const hits = await search(sql, "forgot my password, reset link not arriving");
    expect(hits[0]?.heading).toBe("Reset your password");
  });

  it("returns nothing for empty or stopword-only text", async () => {
    expect(await search(sql, "")).toEqual([]);
    expect(await search(sql, "the and")).toEqual([]);
  });
});

describe("settle", () => {
  const sources: Source[] = [{ id: 1, title: "Billing and plans", heading: "Refunds", slug: "billing-and-plans", content: "..." }];

  it("passes a grounded answer through with its citation", () => {
    const s = settle({ answer: "Yearly plans get a full refund within 30 days.", cited_chunk_ids: [1], needs_human: false, handoff_reason: null }, sources);
    expect(s.handoff).toBeNull();
    expect(s.citations.map((c) => c.heading)).toEqual(["Refunds"]);
  });

  it("turns an uncited answer into a handoff and hides it", () => {
    const s = settle({ answer: "Sure, we integrate with QuickBooks!", cited_chunk_ids: [], needs_human: false, handoff_reason: null }, sources);
    expect(s.handoff).toMatch(/not grounded/);
    expect(s.answer).not.toContain("QuickBooks");
    expect(s.answer).toContain(HANDOFF_NOTE);
  });

  it("treats a citation to a section it was never shown as ungrounded", () => {
    const s = settle({ answer: "Made up.", cited_chunk_ids: [99], needs_human: false, handoff_reason: null }, sources);
    expect(s.handoff).not.toBeNull();
    expect(s.citations).toEqual([]);
  });

  it("keeps a grounded answer when the docs say a person must act", () => {
    const s = settle(
      { answer: "Yearly plans cancelled within 30 days get a full refund; the billing team reviews it.", cited_chunk_ids: [1], needs_human: true, handoff_reason: "Refund request" },
      sources,
    );
    expect(s.handoff).toBe("Refund request");
    expect(s.answer).toContain("full refund");
    expect(s.answer).toContain(HANDOFF_NOTE);
  });
});

describe("chat", () => {
  it("answers from retrieved docs and stores the conversation", async () => {
    const llm = new FakeAnswerer((src) => ({ answer: "Growth is $29 per month.", cited_chunk_ids: [src[0]!.id], needs_human: false, handoff_reason: null }));
    const res = await chat(sql, llm, "How much is the Growth plan?");
    expect(res.handedOff).toBe(false);
    expect(res.citations[0]?.title).toBe("Billing and plans");
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from messages where conversation_id = ${res.conversationId}`;
    expect(row?.n).toBe(2);
  });

  it("opens a ticket without calling the model when the customer asks for a person", async () => {
    const llm = new FakeAnswerer(() => {
      throw new Error("should not be called");
    });
    const res = await chat(sql, llm, "Can I talk to a person please?");
    expect(res.handedOff).toBe(true);
    expect(res.ticketId).not.toBeNull();
    expect(llm.calls).toHaveLength(0);
  });

  it("opens a ticket when the model says the docs don't cover it", async () => {
    const llm = new FakeAnswerer(() => ({ answer: "", cited_chunk_ids: [], needs_human: true, handoff_reason: "Integration question not in docs" }));
    const res = await chat(sql, llm, "Do you integrate with QuickBooks invoices?");
    expect(res.handedOff).toBe(true);
    const [t] = await sql`select reason, status from tickets where id = ${res.ticketId!}`;
    expect(t).toEqual({ reason: "Integration question not in docs", status: "open" });
  });

  it("continues a conversation and uses the previous question for retrieval", async () => {
    const llm = new FakeAnswerer((src) => ({ answer: "ok", cited_chunk_ids: [src[0]!.id], needs_human: false, handoff_reason: null }));
    const first = await chat(sql, llm, "How do refunds work?");
    const second = await chat(sql, llm, "and if I paid yearly?", first.conversationId);
    expect(second.conversationId).toBe(first.conversationId);
    expect(llm.calls[1]!.map((s) => s.heading)).toContain("Refunds");
  });
});
