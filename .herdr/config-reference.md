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
| `lifecycle` | — | herdr runtime, unverified in repo | Required on read (`persistent` or `ephemeral`); the setup server returns `invalid_config` if the key is missing. Setup save keeps it from the previous profile; a new profile defaults to `persistent` for tech-lead and `ephemeral` for other roles. |
| `cwd` | — | herdr runtime, unverified in repo | Required on read (string); the setup server returns `invalid_config` if the key is missing. Setup save keeps it from the previous profile; a new profile uses `.`. |
| `worktree` | — | herdr runtime, unverified in repo | Required on read (boolean); the setup server returns `invalid_config` if the key is missing. Setup save keeps it from the previous profile; a new profile defaults to `true` except for tech-lead. |
| `args` | `model`, `mode`, `extraArgs` | herdr runtime, unverified in repo | CLI arguments persisted as an array. Setup encodes the UI model/mode and extra arguments into this field. |
| `prompt` | `definition` | herdr runtime, unverified in repo | Definition path such as `agents/be.md`; UI requires the file to exist. |
| `task` | `task` | herdr runtime, unverified in repo | Profile task text. |

## UI encoding and validation

The setup UI does not persist `model`, `mode`, `extraArgs`, or `definition` under those names:
`model`, `mode`, and `extraArgs` are encoded into persisted `args`; `definition` maps to `prompt`.
`lifecycle`, `cwd`, and `worktree` are preserved from the existing profile with the same ID or use
the new-profile values above. These defaults apply only when the setup app saves a new or unsaved
profile. On read they are required in every persisted profile, and no default is applied to a
hand-written `workflow.json`; the file must contain all three keys.

The server validates persisted config on read and submitted UI config on write. UI validation checks
strict object shapes, required top-level fields, numeric ranges above, supported roles/kinds/modes,
profile ID and definition path patterns, model support for the selected kind, and that every default
profile exists with its matching role. Each definition file must exist on save. First-run defaults
are server constants, not values loaded from any file; no profile is pre-created and role defaults
start blank until assigned.

Unknown keys are rejected, both on read and on write. An unrecognized top-level key or an
unrecognized key inside a profile makes the file `invalid_config` (`Unrecognized key`), and the setup
app does not load it. The accepted top-level keys are `version`, `timeoutMs`, `startTimeoutMs`,
`maxRounds`, `spawnPolicy`, `defaultProfiles`, and `profiles`; the accepted profile keys are `role`,
`kind`, `lifecycle`, `cwd`, `worktree`, `args`, `prompt`, and `task`. Adding an arbitrary key does not
make an agent or the herdr runtime execute it. Runtime consumers outside this repository remain
unverified.

## Routing and spawn enforcement

The setup app displays the fixed routing table exported by `.herdr/route-check.mjs`; editing config
does not change routes. The orchestrator must invoke route-check with the message, run roster, and
local workflow config. Route-check checks message routing, sender ownership/liveness, requested
profile existence and role, and the configured live tech-lead and per-owner child ceilings. The
orchestrator must not deliver a rejected message and must stop/report if the local config cannot be
supplied.

Route-check prints one JSON object on stdout. Error codes and exit codes:

| `error` | Exit code | Raised when |
| --- | --- | --- |
| `missing_config` | 2 | The config argument is absent, or the local `workflow.json` path does not exist. |
| `invalid_config` | 1 | `workflow.json` is malformed JSON, cannot be read for another reason, or is not v2 with the required `spawnPolicy` numbers and a `profiles` object. Route-check does not check per-profile keys; the setup server does. |
| `invalid_message` | 1 | The message argument is absent, the message file cannot be read, or it is malformed JSON. |
| `invalid_roster` | 1 | The roster argument is absent, the `team.json` file cannot be read, or it is malformed JSON. |
| any other code from `checkMessage` (for example `sender_mismatch`, `route_refused`, `owner_mismatch`, `spawn_limit`, `invalid_spawn`) | 1 | Routing or spawn refusal after all inputs were read. |
| (`ok: true`) | 0 | The message is allowed. |

Inputs are read in this order: config, then message, then roster. A failure on an earlier input is
reported first. `missing_config` is only for the config file; a malformed message or roster never
reports `missing_config`.
