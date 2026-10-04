import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { Sql } from "./db.js";

export interface Chunk {
  heading: string;
  content: string;
}

export interface Source {
  id: number;
  title: string;
  heading: string;
  slug: string;
  content: string;
}

// One chunk per "## " section keeps each answer citable to a specific article section.
export function chunkMarkdown(md: string): { title: string; chunks: Chunk[] } {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  let heading = "Overview";
  let buf: string[] = [];
  const chunks: Chunk[] = [];
  const flush = () => {
    const content = buf.join("\n").trim();
    if (content) chunks.push({ heading, content });
    buf = [];
  };
  for (const line of lines) {
    const h1 = /^#\s+(.+)/.exec(line);
    const h2 = /^##\s+(.+)/.exec(line);
    if (h1 && !title) {
      title = h1[1]!.trim();
    } else if (h2) {
      flush();
      heading = h2[1]!.trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return { title: title || "Untitled", chunks };
}

// Re-ingesting a file replaces its chunks, so editing an article is just "run ingest again".
export async function ingestDir(sql: Sql, dir: string): Promise<{ documents: number; chunks: number }> {
  const files = (await readdir(dir)).filter((f) => extname(f) === ".md").sort();
  let total = 0;
  for (const file of files) {
    const { title, chunks } = chunkMarkdown(await readFile(join(dir, file), "utf8"));
    const slug = basename(file, ".md");
    await sql.begin(async (tx) => {
      const [doc] = await tx<{ id: number }[]>`
        insert into documents (slug, title) values (${slug}, ${title})
        on conflict (slug) do update set title = excluded.title, updated_at = now()
        returning id`;
      await tx`delete from chunks where document_id = ${doc!.id}`;
      for (const [ord, c] of chunks.entries()) {
        await tx`insert into chunks (document_id, ord, heading, content) values (${doc!.id}, ${ord}, ${c.heading}, ${c.content})`;
      }
    });
    total += chunks.length;
  }
  return { documents: files.length, chunks: total };
}

// Postgres full-text search, OR-ing the question's words and ranking by cover density.
// Headings are weighted above body text. No vector database or embedding API needed.
export async function search(sql: Sql, text: string, limit = 5): Promise<Source[]> {
  const words = [...new Set(text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])].slice(0, 30);
  if (words.length === 0) return [];
  const query = words.join(" | ");
  return sql<Source[]>`
    select c.id, d.title, c.heading, d.slug, c.content
    from chunks c join documents d on d.id = c.document_id,
         to_tsquery('english', ${query}) q
    where c.tsv @@ q
    order by ts_rank_cd(c.tsv, q, 32) desc, c.id
    limit ${limit}`;
}
