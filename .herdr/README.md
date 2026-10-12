# herdr multi-agent team

The orchestrator is the current agent: the Claude session in your own herdr pane (`HERDR_ENV=1`).
It does not get a new tab, and no script runs the team. It starts the role agents, routes their
messages, asks the human, and ends the run.

Each role runs as its own herdr agent in its own tab. Each role picks its own agent kind and model,
so pi, claude, codex, etc. can be mixed.

## Chain of command

```
human ◄──► orchestrator (current agent, this pane)
              │ task
              ▼
          tech-lead ──spawn──► backend_dev, frontend_dev
              ▲                    │  question / report
              │◄───────────────────┘
              │ spawn (after both reports)
              ▼
          qa_engineer ──verdict──► tech-lead ──fix──► backend_dev / frontend_dev
              ▲                         │
              └──────── retest ◄────────┘   (repeat until PASS)

tech-lead ──escalation──► orchestrator ──asks──► human ──decision──► tech-lead
tech-lead ──complete────► orchestrator ──► run ends
```

- Devs and QA talk only to `tech-lead`.
- Only `tech-lead` reaches the orchestrator: `spawn`, `escalation`, `complete`.
- The orchestrator never decides on its own. Unresolved questions go to the human, in the
  orchestrator's chat.
- The orchestrator counts QA verdicts that do not start with `PASS`. After `maxRounds`
  (workflow.json, default 5) failures, it asks the human whether to continue.

## Routes

| from                                     | may send to                                              |
|------------------------------------------|----------------------------------------------------------|
| tech-lead                                | backend_dev, frontend_dev, qa_engineer, orchestrator     |
| backend_dev, frontend_dev, qa_engineer   | tech-lead                                                |
| orchestrator                             | the roles above, as `task`, `answer` or `error`          |

Only `spawn`, `escalation` and `complete` may go to the orchestrator. A message on a route that is
not allowed is bounced back to its sender as an `error`.

## Messages

An agent ends its turn after writing one JSON file per message into `<task>/outbox/`,
named `<role>-<unique>.json`:

```json
{"to": "tech-lead", "type": "question", "body": "Which auth lib? Need a decision."}
{"to": "orchestrator", "type": "spawn", "roles": ["backend_dev"], "tasks": {"backend_dev": "<full task, including any fix list>"}}
```

Types: `question`, `report`, `finding`, `fix`, `retest`, `verdict`, `answer`, `spawn`,
`escalation`, `complete`. The orchestrator takes the sender from the file name, applies the routes
above, and logs every message to `<task>/messages.jsonl`.

Messages that arrive while an agent is busy go into its next turn together. Tech-lead keeps its
context across turns. Dev and QA roles are stopped after their final message, so each spawn starts with
a fresh context and only what its spawn message and queue carry.

## Orchestrator steps

1. Work in your own herdr pane. That pane is the orchestrator; do not open a tab for it.
2. Start a run. Pick a task id, a short slug such as `car-fuel-management`, and create `.herdr/tasks/<task-id>/`
   with `outbox/`, a `requirement.md` copied from the request, and `tabs.json` set to
   `{"workspace": "<HERDR_WORKSPACE_ID>", "tabs": {}}`. If the folder already exists, pick a new id, or ask the
   human before reusing it.
3. Start tech-lead at run start. Start any other role only when tech-lead sends `spawn` for it (step 7).
   A role with `"worktree": true` gets its own checkout first. A role that already has a worktree from
   an earlier spawn reuses it, and does not get a new branch:

   ```bash
   herdr worktree create --workspace "$HERDR_WORKSPACE_ID" --branch herdr/<role>-<run-id> --base <main> --label <role> --no-focus
   herdr agent start <role> --kind <kind> --pane <root_pane_id> --timeout 120000 -- <args>
   ```

   The worktree opens its own workspace and root pane: use `.result.root_pane.pane_id` for `--pane`
   and record the tab id in `<task>/tabs.json`. Roles listed in `merge` get those branches merged into the
   checkout before their first prompt.
