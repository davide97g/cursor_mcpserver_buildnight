---
name: promo-kit
description: Use the Promo Kit MCP server to create research-backed campaign assets.
---

Use this skill when the user asks to create, improve, or demo a promo kit for a product, event, workshop, venue, or launch.

The local MCP server should be running first:

```bash
npm run dev
```

Use `get_workshop_flow` first when orienting a new attendee. Use `check_setup` next to verify provider readiness without exposing secrets. Then use `run_demo_preset` for the easiest non-technical workshop demo. Use `create_and_evaluate_promo_kit` when the user wants custom inputs. Both create a complete kit, evaluate it with an LLM-as-a-judge style rubric, and send scores to Langfuse when configured. When Langfuse is not configured, explain `langfuse.dryRun`, `traceName`, `scoreNames`, and `scoreCount`.

Use `create_promo_kit` only for generation without benchmarking. Use individual tools only when the user asks for one asset:

- `research_market`: Exa-backed research and sources
- `generate_poster`: Unsplash campaign visual by default, or fal.ai image generation when `IMAGE_PROVIDER=fal`
- `generate_voiceover`: ElevenLabs text-to-speech
- `create_promo_kit`: orchestrates research, poster, captions, script, and voiceover
- `evaluate_promo_kit`: judges a pasted JSON promo kit
- `create_and_evaluate_promo_kit`: full generation plus benchmark
- `check_setup`: provider readiness check without secret values
- `get_workshop_flow`: presenter-friendly sequence for the demo
- `list_demo_presets`: available demo scenarios
- `run_demo_preset`: one-click preset demo
- `list_intro_styles`: YouTube intro style presets
- `design_youtube_intro`: channel intro with shot list, hero frame, and hook voiceover
- `list_news_categories`: news beat presets for broadcast tools
- `fetch_latest_news`: latest headlines only via Exa
- `create_news_broadcast`: TV-style news intro with slides, anchor script, and voiceover

Use `create_news_broadcast` when the user wants a news-program style intro: latest headlines, one image slide per story, and a voice that reads the bulletin. Use `fetch_latest_news` when they only want headlines without assets.

Good demo prompt:

```text
Run the cursor-build-night-padova preset.
Include a research-backed angle, poster visual, short ad script, voiceover status, judge score, and Langfuse status.
```

When presenting results, include the positioning, captions, source links, visual image URL, image attribution, voiceover status, overall judge score, strongest score, weakest score, Langfuse status, and Langfuse dry-run score names.
