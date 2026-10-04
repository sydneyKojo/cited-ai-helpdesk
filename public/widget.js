// Cited chat widget. Embed with: <script src="https://your-cited-host/widget.js" defer></script>
(() => {
  if (window.__citedWidget) return;
  window.__citedWidget = true;
  const origin = new URL(document.currentScript.src).origin;
  const KEY = "cited-conversation";
  const store = {
    get: () => { try { return localStorage.getItem(KEY) || undefined; } catch { return undefined; } },
    set: (v) => { try { localStorage.setItem(KEY, v); } catch {} },
    clear: () => { try { localStorage.removeItem(KEY); } catch {} },
  };

  const host = document.createElement("div");
  host.id = "cited-widget";
  document.body.appendChild(host);
  // Shadow DOM keeps the widget's styles and the host page's styles from affecting each other.
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { --c: #111111; --mark: #ffe066; all: initial; }
      * { box-sizing: border-box; font-family: "Inter Tight", Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
      .serif { font-family: Newsreader, "Iowan Old Style", Georgia, serif; }
      .launcher { position: fixed; right: 20px; bottom: 20px; height: 54px; padding: 0 20px 0 16px; border-radius: 999px; border: 0; background: var(--c); color: #fff; cursor: pointer; box-shadow: 0 10px 28px rgba(17,17,17,.25); display: flex; align-items: center; gap: 9px; z-index: 2147483000; font-size: 15px; font-weight: 600; transition: transform .15s; }
      .launcher:hover { transform: translateY(-1px); }
      .launcher .fnm { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 5px; background: var(--mark); color: #111; font-size: 11px; font-weight: 700; transform: translateY(-5px); margin-left: -6px; }
      .launcher:focus-visible, button:focus-visible, textarea:focus-visible { outline: 2px solid #c9a400; outline-offset: 2px; }
      .panel { position: fixed; right: 20px; bottom: 88px; width: min(400px, calc(100vw - 24px)); height: min(620px, calc(100vh - 112px)); display: none; flex-direction: column; background: #fbfaf7; color: #111; border-radius: 20px; border: 1px solid #e7e4dd; box-shadow: 0 24px 64px -16px rgba(17,17,17,.35); overflow: hidden; z-index: 2147483000; font-size: 14.5px; line-height: 1.5; }
      .panel.open { display: flex; }
      @media (max-width: 480px) { .panel { right: 12px; bottom: 80px; height: calc(100vh - 96px); } .launcher { right: 14px; bottom: 14px; } }
      .head { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid #e7e4dd; background: #fff; }
      .head .t { font: 500 20px/1.1 Newsreader, Georgia, serif; }
      .head .s { font-size: 12px; color: #6b6862; margin-top: 2px; }
      .head .x { margin-left: auto; background: transparent; border: 0; color: #111; cursor: pointer; padding: 6px; border-radius: 999px; }
      .head .x:hover { background: #f1efe9; }
      .log { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
      .msg { max-width: 88%; padding: 11px 14px; border-radius: 16px; white-space: pre-wrap; word-wrap: break-word; }
      .user { align-self: flex-end; background: var(--c); color: #fff; border-bottom-right-radius: 5px; }
      .bot { align-self: flex-start; background: #fff; border: 1px solid #e7e4dd; border-bottom-left-radius: 5px; }
      .fn { display: inline-grid; place-items: center; min-width: 16px; height: 16px; padding: 0 4px; margin-left: 2px; border-radius: 4px; background: var(--mark); color: #111; font-size: 10px; font-weight: 700; vertical-align: super; }
      .sources { display: grid; gap: 7px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #d4cfc4; white-space: normal; }
      .source { display: grid; grid-template-columns: auto 1fr; gap: 8px; font-size: 12px; color: #6b6862; }
      .source .fn { vertical-align: 0; margin: 1px 0 0; }
      .source b { color: #111; font-weight: 600; }
      .source q { display: block; font: italic 13px/1.45 Newsreader, Georgia, serif; color: #3b3936; }
      .ticket { display: block; margin-top: 10px; font-size: 12px; color: #b4580e; white-space: normal; }
      .err { border-color: #f3c7c2; background: #fff6f5; }
      .typing span { display: inline-block; width: 6px; height: 6px; margin: 0 2px; border-radius: 50%; background: #8a867f; animation: b 1s infinite; }
      .typing span:nth-child(2) { animation-delay: .15s; } .typing span:nth-child(3) { animation-delay: .3s; }
      @keyframes b { 0%, 60%, 100% { opacity: .3; transform: none; } 30% { opacity: 1; transform: translateY(-3px); } }
      @media (prefers-reduced-motion: reduce) { .typing span { animation: none; } .launcher { transition: none; } }
      .quick { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 18px 10px; }
      .quick button { font-size: 12.5px; border: 1px solid #d4cfc4; background: #fff; color: #3b3936; border-radius: 999px; padding: 5px 12px; cursor: pointer; }
      .quick button:hover { border-color: #111; color: #111; }
      form { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #e7e4dd; background: #fff; align-items: flex-end; }
      textarea { flex: 1; resize: none; font-size: 14.5px; padding: 10px 14px; border: 1px solid #d4cfc4; border-radius: 20px; max-height: 120px; color: #111; background: #fbfaf7; }
      .send { border: 0; border-radius: 999px; background: var(--c); color: #fff; padding: 10px 16px; font-weight: 600; cursor: pointer; font-size: 14px; }
      .send:disabled { opacity: .45; cursor: not-allowed; }
      .foot { text-align: center; font-size: 11px; color: #8a867f; padding: 0 0 9px; background: #fff; }
      .foot a { color: inherit; }
      .panel.dark { background: #2a2a28; color: #ebe8e1; border-color: #474641; }
      .dark .head, .dark form, .dark .foot { background: #333331; border-color: #474641; } .dark .head .x { color: #ebe8e1; } .dark .head .x:hover { background: #3a3a37; }
      .dark .head .s { color: #aaa69c; } .dark .bot { background: #333331; border-color: #474641; } .dark .source b { color: #ebe8e1; } .dark .source q { color: #d3cfc6; } .dark .sources { border-color: #57554f; }
      .dark textarea { background: #2a2a28; color: #ebe8e1; border-color: #57554f; } .dark .quick button { background: #333331; color: #d3cfc6; border-color: #57554f; } .dark .err { background: #4b3632; border-color: #6a4540; }
    </style>
    <button class="launcher" aria-label="Open help chat" aria-expanded="false">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Ask a question<span class="fnm" aria-hidden="true">1</span>
    </button>
    <section class="panel" role="dialog" aria-label="Help chat" aria-modal="false">
      <div class="head">
        <div><div class="t">Help</div><div class="s">Answers from our help centre, with numbered sources</div></div>
        <button class="x" aria-label="Close chat"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="log" aria-live="polite"></div>
      <div class="quick"><button type="button" data-q="I'd like to talk to a person">Talk to a person</button><button type="button" data-new>New conversation</button></div>
      <form><textarea rows="1" maxlength="2000" placeholder="Ask a question…" aria-label="Your question"></textarea><button class="send">Send</button></form>
      <div class="foot">Every answer is footnoted with the article it came from. Powered by <a href="${origin}" target="_blank" rel="noopener">Cited</a></div>
    </section>`;

  const $ = (s) => root.querySelector(s);
  // Follow the host page's light/dark choice (html[data-theme="dark"]); light otherwise.
  const syncTheme = () => $(".panel").classList.toggle("dark", document.documentElement.dataset.theme === "dark");
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const launcher = $(".launcher"), panel = $(".panel"), log = $(".log"), form = $("form"), input = $("textarea"), send = $(".send");
  let greeting = "Hi! Ask me anything about our product, billing or your account.";

  fetch(`${origin}/api/config`).then((r) => (r.ok ? r.json() : null)).then((cfg) => {
    if (!cfg) return;
    host.style.setProperty("--c", cfg.color);
    $(".head .t").textContent = cfg.name;
    greeting = cfg.greeting;
    if (log.children.length === 1) log.firstChild.textContent = greeting;
  }).catch(() => {});

  const add = (text, who, extras = [], cls = "") => {
    const el = document.createElement("div");
    el.className = `msg ${who} ${cls}`;
    el.textContent = text;
    extras.forEach((x) => el.appendChild(x));
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };
  const chip = (text, cls) => Object.assign(document.createElement("span"), { className: cls, textContent: text });
  add(greeting, "bot");

  const open = (v) => {
    panel.classList.toggle("open", v);
    launcher.setAttribute("aria-expanded", String(v));
    launcher.setAttribute("aria-label", v ? "Close help chat" : "Open help chat");
    if (v) input.focus();
  };
  launcher.onclick = () => open(!panel.classList.contains("open"));
  $(".x").onclick = () => { open(false); launcher.focus(); };
  root.addEventListener("keydown", (e) => e.key === "Escape" && open(false));

  const ask = async (message) => {
    if (!message || send.disabled) return;
    add(message, "user");
    const typing = add("", "bot typing");
    typing.innerHTML = "<span></span><span></span><span></span>";
    typing.setAttribute("aria-label", "Assistant is typing");
    send.disabled = true;
    try {
      const res = await fetch(`${origin}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId: store.get() }),
      });
      const data = await res.json().catch(() => ({}));
      typing.remove();
      if (!res.ok) return add(data.error || "Something went wrong. Please try again.", "bot", [], "err");
      store.set(data.conversationId);
      const extras = data.citations.map((_, i) => chip(String(i + 1), "fn"));
      if (data.citations.length) {
        const list = document.createElement("div");
        list.className = "sources";
        data.citations.forEach((c, i) => {
          const row = document.createElement("div");
          row.className = "source";
          const body = document.createElement("span");
          body.append(Object.assign(document.createElement("b"), { textContent: `${c.title} › ${c.heading}` }));
          if (c.excerpt) body.append(Object.assign(document.createElement("q"), { textContent: c.excerpt }));
          row.append(chip(String(i + 1), "fn"), body);
          list.append(row);
        });
        extras.push(list);
      }
      if (data.ticketId) extras.push(chip(`Ticket #${data.ticketId} opened. Our team will reply by email.`, "ticket"));
      add(data.answer, "bot", extras);
    } catch {
      typing.remove();
      add("Can't reach the help desk right now. Check your connection and try again.", "bot", [], "err");
    } finally {
      send.disabled = false;
      input.focus();
    }
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    const m = input.value.trim();
    input.value = "";
    input.style.height = "";
    ask(m);
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });
  input.addEventListener("input", () => { input.style.height = ""; input.style.height = `${Math.min(input.scrollHeight, 120)}px`; });
  root.querySelector("[data-q]").onclick = (e) => ask(e.currentTarget.dataset.q);
  root.querySelector("[data-new]").onclick = () => {
    store.clear();
    log.replaceChildren();
    add(greeting, "bot");
    input.focus();
  };
})();
