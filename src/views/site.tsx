import type { Article } from "../insights.js";
import { readFileSync } from "node:fs";
import { Document, Icon, type IconName, Logo, ThemeToggle } from "./ui.js";

// Hand-drawn line illustrations, inlined so their ink follows the light/dark theme.
const art = (name: string) =>
  readFileSync(new URL(`../../public/img/${name}.svg`, import.meta.url), "utf8").replaceAll('"#111"', '"currentColor"').replaceAll("#fff", "var(--surface)");
const ART = { book: art("book"), search: art("search"), handoff: art("handoff") };

function Illustration({ name, label }: { name: keyof typeof ART; label: string }) {
  return <figure class="illo" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: ART[name] }} />;
}

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: "quote", title: "Every answer shows its source", body: "Customers see which help article an answer came from, and can open it. Your team can check any answer against the original in one click." },
  { icon: "shield", title: "It doesn't guess", body: "If the answer isn't in your docs, Cited says so and hands over. Answers that don't cite a real section are blocked before the customer sees them." },
  { icon: "inbox", title: "Handoffs arrive with context", body: "When a person is needed, a ticket lands in the support inbox with the question, the reason and the full conversation, so nobody asks the customer to repeat themselves." },
  { icon: "chart", title: "See what it handles", body: "Track how many conversations the assistant resolves on its own, why it hands off, and which articles customers rely on most." },
  { icon: "book", title: "Your docs stay the source of truth", body: "Write help articles as you do today. Re-index after an edit and the assistant answers from the new version. There's no training step." },
  { icon: "code", title: "One line to install", body: "Add a single script tag to your site or help centre. The widget works on desktop and mobile and only runs on the domains you allow." },
];

const FLOW = [
  { t: "Customer asks", d: "A question in the chat widget on your site, in their own words." },
  { t: "Search your docs", d: "The most relevant sections of your help centre are found, including context from earlier in the chat." },
  { t: "Draft the answer", d: "Claude writes a short reply using only those sections, and lists the ones it used." },
  { t: "Check the draft", d: "Code verifies every citation points to a real, retrieved section. No citation, no answer." },
  { t: "Answer or hand off", d: "The customer gets a sourced answer, or a ticket is opened for your team with the full transcript." },
];

const FAQ = [
  { q: "Which AI model does it use?", a: "Claude, by Anthropic, through the official API. Answers are generated from your help articles only; the model is told to treat everything else as reference, not instructions." },
  { q: "What happens when the docs don't cover a question?", a: "The assistant tells the customer it doesn't want to guess and opens a ticket for your team. The ticket shows the question, why it was handed off and the conversation so far." },
  { q: "Can it issue refunds or change accounts?", a: "No, by design. Cited answers questions. Anything that needs a person, such as refunds, account deletion or identity checks, is explained from your policy and handed to your team." },
  { q: "How do I update what it knows?", a: "Edit your help articles and re-index from the Knowledge base page. Answers use the new content immediately." },
  { q: "Where is data stored?", a: "Cited is self-hosted: conversations and tickets live in your own PostgreSQL database. Questions and the relevant help sections are sent to the Claude API to draft each answer." },
];

