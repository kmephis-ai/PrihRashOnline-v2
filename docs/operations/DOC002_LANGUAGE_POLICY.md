# DOC-002 — русский нормативный контур документации

## Назначение

`PRH_LANGUAGE_POLICY_V1@1.0.0` делает правило `LANG-RU` исполняемым: **русский язык является единственным нормативным языком human-facing части проекта**, а технические machine-facing identifiers сохраняются в исходном виде.

Политика не создаёт второй English source of truth и не требует буквального перевода API/schema/standard/library names.

## Что считается human-facing нормативным текстом

В machine-readable inventory включены ключевые входные точки и governance-документы: `README.md`, `AGENTS.md`, Roadmap, current project status, AI context, release runbook, security/architecture contracts и GitHub Issue/PR/Release templates.

Новый нормативный документ, который становится source of truth для процесса/архитектуры/безопасности/эксплуатации, должен иметь русский human-readable смысл. Технические фрагменты внутри него могут оставаться на английском.

## Что не переводится

Явно допустимы без перевода:

- schema/API/protocol identifiers: `PRH_CANONICAL_TRANSACTION_V1`, `PRH_TRANSACTION_REPOSITORY_V1`, `FIN-TRUTH-v1`;
- policy/reason codes: `FREE_ONLY`, `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`;
- технологии и библиотеки: GitHub Actions, Google Apps Script, YDB/YQL, ECharts, Playwright, Node.js;
- стандарты: OAuth, OIDC/WIF, HMAC-SHA256, RFC 2104, NIST SP 800-63B-4;
- branch/file paths, команды CLI, JSON/YAML поля и code fences.

Это allowlist-категория, а не разрешение писать English-only prose вокруг технического идентификатора.

## Scanner

`tools/language-policy-scan.js` работает локально/offline и:

1. получает tracked paths через `git ls-files`;
2. блокирует параллельные normative English trees/README (`docs/en`, `docs/english`, `README_EN.md`, `README.en.md`);
3. проверяет существование каждого inventory path;
4. удаляет code fences, inline code и URL перед human-language check;
5. требует минимальный объём кириллического human-facing текста для каждого inventory item;
6. проверяет обязательные `LANG-RU`/`language: ru` markers.

Scanner не анализирует финансовые значения, не обращается в сеть и не имеет runtime/write authority.

## GitHub templates

Roadmap Issue, PR и Release templates по умолчанию требуют русскую human-facing часть и содержат `language: ru`. Технические identifiers сохраняются без перевода. Private financial/runtime payload запрещён независимо от языка.

## Не является scope DOC-002

DOC-002 не меняет financial truth, Apps Script runtime, provider configuration, deployment exposure, Google/YDB write ownership или пользовательские финансовые данные. `FREE_ONLY` остаётся обязательным.

## Machine evidence

- `lib/documentation/language_policy.v1.json`;
- `lib/documentation/language_policy.js`;
- `tools/language-policy-scan.js`;
- `tests/language_policy_contract_test.js`;
- named `Language policy` gate в PR Validation;
- TEST-010 classification;
- existing documentation/privacy/security/FREE_ONLY/full layered gates.

## Rollback

Откатить DOC-002 policy/scanner/templates/docs/gates. Runtime и financial state при этом не изменяются.
