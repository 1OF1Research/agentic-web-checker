// Core conformance checker for the Open Agentic Web (MVP Profile 0.3).
// Pure logic with an injected fetch, so the page, the action bridge and the
// Node tests all run the same code. It only reads public artifacts:
// agent-manifest.json, the resolved network definition it names, links.json
// and the optional .well-known discovery files. It never sends credentials.

export const SPEC_PROFILE = "MVP Profile 0.3 (18 November 2026)";

export const CHECKLIST = [
  { id: "manifest_reachable", label: "Manifest is publicly reachable", why: "Other sites find your agents through agent-manifest.json at your site base. Without it, nothing can discover or load your network." },
  { id: "manifest_shape", label: "Manifest lists networks with name, front agent and network file", why: "The manifest must name each network, its front agent (front_man) and where its resolved network definition lives (hocon), or a caller cannot select and load it." },
  { id: "network_reachable", label: "Network definition is publicly reachable", why: "The caller fetches the resolved network definition named in the manifest and validates it before running anything." },
  { id: "network_shape", label: "Network definition is valid: agents, front agent, descriptions", why: "The definition must be data-only, name a front agent that exists, and give every agent a function description and instructions, or runtimes reject it before any model call." },
  { id: "links_map", label: "Peer link map (links.json) is published", why: "links.json maps the symbolic names your network uses for partner networks to their real URLs. Without it, named partner references cannot resolve on other sites." },
  { id: "cors", label: "Public artifacts allow cross-origin reads (CORS)", why: "A browser on another site may only fetch your public artifacts when your host sends an Access-Control-Allow-Origin header that permits it. A checker running in a browser is itself blocked without it, which is reported as a failure to read." },
  { id: "discovery", label: "Discovery metadata is published (.well-known)", why: "Optional in this profile, but the .well-known files help directories and other tools describe your site without loading the full network." },
  { id: "inference_note", label: "Inference is pluggable (default router or visitor key)", why: "The manifest should say how inference is funded: a site default router, or the visitor's own key (BYOK). A peer site must never receive the visitor's key or override the caller's router." },
];

function result(id, status, detail) {
  const item = CHECKLIST.find((c) => c.id === id);
  return { id, label: item.label, status, detail, why: item.why };
}

export function normalizeBase(input) {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, reason: "Give the address of the agentic website, for example https://example.com or https://example.com/agents" };
  }
  let text = input.trim();
  if (!/^https?:\/\//i.test(text)) text = "https://" + text;
  let url;
  try { url = new URL(text); } catch { return { ok: false, reason: "That does not read as a web address." }; }
  // If the visitor pasted a network URL (…/<base>/<network>) or the manifest
  // file itself, step back to the site base that holds agent-manifest.json.
  if (url.pathname.endsWith("/agent-manifest.json")) {
    url.pathname = url.pathname.slice(0, -"/agent-manifest.json".length) + "/";
  } else if (url.pathname.endsWith(".network.json") || url.pathname.endsWith(".json")) {
    url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1);
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return { ok: true, base: url.href, origin: url.origin };
}

