# OpenAI Harness Notes

These notes translate the referenced OpenAI Codex materials into project rules.

## Practical Takeaways

- Keep `AGENTS.md` short and map-like.
- Store durable knowledge in versioned docs.
- Use skills for reusable workflows and domain-specific procedures.
- Use scripts, schemas, checks, and hooks for deterministic constraints.
- Make the app readable to agents through logs, artifacts, schemas, screenshots, and run manifests.
- Add agent roles only when they protect context or improve specialist output.
- Convert repeated review feedback into docs or deterministic checks.

## Project Translation

For this project, the "codebase" includes the content production system itself:

- source videos and transcripts
- claim ledgers
- script plans
- storyboards
- media prompts
- generated assets
- render manifests
- publishing metadata

The harness should make each artifact inspectable by both humans and agents.

