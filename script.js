// The checker page's own logic. The page form and the assistant's actions call
// the same methods on Checker.page, so both always agree.
import { checkAgenticSite, CHECKLIST, SPEC_PROFILE } from "./check-core.js";

export class App {
  static page = {
    history: [],

    async checkSite(url) {
      if (typeof url !== "string" || !url.trim()) {
        return { ok: false, reason: "Give the address of the agentic website to check." };
      }
      const report = await checkAgenticSite(url.trim());
      if (report.ok) {
        App.page.history.unshift({ base: report.base, verdict: report.verdict, when: new Date().toISOString() });
        App.page.history = App.page.history.slice(0, 10);
      }
      return report;
    },

    getState() {
      return {
        profile: SPEC_PROFILE,
        checksRun: App.page.history.length,
        recentChecks: App.page.history.slice(),
        whatThisSiteDoes: "Paste the address of any agentic website and this page reads its public manifest and network definition, tests them against the worldwide agentic web MVP profile, and returns a plain-language card: what conforms, what does not, and what to fix first.",
        cannotDo: "It cannot run another site's agents, cannot see anything a site does not publish, cannot fix another site, and cannot judge design or quality — only conformance with the published profile.",
      };
    },

    getChecklist() {
      return CHECKLIST.map(({ id, label, why }) => ({ id, label, why }));
    },
  };
}

// Browser wiring: the manual checker form. Guarded so Node tests can import
// this module without a DOM.
if (typeof document !== "undefined") {
  const form = document.querySelector("#check-form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.querySelector("#check-url");
      const out = document.querySelector("#check-result");
      out.textContent = "Checking…";
      try {
        const report = await App.page.checkSite(input.value);
        out.textContent = "";
        if (!report.ok) {
          const p = document.createElement("p");
          p.textContent = report.reason;
          out.append(p);
          return;
        }
        const heading = document.createElement("h3");
        heading.textContent = report.verdict === "does-not-conform" ? "Does not conform yet" : (report.verdict === "conforms" ? "Conforms" : "Conforms, with notes");
        const summary = document.createElement("p");
        summary.textContent = report.summary;
        out.append(heading, summary);
        const list = document.createElement("ul");
        for (const check of report.checks) {
          const li = document.createElement("li");
          li.textContent = `${check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "✗"} ${check.label} — ${check.detail}`;
          list.append(li);
        }
        out.append(list);
      } catch (error) {
        out.textContent = "The check could not run: " + (error && error.message ? error.message : String(error));
      }
    });
  }
}