4. Send the turn: `herdr agent prompt <role> "<prompt>" --wait --timeout 1800000`. The prompt is the
   role file, an environment block, and the inbound messages. The environment block gives the absolute
   task folder, which replaces `{task}` in the workflow task text. Tech-lead keeps its session, so after its
   first turn it gets only the environment block and inbound messages. Ephemeral roles start fresh, so
   every spawn sends the role file again. A turn can take up to 30 minutes, so run it in the background.
   If `herdr agent get <role>` reports `blocked`, read its pane (`herdr agent read <role>`), then approve
   or stop.
5. After each turn, read `<task>/outbox/<role>-*.json`, log each message to `<task>/messages.jsonl`, delete the
   file, and route it per the table above. A message to a running role goes into its next turn. A
   message to a stopped role waits in the queue until tech-lead spawns that role.
6. Stop after the final message. When a dev's turn ends with `report`, or QA's with `verdict`, stop
   the role: `herdr tab close <tab_id>`, then remove its entry from `<task>/tabs.json`. Keep its worktree and
   branch. Queued messages for it wait for its next spawn. Tech-lead is not stopped this way.
7. `spawn` from tech-lead: start each listed role (step 3). Its first turn is the role file, the
   environment block, and inbound messages: `tasks[role]` from the spawn message if present, else the
   role's `task` in workflow.json, plus any messages queued for that role.
8. `escalation`: ask the human in chat. Send the answer to tech-lead as `answer`.
9. `complete`: close the tech-lead tab (`herdr tab close <tab_id>`) and delete `<task>/tabs.json`. Keep the
   worktrees and the task folder for review.

## Run folders

Each workflow execution gets one folder, `.herdr/tasks/<task-id>/`. The task id is a short slug picked at run
start. Everything a run writes lives in that folder:

```
.herdr/tasks/<task-id>/
  requirement.md    the request tech-lead reads first
  design.md         design and ticket list (tech-lead)
  api.md            API contract summary (backend_dev)
  qa-report*.md     QA reports, one per round
  qa-probe*/        QA probe scripts, one folder per round
  outbox/           message files waiting for the orchestrator
  messages.jsonl    message log for this run
  tabs.json         open tabs for this run
```

Agents write only inside their task folder and their own worktree. `.herdr/tasks/` is gitignored, and so is
`.herdr/out/` (retired: old runs live under `tasks/`). Run folders are kept after a run for review.

## Tabs and worktrees

Tabs and worktrees are created without focus, so your current pane keeps focus. Tabs go into the
orchestrator's workspace (`HERDR_WORKSPACE_ID`). Worktree checkouts (`~/.herdr/worktrees/...`) and
their `herdr/*` branches are not removed automatically; delete them when done. If a run is
interrupted, close its tabs and delete `<task>/tabs.json`.

## Pick an agent per role

Set `kind` to any value from `herdr agent start --help` and put that CLI's native args in `args`.
Model flags are passed through after `--`. `cwd` is optional and relative to the project root
(default `.`).

```json
"backend_dev": {
  "kind": "codex",
  "args": ["--model", "<codex-model-id>"],
  "prompt": "agents/be.md",
  "task": "..."
}
```

The current kind and args for each role live in `workflow.json`, the source of truth. This README does not repeat them.

Kinds installed on this machine: `pi`, `claude`, `codex`. Check any other kind with `which <cli>`
before using it.

Leave `args` as `[]` to use the CLI's default model.

### Permissions

Set permission args per role in `workflow.json`. A role with bypass-style args runs commands without approval
prompts, so the team does not stall. A role without them follows its CLI's own settings; check those before
running it unattended.

Permission args apply when an agent starts. A running agent keeps the args it started with.

## Notes

- Tab and agent labels are the role names (`tech-lead`, `backend_dev`, …). A name is unavailable
  while an earlier agent with that name is still running, so only run one team at a time.
- `workflow-stale.json` is an old config and is unused.
- If no agent has messages in flight and no `complete` arrived, the team is stalled. Ask the human.
