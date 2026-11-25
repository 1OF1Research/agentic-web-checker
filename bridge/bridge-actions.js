// The actions this site shares with other agent sites, through its action
// bridge. When another site's assistant calls this network, the bridge loads
// this module in a hidden frame on this site's origin, which has no page.
// The checker core is standalone (it only fetches public artifacts), so the
// same checks run here exactly as on the page.
//
// Both shared actions only read public data: a conformance check of a public
// site returns only what that site itself publishes, so any site may call
// them. Nothing here can see a visitor, a page, or a key.
import { checkAgenticSite, CHECKLIST, SPEC_PROFILE } from "../check-core.js";

class BridgeActions {
  static EVERY_SITE = ["*"];

  static registerActions(actions) {
    actions.register(BridgeActions.checkSiteAction());
    actions.register(BridgeActions.getChecklistAction());
  }

  static checkSiteAction() {
    return {
      name: "check_agentic_site",
      description: "Check one agentic website for conformance with the worldwide agentic web MVP profile. Give the site's address. Reads that site's public agent-manifest.json, network definition and links.json and returns a per-check card with a verdict and what to fix. Changes nothing.",
      effect: "read",
      availability: "bridge",
      callerOrigins: BridgeActions.EVERY_SITE,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["url"],
        properties: {
          url: { type: "string", description: "The agentic website's address, for example https://example.com" },
        },
      },
      execute: (args) => checkAgenticSite(args && args.url),
    };
  }

  static getChecklistAction() {
    return {
      name: "get_spec_checklist",
      description: "Read the conformance checks this checker runs against " + SPEC_PROFILE + ", with a plain-language reason for each. Changes nothing.",
      effect: "read",
      availability: "bridge",
      callerOrigins: BridgeActions.EVERY_SITE,
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => CHECKLIST.map(({ id, label, why }) => ({ id, label, why })),
    };
  }
}

export const registerActions = BridgeActions.registerActions;
