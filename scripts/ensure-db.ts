// Creates the app's database on a shared Postgres server if it doesn't exist yet,
// so several apps can share one server, each with its own database (e.g. .../atrium, .../cited).
import postgres from "postgres";

export async function ensureDatabase(url: string): Promise<void> {
  const probe = postgres(url, { onnotice: () => {}, max: 1 });
  try {
    await probe`select 1`;
    return;
  } catch (e) {
    if ((e as { code?: string }).code !== "3D000") throw e; // 3D000 = database does not exist
  } finally {
    await probe.end();
  }
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error(`Refusing to create database with name "${name}"`);
  target.pathname = "/postgres";
  const admin = postgres(target.toString(), { onnotice: () => {}, max: 1 });
  try {
    await admin.unsafe(`create database ${name}`);
    console.log(`Created database "${name}".`);
  } finally {
    await admin.end();
  }
}