export function HomePage() {
  return (
    <Document title="Cited · AI support answers your customers can trust" description="Cited answers customer questions from your own help centre, cites the article behind every answer and hands the rest to your team.">
      <header class="mk-nav">
        <div class="inner">
          <a href="/" aria-label="Cited home"><Logo /></a>
          <nav class="links" aria-label="Product">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#install">Install</a>
            <a href="#faq">FAQ</a>
          </nav>
          <span style="flex:1" />
          <ThemeToggle />
          <a href="/console" class="btn ghost">Support console</a>
          <a href="/demo" class="btn">Try the demo</a>
        </div>
      </header>

      <main>
        <div class="mk-wrap">
          <section class="mk-hero split">
            <div>
              <h1>Support answers your customers can <mark>trust</mark>.</h1>
              <p class="sub">Cited answers from your help centre, footnotes every answer with its source, and hands the rest to your team.</p>
              <div class="cta">
                <a href="/demo" class="btn lg">Ask the demo assistant <Icon name="arrowRight" size="sm" /></a>
                <a href="#how" class="btn secondary lg">How it works</a>
              </div>
              <p class="fine">Try a question it can't answer, too.</p>
            </div>
            <div class="ruled chat-demo" aria-hidden="true">
              <div class="bubble user">I paid for a yearly plan two weeks ago. Can I get a refund?</div>
              <div class="bubble bot">
                Yes. Yearly plans cancelled within 30 days get a full refund<span class="fn">1</span>. A person will review yours.
                <div class="sources">
                  <div class="source"><span class="fn">1</span><span><b>Billing and plans › Refunds</b><q>Yearly plans cancelled within 30 days of purchase get a full refund.</q></span></div>
                </div>
                <span class="tk"><Icon name="inbox" size="sm" /> Ticket #1 opened for the billing team</span>
              </div>
              <div class="bubble user">Do you integrate with QuickBooks?</div>
              <div class="bubble bot">I'm not sure, and I don't want to guess. I've passed this to our team.</div>
            </div>
          </section>
        </div>

        <section class="mk-section">
          <div class="mk-wrap">
            <div class="intro-art"><div class="intro" style="margin:0">
              <span class="kicker">The problem</span><h2>Most support bots guess. Customers notice.</h2>
              <p>A confident wrong answer about pricing or refunds costs more than no answer at all. Cited is built to be right or to step aside.</p>
            </div>
            <Illustration name="search" label="Drawing of a magnifying glass over a help article with one line highlighted" /></div>
            <div class="compare">
              <div class="card card-pad">
                <h3 style="margin-bottom:12px">A typical chatbot</h3>
                <ul>
                  {["Makes up policies that sound plausible", "No way to tell where an answer came from", "Customers repeat themselves when they reach a person", "No idea which questions it gets wrong"].map((t) => (
                    <li><span style="color:var(--danger)"><Icon name="x" size="sm" /></span>{t}</li>
                  ))}
                </ul>
              </div>
              <div class="card card-pad" style="border-color:var(--ink)">
                <h3 style="margin-bottom:12px">Cited</h3>
                <ul>
                  {["Answers only from your published help articles", "Shows the article and section behind each answer", "Hands off with the full transcript in your inbox", "Reports why it hands off, so you know which docs to write"].map((t) => (
                    <li><span style="color:var(--ok)"><Icon name="check" size="sm" /></span>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section class="mk-section" id="how">
          <div class="mk-wrap">
            <div class="intro-art"><div class="intro" style="margin:0">
              <span class="kicker">How it works</span><h2>What happens when a customer asks a question.</h2>
              <p>Five steps, in about two to five seconds. The last check is done in code, not left to the model.</p>
            </div>
            <Illustration name="book" label="Drawing of an open book with a highlighted line and a footnote marker" /></div>
            <ol class="flow" style="padding:0;margin:0">
              {FLOW.map((f, i) => (
                <li><span class="n">0{i + 1}</span><h3>{f.t}</h3><p>{f.d}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section class="mk-section alt" id="features">
          <div class="mk-wrap">
            <div class="intro">
              <span class="kicker">Product</span><h2>Built for support teams, not just for the chat window.</h2>
              <p>The widget is what customers see. The console is where your team runs it.</p>
            </div>
            <div class="features">
              {FEATURES.map((f) => (
                <div class="feature"><span class="fi"><Icon name={f.icon} /></span><h3>{f.title}</h3><p>{f.body}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section class="mk-section">
          <div class="mk-wrap">
            <div class="intro-art"><div class="intro" style="margin:0"><span class="kicker">Who it's for</span><h2>For teams where a wrong answer costs a customer.</h2></div>
            <Illustration name="handoff" label="Drawing of a customer question passed to a support agent as a ticket" /></div>
            <div class="grid grid-2">
              {[
                { i: "layers" as IconName, t: "SaaS support teams", d: "Deflect repeat questions about plans, billing and setup, and spend agent time on the issues that need a person." },
                { i: "card" as IconName, t: "E-commerce and subscriptions", d: "Answer delivery, returns and subscription questions straight from your policy pages, accurately." },
                { i: "briefcase" as IconName, t: "IT and internal helpdesks", d: "Point it at your internal wiki so staff get sourced answers about tools and processes." },
                { i: "users" as IconName, t: "Small teams without 24/7 cover", d: "Customers get answers out of hours; anything else is waiting in the inbox in the morning, with context." },
              ].map((a) => (
                <div class="card feature" style="grid-template-columns:auto 1fr;align-items:start;column-gap:14px">
                  <span class="fi" style="margin:0"><Icon name={a.i} /></span>
                  <div><h3>{a.t}</h3><p style="margin-top:4px">{a.d}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section class="mk-section" id="install">
          <div class="mk-wrap grid grid-2" style="align-items:center">
            <div class="intro" style="margin-bottom:0">
              <span class="kicker">Install</span><h2>Live on your site in minutes.</h2>
              <p>Load your help articles, allow your domain in Settings, then add one line before the closing body tag. The widget picks up your assistant's name, greeting and brand colour.</p>
            </div>
            <pre class="code"><code>{'<script src="https://support.yourcompany.com/widget.js" defer></script>'}</code></pre>
          </div>
        </section>

        <section class="mk-section" id="faq">
          <div class="mk-wrap">
            <div class="grid grid-2" style="gap:48px;align-items:start">
              <div><span class="kicker">FAQ</span><h2>Questions support leads ask.</h2></div>
              <div class="faq">{FAQ.map((f) => <details><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
            </div>
          </div>
        </section>

        <div class="mk-wrap">
          <section class="mk-cta" style="margin-top:88px">
            <h2>Ask it something it can't answer.</h2>
            <p style="max-width:520px">Then open the console to see the ticket it created, with the whole conversation attached.</p>
            <a href="/demo" class="btn lg">Try the demo</a>
          </section>
        </div>
      </main>
      <footer class="mk-foot">
        <div class="mk-wrap inner">
          <Logo />
          <span>Cited: AI support answers with sources. Powered by Claude. Demo company and articles are fictional.</span>
          <a href="/console">Support console</a>
        </div>
      </footer>
    </Document>
  );
}

// A realistic help centre for the fictional company, built from the same articles the assistant answers from.
export function DemoHelpCentre({ articles, article }: { articles: Article[]; article?: { title: string; slug: string; sections: { heading: string; content: string }[] } }) {
  return (
    <Document title={article ? `${article.title} · Acme Invoicing Help` : "Acme Invoicing Help Centre"}>
      <div style="background:#111;color:#fbfaf7;font-size:13px;padding:8px 16px;text-align:center">
        Demo of <a href="/" style="color:#fff;text-decoration:underline">Cited</a> on a fictional company's help centre. Open the chat in the bottom-right corner.
      </div>
      <header class="mk-nav">
        <div class="inner">
          <a href="/demo" class="logo" style="gap:8px"><span style="width:26px;height:26px;border-radius:6px;background:#1f2937;color:#fff;display:grid;place-items:center;font-size:13px">A</span>Acme Invoicing <span class="muted" style="font-weight:500">Help</span></a>
          <span style="flex:1" />
          <ThemeToggle />
          <a href="/console" class="btn ghost sm">See the support console</a>
        </div>
      </header>
      <main class="mk-wrap" style="padding-top:40px;padding-bottom:80px">
        {article ? (
          <article class="grid grid-main" style="align-items:start">
            <div class="card card-pad" style="display:grid;gap:22px">
              <nav class="crumbs"><a href="/demo">Help centre</a><span>/</span></nav>
              <h1 style="font-size:28px">{article.title}</h1>
              {article.sections.map((s) => (
                <section id={s.heading.toLowerCase().replace(/\W+/g, "-")}>
                  <h2 style="margin-bottom:6px">{s.heading}</h2>
                  <p class="section-text">{s.content}</p>
                </section>
              ))}
            </div>
            <aside class="card card-pad" style="display:grid;gap:8px">
              <h3>In this article</h3>
              {article.sections.map((s) => <a href={`#${s.heading.toLowerCase().replace(/\W+/g, "-")}`}>{s.heading}</a>)}
              <hr style="border:0;border-top:1px solid var(--line);width:100%" />
              <p class="muted small">Still stuck? Ask the assistant in the corner; it answers from these articles.</p>
            </aside>
          </article>
        ) : (
          <div class="grid" style="gap:28px">
            <div style="max-width:640px">
              <h1 style="font-size:34px;letter-spacing:-0.02em">How can we help?</h1>
              <p class="muted" style="font-size:16px;margin-top:8px">Guides for getting started, billing, invoices and account security.</p>
            </div>
            <div class="grid grid-2">
              {articles.map((a) => (
                <a href={`/demo/articles/${a.slug}`} class="card feature" style="color:inherit;text-decoration:none">
                  <span class="fi"><Icon name="book" /></span>
                  <h3>{a.title}</h3>
                  <p>{a.sections} topics</p>
                </a>
              ))}
            </div>
            <div class="card card-pad">
              <h3>Questions to try with the assistant</h3>
              <ul class="small" style="margin:10px 0 0;padding-left:18px;display:grid;gap:6px;color:var(--text-2)">
                <li>How much is the Growth plan and how many users does it include?</li>
                <li>I paid yearly two weeks ago. Can I get my money back?</li>
                <li>How do I stop payment reminders for one customer?</li>
                <li>Do you integrate with QuickBooks? <span class="muted">(not in the docs: watch it hand off)</span></li>
              </ul>
            </div>
          </div>
        )}
      </main>
      <script src="/widget.js" defer></script>
    </Document>
  );
}
