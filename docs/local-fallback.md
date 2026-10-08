# Local OpenCode fallback

The shared server must load `.agent-runtime/shared-opencode.json` through
`OPENCODE_CONFIG`. This adds the local provider to both workspaces without editing
the peer workspace. Keep this environment variable when restarting the server:

```powershell
$env:OPENCODE_CONFIG = 'D:\data\shuttle-kaengkarn\.agent-runtime\shared-opencode.json'
opencode.cmd serve --hostname 127.0.0.1 --port 4096
```

The supervisor tries only its configured zero-cost OpenCode models first. When
those models exhaust quota, `localFallback.enabled` permits a fresh local session
using `ollama-local/shuttle-coder:latest`. The provider must use the explicit
loopback Ollama endpoint. Paid Codex rescue remains separately disabled.

Local coding has eight agent steps, five minutes of wall time, at most two
attempts per worker over the saved run, and one active local coding worker at a
time. Advisory Ollama inference is skipped while local coding is active. Fresh
prompts contain bounded task and diagnostic context; they do not copy the cloud
conversation. Existing permission rules still apply, including human decisions
for unknown commands. A timeout aborts the local session and preserves files.

The ordinary full project checks run after the local turn. Failure or a model
error stops that worker for review; model statements alone never pass a sprint.
The session ID is stored in `autopilot-state.json`, and
`node scripts/agent-status.mjs` displays it. Attach to that ID to view local work;
the original cloud session is preserved. A controller restart preserves attempt
counts and any active local session. Neither advancing sprints nor restarting
replenishes the local attempt budget.

`scripts/ollama-smoke.mjs` starts a tool-use acceptance request on the isolated
test server at port 4097. It is a diagnostic driver, not a passing test by itself:
verify actual read/edit tool events, unchanged test assertions, and successful
execution of `.agent-runtime/ollama-smoke/test.js` before enabling fallback.

The installed Qwen2.5 Coder 3B returned markdown containing JSON instead of actual
tool calls in the initial acceptance test. It must not be assumed to work as an
OpenCode coding agent merely because ordinary text generation succeeds.

Acceptance on 2026-10-08: Qwen3 4B Instruct, derived locally as
`shuttle-coder:latest` with a 16K context, completed actual read, edit, and bash
calls through OpenCode. It changed the faulty subtraction into addition, left
the assertion file unchanged, and ran `node test.js` with output
`LOCAL_FALLBACK_PASS`. The coordinator independently reran the same test and
confirmed it passed. Detailed local evidence is in
`.agent-runtime/ollama-acceptance.json`. The 23 controller regression tests also
passed. This smoke test demonstrates basic tool execution, not the ability to
complete every project sprint; full project checks remain mandatory.
