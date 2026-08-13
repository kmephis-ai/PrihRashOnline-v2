# GOV-REC-002 rollout checklist

После merge protocol change:

1. VIZ-REC-001 остаётся `BLOCKED / CODE_COMPLETE / RUNTIME_INTEGRATED` до честного Product Ready evidence.
2. E2E-REC-001 переносит `VIZ-REC-001` из обычного `depends_on` в `depends_on_runtime_integrated`.
3. E2E-REC-001 может стать `READY/IN_PROGRESS`, если остальные обычные dependencies `DONE`.
4. Canonical authenticated E2E producer публикует `product-ready-e2e` только для exact deployed SHA и sanitized evidence.
5. Только после этого VIZ-REC-001 проходит Product Ready, autonomous merge и Main Verification.

Запрещено использовать GOV-REC-002 как основание для ручного или синтетического `product-ready-e2e=PASS`.
