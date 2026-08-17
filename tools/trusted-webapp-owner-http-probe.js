'use strict';

const fs = require('fs');
const path = require('path');

const WEB_DESCRIPTION = 'PrihRashOnline Web Dashboard DEV WebApp';
const MAX_REDIRECTS = 3;
const ALLOWED_INITIAL_HOST = 'script.google.com';
const ALLOWED_CONTENT_HOST_SUFFIX = '.googleusercontent.com';

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return null; }
}

function safeStatus(payload) {
  const raw = String(payload && payload.error && payload.error.status || '').toUpperCase();
  return /^[A-Z][A-Z0-9_]{0,39}$/.test(raw) ? raw : 'UNKNOWN';
}

function hasWebEntryPoint(deployment) {
  return Array.isArray(deployment && deployment.entryPoints)
    && deployment.entryPoints.some((entry) => entry && entry.entryPointType === 'WEB_APP' && entry.webApp);
}

function webEntryPoint(deployment) {
  return (deployment.entryPoints || []).find((entry) => entry && entry.entryPointType === 'WEB_APP' && entry.webApp).webApp;
}

function deploymentDescription(deployment) {
  return String(deployment && deployment.deploymentConfig && deployment.deploymentConfig.description || '');
}

function validateWebUrl(raw) {
  let url;
  try { url = new URL(String(raw || '')); } catch (_) { return null; }
  if (url.protocol !== 'https:' || url.hostname !== ALLOWED_INITIAL_HOST) return null;
  if (!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) return null;
  url.search = '';
  url.hash = '';
  return url;
}

function isAllowedContentRedirect(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' &&
      (url.hostname === ALLOWED_INITIAL_HOST || url.hostname.endsWith(ALLOWED_CONTENT_HOST_SUFFIX));
  } catch (_) {
    return false;
  }
}

function isLoginRedirect(raw) {
  try {
    const host = new URL(raw).hostname;
    return host === 'accounts.google.com' || host.endsWith('.accounts.google.com');
  } catch (_) {
    return false;
  }
}

function classifyUnexpectedHtml(html) {
  const text = String(html || '');
  const login = /accounts\.google\.com|ServiceLogin|identifierId|gaia_loginform|signin\/v2|Sign in(?:\s+to)?\s+Google|Войдите в аккаунт Google|Войти в аккаунт Google/i.test(text);
  if (login) return 'BROWSER_SESSION_REQUIRED';
  const permission = /Authorization required|access denied|permission denied|You need (?:access|permission)|Request access|Требуется авторизация|Нет доступа|Запросить доступ/i.test(text);
  if (permission) return 'WEBAPP_PERMISSION_INTERSTITIAL';
  const googleInterstitial = /google(?:usercontent)?\.com|Google Accounts|Google Drive|Google Apps Script/i.test(text);
  if (googleInterstitial) return 'GOOGLE_WEBAPP_INTERSTITIAL';
  return 'OWNER_HTTP_NON_APP_HTML_200';
}

async function ownerAccessToken(profileName) {
  const authPath = process.env.CLASPRC_PATH || path.join(process.env.HOME || '', '.clasprc.json');
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  const profile = auth && auth.tokens && auth.tokens[profileName];
  if (!profile || !profile.client_id || !profile.client_secret || !profile.refresh_token) {
    return { ok: false, reason: 'OAUTH_PROFILE_INCOMPLETE' };
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: profile.client_id,
      client_secret: profile.client_secret,
      refresh_token: profile.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const payload = await readJson(response);
  const accessToken = payload && payload.access_token;
  if (!response.ok || typeof accessToken !== 'string' || !accessToken) {
    return { ok: false, reason: 'OAUTH_TOKEN_REFRESH_FAILED' };
  }
  return { ok: true, accessToken };
}

async function listDeployments(scriptId, accessToken) {
  const deployments = [];
  let pageToken = '';
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/deployments`);
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` }
    });
    const payload = await readJson(response);
    if (!response.ok || !payload || !Array.isArray(payload.deployments)) {
      return { ok: false, reason: `DEPLOYMENT_LIST_HTTP_${response.status}_${safeStatus(payload)}` };
    }
    deployments.push(...payload.deployments);
    pageToken = String(payload.nextPageToken || '');
    if (!pageToken) return { ok: true, deployments };
  }
  return { ok: false, reason: 'DEPLOYMENT_LIST_PAGINATION_EXCEEDED' };
}

