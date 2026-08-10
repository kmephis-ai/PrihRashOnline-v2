# DQ-020 — Data Quality Center

## Назначение

`PRH_DATA_QUALITY_CENTER_V1@1.0.0` — read-only контур контроля качества canonical/candidate transaction records. Он обнаруживает missing/invalid, exact duplicate, suspicious и provenance issues, строит repair preview и формирует evidence state для возможного будущего repair package.

DQ-020 **не исправляет реальные Google Sheets rows**, не меняет FIN-TRUTH/canonical schema и не получает write authority.

## Detectors v1

### Canonical validation

Каждая candidate record проверяется через DATA-010 canonical normalization fail-closed. Отдельно фиксируются отсутствующие required fields. Невалидная запись не coercится и не переписывается.

### Exact duplicate

Fingerprint `SHA256_CANONICAL_BUSINESS_PAYLOAD_V1` строится по canonical business payload без transaction/provenance identity. Это exact/versioned detector, а не similarity ML. Одинаковые amount/date сами по себе недостаточны: account/category/type/status/currency/tags/counterparty/description/reversal semantics также входят в payload.

Даже exact duplicate получает `REVIEW_REQUIRED / NO_AUTOFIX`: detector не доказывает, что одна из одинаковых операций лишняя.

### Suspicious rules

V1 возвращает объяснимые reason codes:

- `ADJUSTMENT_NONZERO`;
- `SELF_TRANSFER`;
- `REVERSAL_SELF_REFERENCE`;
- `SHEET_SOURCE_LOCATION_INCOMPLETE`.

Opaque anomaly score в DQ-020 отсутствует.

### Provenance

Проверяются logical source identity duplicates и completeness Sheets source location. `SOURCE_IDENTITY_DUPLICATE` не переписывает provenance автоматически.

## Repair preview

`PRH_DATA_QUALITY_REPAIR_PREVIEW_V1` детерминированно связывает issue с proposed state. V1 всегда:

```text
action = NO_AUTOFIX
state = REVIEW_REQUIRED
write_performed = false
```

Preview может объяснить проблему, но не является mutation plan execution.

## Bulk mutation boundary

`PRH_DATA_QUALITY_MUTATION_GATE_V1` проверяет наличие:

- exact SHA-256 plan hash;
- fresh `PRH_DQ_BACKUP_BINDING_V1`, привязанного к тому же plan hash;
- idempotency key;
- `PRH_DQ_ROLLBACK_EVIDENCE_V1 = PASS`;
- `PRH_DQ_READBACK_EVIDENCE_V1 = PASS`.

Если evidence неполный, state = `BLOCKED_EVIDENCE_MISSING`.

Даже при полном evidence DQ-020 возвращает только:

```text
state = READY_FOR_SEPARATE_AUTHORIZATION
write_authorized = false
reason_code = DQ020_WRITE_AUTHORITY_ABSENT
```

Таким образом, сам DQ-020 не создаёт обход необратимого action gate. Historical MIG-010 `IRREVERSIBLE_ACTION_AUTHORIZED` **не reusable** для DQ repair. Любой будущий bulk repair требует отдельного exact-bound policy/owner authorization и не входит в этот Roadmap item.

Generic Google write продолжает fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Privacy / observability

Public tests/screenshots используют только independently generated synthetic records.

Public telemetry allowlist:

- schema/version;
- scan hash;
- record/issue counts;
- reason counts;
- status/reason code.

Raw rows, amounts, descriptions, transaction/source IDs и private runtime locators в public telemetry запрещены.

## UI evidence

`DataQualityWebApp.html` — synthetic responsive evidence surface. Он показывает категории issues и write boundary, но не содержит production-derived rows/amounts.

## Machine evidence

- `lib/data_quality/data_quality_center.v1.json`;
- `lib/data_quality/data_quality_center.js`;
- `tests/data_quality_center_contract_test.js`;
- `DataQualityWebApp.html`;
- `tests/data_quality_visual_test.js`;
- named gates `Data Quality`, `Data Quality visual gate`.

## Authority / cost

DQ-020 не владеет FIN-TRUTH, canonical schema override, storage, network, financial write или repair write. `FREE_ONLY` mandatory; external provider не требуется.
