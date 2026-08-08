# ПрихРасхOnline v2

Домашняя финансовая система на Google Sheets + Apps Script с приватным Web Dashboard и GitHub как инженерным control plane.

> **Текущий статус:** R0 platform baseline. Финансовая сверка, migration reconciliation, synthetic-only public boundary, reproducible supply chain, exact-SHA trusted DEV delivery, portable encrypted restore, privacy-safe observability и `FREE_ONLY` guard уже машинно доказаны. После DOC-001 `MASTER-G0` и `MASTER-G2` закрыты; до выхода из R0 остаётся AI Engineering contract chain (`AIENG-001..003`) для `MASTER-G1`.

## Принципы

- простота и сопровождаемость важнее лишней инфраструктуры;
- финансовая истина определяется canonical transaction rules, а не legacy итоговыми ячейками;
- публичный GitHub содержит только код, документацию и независимо сгенерированные synthetic financial fixtures;
- приватная книга Google остаётся текущим primary data store/adapter; полный history cutover не считается завершённым до отдельного migration gate;
- обычная инженерная доставка автоматизирована, но privacy, paid-service activation и irreversible production-data actions остаются policy boundaries;
- `FREE_ONLY` — исполняемый invariant: неизвестный billable provider fail-closed, paid overage автоматически не включается.

## Dashboard

Web Dashboard остаётся основным пользовательским интерфейсом текущей Google Apps Script реализации. DEV Web App закрыт границей доступа `MYSELF`.

**Приватный deployment URL не публикуется и не поддерживается через README/release commits.** Владелец открывает Dashboard через доверенный private deployment/book menu или собственную локальную закладку. Отсутствие публичной ссылки не является ошибкой release pipeline.

Основные возможности текущего Dashboard:

- 10 представлений: обзор, годы, месяцы, выбранный месяц, сезонность, структура, операции, прогноз, качество, детали;
- Executive KPI и read-only drill-down к исходным операциям;
- единый refresh;
- Quality Workbench с очередью решений;
- объяснимая классификация: предложение -> staging -> подтверждение;
- PDF-отчёт существующей аналитики;
- snapshots KPI в существующий `10 Контроль`;
- responsive desktop/laptop/mobile UI.

## Финансовая и data safety модель

- публичные tests/fixtures не используют реальные или real-derived финансовые значения, агрегаты, распределения, seasonality, IDs или screenshots;
- financial reconciliation строится из canonical/raw transaction semantics; legacy totals не являются golden truth;
- source-to-canonical reconciliation проверяет provenance, mismatch/duplicate/missing/changed source rows и idempotency;
- Web Dashboard не является свободным writer в `01 Операции`; финансовые mutation paths требуют отдельной write policy и machine evidence;
- DEV и PROD — разные policy boundaries; merge в `main` сам по себе не разрешает необратимое PROD действие.

## Автономная доставка

Обычный Roadmap item проходит одну canonical цепочку:

```text
Roadmap Issue: IN_PROGRESS
        ↓
agent/<ID>-<slug> + PR to main
        ↓
PR Validation
  zero deploy secrets
  policy/security/privacy/FREE_ONLY/contracts/UI
  immutable Apps Script candidate bound to exact PR SHA
        ↓
Trusted DEV Deploy
  trusted workflow from default branch
  verifies candidate artifact against exact candidate Git tree
        ↓
Trusted Runtime Health
  authenticated owner-only Execution API probe
  proves deployed candidate SHA + source-tree identity
        ↓
CI-003 autonomous squash merge
        ↓
Main Verification
  verifies merge/gates and changes linked Issue IN_PROGRESS -> DONE
```

Нет штатных `agent/release/**` snapshot branches, commit-count gate, manual runtime marker, anonymous Web App health probe или post-merge direct README commit.

## Recovery / observability / cost

- **DR-001:** owner-local portable `.prhbackup` шифруется AES-256-GCM до записи на диск; verify + isolated SQLite restore drill доказаны; backup/key/OAuth/private payload никогда не попадают в GitHub/CI/chat.
- **OBS-001:** audit journal bounded/rotating, technical metadata allowlisted, logging failure отделён от корректности финансовой операции, privacy-safe health state сохраняет только технические counters/status.
- **FINOPS-001:** `FREE_ONLY` guard использует explicit provider safety envelopes, conservative pre-reservation и 50/70/85/95/100 circuit-breaker policy; provider allowlist по умолчанию пуст.

## Документация

- [Текущий статус и gates](docs/PROJECT_STATUS.md)
- [Архитектура](docs/architecture.md)
- [Release / autonomous delivery](docs/RELEASE_PROCESS.md)
- [Web Dashboard](docs/dashboard.md)
- [Модель данных и privacy boundary](docs/data-model.md)
- [Руководство пользователя](docs/user-guide.md)
- [DR-001 owner backup](docs/operations/DR001_DIRECT_OWNER_BACKUP.md)
- [OBS-001 audit/telemetry](docs/operations/OBS001_AUDIT_TELEMETRY.md)
- [FINOPS-001 FREE_ONLY guard](docs/operations/FINOPS001_FREE_ONLY_GUARD.md)
- [Public-history remediation policy](docs/security/PUBLIC_HISTORY_REMEDIATION_PLAN.md)
- [CHANGELOG](CHANGELOG.md)

## Что дальше

R0 не считается полностью закрытым до `MASTER-G1`: repository AI contract, executable Roadmap-to-agent protocol и read-only multi-AI review protocol (`AIENG-001..003`). Только после закрытия всех R0 master gates приоритет переходит к R1 canonical financial platform (`FIN-010`, затем `DATA-010` и domain/adapters).
