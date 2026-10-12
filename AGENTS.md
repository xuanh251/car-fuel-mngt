# AGENTS.md

Guidance for AI agents working in this repo.

## Project

Car Fuel Management web app. npm workspaces (`backend/`, `frontend/`) driven by Turbo.
See `README.md` for install, dev, build, and test commands.

- Install: `npm install` from the repo root.
- Dev: `npm run dev` (backend :3000, frontend Vite :5173).
- Test: `npm test` from the repo root. E2E: `cd frontend && npm run test:e2e`.
- Keep backend code in `backend/` and frontend code in `frontend/`.

## Multi-agent workflow (`.herdr/`)

This repo runs multi-agent work through herdr, configured in `.herdr/`:

- `.herdr/README.md`: the full protocol (chain of command, routes, message types, orchestrator steps).
- `.herdr/workflow.json`: roles (`tech-lead`, `backend_dev`, `frontend_dev`, `qa_engineer`), their agent kinds, args, and tasks. This is the source of truth for the current setup. It is gitignored; `.herdr/workflow.json.example` is the committed template. On a fresh clone, copy the example to `.herdr/workflow.json` and edit it.
- `.herdr/agents/*.md`: role prompts.
- `.herdr/tasks/<task-id>/`: one folder per run (requirement, design, reports, message log). Gitignored.

### Orchestrator mode

Any message from the user in the current pane makes this agent the orchestrator. No keyword is needed.
The exception: if the user says directly to process their request (for example, "process this directly"), handle it yourself without starting the team.

1. Read `.herdr/README.md` and `.herdr/workflow.json` before doing anything else.
2. Work in the current pane. Do not open a tab for the orchestrator.
3. Follow "Orchestrator steps" in `.herdr/README.md`. Start `tech-lead` at run start; start other roles only on its `spawn`.
4. Never decide unresolved questions yourself. Ask the human in chat, then send the answer to tech-lead.
5. Only one team runs at a time. If a role name is still in use, ask the human before reusing a task id.

### Rules for any agent in a `.herdr` run

- Write only inside your run folder `.herdr/tasks/<task-id>/` and your own worktree.
- Talk only along the routes in `.herdr/README.md`. Devs and QA talk only to `tech-lead`.
- Write each outgoing message as one JSON file in `<task>/outbox/` named `<role>-<unique>.json`.
- Commit only in your own worktree and branch (`herdr/<role>-<run-id>`). Do not commit to `main`.
- Do not delete run folders or worktrees. Keep them for review.
