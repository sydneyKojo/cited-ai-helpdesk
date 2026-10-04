import type { Child } from "hono/jsx";
import type { Article, ConversationRow, Overview, TicketRow, TranscriptMessage } from "../insights.js";
import type { Source } from "../knowledge.js";
import type { Settings } from "../settings.js";
import { Badge, ConfirmSubmit, dateLabel, Document, Empty, Flash, Help, Icon, type IconName, Kpi, Logo, PageHead, pct, relative, Segmented, ThemeToggle } from "./ui.js";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/console", label: "Overview", icon: "home" },
  { href: "/console/inbox", label: "Inbox", icon: "inbox" },
  { href: "/console/conversations", label: "Conversations", icon: "message" },
  { href: "/console/knowledge", label: "Knowledge base", icon: "book" },
];
const NAV2: { href: string; label: string; icon: IconName }[] = [
  { href: "/console/install", label: "Install widget", icon: "code" },
  { href: "/console/settings", label: "Settings", icon: "settings" },
];

export function Shell({ path, title, openTickets, settings, children }: { path: string; title: string; openTickets: number; settings: Settings; children: Child }) {
  const tab = (i: { href: string; label: string; icon: IconName }) => {
    const active = i.href === "/console" ? path === "/console" : path.startsWith(i.href);
    return (
      <a href={i.href} aria-current={active ? "page" : undefined}>
        {i.label}
        {i.href === "/console/inbox" && openTickets > 0 && <span class="count" title="Open tickets">{openTickets}</span>}
      </a>
    );
  };
  return (
    <Document title={`${title} · Cited`}>
      <div class="cshell">
        <header class="tophead">
          <div class="bar">
            <a href="/console" aria-label="Cited console"><Logo /></a>
            <span class="muted small" style="white-space:nowrap"><span class="swatch" style={`background:${settings.brandColor}`} />{settings.assistantName}</span>
            <span style="flex:1" />
            <form action="/console/conversations" class="search" role="search">
              <Icon name="search" size="sm" />
              <input name="q" type="search" placeholder="Search conversations" aria-label="Search conversations" />
            </form>
            <ThemeToggle />
            <details class="user-menu">
              <summary aria-label="Account menu"><span class="avatar" aria-hidden="true">SA</span></summary>
              <div class="menu">
                <div class="who"><div class="strong">Support admin</div><div class="muted tiny">Signed in with the admin token</div></div>
                <a href="/demo" target="_blank" rel="noopener"><Icon name="external" size="sm" /> Open the live widget</a>
                <a href="/console/settings"><Icon name="settings" size="sm" /> Settings</a>
                <form method="post" action="/console/logout"><button><Icon name="logout" size="sm" /> Sign out</button></form>
              </div>
            </details>
          </div>
          <nav class="tabs" aria-label="Console">{[...NAV, ...NAV2].map(tab)}</nav>
        </header>
        <main class="content" id="main">{children}</main>
      </div>
    </Document>
  );
}

