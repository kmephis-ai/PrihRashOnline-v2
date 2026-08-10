# AUTH-040 — семейная аутентификация и авторизация

## Назначение

`PRH_FAMILY_AUTH_V1@1.0.0` задаёт provider-neutral security boundary для будущего семейного runtime: verified identity assertion, principal, signed session, least-privilege roles/capabilities, household isolation и privacy-safe authorization telemetry.

AUTH-040 **не делает текущий Apps Script Web App публичным**, не provision-ит Yandex Cloud IAM/OIDC и не выдаёт financial write authority.

## Identity verifier boundary

Raw identity assertion никогда не считается доверенным самостоятельно. Core принимает его только через injected verifier adapter и использует результат `PRH_VERIFIED_IDENTITY_ASSERTION_V1` с обязательными:

- `verified=true`;
- issuer/subject/household;
- exact expected audience;
- issued/expires timestamps;
- known family role.

Wrong audience, expired/unverified assertion и unknown role fail-closed.

Required CI использует только independently generated synthetic identities. Live IdP/provider не нужен.

## Session protection

Reference session token integrity = `HMAC-SHA256` с **runtime-injected key ≥32 bytes**. Key не хранится в repository/config fixture и не попадает в telemetry.

Session включает:

- random 128-bit session ID;
- role + household/subject binding;
- 30 minute idle timeout;
- 8 hour absolute lifetime;
- `session_version`.

Signature проверяется `timingSafeEqual`. Rotation увеличивает version в stateful reference store, поэтому предыдущий signed token становится `AUTH_SESSION_VERSION_STALE`; rotation не продлевает absolute lifetime.

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

AUTH-040 не отменяет repository write policy.

## Household isolation

Каждый household-scoped resource требует exact `resource_household_id == session.household_id`. Cross-household access всегда `AUTH_HOUSEHOLD_ISOLATION_DENY`, даже если роль в принципе имеет capability.

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
- SHA-256 opaque principal/household/session hashes;
- bounded decision count.

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

Reference design сверялся с NIST SP 800-63B-4 session management: session secret, inactivity/overall timeouts, session termination и защита state-changing requests. Integrity primitive — HMAC-SHA256, соответствующий стандартной HMAC construction (RFC 2104). Эти внешние standards не заменяют project-specific fail-closed rules выше.

## Machine evidence

- `lib/auth/family_auth.v1.json`;
- `lib/auth/family_auth.js`;
- `tests/family_auth_contract_test.js`;
- named `Family Auth` gate;
- full layered privacy/security/FREE_ONLY regression.

## Rollback

Revert AUTH-040 contract/core/tests/docs/gate. Current private `MYSELF` Apps Script runtime и Google/YDB write authorities остаются прежними.
