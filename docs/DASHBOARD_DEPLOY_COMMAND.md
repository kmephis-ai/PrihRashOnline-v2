# Dashboard DEV deployment command

The Apps Script DEV deployment is started from pull request #6 with the exact owner-only comment:

```text
/deploy-dashboard-dev
```

The default-branch workflow validates that:

- the comment belongs to issue / pull request `#6`;
- the command matches exactly;
- the actor is the repository owner;
- the dispatched target ref is `agent/dashboard-ux-structure`.

The deployment remains fail-closed: tests, Playwright visual validation, `clasp push`, and Web App deployment must all pass before success is reported.