async function probeOwnerHttp(url, accessToken, fetchImpl = fetch) {
  let current = new URL(url.toString());
  current.searchParams.set('surface', 'home');
  let authorization = `Bearer ${accessToken}`;
  const startedAt = Date.now();

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetchImpl(current, {
      method: 'GET',
      headers: {
        ...(authorization ? { authorization } : {}),
        'cache-control': 'no-cache',
        'user-agent': 'PrihRashOnline-Trusted-Owner-Probe/1.0'
      },
      redirect: 'manual'
    });

    if (response.status === 200) {
      const html = await response.text();
      const canonicalShell = html.includes('data-prh-canonical-r2-shell="1"');
      const russianHomeSource = html.includes('Финансовый дом');
      const reason = canonicalShell && russianHomeSource
        ? 'OWNER_HTTP_AUTHENTICATED_200'
        : classifyUnexpectedHtml(html);
      return {
        ok: canonicalShell && russianHomeSource,
        reason,
        http_status: 200,
        latency_ms: Math.max(0, Date.now() - startedAt),
        canonical_shell: canonicalShell,
        russian_home_source: russianHomeSource,
        redirect_count: redirect
      };
    }

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return {
        ok: false,
        reason: `OWNER_HTTP_STATUS_${response.status}`,
        http_status: response.status,
        latency_ms: Math.max(0, Date.now() - startedAt),
        redirect_count: redirect
      };
    }

    const location = response.headers.get('location') || '';
    if (isLoginRedirect(location)) {
      return {
        ok: false,
        reason: 'BROWSER_SESSION_REQUIRED',
        http_status: response.status,
        latency_ms: Math.max(0, Date.now() - startedAt),
        redirect_count: redirect + 1
      };
    }
    if (!isAllowedContentRedirect(location)) {
      return {
        ok: false,
        reason: 'OWNER_HTTP_REDIRECT_NOT_ALLOWLISTED',
        http_status: response.status,
        latency_ms: Math.max(0, Date.now() - startedAt),
        redirect_count: redirect + 1
      };
    }
    current = new URL(location);
    authorization = current.hostname === ALLOWED_INITIAL_HOST ? authorization : '';
  }

  return { ok: false, reason: 'OWNER_HTTP_REDIRECT_LIMIT', http_status: 0, latency_ms: 0, redirect_count: MAX_REDIRECTS };
}

async function main() {
  try {
    const scriptId = String(process.env.APPS_SCRIPT_ID || '');
    const profileName = String(process.env.CLASP_USER || 'prihrash-ci');
    if (!/^[A-Za-z0-9_-]{20,}$/.test(scriptId)) return emit({ ok: false, reason: 'APPS_SCRIPT_ID_INVALID' });

    const token = await ownerAccessToken(profileName);
    if (!token.ok) return emit(token);
    const listed = await listDeployments(scriptId, token.accessToken);
    if (!listed.ok) return emit(listed);

    const matches = listed.deployments.filter((deployment) =>
      deploymentDescription(deployment) === WEB_DESCRIPTION && hasWebEntryPoint(deployment));
    if (matches.length !== 1) return emit({ ok: false, reason: 'WEB_DEPLOYMENT_IDENTITY_INVALID' });

    const entry = webEntryPoint(matches[0]);
    const config = entry && entry.entryPointConfig || {};
    if (config.access !== 'MYSELF') return emit({ ok: false, reason: 'WEB_DEPLOYMENT_ACCESS_NOT_MYSELF' });
    if (config.executeAs !== 'USER_DEPLOYING') return emit({ ok: false, reason: 'WEB_DEPLOYMENT_EXECUTE_AS_UNEXPECTED' });
    const url = validateWebUrl(entry.url);
    if (!url) return emit({ ok: false, reason: 'WEB_DEPLOYMENT_URL_INVALID' });

    emit(await probeOwnerHttp(url, token.accessToken));
  } catch (_) {
    emit({ ok: false, reason: 'OWNER_HTTP_PROBE_INTERNAL_ERROR' });
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  WEB_DESCRIPTION,
  validateWebUrl,
  isAllowedContentRedirect,
  isLoginRedirect,
  classifyUnexpectedHtml,
  probeOwnerHttp
};
