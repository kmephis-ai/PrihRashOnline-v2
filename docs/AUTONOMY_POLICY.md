# Recommended Safe Autonomy Mode

## Scope

This policy governs autonomous work on `ПрихРасхOnline v2 DEV` and repository `kmephis-ai/PrihRashOnline-v2`.

## Allowed without separate confirmation

- Google Sheets visual styling and layout changes in DEV.
- Chart formatting, sizing, placement and source-range repair after verification.
- Navigation, grouping, filters, conditional formatting and helper formulas.
- Formula edits after bounded pre-read and mandatory read-back verification.
- GitHub branches, commits, tests and draft pull requests.
- Documentation and roadmap updates.

## Restricted

- Direct value changes in `01 Операции` are denied by default.
- Controlled quality apply stays disabled until both write switches are explicitly enabled.
- Any write to operation values requires backup-before-write, bounded batch size, reread verification and rollback support.
- Production publication or dangerous Apps Script deployment requires a separate decision.
- Pull request merge is allowed only after successful checks and no unresolved blocker.

## Fail-closed rules

1. Read target ranges before every edit pass.
2. Apply small atomic changes.
3. Read back every changed range.
4. Stop on mismatch, missing range, schema drift or failed verification.
5. Never guess sheet IDs, ranges or operation columns.
6. Preserve formulas, data validation, hyperlinks and operation values unless the task explicitly targets them.

## User interaction

The user is involved only for:

- production publication;
- financial data value changes;
- irreversible actions;
- missing credentials or external authorization;
- conflicting business decisions.

## Current limitation

Full Apps Script source synchronization remains pending until an authenticated `clasp` session is available in the execution environment.
