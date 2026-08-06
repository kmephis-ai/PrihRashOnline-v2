# Web Dashboard pipeline trigger

Triggered after the repository was made public and the deployment workflow was moved to GitHub-hosted `ubuntu-latest`.

- Target: Apps Script HTML Web Dashboard DEV
- Release candidate: Web Dashboard 1.1
- Functional commit: `01ae25bbf4fcda78fc646c0079cc463f8afbe0b6`
- Visual gate: Playwright at desktop `1600×1000`, laptop `1280×900`, mobile `390×844`
- Interaction gate: forecast tab, detail panel and URL state
- Safety: read-only dashboard data API; no writes to `01 Операции`
- Trigger time: 2026-08-06 21:42 MSK