async function fetchText(fetchFn, url, timeoutMs) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(url, { signal: controller ? controller.signal : undefined, headers: { "Accept": "application/json, text/plain, */*" } });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, cors: res.headers && typeof res.headers.get === "function" ? res.headers.get("access-control-allow-origin") : null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkAgenticSite(input, fetchFn, timeoutMs = 12000) {
  const fetchImpl = fetchFn || (typeof fetch !== "undefined" ? fetch : null);
  if (!fetchImpl) return { ok: false, reason: "No fetch available in this environment." };
  const norm = normalizeBase(input);
  if (!norm.ok) return { ok: false, reason: norm.reason };
  const base = norm.base;
  const checks = [];
  const notes = [];

  // 1. Manifest reachable
  let manifest = null;
  let manifestUrl = new URL("agent-manifest.json", base).href;
  try {
    const r = await fetchText(fetchImpl, manifestUrl, timeoutMs);
    if (!r.ok) {
      checks.push(result("manifest_reachable", "fail", `agent-manifest.json answered HTTP ${r.status}.`));
    } else {
      try { manifest = JSON.parse(r.text); checks.push(result("manifest_reachable", "pass", "agent-manifest.json loaded.")); }
      catch { checks.push(result("manifest_reachable", "fail", "agent-manifest.json loaded but is not valid JSON.")); }
    }
    if (r.cors) checks.push(result("cors", "pass", `Public artifacts send Access-Control-Allow-Origin: ${r.cors}.`));
    else notes.push("cors_header_unseen");
  } catch (error) {
    checks.push(result("manifest_reachable", "fail", `Could not read agent-manifest.json (${error && error.name === "AbortError" ? "timed out" : "network or CORS refusal"}). If this check runs in a browser, a missing CORS header on the target site causes exactly this failure.`));
  }

  if (!manifest) {
    checks.push(result("manifest_shape", "fail", "No manifest to read."));
    checks.push(result("network_reachable", "fail", "No manifest, so no network definition can be located."));
    checks.push(result("network_shape", "fail", "No network definition to validate."));
  } else {
    // 2. Manifest shape
    const networks = Array.isArray(manifest.networks) ? manifest.networks : [];
    const bad = networks.filter((n) => !n || typeof n.name !== "string" || typeof n.front_man !== "string" || typeof n.hocon !== "string");
    if (networks.length === 0) checks.push(result("manifest_shape", "fail", "The manifest lists no networks."));
    else if (bad.length) checks.push(result("manifest_shape", "fail", `${bad.length} of ${networks.length} network entries are missing name, front_man or hocon.`));
    else checks.push(result("manifest_shape", "pass", `${networks.length} network(s) listed, each with name, front_man and hocon.`));

    // Inference note (informational, never a fail on its own)
    if (manifest.llm_router && (manifest.llm_router.base_url || manifest.llm_router.byok_router)) {
      checks.push(result("inference_note", "pass", "Manifest declares an inference router / BYOK route."));
    } else {
      checks.push(result("inference_note", "warn", "Manifest declares no llm_router. That is allowed when the page runtime offers visitor key settings, but a caller cannot tell how inference is funded."));
    }

    // 3+4. First network definition
    const first = networks.find((n) => n && typeof n.hocon === "string");
    if (first) {
      const netUrl = new URL(first.hocon, base).href;
      let network = null;
      try {
        const r = await fetchText(fetchImpl, netUrl, timeoutMs);
        if (!r.ok) checks.push(result("network_reachable", "fail", `Network definition answered HTTP ${r.status}.`));
        else {
          try { network = JSON.parse(r.text); checks.push(result("network_reachable", "pass", `Network definition loaded from ${first.hocon}.`)); }
          catch { checks.push(result("network_reachable", "fail", "Network definition loaded but is not valid JSON (a resolved .network.json must be JSON for browser loading).")); }
        }
      } catch (error) {
        checks.push(result("network_reachable", "fail", `Could not read the network definition (${error && error.name === "AbortError" ? "timed out" : "network or CORS refusal"}).`));
      }
      if (network) {
        const tools = Array.isArray(network.tools) ? network.tools : [];
        const names = tools.map((t) => t && t.name).filter(Boolean);
        const problems = [];
        if (tools.length === 0) problems.push("no agents (tools list is empty)");
        if (!names.includes(first.front_man)) problems.push(`front agent "${first.front_man}" is not one of the agents in the definition`);
        const undescribed = tools.filter((t) => !t || !t.function || typeof t.function.description !== "string" || !t.function.description.trim());
        if (undescribed.length) problems.push(`${undescribed.length} agent(s) have no function description`);
        const dupes = names.filter((n, i) => names.indexOf(n) !== i);
        if (dupes.length) problems.push(`duplicate agent names: ${[...new Set(dupes)].join(", ")}`);
        if (problems.length) checks.push(result("network_shape", "fail", problems.join("; ") + "."));
        else checks.push(result("network_shape", "pass", `${tools.length} agent(s); front agent "${first.front_man}" present; every agent described.`));
      } else {
        checks.push(result("network_shape", "fail", "No readable network definition to validate."));
      }
    }
  }

  // 5. links.json
  try {
    const r = await fetchText(fetchImpl, new URL("links.json", base).href, timeoutMs);
    if (r.ok) { JSON.parse(r.text); checks.push(result("links_map", "pass", "links.json loaded and parses.")); }
    else checks.push(result("links_map", "warn", `links.json answered HTTP ${r.status}. It matters when the network refers to partners by name.`));
  } catch { checks.push(result("links_map", "warn", "links.json could not be read. It matters when the network refers to partners by name.")); }

  // 6. Discovery (optional)
  try {
    const r = await fetchText(fetchImpl, new URL(".well-known/nsdeploy.json", base).href, timeoutMs);
    if (r.ok) checks.push(result("discovery", "pass", ".well-known/nsdeploy.json is published."));
    else checks.push(result("discovery", "warn", "No .well-known/nsdeploy.json. Optional in this profile; directories and tools use it when present."));
  } catch { checks.push(result("discovery", "warn", "No .well-known discovery file could be read. Optional in this profile.")); }

  if (!checks.some((c) => c.id === "cors")) {
    checks.push(result("cors", "warn", "The checker could read the artifacts from this environment, but the Access-Control-Allow-Origin header was not visible here. In a browser, a cross-origin read that succeeds is itself the CORS proof; a read that fails for CORS is reported under the manifest check."));
  }

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const verdict = fails === 0 ? (warns === 0 ? "conforms" : "conforms-with-notes") : "does-not-conform";
  const summary = fails === 0
    ? (warns === 0 ? "This site publishes everything the profile requires and its network definition validates." : "This site meets the required parts of the profile. The notes below are worth fixing, but none of them stops another site from loading its agents.")
    : "This site does not yet meet the profile. The failed checks below are the exact things to fix, in order.";
  return { ok: true, base, verdict, fails, warns, checks, summary, profile: SPEC_PROFILE };
}
