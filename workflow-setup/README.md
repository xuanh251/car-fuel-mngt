# Herdr Workflow Setup

Standalone local configuration app for `.herdr/workflow.json` and agent definitions. It is not
part of the Car Fuel app and is not included in the root npm workspaces.

```sh
cd workflow-setup
npm install
npm run build
npm start                 # http://127.0.0.1:4317
# Development: npm run dev (Vite at http://127.0.0.1:5174, API at 4317)
```

The server binds only to loopback. `HOST` defaults to `127.0.0.1` and startup rejects any
non-loopback value. `PORT` defaults to `4317`; `HERDR_DIR` defaults to `../.herdr` relative to
this directory; `ALLOWED_ORIGINS` defaults to the loopback origins on ports 4317 and 5174.
The app has no login: any local process able to reach the service can make changes. Host and
Origin checks reduce browser CSRF and DNS-rebinding risk, but do not provide authentication.

On first run, when `.herdr/workflow.json` is absent, the app loads the tracked
`.herdr/workflow.json.example` and reports `configSource: "example"`. Legacy v1 data is migrated
in memory; a v2 local config is created only when saved. Agent definitions are restricted to
`.herdr/agents/`.
