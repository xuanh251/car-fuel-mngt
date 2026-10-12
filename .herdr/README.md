# Herdr multi-agent team protocol

This repository supports several concurrent tech leads. Each tech lead owns its own backend,
frontend, and QA instances. The orchestrator is the human-facing session and is responsible for
starting/stopping instances, creating worktrees, maintaining each task roster, and routing every
message. The `herdr` CLI is the runtime; this protocol does not claim that the CLI enforces
owner-scoped routing by itself.

## Config and limits

- `.herdr/workflow.json` is the local config and is gitignored. `.herdr/workflow.json.example` is
  the tracked v2 template. On a fresh clone, the setup app can read the example without creating
  local config; the first save writes a v2 `.herdr/workflow.json`.
- Config defines reusable profiles and one default profile per role. Multiple profiles may share
  a role. Runtime instance IDs are separate from profile IDs.
- Before asking any configuration question, read the tracked `.herdr/workflow.json.example`
  alongside the task design. Use it as the starting config when local config is absent; ask the
  human only about genuine unresolved differences.
- `spawnPolicy.maxTechLeads` limits live tech-lead instances. Each tech lead independently owns
  up to `maxDevsPerTechLead.backend_dev`, `maxDevsPerTechLead.frontend_dev`, and
  `maxQaPerTechLead` child instances.
- Each task run lives under `.herdr/tasks/<task-id>/`. A run has one `team.json`, owned and written
  only by its orchestrator. It records every instance as `{ "id", "role", "owner", "status",
  "profile", "worktree", "branch" }`. Tech leads have `owner: null`; each developer and QA
  instance has exactly one owner, its `tech-lead-N` instance ID.
- Instance IDs are unique within a task and match `<role>-<positive integer>`: for example
  `tech-lead-2`, `backend_dev-3`, `frontend_dev-1`, `qa_engineer-2`. Never reuse an ID in a run.

## Ownership and filesystem

- The orchestrator writes `team.json`, requirements, designs, and task-level coordination files.
- Each agent writes only its own worktree and `.herdr/tasks/<task-id>/instances/<instance-id>/`.
  Each instance folder has its own `outbox/`; messages are named `<instance-id>-<unique>.json`.
- Agents communicate only along the routes below. Dev and QA instances talk only to their owner
  tech lead. A tech lead talks only to its owned dev/QA children or the orchestrator.
- A dev/QA branch is `herdr/<instance-id>-<run-id>`. QA merges only branches belonging to its
  owner tech lead. Worktrees and run folders are retained for review.

## Routes

Routing is fixed. The standalone setup app displays the rules from `route-check.mjs` read-only;
it cannot change them. Before routing every outbox message, the orchestrator must run:

```sh
node .herdr/route-check.mjs <message.json> <task>/team.json [<herdr-dir>/workflow.json]
```

If no local config exists, pass `.herdr/workflow.json.example` as the optional config argument.
The command prints `{ "ok": true }` on acceptance or an error object and exits nonzero. Do not
deliver rejected messages; send the sender an `error` using an allowed route.

| Sender | Recipient | Allowed types |
|---|---|---|
| `tech-lead-N` | `orchestrator` | `spawn`, `escalation`, `complete` |
| `tech-lead-N` | dev/QA instance with `owner == tech-lead-N` | `task`, `fix`, `retest`, `answer` |
| dev/QA instance X | `owner(X)` | `question`, `report`, `finding`, `verdict` |
| `orchestrator` | a live tech lead or any live roster instance | `task`, `answer`, `error` |

Refuse dev/QA messages to the orchestrator or another lead; tech-lead messages to a non-owned
instance or another tech lead; messages from stopped/unknown instances; and `spawn` from anyone
other than a tech lead. For `spawn`, the owner is the sending tech lead; if the message body has
an `owner` field it must match. Check the live tech-lead ceiling and that lead's per-role child
ceilings before starting instances. The orchestrator adds each new instance to `team.json` before
delivering messages to it and marks stopped instances `status: "stopped"`.

## Orchestrator steps

1. Create a unique `.herdr/tasks/<task-id>/` with `instances/` and `team.json`; do not reuse a run
   folder or instance ID. Start the requested number of tech leads, up to the configured ceiling.
2. Give each tech lead an independent task/design context and a distinct ID. Its work is scoped to
   the children it owns. Do not share or cross-route another lead's developer or QA instances.
3. On a tech-lead `spawn` request, validate every requested role against `spawnPolicy`, create
   distinct child IDs and worktrees, record each owner in `team.json`, then send that child its
   task. Keep each child connected to exactly one tech lead.
4. Validate each outbox JSON using `route-check.mjs` before routing. Include the sender instance
   ID explicitly in the message. Log accepted and rejected messages in the run's message log.
5. When a child reports done, stop that instance and mark it stopped. A later fix/retest uses a new
   instance ID unless the runtime explicitly resumes the existing one; never reuse a stopped ID.
6. QA is started only by its owning tech lead and merges only that lead's dev branches. Continue
   fix/retest cycles until QA reports `PASS` with no open findings.
7. An unresolved decision is escalated by the owning tech lead to the orchestrator. The
   orchestrator asks the human and returns the answer only to that same lead.
8. A tech lead sends `complete` only after its run is complete. Close only that lead's pane; other
   tech leads and their task contexts continue independently.

## Runtime notes

`agent start` accepts positional distinct names plus `--pane`; `worktree create` supports
`--branch`, `--path`, and `--label` in the installed CLI. Concurrent multi-instance behavior is
dependent on the herdr runtime and must be verified there. `route-check.mjs` provides a required
orchestrator check; neither the app nor API can force the orchestrator to run it.

## CLI discovery notes

Binary names `claude`, `codex`, and `pi` were verified on the implementation host. Other catalog
entries (`gemini`, `cursor`, `devin`, `agy`, `cline`, `omp`, `mastracode`, `opencode`, `copilot`,
`kimi`, `kiro`, `droid`, `amp`, `grok`, `hermes`, `kilo`, `qodercli`, `qwen`, `letta`, `maki`,
`muse`) use their kind name as a best-effort binary name and remain explicitly unverified. Their
version flags and model-list behavior are not claimed as verified. Pi model discovery uses the
locally observed `pi --list-models [search]` table format; failures fall back to an empty list.
