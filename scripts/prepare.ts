// Runs before each deploy: creates or updates tables, re-indexes the help articles,
// and loads the demo conversations into an empty database.
import "dotenv/config";
import { connect, setup } from "../src/db.js";
import { ingestDir } from "../src/knowledge.js";
import { ensureDatabase } from "./ensure-db.js";

await ensureDatabase(process.env.DATABASE_URL ?? "postgres://localhost:5432/helpdesk");
const sql = connect();
await setup(sql);
const [row] = await sql<{ n: number }[]>`select count(*)::int as n from conversations`;
const r = await ingestDir(sql, "knowledge");
await sql.end();
console.log(`Indexed ${r.documents} articles (${r.chunks} sections).`);
if ((row?.n ?? 0) === 0) {
  console.log("No conversations yet: loading demo history.");
  await import("./seed-demo.js");
}
