import type { Child } from "hono/jsx";

// Changes on every deploy/restart so browsers fetch fresh CSS and JS despite caching.
const V = Date.now().toString(36);

// Icon set shared with the rest of the portfolio (24px grid, 1.75 stroke).
const PATHS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 19v-1a4 4 0 0 0-3-3.87M16 3.13a3.5 3.5 0 0 1 0 6.75",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h3",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  plus: "M12 5v14M5 12h14",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  check: "M20 6 9 17l-5-5",
  checkCircle: "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 16v-4M12 8h.01",
  arrowRight: "M5 12h14M12 5l7 7-7 7",
  arrowLeft: "M19 12H5M12 19l-7-7 7-7",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4",
  card: "M2 5h20v14H2zM2 10h20",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2",
  menu: "M3 6h18M3 12h18M3 18h18",
  x: "M18 6 6 18M6 6l12 12",
  mail: "M3 5h18v14H3zM3 7l9 6 9-6",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  printer: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  layers: "M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  zap: "M13 2 3 14h9l-1 8 10-12h-9z",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  briefcase: "M3 7h18v13H3zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M3 13h18",
  external: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3",
} as const;
const EXTRA = {
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM20 17v4H6.5A2.5 2.5 0 0 1 4 18.5",
  code: "M16 18l6-6-6-6M8 6l-6 6 6 6",
  chart: "M3 3v18h18M7 16v-5M12 16V7M17 16v-8",
  quote: "M3 21c3 0 7-1 7-8V5H3v8h4c0 3-1 5-4 5zM14 21c3 0 7-1 7-8V5h-7v8h4c0 3-1 5-4 5z",
  refresh: "M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15",
} as const;
export type IconName = keyof typeof PATHS | keyof typeof EXTRA;

export function Icon({ name, size = "md" }: { name: IconName; size?: "sm" | "md" }) {
  const d = (PATHS as Record<string, string>)[name] ?? (EXTRA as Record<string, string>)[name];
  return (
    <svg class={size === "sm" ? "icon-sm" : "icon"} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// The Cited mark: the wordmark with a raised highlighter footnote. Every answer comes with its source.
export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <span class="logo" style={`font-weight:500;${onDark ? "color:#fbfaf7" : ""}`}>
      Cited<span class="fn" style="font-size:11px;min-width:16px;height:16px;margin-left:2px;transform:translateY(-2px)">1</span>
    </span>
  );
}

// Light by default; a saved "dark" choice is applied before first paint.
const THEME_SCRIPT = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export function ThemeToggle() {
  return (
    <button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch between light and dark mode" title="Light / dark mode">
      <svg class="icon-sm moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      <svg class="icon-sm sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
    </button>
  );
}

export function Document({ title, description, children, bodyClass }: { title: string; description?: string; children: Child; bodyClass?: string }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" />
        <link rel="stylesheet" href={`/assets/cited.css?v=${V}`} />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23111111'/%3E%3Ccircle cx='20' cy='14' r='3' fill='white'/%3E%3C/svg%3E" />
      </head>
      <body class={bodyClass}>
        {children}
        <script src={`/assets/console.js?v=${V}`} defer></script>
      </body>
    </html>
  );
}

export const LABEL: Record<string, string> = { open: "Open", resolved: "Resolved", answered: "Answered", handed_off: "Handed off" };
const TONE: Record<string, string> = { open: "overdue", resolved: "paid", answered: "paid", handed_off: "open" };

export function Badge({ status }: { status: string }) {
  return <span class={`badge ${TONE[status] ?? "void"}`}>{LABEL[status] ?? status}</span>;
}

export function Help({ id, children }: { id: string; children: Child }) {
  return (
    <span class="help" tabindex={0} aria-describedby={id}>
      <Icon name="help" size="sm" />
      <span class="tip" role="tooltip" id={id}>{children}</span>
    </span>
  );
}

export function Kpi({ label, value, hint, help, alert }: { label: string; value: string; hint?: string; help?: string; alert?: boolean }) {
  const id = `kpi-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div class={`card kpi${alert ? " alert" : ""}`}>
      <div class="label">{label}{help && <Help id={id}>{help}</Help>}</div>
      <div class="value">{value}</div>
      {hint && <div class="hint">{hint}</div>}
    </div>
  );
}

export function PageHead({ title, lead, crumbs, actions }: { title: string; lead?: Child; crumbs?: { href: string; label: string }[]; actions?: Child }) {
  return (
    <div class="page-head">
      <div>
        {crumbs && (
          <nav class="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c) => <span class="crumbs"><a href={c.href}>{c.label}</a><span aria-hidden="true">/</span></span>)}
          </nav>
        )}
        <h1>{title}</h1>
        {lead && <p class="lead">{lead}</p>}
      </div>
      {actions && <div class="actions">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon: IconName; title: string; children?: Child; action?: Child }) {
  return (
    <div class="empty">
      <div class="glyph"><Icon name={icon} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <div class={`flash ${err ? "err" : "ok"}`} role={err ? "alert" : "status"}>
      <Icon name={err ? "alert" : "checkCircle"} size="sm" />
      <span>{err ?? ok}</span>
    </div>
  );
}

export function Segmented({ items, current }: { items: { key: string; href: string; label: string; n?: number }[]; current: string }) {
  return (
    <nav class="segmented" aria-label="Filter">
      {items.map((i) => (
        <a href={i.href} aria-current={i.key === current ? "true" : undefined}>
          {i.label}{i.n !== undefined && <span class="n">{i.n}</span>}
        </a>
      ))}
    </nav>
  );
}

// A destructive or important action asks first. Wired up by /assets/console.js; without JS the form just submits.
export function ConfirmSubmit({ label, title, body, confirm, cls = "btn secondary" }: { label: Child; title: string; body: string; confirm: string; cls?: string }) {
  return (
    <button type="submit" class={cls} data-confirm-title={title} data-confirm-body={body} data-confirm-ok={confirm}>{label}</button>
  );
}

export function relative(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d ago`;
  return dateLabel(d);
}

export function dateLabel(d: Date, withTime = false): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
