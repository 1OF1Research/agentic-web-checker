// Tests for the checker core, with a scripted fetch. Run:
//   node --test "tests/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAgenticSite, normalizeBase } from "../check-core.js";

function fakeFetch(routes) {
  return async (url) => {
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    if (!key) {
      return { ok: false, status: 404, headers: { get: () => null }, text: async () => "not found" };
    }
    const body = routes[key];
    return { ok: true, status: 200, headers: { get: (h) => (h === "access-control-allow-origin" ? "*" : null) }, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) };
  };
}

const GOOD_MANIFEST = {
  networks: [{ name: "demo", front_man: "greeter", hocon: "./demo.network.json" }],
  llm_router: { base_url: "https://api.otari.ai/api/v1", byok_router: "https://api.otari.ai/api/v1" },
};
const GOOD_NETWORK = {
  tools: [
    { name: "greeter", function: { description: "Greets visitors" }, instructions: "Be kind.", tools: [] },
  ],
};

test("normalizeBase steps back from a manifest URL", () => {
  const r = normalizeBase("https://example.com/agents/agent-manifest.json");
  assert.equal(r.ok, true);
  assert.equal(r.base, "https://example.com/agents/");
});

test("normalizeBase refuses an empty address", () => {
  assert.equal(normalizeBase("").ok, false);
  assert.equal(normalizeBase("   ").ok, false);
});

test("a conforming site passes with no fails", async () => {
  const fetchFn = fakeFetch({
    "agent-manifest.json": GOOD_MANIFEST,
    "demo.network.json": GOOD_NETWORK,
    "links.json": { version: 1, networks: { demo: {} } },
    "nsdeploy.json": { site: "demo" },
  });
  const report = await checkAgenticSite("https://example.com", fetchFn);
  assert.equal(report.ok, true);
  assert.equal(report.fails, 0);
  assert.equal(report.verdict, "conforms");
});

test("a missing front agent fails the network shape check", async () => {
  const fetchFn = fakeFetch({
    "agent-manifest.json": GOOD_MANIFEST,
    "demo.network.json": { tools: [{ name: "other", function: { description: "x" }, tools: [] }] },
    "links.json": { version: 1, networks: {} },
  });
  const report = await checkAgenticSite("https://example.com", fetchFn);
  assert.equal(report.verdict, "does-not-conform");
  const shape = report.checks.find((c) => c.id === "network_shape");
  assert.equal(shape.status, "fail");
  assert.match(shape.detail, /front agent/);
});

test("a site with no manifest fails cleanly, not with a throw", async () => {
  const fetchFn = fakeFetch({});
  const report = await checkAgenticSite("https://missing.example", fetchFn);
  assert.equal(report.ok, true);
  assert.equal(report.verdict, "does-not-conform");
  assert.equal(report.checks.find((c) => c.id === "manifest_reachable").status, "fail");
});

test("a fetch that throws (CORS-style refusal) is a fail with the reason named", async () => {
  const fetchFn = async () => { throw new TypeError("Failed to fetch"); };
  const report = await checkAgenticSite("https://blocked.example", fetchFn);
  assert.equal(report.verdict, "does-not-conform");
  assert.match(report.checks[0].detail, /CORS/);
});
