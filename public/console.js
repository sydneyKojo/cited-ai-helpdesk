// Small progressive enhancements for server-rendered pages. Everything still works without JavaScript.
(() => {
  // Light/dark toggle, remembered per browser.
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-theme-toggle]")) return;
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
  });

  // Mobile navigation drawer.
  const shell = document.querySelector(".shell");
  const toggle = document.querySelector(".mobile-nav-toggle");
  if (shell && toggle) {
    const set = (open) => {
      shell.dataset.nav = open ? "open" : "closed";
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", () => set(shell.dataset.nav !== "open"));
    shell.addEventListener("click", (e) => e.target === shell && set(false));
    addEventListener("keydown", (e) => e.key === "Escape" && set(false));
  }

  // Confirmation dialog for buttons marked data-confirm-title.
  let dialog;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-confirm-title]");
    if (!btn || btn.dataset.confirmed) return;
    e.preventDefault();
    dialog ??= Object.assign(document.createElement("dialog"), {
      innerHTML: '<div class="dlg-body"><h2></h2><p class="muted"></p></div><div class="dlg-foot"><button type="button" class="btn secondary" value="cancel">Cancel</button><button type="button" class="btn" value="ok"></button></div>',
    });
    document.body.appendChild(dialog);
    dialog.querySelector("h2").textContent = btn.dataset.confirmTitle;
    dialog.querySelector("p").textContent = btn.dataset.confirmBody || "";
    const ok = dialog.querySelector('[value="ok"]');
    ok.textContent = btn.dataset.confirmOk || "Confirm";
    dialog.querySelector('[value="cancel"]').onclick = () => dialog.close();
    ok.onclick = () => {
      dialog.close();
      btn.dataset.confirmed = "1";
      btn.form ? btn.form.requestSubmit(btn) : btn.click();
    };
    dialog.showModal();
  });

  // Copy buttons.
  document.querySelectorAll("[data-copy]").forEach((b) => {
    b.addEventListener("click", async () => {
      const target = document.getElementById(b.dataset.copy);
      await navigator.clipboard.writeText(target.innerText);
      const label = b.textContent;
      b.textContent = "Copied";
      setTimeout(() => (b.textContent = label), 1500);
    });
  });

  // Disable submit buttons while a form posts, to prevent double submits.
  document.addEventListener("submit", (e) => {
    const b = e.submitter;
    if (b && b.dataset.pending) {
      setTimeout(() => {
        b.disabled = true;
        b.textContent = b.dataset.pending;
      });
    }
  });
})();
