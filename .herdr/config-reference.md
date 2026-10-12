# Workflow configuration reference

This page is the canonical agent-facing guide to workflow configuration. Read it once when you need
configuration context. The orchestrator reads the effective local configuration in its checkout and
passes each agent only the relevant profile, limits, and task context. Agents in worktrees must not
expect the ignored file to exist and must not copy or request unrelated profiles or arguments. If the
owner did not supply a required effective detail, ask that owner through the normal message route.

## Source and missing configuration

The sole runtime source is the local, gitignored `.herdr/workflow.json`. The tracked
`.herdr/workflow.json.example` is an informational teammate template only; differences between it
and a local file have no runtime meaning. No runtime component fills missing values from the template.

The setup server reports `configSource: "missing"` in `/api/status` and returns `409 missing_config`
with first-run UI defaults from `GET /api/config` when the local file is absent. Saving a valid first
run creates the local file. A present but incomplete or invalid file returns `422 invalid_config` with
field paths; the UI does not fill it in. Route-check requires the local file as its third argument and
rejects missing or invalid configuration. The orchestrator stops and reports when required config is
missing. Do not pass the example file to route-check.

## Persisted top-level fields (v2)

| Persisted key | UI key | Runtime consumer | Meaning and validation |
| --- | --- | --- | --- |
| `version` | `version` | Setup schema and route-check | Must be `2`. |
| `timeoutMs` | `timeoutMs` | herdr runtime, unverified in repo | Integer 1,000–86,400,000. |
| `startTimeoutMs` | `startTimeoutMs` | herdr runtime, unverified in repo | Integer 1,000–600,000. |
| `maxRounds` | `maxRounds` | herdr runtime, unverified in repo | Integer 1–50. |
| `spawnPolicy.maxTechLeads` | same | Orchestrator policy and route-check | Maximum live tech-lead instances; integer 1–6. |
| `spawnPolicy.maxDevsPerTechLead.backend_dev` | same | Orchestrator policy and route-check | Per-owner backend developer ceiling; integer 0–6. |
| `spawnPolicy.maxDevsPerTechLead.frontend_dev` | same | Orchestrator policy and route-check | Per-owner frontend developer ceiling; integer 0–6. |
| `spawnPolicy.maxQaPerTechLead` | same | Orchestrator policy and route-check | Per-owner QA ceiling; integer 0–4. |
| `defaultProfiles.<role>` | same | Setup UI; orchestrator selection | Profile ID for `tech-lead`, `backend_dev`, `frontend_dev`, or `qa_engineer`; must exist and have that role. |
| `profiles` | `profiles` | Setup UI; orchestrator selection; route-check spawn validation | Map of profile IDs to persisted profiles. |

## Persisted profile fields

| Persisted key | UI key | Runtime consumer | Meaning and validation |
| --- | --- | --- | --- |
| map key / profile ID | map key | Setup UI and orchestrator | Lowercase ID matching `^[a-z][a-z0-9-]{0,39}$`. |
| `role` | `role` | Orchestrator and route-check | One of the four supported roles. Route-check requires the requested spawn role to match. |
| `kind` | `kind` | herdr runtime, unverified in repo; setup catalog | Agent implementation kind; must be in the setup catalog. |
| `lifecycle` | — | herdr runtime, unverified in repo | Kept from a previous profile when saving. New tech-lead profile defaults to `persistent`; other roles to `ephemeral`. |
| `cwd` | — | herdr runtime, unverified in repo | Kept from a previous profile; new profiles use `.`. |
| `worktree` | — | herdr runtime, unverified in repo | Kept from a previous profile; new profiles default true except tech-lead. |
| `args` | `model`, `mode`, `extraArgs` | herdr runtime, unverified in repo | CLI arguments persisted as an array. Setup encodes the UI model/mode and extra arguments into this field. |
| `prompt` | `definition` | herdr runtime, unverified in repo | Definition path such as `agents/be.md`; UI requires the file to exist. |
| `task` | `task` | herdr runtime, unverified in repo | Profile task text. |

## UI encoding and validation

The setup UI does not persist `model`, `mode`, `extraArgs`, or `definition` under those names:
`model`, `mode`, and `extraArgs` are encoded into persisted `args`; `definition` maps to `prompt`.
`lifecycle`, `cwd`, and `worktree` are preserved from the existing profile with the same ID or use
the new-profile values above.

The server validates persisted config on read and submitted UI config on write. UI validation checks
strict object shapes, required top-level fields, numeric ranges above, supported roles/kinds/modes,
profile ID and definition path patterns, model support for the selected kind, and that every default
profile exists with its matching role. Each definition file must exist on save. First-run defaults
are server constants, not values loaded from any file; no profile is pre-created and role defaults
start blank until assigned.

Unknown JSON keys are rejected by the setup schema. Adding an arbitrary key does not make an agent
or the herdr runtime execute it. Runtime consumers outside this repository remain unverified.

## Routing and spawn enforcement

The setup app displays the fixed routing table exported by `.herdr/route-check.mjs`; editing config
does not change routes. The orchestrator must invoke route-check with the message, run roster, and
local workflow config. Route-check checks message routing, sender ownership/liveness, requested
profile existence and role, and the configured live tech-lead and per-owner child ceilings. A missing
config argument/file is `missing_config`; absent required v2 fields or invalid config is
`invalid_config`. The orchestrator must not deliver a rejected message and must stop/report if the
local config cannot be supplied.
