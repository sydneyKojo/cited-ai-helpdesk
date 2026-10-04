import "dotenv/config";
import { chat } from "./assistant.js";
import { connect, setup } from "./db.js";
import { ingestDir } from "./knowledge.js";
import { answererFromEnv } from "./llm.js";

const [cmd, ...args] = process.argv.slice(2);
const sql = connect();

try {
  await setup(sql);
  if (cmd === "setup") {
    console.log("Database ready.");
  } else if (cmd === "ingest") {
    const r = await ingestDir(sql, args[0] ?? "knowledge");
    console.log(`Ingested ${r.documents} articles into ${r.chunks} sections.`);
  } else if (cmd === "ask") {
    const res = await chat(sql, answererFromEnv(), args.join(" "));
    console.log(res.answer);
    for (const c of res.citations) console.log(`  source: ${c.title} › ${c.heading}`);
    if (res.ticketId) console.log(`  handed off: ticket #${res.ticketId}`);
  } else {
    console.log('Usage: tsx src/cli.ts setup | ingest <dir> | ask "<question>"');
    process.exitCode = 1;
  }
} finally {
  await sql.end();
}
