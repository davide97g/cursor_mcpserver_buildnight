try {
  process.loadEnvFile?.(".env");
} catch {
  // .env is optional. direnv or the parent shell can provide variables instead.
}

const endpoint = process.env.MCP_URL
  ? `${process.env.MCP_URL.replace(/\/$/, "")}/mcp`
  : "http://localhost:3000/mcp";

let nextId = 1;
let sessionId;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function rpc(method, params = {}, notification = false) {
  const body = notification
    ? { jsonrpc: "2.0", method, params }
    : { jsonrpc: "2.0", id: nextId++, method, params };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!sessionId) {
    sessionId = response.headers.get("mcp-session-id");
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`MCP HTTP ${response.status}: ${text}`);
  }

  if (!text) {
    return null;
  }

  if (text.startsWith("event:")) {
    const line = text.split("\n").find((part) => part.startsWith("data: "));
    return JSON.parse(line.slice(6));
  }

  return JSON.parse(text);
}

function structured(result, toolName) {
  assert(!result?.result?.isError, `${toolName} returned an MCP error`);
  assert(
    result?.result?.structuredContent,
    `${toolName} returned no structured content`
  );
  return result.result.structuredContent;
}

await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "promo-kit-smoke", version: "1.0.0" },
});
await rpc("notifications/initialized", {}, true);

const toolsResult = await rpc("tools/list");
const toolNames = toolsResult.result.tools.map((tool) => tool.name);
const requiredTools = [
  "check_setup",
  "get_workshop_flow",
  "list_demo_presets",
  "run_demo_preset",
  "research_market",
  "generate_poster",
  "generate_voiceover",
  "create_promo_kit",
  "evaluate_promo_kit",
  "create_and_evaluate_promo_kit",
  "run_benchmark_suite",
  "list_intro_styles",
  "design_youtube_intro",
  "list_news_categories",
  "fetch_latest_news",
  "create_news_broadcast",
];

for (const toolName of requiredTools) {
  assert(toolNames.includes(toolName), `Missing tool: ${toolName}`);
}

const setup = structured(
  await rpc("tools/call", { name: "check_setup", arguments: {} }),
  "check_setup"
);
assert(setup.demoReady, `Demo is not ready: ${setup.missingRequired.join(", ")}`);

const flow = structured(
  await rpc("tools/call", { name: "get_workshop_flow", arguments: {} }),
  "get_workshop_flow"
);
assert(flow.steps.length >= 5, "Workshop flow should include at least five steps");

const preset = structured(
  await rpc("tools/call", {
    name: "run_demo_preset",
    arguments: { preset: "cursor-build-night-padova" },
  }),
  "run_demo_preset"
);

assert(preset.promoKit.title.includes("cursor build night"), "Preset title mismatch");
assert(preset.promoKit.research.sources.length > 0, "Expected research sources");
assert(preset.promoKit.poster.imageUrl, "Expected poster image URL");
assert(preset.evaluation.overallScore >= 0, "Expected judge score");
assert(typeof preset.langfuse.dryRun === "boolean", "Expected Langfuse dryRun flag");
assert(preset.langfuse.scoreCount > 0, "Expected Langfuse score metadata");

console.log(
  JSON.stringify(
    {
      ok: true,
      endpoint,
      tools: toolNames.length,
      demoReady: setup.demoReady,
      score: preset.evaluation.overallScore,
      voiceStatus: preset.promoKit.voiceover.status,
      langfuse: {
        sent: preset.langfuse.sent,
        dryRun: preset.langfuse.dryRun,
        scoreCount: preset.langfuse.scoreCount,
      },
    },
    null,
    2
  )
);
