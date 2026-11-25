// Mounts the assistant inside the checker page. Load it with:
//   <script type="module" src="site.js"></script>
// The page needs the mount markup from the assistant section in index.html.
// This site has no irreversible actions — every action only reads — so there
// are no confirmation dialogs of its own; the runtime's own dialogs and
// consent cards are used unchanged.
import { ChatFollow } from "./chat-follow.js";

export class AssistantMount {
  static GREETING = "I can check any agentic website against the worldwide agentic web profile and explain the result in plain language, turn a failed check into a fix list, and tell you exactly what this checker can and cannot do.";

  static DIALOGS = {};

  static async start() {
    const status = document.querySelector("#assistant-status");
    const siteBase = new URL("./", import.meta.url).href;
    try {
      const { boot } = await import("./runtime/index.js");
      const booted = await boot("#agent-app", {
        originUrl: siteBase,
        sandboxWorkerUrl: new URL("runtime/sandbox-worker.js", siteBase).href,
      });
      AssistantMount.engine = booted.engine;
      ChatFollow.start(document.querySelector("#agent-app"));
      const needsKey = !booted.engine.mockLLM
        && (!booted.engine.byokKey || booted.engine.byokKey === "demo");
      status.textContent = needsKey
        ? "Assistant needs your AI provider key. Add it in AI model settings below. The checker form above works without one."
        : "Assistant connected to this page.";
      if (!needsKey) {
        AssistantMount.greet();
      }
      return booted.engine;
    } catch (error) {
      status.textContent = "The assistant could not load. You can still use the checker form above.";
      console.error("Assistant startup failed", error);
      return null;
    }
  }

  static greet() {
    const first = document.querySelector("#ns-msgs .ns-msg.bot");
    if (first) {
      first.textContent = AssistantMount.GREETING;
    }
  }
}

if (typeof window !== "undefined") {
  await AssistantMount.start();
}
