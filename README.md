# Agentic Web Checker

Paste the address of any agentic website. This site reads the public files
that site publishes — its `agent-manifest.json`, the agent network definition
that file names, its `links.json` and its discovery files — tests them
against the Worldwide Agentic Web MVP Profile 0.3, and returns a
plain-language card: what conforms, what does not, and what to fix first, in
order.

It is itself an open agentic website, built the way the profile describes:

- `agent-manifest.json` describes its agent network (`agentic_web_checker`)
  and how inference is funded (a default router, or the visitor's own key).
- `agentic_web_checker.network.json` is the resolved, data-only network
  definition: a front agent, `conformance_guide`, and a `fix_advisor`
  specialist it delegates to.
- `runtime/` is the reference browser runtime, copied unchanged. The network
  runs in the visitor's browser, on the visitor's chosen model and key.
- `site-actions.js` registers the page's own operations as tools
  (`website_check_agentic_site`, `website_get_checker_state`,
  `website_get_spec_checklist`). All of them only read.
- `bridge/bridge-actions.js` shares the check and the checklist with other
  agentic websites, so any site's assistant can call this network and check
  a third site for its own visitor. The shared reads return only public
  data, so any caller origin may use them.
- `check-core.js` is the checker itself: one module that the page form, the
  assistant's tools and the bridge all run, so every route gives the same
  answer.

## Run it locally

```shell
node serve.mjs . --port 8080
```

(serve.mjs is a small static server that sends the CORS header the profile
requires on the public files; any static host that sends
`Access-Control-Allow-Origin: *` for the public artifacts works.)

Then open the page, paste a site address into the checker form — no key
needed — or add your own provider key in the assistant's AI model settings
and ask the assistant to check a site for you.

## Tests

```shell
node --test "tests/*.test.mjs"
```

The tests run the checker core against scripted sites: a conforming site, a
site whose front agent is missing, a site with no manifest, and a site whose
host refuses the read the way a missing CORS header refuses it in a browser.

## What it cannot do

It cannot run another site's agents, cannot see anything a site does not
publish, cannot fix another site, and cannot judge design or quality — only
conformance with the published profile.
