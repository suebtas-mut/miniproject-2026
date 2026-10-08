# Permission and AI escalation workflow

Implemented 2026-10-08 in `scripts/permission-workflow.mjs` and the autonomous supervisor.

| Condition | Handler | Action |
| --- | --- | --- |
| Exact allowlisted read-only Git command | Deterministic policy | Reply `once`, after re-fetching and fingerprinting the unchanged request |
| Exact authorized local test invocation | Deterministic policy | Verify full pending tool input and actual workspace directory; reply `once` without AI inference |
| Read `.env`, private keys or certificate key files | Deterministic policy | Reject; worker should use `.env.example`, mocks or injected configuration |
| External directory, deletion, publishing, push/merge or other consequential operation | Human review | Keep pending and notify OpenCode; no model can grant new authority |
| Other permission outside the policy | Ollama advisory, then human review | One short generic suggestion for a safer alternative; request stays pending |
| Known routine project question | Fixed project conventions | Answer the matching option after a fresh request check |
| Other project question | Ollama advisory | Save advice for Codex coordinator/human review; do not invent requirements |
| Implementation tests still fail after free repair rounds | Ollama then bounded Codex rescue | Only when the worker is idle and no permission/question is pending; rerun tests afterward |

Permission recommendations are **not approvals**. In particular, even an Ollama answer saying “approve” cannot expand the allowlist or bypass OpenCode, sandbox or organization restrictions. The read-only allowlist is `git status --short`, `git status`, `git diff --stat`, and `git branch --show-current`. Arbitrary shell/test commands are not approved merely because AI calls them safe.

## Local test approval (user-authorized extension)

- Backend directory: `npm.cmd test -- --runInBand` or `npm test -- --runInBand`. `package.json` must still define `test: jest` and have no `pretest`/`posttest` lifecycle hooks.
- Flutter app directory: `flutter test --no-pub` or `flutter analyze --no-pub`. Automatic package fetching is excluded from these approved forms.
- Workspace root: `node --test` with explicitly named controller test files from the fixed list in `scripts/local-test-policy.mjs`.
- The full command and workdir are fetched from the pending OpenCode tool call using its message/call ID, not inferred from a permission pattern such as `npm *`. A second read revalidates the invocation and package hooks before approval.
- If the tool has no workdir option, the exact prefix `Set-Location -LiteralPath 'absolute-approved-directory'; ` followed by one approved command is supported. Chained operations, output redirections, installation commands and external-directory permissions remain outside this policy.
- These tests execute project code and can write normal build/cache artifacts; they are not read-only operations or a security sandbox. The allowance covers the user's local project verification scope, not production or destructive database tests. Unrecognized commands remain pending for review.

Requests remain visible in OpenCode. Review metadata and advice are persisted under `.agent-runtime/permission-workflow/<fingerprint>.json`; events are in `.agent-runtime/autopilot.jsonl`. Raw shell commands and file contents are not sent to Ollama for this permission advisory. A durable reservation prevents repeated inference after a restart. A changed request must be reviewed again. Normal replies use `once`, never an unrestricted `always` rule.

While permission is pending, the controller does not invoke Codex rescue, advance the affected worker, or count that waiting interval toward the 45-minute turn timeout. The other worker can continue. Pending approvals are inspected even when a worker is already marked `needs-review`.

Codex rescue retains the existing total two-call / one-per-worker budget across all sprints. This workflow does not wake an existing VS Code conversation; actual automatic repair uses the separately configured bundled App Server. The permission UI itself remains the place for a human to approve consequential requests.

Validation: 20 controller/workflow tests passed, including 100 repeated polls with one advisory call, no authority granted by model output, stale-request rejection, normal delivery without repeat replies, secret-file classification, command chaining rejection, workspace enforcement and revalidation of changed npm lifecycle hooks. Live high-risk approvals were not manufactured for testing.
# Flutter SDK source reads

With `sdkRead.enabled` and an explicitly configured `sdkRead.sourceRoot`, the
supervisor can approve a read-only `.dart` source inspection once. It retrieves
the actual pending tool call, checks the real file path stays inside that SDK
source tree without junction redirection, and accepts only the read tool or a
small PowerShell grammar (`Get-Content`, bounded array slices, literal labels,
and optional `Select-Object -Skip ... -First ...`). It revalidates the tool call
before replying. External edits, SDK execution, shell chaining, redirection and
other external paths remain outside this rule. Policy v3 reevaluates requests
previously held under the earlier external-directory rule.

This is deterministic authorization for the user's approved SDK-reading scope;
it needs no model inference. Ollama advice remains advisory for unknown actions.

Policy v4 also supports explicit `sdkRead.dependencySourceRoots` for reviewed
dependency source directories, currently go_router 14.8.1 `lib/src`. It expands
only the literal `$env:LOCALAPPDATA` prefix in quoted Get-Content paths; arbitrary
variable interpolation and command substitution remain disallowed. It does not
grant access to all of Pub Cache.

