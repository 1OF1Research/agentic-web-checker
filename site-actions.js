// Registers this website's operations with the agent runtime.
// agent-manifest.json loads this module through "actions.module". Only the
// names in "actions.agentTools" become model tools, called website_<name>.
// All three actions only read: the checker reads public artifacts and this
// page's own state. Nothing here changes anything, anywhere.
import { App } from "./script.js";

class SiteActions {
  static registerActions(actions) {
    actions.register(SiteActions.checkSiteAction());
    actions.register(SiteActions.getStateAction());
    actions.register(SiteActions.getChecklistAction());
  }

  static checkSiteAction() {
    return {
      name: "check_agentic_site",
      description: "Check one agentic website for conformance with the worldwide agentic web MVP profile. Give the site's address (its base URL, or a network URL). It reads that site's public agent-manifest.json, its resolved network definition and links.json, validates them, and returns a per-check card with a verdict and what to fix. Call it whenever the visitor gives you a site address to check. It changes nothing.",
      effect: "read",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["url"],
        properties: {
          url: { type: "string", description: "The agentic website's address, for example https://example.com or https://example.com/agents" },
        },
      },
      execute: (args) => App.page.checkSite(args && args.url),
    };
  }

  static getStateAction() {
    return {
      name: "get_checker_state",
      description: "Read what this checker site does, which profile version it checks against, what it cannot do, and the checks run so far in this page. Call it before answering questions about the checker itself.",
      effect: "read",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => App.page.getState(),
    };
  }

  static getChecklistAction() {
    return {
      name: "get_spec_checklist",
      description: "Read the list of conformance checks this site runs, with a plain-language reason for each. Call it when the visitor asks what conformance means or what a check looks for.",
      effect: "read",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => App.page.getChecklist(),
    };
  }
}

export const registerActions = SiteActions.registerActions;
