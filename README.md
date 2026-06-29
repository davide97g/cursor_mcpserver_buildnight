# Promo Kit MCP

Finished reference project for the MCP build night. This Manufact/mcp-use app creates a complete promo kit from a short campaign brief.

It combines:

- Exa for web research and source summaries
- Unsplash for campaign visuals by default
- optional fal.ai support for generated poster images
- ElevenLabs for voice ad generation
- Langfuse for trace and score observability
- an LLM-as-a-judge style evaluator for output quality
- MCP as the agent tool interface

## Setup

Prerequisite: Node.js 22 or newer.

```bash
npm install
cp .env.example .env
```

Add your workshop credit keys to `.env`:

```bash
PORT=3000
MCP_URL=http://localhost:3000
IMAGE_PROVIDER=unsplash
EXA_API_KEY=...
UNSPLASH_ACCESS_KEY=...
FAL_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=TX3LPaxmHKxFdv7VOQHJ
JUDGE_PROVIDER=heuristic
JUDGE_API_KEY=
JUDGE_BASE_URL=https://api.moonshot.ai/v1
JUDGE_MODEL=kimi-k2.7-code-highspeed
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

`ELEVENLABS_VOICE_ID` is optional. The example value is a premade voice that worked with the free-plan key during testing.
`FAL_KEY` is optional unless you set `IMAGE_PROVIDER=fal`.
Langfuse and the Kimi LLM judge are optional. Without them, the benchmark still works with a local heuristic judge and returns `langfuse.sent: false`.
When Langfuse keys are missing, `langfuse.dryRun: true` shows the trace name and score names that would be sent.
The app loads `.env` automatically on Node 22+, and direnv-exported variables still work.

If you use direnv, put those exports in `.envrc.local` instead and run:

```bash
direnv allow
```

Start the local server:

```bash
npm run dev
```

In another terminal, run the preflight smoke test:

```bash
npm run smoke
```

To verify the Langfuse request shape without real Langfuse keys:

```bash
npm run test:langfuse
```

Open the inspector:

```text
http://localhost:3000/inspector
```

Local MCP endpoint:

```text
http://localhost:3000/mcp
```

If mcp-use reports a different port because 3000 is busy, set `PORT` in `.envrc.local` and update `mcp.json` / `.mcp.json` to match for that machine.

## Optional Web UI

The MCP inspector is a developer console, not the product UI. This repo also
includes a tiny local web app that calls the same MCP tools through a local
proxy, so you can showcase the MCP server and a real client side by side.

Start the MCP server first:

```bash
PORT=3022 MCP_URL=http://localhost:3022 npm run dev
```

Then start the web UI in another terminal:

```bash
MCP_SERVER_URL=http://localhost:3022 npm run web
```

Open:

```text
http://localhost:5174
```

The UI can:

- run `check_setup`
- load `list_demo_presets`
- call `run_demo_preset`
- call `create_and_evaluate_promo_kit`
- call `run_benchmark_suite`
- call `research_market`
- call `generate_voiceover`

This is intentionally small enough for attendees to modify with Cursor during
the workshop.

To point the local UI at a deployed MCP server instead of your local server:

```bash
MCP_SERVER_URL=https://fast-zero-4d5xn.run.mcp-use.com npm run web
```

## Cursor Demo

Use `mcp.json` to connect Cursor to the local server:

```json
{
  "mcpServers": {
    "promo-kit-mcp": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Then ask Cursor Agent:

```text
Use get_workshop_flow first, then check_setup.
After that, use run_demo_preset with cursor-build-night-padova.
Show the promo kit, the judge score, and whether Langfuse received the trace.
```

Or, for the shortest possible demo:

```text
Use run_demo_preset with cursor-build-night-padova.
Show the promo kit, the judge score, and whether Langfuse received the trace.
```

## Tools

- `check_setup()`
- `get_workshop_flow()`
- `research_market(topic, audience, location, maxResults)`
- `generate_poster(brief, visualStyle, format)`
- `generate_voiceover(script, voiceId, language)`
- `create_promo_kit(topic, audience, location, tone)`
- `evaluate_promo_kit(topic, audience, location, promoKitJson)`
- `create_and_evaluate_promo_kit(topic, audience, location, tone)`
- `run_benchmark_suite(topic, audience, location, tones)`
- `list_demo_presets()`
- `run_demo_preset(preset)`

## Expected Output

`create_promo_kit` returns:

- title and positioning
- three social captions
- Exa-backed research with source links
- Unsplash image URL with attribution, or fal.ai poster prompt and image URL when `IMAGE_PROVIDER=fal`
- ElevenLabs voiceover script, plus an audio data URL when the current key and voice have enough API access

`create_and_evaluate_promo_kit` returns:

- `promoKit`: the generated campaign kit
- `evaluation`: judge, overall score, rubric scores, strengths, and improvements
- `langfuse`: whether the trace and scores were sent to Langfuse, plus dry-run trace and score metadata when keys are missing

`run_benchmark_suite` returns:

- `comparison`: ranked rows for two or three tone variants
- `winner`: the winning variant ID
- `candidates`: each generated promo kit, judge evaluation, and Langfuse trace metadata

## Demo Prompts

```text
Run get_workshop_flow and explain the live demo sequence.
```

```text
Run check_setup and tell me what is ready for the workshop.
```

```text
Create a promo kit for a student AI build night in Rome.
```

```text
Create and evaluate a promo kit for a Cursor build night in Padova for developers.
```

```text
Run the cursor-build-night-padova preset and explain the judge scores.
```

```text
Run a benchmark suite for a Cursor build night in Padova for developers.
Compare energetic and practical, friendly and beginner-safe, and bold and urgent tones.
Show the winner, the comparison table, and the Langfuse trace IDs.
```

Preset IDs:

- `cursor-build-night-padova`
- `student-ai-build-night-rome`
- `matcha-cafe-university`
- `indie-game-tournament`

```text
Create a promo kit for a matcha cafe opening near a university.
```

```text
Create a promo kit for an indie game tournament this weekend.
```

## Troubleshooting

Missing API key:

```text
EXA_API_KEY is required for Exa. Copy .env.example to .env and add your workshop credit key.
```

Fix: add the missing key to `.env` and restart `npm run dev`.

fal.ai returns no image URL:

```text
fal.ai returned no image URL.
```

Fix: retry with a shorter prompt or check fal.ai credits.

Unsplash returns no image:

```text
Unsplash returned no image
```

Fix: use a simpler campaign brief or visual style.

ElevenLabs returns an auth or quota error:

```text
ElevenLabs TTS failed (401 or 429)
```

The server now keeps the promo kit usable when TTS is unavailable. The voiceover object returns `status: "unavailable"`, keeps the script, and includes the provider error for troubleshooting.

Fix: verify the API key, voice ID, account tier, and remaining credits.

Langfuse says `sent: false`:

```text
langfuse: { "enabled": false, "sent": false, "dryRun": true }
```

Fix: set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL`, then restart `npm run dev`.

For the workshop, `dryRun: true` is still useful: show `traceName`, `scoreNames`, and `scoreCount` to explain exactly what the app would send to Langfuse once keys are configured.

LLM judge is not configured:

```text
judge: "heuristic"
```

This is expected for the workshop. Set `JUDGE_PROVIDER=llm`, `JUDGE_API_KEY`, and optionally `JUDGE_BASE_URL` / `JUDGE_MODEL` if you want a live Kimi judge instead of the deterministic rubric. Defaults target Moonshot's OpenAI-compatible API with `kimi-k2.7-code-highspeed`.

Check setup before a live demo:

```text
check_setup()
```

This reports which providers are configured without exposing key values. Exa and the selected image provider are required for the finished live demo. ElevenLabs, the Kimi LLM judge, and Langfuse can be unavailable without breaking the main promo kit flow.

Langfuse implementation note:

This repo keeps the workshop dependency surface small by sending traces and numeric scores through Langfuse's public HTTP API from `src/providers/langfuse.ts`. The same flow can be swapped to the Langfuse SDK later without changing the MCP tool contract.

Build warning about large chunks:

```text
Some chunks are larger than 1024 kB
```

This comes from the mcp-apps widget bundle and does not block the local workshop demo.

## Optional Distribution Story

This repo includes local wrapper files for:

- Cursor: `.cursor-plugin/plugin.json` and `mcp.json`
- Claude Code: `.claude-plugin/plugin.json` and `.mcp.json`
- Codex: `.codex-plugin/plugin.json` and `.mcp.json`

The important idea for attendees: the MCP server is the product, and plugin or connector marketplaces are the distribution layer.

## Workshop Narrative

1. The agent calls MCP tools instead of only writing text.
2. Exa grounds the campaign in current web context.
3. Unsplash supplies a visual asset with attribution.
4. ElevenLabs attempts a voiceover; if account limits block audio, the workflow still keeps the script.
5. The judge scores the output with a rubric.
6. Langfuse stores the trace and numeric scores when keys are configured.

## Manufact Cloud

Deployment is optional for the local workshop:

```bash
npm run deploy
```

Do not commit real API keys, Manufact device codes, generated images, or generated audio files.
