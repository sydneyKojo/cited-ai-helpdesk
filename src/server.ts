import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { connect, setup } from "./db.js";
import { answererFromEnv } from "./llm.js";

const sql = connect();
await setup(sql);
const adminToken = process.env.ADMIN_TOKEN ?? "";
if (!adminToken || adminToken === "change-me") console.warn("ADMIN_TOKEN is not set: the support console stays locked until it is.");

const app = createApp({
  sql,
  answerer: answererFromEnv(),
  adminToken,
  secureCookies: process.env.NODE_ENV === "production",
  trustProxy: process.env.TRUST_PROXY === "true",
});

const port = Number(process.env.PORT ?? 3300);
serve({ fetch: app.fetch, port });
console.log(`Cited on http://localhost:${port} · console: /console · demo: /demo`);
