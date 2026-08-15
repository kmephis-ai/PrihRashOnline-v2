# ADWF Local Git Mirror в PrihRashOnline-v2

## Назначение

`adwf-local-git-mirror` — first-party Skill из `AI-Development-Framework`, который восстанавливает настоящий локальный Git workspace на exact GitHub SHA, когда execution environment не может выполнять обычные `git clone` / `git fetch` из-за DNS/HTTPS egress.

Для PrihRashOnline-v2 Skill вендорится byte-for-byte из canonical:

- repository: `kmephis-ai/AI-Development-Framework`;
- ref: `main`;
- exact upstream SHA: `676e5ded2cce37f15540cd1462fdff7b57e4ca3f`;
- lock: `.ai-context/adwf-local-git-mirror.lock.json`.

Проверка vendored snapshot:

```bash
node tools/verify-adwf-local-git-mirror.js
```

## Приоритет работы

1. Сначала выполнить один bounded direct-Git probe.
2. Если direct Git работает — использовать обычный Git и не расходовать GitHub Actions.
3. Если получена deterministic DNS/egress ошибка (например `Could not resolve host: github.com`) — использовать `skills/adwf-local-git-mirror/SKILL.md`.
4. После успешной materialization локальный Git является рабочим инструментом для анализа, editing, generators/tests, `git diff`, `merge-base`, `worktree` и локальных commits.
5. GitHub остаётся provider Source of Truth. Пока direct remote Git/push недоступен, Connector используется только для необходимых provider-side действий: bootstrap transport, remote mutation/readback, CI/status/artifact operations.

## Почему Connector не исчезает полностью

Skill предназначен не для отказа от GitHub, а для отказа от постоянного чтения/редактирования repository через Connector. При заблокированном direct Git первоначальный bundle должен быть создан на GitHub Runner и доставлен через Connector. Удалённые branch/PR/CI операции также требуют provider API, пока обычный Git transport недоступен.

Целевой режим для AI-сессии:

```text
GitHub exact SHA -> short-lived mirror bootstrap -> verified local .git workspace
                                               -> local analysis/edit/tests/diff
                                               -> minimal provider mutation/readback
```

## Безопасность

- exact SHA обязателен; `latest`/неявный HEAD запрещены;
- preferred bootstrap template имеет только `contents: read`;
- artifact retention — 1 day;
- fallback с `contents: write` изолирован и используется только если binary artifact download невозможен;
- PAT/OAuth/refresh token/client secret/Connector credential нельзя помещать в repository, prompt, workflow, artifact или log;
- bundle считается недоверенным до checksum + manifest + `git bundle verify` + exact HEAD + `git fsck`;
- local PASS не заменяет provider exact-head CI, Trusted DEV Deploy, Runtime Health или Owner UAT;
- `FREE_ONLY`, privacy и FIN-TRUTH не изменяются.

## Обновление Skill

Обновление выполняется только от нового exact canonical ADWF SHA. Сначала обновляются byte-for-byte vendored files, затем `.ai-context/adwf-local-git-mirror.lock.json`, после чего обязательна команда:

```bash
node tools/verify-adwf-local-git-mirror.js
```

Нельзя автоматически подтягивать `main/latest` без фиксации exact upstream SHA.
