# AUTH-040 — семейная аутентификация и авторизация

## Назначение

`PRH_FAMILY_AUTH_V1@1.0.0` задаёт provider-neutral security boundary для будущего семейного runtime: verified identity assertion, principal, integrity-protected session, least-privilege roles/capabilities, household isolation и privacy-safe authorization telemetry.

AUTH-040 **не делает текущий Apps Script Web App публичным**, не provision-ит Yandex Cloud IAM/OIDC и не выдаёт financial write authority.

## Identity verifier boundary

Raw identity assertion никогда не считается доверенным самостоятельно. Core принимает его только через injected verifier adapter и использует результат `PRH_VERIFIED_IDENTITY_ASSERTION_V1` с обязательными:

- `verified=true`;
- issuer/subject/household;
- exact expected audience;
- issued/expires timestamps;
- known family role.

Wrong audience, expired/unverified assertion и unknown role fail-closed. Required CI использует только independently generated synthetic identities. Live IdP/provider не нужен.

## Session protection

Reference session token integrity = `HMAC-SHA256` с **runtime-injected key ≥32 bytes**. Key не хранится в repository/config fixture и не попадает в telemetry.

Signed token намеренно identity-minimal: он содержит только technical session metadata (`session_id`, issued/absolute-expiry timestamps, version). Raw issuer/subject/household/role в token payload запрещены. Identity/role binding, `last_activity_at`, idle timeout и revocation/version state находятся в server-side session store.

Session policy:

- random 128-bit session ID;
- 30 minute **activity-based** idle timeout;
- 8 hour absolute lifetime;
- `session_version`;
- constant-time signature compare через `timingSafeEqual`.

Успешная авторизация обновляет только server-side `last_activity_at`; она не переписывает signed token. Rotation увеличивает version, делает предыдущий token `AUTH_SESSION_VERSION_STALE` и обновляет activity state, но **не продлевает absolute lifetime**.

## Least privilege

V1 roles:

- `VIEWER`: `FINANCE_READ`;
- `EDITOR`: read + transaction-draft/budget/profile/data-quality capabilities;
- `OWNER`: EDITOR capabilities + `HOUSEHOLD_ADMIN`.

Unknown role/capability = DENY.

Важно: capability `TRANSACTION_DRAFT_EDIT` описывает application-level draft permission. Даже authorization `ALLOW` возвращает:

```text
backend_financial_write_granted = false
google_write_policy = GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED
```

AUTH-040 не отменяет repository write policy и не становится canonical financial-write authority.

## Household isolation

Каждый household-scoped resource требует exact `resource_household_id == session.household_id`. Cross-household access всегда `AUTH_HOUSEHOLD_ISOLATION_DENY`, даже если роль имеет capability.

Raw household/subject/session IDs не разрешены в public telemetry.

## Mutation nonce / CSRF boundary

Mutating capabilities (`TRANSACTION_DRAFT_EDIT`, `BUDGET_PLAN_EDIT`, `PROFILE_EDIT`, `HOUSEHOLD_ADMIN`) требуют `PRH_MUTATION_NONCE_V1`.

Nonce:

- HMAC-integrity protected;
- random 128-bit ID;
- bound к session ID + session version + capability;
- lifetime 300 seconds;
- single-use через reference session store.

Replay = `AUTH_MUTATION_NONCE_REPLAYED`. Wrong session/version/capability = DENY. Cross-household denial происходит до nonce consumption, поэтому попытка к чужому household не «сжигает» корректный nonce для своего household.

Это reference policy для state-changing web requests, а не отдельный authorization на Google/YDB write.

## Decision telemetry

Public-safe `PRH_AUTH_TELEMETRY_V1` допускает только:

- schema/version;
- ALLOW/DENY + reason code;
- role/capability/session state;
- opaque principal/household/session pseudonyms;
- bounded decision count.

Pseudonyms строятся через **HMAC-SHA256 с отдельным runtime-injected key ≥32 bytes**, а не plain SHA-256 raw identifiers. Это уменьшает риск dictionary reversal и делает public-safe pseudonyms key-scoped. Raw telemetry key никогда не публикуется.

Запрещены raw subject/household/session IDs, bearer token, HMAC key, OAuth/refresh token, private runtime locator и financial payload.

## Current runtime boundary

На AUTH-040 текущий Apps Script access остаётся:

```text
MYSELF
public_exposure_change = false
identity_provider_provisioned = false
```

То есть contract готовит будущую auth adapter boundary, но **не расширяет** текущую поверхность доступа.

## Security standards baseline

Reference design сверялся с NIST SP 800-63B-4 session management: session secret, inactivity/overall timeouts, session termination и защита state-changing requests. Integrity/pseudonym primitive — HMAC-SHA256, соответствующий стандартной HMAC construction (RFC 2104). Эти внешние standards не заменяют project-specific fail-closed rules выше.

## Machine evidence

- `lib/auth/family_auth.v1.json`;
- `lib/auth/family_auth.js`;
- `tests/family_auth_contract_test.js`;
- named `Family Auth` gate;
- full layered privacy/security/FREE_ONLY regression.

Adversarial test обязан доказывать: signature tamper/wrong key fail, token не содержит identity payload, activity refresh не отменяет absolute expiry, cross-household/unknown capability deny, nonce replay deny, keyed telemetry pseudonyms отличаются при смене key и не раскрывают raw identifiers.

## Rollback

Revert AUTH-040 contract/core/tests/docs/gate. Current private `MYSELF` Apps Script runtime и Google/YDB write authorities остаются прежними.
