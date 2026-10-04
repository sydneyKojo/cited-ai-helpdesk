import postgres from "postgres";

export type Sql = postgres.Sql;

export function connect(url = process.env.DATABASE_URL ?? "postgres://localhost:5432/helpdesk"): Sql {
  return postgres(url, { onnotice: () => {} });
}

// Idempotent: safe to run on every deploy.
export async function setup(sql: Sql): Promise<void> {
  await sql.unsafe(`
    create table if not exists documents (
      id serial primary key,
      slug text not null unique,
      title text not null,
      updated_at timestamptz not null default now()
    );
    create table if not exists chunks (
      id serial primary key,
      document_id int not null references documents(id) on delete cascade,
      ord int not null,
      heading text not null,
      content text not null,
      tsv tsvector generated always as (
        setweight(to_tsvector('english', heading), 'A') || setweight(to_tsvector('english', content), 'B')
      ) stored
    );
    create index if not exists chunks_tsv_idx on chunks using gin (tsv);
    create table if not exists conversations (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now()
    );
    create table if not exists messages (
      id serial primary key,
      conversation_id uuid not null references conversations(id) on delete cascade,
      role text not null check (role in ('user', 'assistant')),
      content text not null,
      citations jsonb not null default '[]',
      created_at timestamptz not null default now()
    );
    create table if not exists tickets (
      id serial primary key,
      conversation_id uuid not null references conversations(id) on delete cascade,
      question text not null,
      reason text not null,
      status text not null default 'open' check (status in ('open', 'resolved')),
      created_at timestamptz not null default now()
    );
    alter table tickets add column if not exists resolved_at timestamptz;
    create index if not exists messages_convo_idx on messages (conversation_id, id);
    create table if not exists settings (
      id int primary key check (id = 1),
      assistant_name text not null,
      greeting text not null,
      brand_color text not null,
      allowed_origins text not null default '',
      updated_at timestamptz not null default now()
    );
    insert into settings (id, assistant_name, greeting, brand_color)
      values (1, 'Help assistant', 'Hi! Ask me anything about your account, billing or invoices.', '#111111')
      on conflict (id) do nothing;
  `);
}
