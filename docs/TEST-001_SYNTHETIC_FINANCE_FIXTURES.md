# TEST-001 — Synthetic finance fixtures

Status: implementation contract for Roadmap item `TEST-001`.

## Purpose

Public tests must use independently generated fictional finance data. The generator in `tests/fixtures/synthetic_finance.js` is intentionally disconnected from DEV/production datasets, exports, historical aggregates, category distributions, seasonality, screenshots, or runtime responses.

## Determinism

- Default fixed seed is exported as `DEFAULT_SEED`.
- Same seed + profile produces stable transaction order and byte-stable JSON serialization.
- Different seeds change generated transactions while preserving the schema and invariants.
- Monetary values are integer minor units; no floating-point business truth is generated.

## Edge-case contract

The deterministic golden profile includes income, expense, transfer, refund, zero amount, rounding-sensitive minor units, leap day, month/year boundaries, duplicate source identity, missing optional fields, and Unicode text.

## Scale profiles

`PROFILE_SIZES` exposes `golden`, `small`, `scale20k`, and `scale50k`. CI may use a bounded sample from a scale profile; later performance work can consume the full 20k/50k profiles without changing fixture semantics.

## Expected results

The fixture returns `expected` totals computed by a small reference implementation that is independent of production financial functions. Contract tests also recompute those totals with a second test-local reference function so the generator cannot validate itself by calling the production logic under test.

## Privacy boundary

Generated IDs use the `SYN-` prefix and metadata is marked `PUBLIC_SYNTHETIC`. The generator must never be calibrated from real family data, including amounts, counts, categories, descriptions, time-series shape, or derived metrics.

Legacy public-fixture removal, repository-wide privacy scanning, and Git-history remediation are owned by `SEC-001` and are deliberately not duplicated here.