export function LoginPage({ error, next }: { error?: boolean; next?: string }) {
  return (
    <Document title="Sign in · Cited console">
      <div class="auth">
        <aside class="auth-side">
          <a href="/" aria-label="Cited home"><Logo onDark /></a>
          <div style="display:grid;gap:24px">
            <h2>The support console behind your AI assistant.</h2>
            <ul>
              <li><Icon name="inbox" /> <span>Every handoff in one inbox, with the full conversation.</span></li>
              <li><Icon name="chart" /> <span>See how many questions are answered without a person, and why the rest aren't.</span></li>
              <li><Icon name="book" /> <span>Manage the help articles the assistant answers from.</span></li>
            </ul>
          </div>
          <p style="font-size:13px;opacity:.8">Cited · AI support answers with sources</p>
        </aside>
        <main class="auth-main" style="position:relative">
          <div style="position:absolute;top:20px;right:20px"><ThemeToggle /></div>
          <div class="auth-card">
            <div>
              <h1>Sign in to the console</h1>
              <p class="muted">Enter your workspace's admin token. It's set as <code>ADMIN_TOKEN</code> on the server.</p>
            </div>
            {error && <div class="flash err" role="alert"><Icon name="alert" size="sm" /><span>That token isn't right. Check for extra spaces, or ask whoever deployed Cited.</span></div>}
            <form method="post" action="/console/login" class="form card card-pad">
              <input type="hidden" name="next" value={next ?? "/console"} />
              <label>Admin token<input name="token" type="password" autocomplete="current-password" required autofocus /></label>
              <button class="btn lg" data-pending="Signing in…">Sign in</button>
              <p class="muted tiny">You stay signed in for 7 days on this device.</p>
            </form>
            <p class="muted tiny" style="text-align:center"><a href="/">← About Cited</a> · <a href="/demo">Try the demo widget</a></p>
          </div>
        </main>
      </div>
    </Document>
  );
}

export function OverviewPage({ o, recent, days }: { o: Overview; recent: TicketRow[]; days: number }) {
  const max = Math.max(1, ...o.daily.map((d) => d.questions));
  const first = o.daily[0]?.day;
  const last = o.daily[o.daily.length - 1]?.day;
  const fmt = (d?: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
  const reasonMax = Math.max(1, ...o.reasons.map((r) => r.n));
  return (
    <>
      <PageHead
        title="Overview"
        lead={`How the assistant performed over the last ${days} days: what it answered on its own, what it handed to your team, and why.`}
        actions={<a href="/console/inbox?status=open" class="btn"><Icon name="inbox" size="sm" /> Open inbox</a>}
      />
      <section class="kpis">
        <Kpi label="Conversations" value={String(o.conversations)} hint={`${o.questions} questions asked`} help="Chat sessions started in the widget. One conversation can contain several questions." />
        <Kpi label="Resolved by assistant" value={o.conversations ? pct(o.automationRate) : "–"} hint={`${o.resolvedByAssistant} of ${o.conversations} conversations`} help="Conversations that ended without a ticket: every question was answered from your docs." />
        <Kpi label="Handed to your team" value={String(o.handedOff)} hint="Conversations with a ticket" help="Conversations where at least one question needed a person, because the docs didn't cover it, policy requires a person, or the customer asked for one." />
        <Kpi label="Open tickets" value={String(o.openTickets)} hint={o.openTickets ? "Waiting for a reply" : "Inbox zero"} alert={o.openTickets > 0} help="Handoffs not yet marked resolved, across all time." />
      </section>

      <div class="grid grid-main">
        <section class="card">
          <div class="card-head">
            <div><h2>Questions per day</h2><p>Bar height is questions asked; the highlighted part is questions handed to a person.</p></div>
            <div class="legend" style="margin:0"><span><i style="background:var(--ink)" />Questions</span><span><i style="background:var(--mark)" />Handoffs</span></div>
          </div>
          <div class="card-body">
            <div class="chart" role="img" aria-label={`Questions per day from ${fmt(first)} to ${fmt(last)}; peak ${max}.`}>
              {o.daily.map((d) => (
                <div class="col" title={`${fmt(d.day)}: ${d.questions} questions, ${d.handoffs} handed off`}>
                  <span class="h" style={`height:${(Math.min(d.handoffs, d.questions) / max) * 100}%`} />
                  <span class="q" style={`height:${((d.questions - Math.min(d.handoffs, d.questions)) / max) * 100}%`} />
                </div>
              ))}
            </div>
            <div class="axis"><span>{fmt(first)}</span><span>{fmt(last)}</span></div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><h2>Why it handed off <Help id="reasons-help">The reason recorded on each ticket. “Not in the docs” reasons point to articles worth writing.</Help></h2><p>Top reasons, last {days} days</p></div></div>
          {o.reasons.length === 0 ? (
            <Empty icon="checkCircle" title="No handoffs yet">When the assistant passes a question to your team, the reason shows up here.</Empty>
          ) : (
            <div class="card-body bars">
              {o.reasons.map((r) => (
                <div class="bar-row" style="grid-template-columns:1fr 70px 28px">
                  <span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title={r.reason}>{r.reason}</span>
                  <span class="bar-track"><span class="bar-fill warn" style={`width:${(r.n / reasonMax) * 100}%;display:block`} /></span>
                  <span class="strong num" style="text-align:right">{r.n}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div class="grid grid-2">
        <section class="card">
          <div class="card-head"><div><h2>Most-cited articles</h2><p>The help sections customers rely on most.</p></div><a href="/console/knowledge" class="btn ghost sm">Knowledge base</a></div>
          {o.topSources.length === 0 ? (
            <Empty icon="book" title="No answers yet">Once the assistant answers questions, the sections it cites are ranked here.</Empty>
          ) : (
            <ul class="list">
              {o.topSources.map((s) => (
                <li><Icon name="book" size="sm" /><span class="grow"><span class="title">{s.heading}</span><span class="muted tiny">{s.title}</span></span><span class="strong num">{s.n}</span></li>
              ))}
            </ul>
          )}
        </section>
        <section class="card">
          <div class="card-head"><div><h2>Latest handoffs</h2><p>Newest tickets first.</p></div><a href="/console/inbox" class="btn ghost sm">Inbox</a></div>
          {recent.length === 0 ? (
            <Empty icon="inbox" title="Nothing handed off">Tickets appear here when the assistant can't answer from your docs.</Empty>
          ) : (
            <ul class="list">
              {recent.map((t) => (
                <li>
                  <span class="grow"><a href={`/console/inbox/${t.id}`} class="title">{t.question}</a><span class="muted tiny">#{t.id} · {t.reason} · {relative(t.createdAt)}</span></span>
                  <Badge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export function InboxPage({ rows, status, q, counts, ok }: { rows: TicketRow[]; status: string; q: string; counts: { open: number; resolved: number }; ok?: string }) {
  const href = (s: string) => `/console/inbox?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <>
      <PageHead title="Inbox" lead="Questions the assistant handed to your team. Reply to the customer by email, then mark the ticket resolved." />
      <Flash ok={ok} />
      <section class="card">
        <div class="toolbar">
          <Segmented current={status} items={[
            { key: "open", href: href("open"), label: "Open", n: counts.open },
            { key: "resolved", href: href("resolved"), label: "Resolved", n: counts.resolved },
            { key: "all", href: href("all"), label: "All", n: counts.open + counts.resolved },
          ]} />
          <form action="/console/inbox" role="search">
            <input type="hidden" name="status" value={status} />
            <input name="q" value={q} placeholder="Search questions and reasons" aria-label="Search tickets" />
            <button class="btn secondary">Search</button>
          </form>
        </div>
        {rows.length === 0 ? (
          q ? <Empty icon="search" title="No tickets match" action={<a href="/console/inbox" class="btn secondary sm">Clear search</a>}>Try other words from the customer's question.</Empty>
            : status === "open" ? <Empty icon="checkCircle" title="Inbox zero">No customer is waiting on your team. New handoffs from the assistant will appear here.</Empty>
            : <Empty icon="inbox" title="No tickets yet">When the assistant can't answer from your docs, it opens a ticket here with the whole conversation.</Empty>
        ) : (
          <div class="table-wrap">
            <table>
              <thead><tr><th>Ticket</th><th>Why it was handed off</th><th>Status</th><th>Opened</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr>
                    <td><a href={`/console/inbox/${t.id}`} class="row-link">{t.question.length > 90 ? `${t.question.slice(0, 90)}…` : t.question}</a><span class="sub">#{t.id} · {t.messages} messages in conversation</span></td>
                    <td class="small">{t.reason}</td>
                    <td><Badge status={t.status} /></td>
                    <td class="nowrap muted small" title={dateLabel(t.createdAt, true)}>{relative(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Transcript({ messages }: { messages: TranscriptMessage[] }) {
  return (
    <div class="transcript">
      {messages.map((m) => (
        <div class={`bubble ${m.role === "user" ? "user" : "bot"}`}>
          {m.content}
          {m.citations.map((_, i) => <span class="fn">{i + 1}</span>)}
          {m.citations.length > 0 && (
            <div class="sources">
              {m.citations.map((c, i) => (
                <div class="source"><span class="fn">{i + 1}</span><span><b>{c.title} › {c.heading}</b>{c.excerpt && <q>{c.excerpt}</q>}</span></div>
              ))}
            </div>
          )}
          <span class="tiny" style="display:block;margin-top:8px;opacity:.65">{m.role === "user" ? "Customer" : "Assistant"} · {dateLabel(m.createdAt, true)}</span>
        </div>
      ))}
    </div>
  );
}

export function TicketPage({ ticket, messages, ok }: { ticket: TicketRow; messages: TranscriptMessage[]; ok?: string }) {
  return (
    <>
      <PageHead
        crumbs={[{ href: "/console/inbox", label: "Inbox" }]}
        title={`Ticket #${ticket.id}`}
        lead={<>Opened {dateLabel(ticket.createdAt, true)}{ticket.resolvedAt && <> · Resolved {dateLabel(ticket.resolvedAt, true)}</>}</>}
        actions={
          <form method="post" action={`/console/inbox/${ticket.id}/${ticket.status === "open" ? "resolve" : "reopen"}`}>
            {ticket.status === "open" ? (
              <ConfirmSubmit label={<><Icon name="check" size="sm" /> Mark resolved</>} cls="btn" title="Mark this ticket resolved?" body="Do this after you've replied to the customer. You can reopen it later." confirm="Mark resolved" />
            ) : (
              <button class="btn secondary">Reopen ticket</button>
            )}
          </form>
        }
      />
      <Flash ok={ok} />
      <div class="grid grid-main">
        <section class="card">
          <div class="card-head"><div><h2>Conversation</h2><p>Everything the customer and the assistant said, with the sources shown to the customer.</p></div></div>
          <Transcript messages={messages} />
        </section>
        <section class="card">
          <div class="card-head"><div><h2>Details</h2></div><Badge status={ticket.status} /></div>
          <div class="card-body form">
            <dl class="dl">
              <dt>Question</dt><dd>{ticket.question}</dd>
              <dt>Handed off because</dt><dd>{ticket.reason}</dd>
              <dt>Conversation</dt><dd><code>{ticket.conversationId.slice(0, 8)}</code></dd>
            </dl>
            <div class="callout"><Icon name="info" size="sm" /><span>If this question comes up often, add the answer to your help articles and re-index. The assistant will answer it next time.</span></div>
            <a href="/console/knowledge" class="btn secondary">Go to knowledge base</a>
          </div>
        </section>
      </div>
    </>
  );
}

export function ConversationsPage({ rows, outcome, q }: { rows: ConversationRow[]; outcome: string; q: string }) {
  const href = (o: string) => `/console/conversations?outcome=${o}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <>
      <PageHead title="Conversations" lead="Every chat with the assistant, newest first. Review answers, spot gaps in your docs, and open any handoff." />
      <section class="card">
        <div class="toolbar">
          <Segmented current={outcome} items={[
            { key: "all", href: href("all"), label: "All" },
            { key: "answered", href: href("answered"), label: "Resolved by assistant" },
            { key: "handed_off", href: href("handed_off"), label: "Handed off" },
          ]} />
          <form action="/console/conversations" role="search">
            <input type="hidden" name="outcome" value={outcome} />
            <input name="q" value={q} placeholder="Search messages" aria-label="Search messages" />
            <button class="btn secondary">Search</button>
          </form>
        </div>
        {rows.length === 0 ? (
          <Empty icon="message" title={q || outcome !== "all" ? "No conversations match" : "No conversations yet"} action={q || outcome !== "all" ? <a href="/console/conversations" class="btn secondary sm">Show all</a> : <a href="/demo" class="btn sm">Ask the demo widget</a>}>
            {q || outcome !== "all" ? "Try another filter or search term." : "Conversations appear here as soon as customers use the widget."}
          </Empty>
        ) : (
          <div class="table-wrap">
            <table>
              <thead><tr><th>First question</th><th class="r">Questions</th><th>Outcome</th><th>Last message</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr>
                    <td><a href={`/console/conversations/${c.id}`} class="row-link">{c.firstQuestion.length > 100 ? `${c.firstQuestion.slice(0, 100)}…` : c.firstQuestion}</a></td>
                    <td class="r">{c.questions}</td>
                    <td>{c.handedOff ? <a href={`/console/inbox/${c.ticketId}`}><Badge status="handed_off" /></a> : <Badge status="answered" />}</td>
                    <td class="nowrap muted small" title={dateLabel(c.lastAt, true)}>{relative(c.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function ConversationPage({ id, messages, ticketId }: { id: string; messages: TranscriptMessage[]; ticketId: number | null }) {
  return (
    <>
      <PageHead
        crumbs={[{ href: "/console/conversations", label: "Conversations" }]}
        title="Conversation"
        lead={<>Started {messages[0] ? dateLabel(messages[0].createdAt, true) : ""} · <code>{id.slice(0, 8)}</code></>}
        actions={ticketId ? <a href={`/console/inbox/${ticketId}`} class="btn secondary"><Icon name="inbox" size="sm" /> View ticket #{ticketId}</a> : <Badge status="answered" />}
      />
      <section class="card"><Transcript messages={messages} /></section>
    </>
  );
}

export function KnowledgePage({ articles, ok, err, q, hits }: { articles: Article[]; ok?: string; err?: string; q: string; hits: Source[] | null }) {
  return (
    <>
      <PageHead
        title="Knowledge base"
        lead="The help articles the assistant answers from. Edit the Markdown files in the knowledge folder, then re-index to update answers."
        actions={
          <form method="post" action="/console/knowledge/reindex">
            <ConfirmSubmit label={<><Icon name="refresh" size="sm" /> Re-index articles</>} cls="btn" title="Re-index the knowledge base?" body="Articles are re-read from the knowledge folder. Answers use the new content straight away; past conversations are unchanged." confirm="Re-index" />
          </form>
        }
      />
      <Flash ok={ok} err={err} />
      <div class="grid grid-main">
        <section class="card">
          <div class="card-head"><div><h2>Articles</h2><p>{articles.length} article{articles.length === 1 ? "" : "s"}, {articles.reduce((s, a) => s + a.sections, 0)} sections</p></div></div>
          {articles.length === 0 ? (
            <Empty icon="book" title="No articles indexed">Add Markdown files to the knowledge folder (one “## ” heading per topic), then re-index.</Empty>
          ) : (
            <div class="table-wrap">
              <table>
                <thead><tr><th>Article</th><th class="r">Sections</th><th class="r">Times cited</th><th>Indexed</th></tr></thead>
                <tbody>
                  {articles.map((a) => (
                    <tr>
                      <td><a href={`/console/knowledge/${a.slug}`} class="row-link">{a.title}</a><span class="sub">{a.slug}.md</span></td>
                      <td class="r">{a.sections}</td>
                      <td class="r">{a.citations}</td>
                      <td class="muted small nowrap">{relative(a.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section class="card">
          <div class="card-head"><div><h2>Test retrieval</h2><p>See which sections the assistant would read for a question. No AI call, no cost.</p></div></div>
          <form action="/console/knowledge" class="card-body form">
            <label>Customer question<input name="q" value={q} placeholder="e.g. how do refunds work?" /></label>
            <button class="btn secondary">Find sections</button>
          </form>
          {hits && (
            hits.length === 0 ? (
              <Empty icon="search" title="Nothing relevant found">The assistant would hand this question to your team. Consider writing an article that covers it.</Empty>
            ) : (
              <ol class="list" style="padding:0">
                {hits.map((h, i) => (
                  <li style="align-items:flex-start">
                    <span class="score">#{i + 1}</span>
                    <span class="grow hit"><span class="title">{h.heading}</span><span class="muted tiny">{h.title}</span><p class="small muted" style="margin-top:4px">{h.content.slice(0, 160)}{h.content.length > 160 ? "…" : ""}</p></span>
                  </li>
                ))}
              </ol>
            )
          )}
        </section>
      </div>
    </>
  );
}

export function ArticlePage({ title, slug, sections }: { title: string; slug: string; sections: { id: number; heading: string; content: string }[] }) {
  return (
    <>
      <PageHead
        crumbs={[{ href: "/console/knowledge", label: "Knowledge base" }]}
        title={title}
        lead={<>Source file <code>knowledge/{slug}.md</code> · {sections.length} sections</>}
        actions={<a href={`/demo/articles/${slug}`} class="btn secondary" target="_blank" rel="noopener"><Icon name="external" size="sm" /> View in help centre</a>}
      />
      <div class="grid">
        {sections.map((s) => (
          <section class="card">
            <div class="card-head"><div><h2>{s.heading}</h2><p>Section id {s.id}: cited in answers as “{title} › {s.heading}”</p></div></div>
            <div class="card-body"><p class="section-text">{s.content}</p></div>
          </section>
        ))}
      </div>
    </>
  );
}

export function InstallPage({ origin, settings }: { origin: string; settings: Settings }) {
  const snippet = `<script src="${origin}/widget.js" defer></script>`;
  return (
    <>
      <PageHead title="Install the widget" lead="Add the assistant to your website or help centre in three steps." />
      <ol class="grid" style="padding:0;margin:0;list-style:none">
        <li class="card">
          <div class="card-head"><div><h2>1. Allow your website</h2><p>The widget only works on sites you list, so nobody else can embed your assistant.</p></div><a href="/console/settings" class="btn secondary sm">Edit allowed sites</a></div>
          <div class="card-body">
            {settings.allowedOrigins.length === 0 ? (
              <div class="callout"><Icon name="info" size="sm" /><span>No external sites allowed yet. The widget currently works only on this server ({origin}).</span></div>
            ) : (
              <ul class="small" style="margin:0;padding-left:18px">{settings.allowedOrigins.map((o) => <li><code>{o}</code></li>)}</ul>
            )}
          </div>
        </li>
        <li class="card">
          <div class="card-head"><div><h2>2. Paste this before the closing &lt;/body&gt; tag</h2><p>Works with any site builder that lets you add custom code.</p></div><button type="button" class="btn secondary sm" data-copy="snippet">Copy</button></div>
          <div class="card-body"><pre class="code" id="snippet"><code>{snippet}</code></pre></div>
        </li>
        <li class="card">
          <div class="card-head"><div><h2>3. Check it</h2><p>Open your site: a chat button appears bottom-right using your brand colour and greeting. Ask a question from your docs, then one that isn't.</p></div><a href="/demo" target="_blank" rel="noopener" class="btn secondary sm">See it on the demo site</a></div>
        </li>
      </ol>
      <div class="callout"><Icon name="shield" size="sm" /><span>Each visitor can send up to 20 messages per 5 minutes. Requests from sites that aren't allowed are refused.</span></div>
    </>
  );
}

export function SettingsPage({ settings, ok, err }: { settings: Settings; ok?: string; err?: string }) {
  return (
    <>
      <PageHead title="Settings" lead={`How the assistant introduces itself, and where it may be embedded. Last changed ${dateLabel(settings.updatedAt, true)}.`} />
      <Flash ok={ok} err={err} />
      <form method="post" action="/console/settings" class="grid grid-main" style="align-items:start">
        <section class="card">
          <div class="card-head"><div><h2>Assistant</h2><p>Shown in the chat widget header and first message.</p></div></div>
          <div class="card-body form">
            <label>Name<input name="assistantName" required maxlength={40} value={settings.assistantName} /><span class="hint">e.g. “Acme Help” or “Support assistant”.</span></label>
            <label>Greeting<textarea name="greeting" required maxlength={200}>{settings.greeting}</textarea><span class="hint">The first message customers see. Say what it can help with.</span></label>
            <label style="max-width:220px">Brand colour<input name="brandColor" type="color" value={settings.brandColor} style="height:42px;padding:4px" /></label>
          </div>
        </section>
        <section class="card">
          <div class="card-head"><div><h2>Allowed websites</h2><p>Origins that may embed the widget.</p></div></div>
          <div class="card-body form">
            <label>One per line<textarea name="allowedOrigins" rows={5} placeholder={"https://www.example.com\nhttps://help.example.com"}>{settings.allowedOrigins.join("\n")}</textarea>
              <span class="hint">Scheme and host only, e.g. https://help.example.com. This server is always allowed.</span>
            </label>
          </div>
          <div class="card-foot form-actions"><button class="btn" data-pending="Saving…">Save settings</button></div>
        </section>
      </form>
    </>
  );
}

export function NotFoundPage() {
  return (
    <Document title="Page not found · Cited">
      <main class="auth-main" style="min-height:100vh">
        <div class="auth-card" style="text-align:center;justify-items:center">
          <Logo />
          <h1>We couldn't find that page</h1>
          <p class="muted">The link may be out of date, or the ticket or article may have been removed.</p>
          <div class="actions" style="justify-content:center"><a href="/console" class="btn">Go to the console</a><a href="/" class="btn secondary">Cited home</a></div>
        </div>
      </main>
    </Document>
  );
}
