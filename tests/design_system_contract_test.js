'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'lib/design/design_system.v1.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'DashboardWebApp.html'), 'utf8');

function channel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  assert(match, `contrast color must be #RRGGBB: ${hex}`);
  const raw = match[1];
  const r = channel(parseInt(raw.slice(0, 2), 16));
  const g = channel(parseInt(raw.slice(2, 4), 16));
  const b = channel(parseInt(raw.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function requireCssToken(name, value) {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(new RegExp(`--${name}\\s*:\\s*${escaped}`, 'i').test(html), `Dashboard CSS missing ${name}=${value}`);
}

assert.strictEqual(contract.schema, 'PRH_DESIGN_SYSTEM_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.roadmap_id, 'DESIGN-020');
assert.strictEqual(contract.renderer, 'CSS_CUSTOM_PROPERTIES');
assert.strictEqual(contract.external_asset_required, false);
assert.strictEqual(contract.financial_payload_allowed, false);
assert.strictEqual(contract.accessibility.normal_text_min_contrast, 4.5);
assert.strictEqual(contract.accessibility.focus_visible_required, true);
assert.strictEqual(contract.accessibility.reduced_motion_required, true);
assert.strictEqual(contract.accessibility.system_color_scheme_supported, true);
assert.strictEqual(contract.accessibility.explicit_theme_boundary, 'html[data-theme]');
assert.deepStrictEqual(contract.breakpoints_px, { mobile_max: 760, tablet_max: 1250 });

for (const pair of contract.contrast_pairs) {
  const theme = contract.themes[pair.theme];
  assert(theme, `unknown contrast theme ${pair.theme}`);
  const ratio = contrast(theme[pair.foreground], theme[pair.background]);
  assert(ratio >= pair.minimum, `${pair.theme} ${pair.foreground}/${pair.background} contrast ${ratio.toFixed(2)} < ${pair.minimum}`);
}

requireCssToken('ds-font-family', contract.typography.font_family);
for (const [name, value] of Object.entries(contract.spacing_px)) requireCssToken(`ds-space-${name}`, `${value}px`);
for (const [name, value] of Object.entries(contract.radius_px)) requireCssToken(`ds-radius-${name}`, `${value}px`);
requireCssToken('ds-focus-ring', contract.focus.ring);
requireCssToken('ds-focus-width', `${contract.focus.width_px}px`);
requireCssToken('ds-focus-offset', `${contract.focus.offset_px}px`);
requireCssToken('ds-motion-fast', `${contract.motion.fast_ms}ms`);
requireCssToken('ds-motion-normal', `${contract.motion.normal_ms}ms`);

for (const [themeName, theme] of Object.entries(contract.themes)) {
  const boundary = themeName === 'light' ? /:root\s*,\s*html\[data-theme=["']light["']\]/ : /html\[data-theme=["']dark["']\]/;
  assert(boundary.test(html), `explicit ${themeName} theme boundary missing`);
  for (const [name, value] of Object.entries(theme)) requireCssToken(`ds-${name.replace(/_/g, '-')}`, value);
}

assert(/@media\s*\(prefers-color-scheme:\s*dark\)/i.test(html), 'system dark preference boundary missing');
assert(/html:not\(\[data-theme\]\)/.test(html), 'system dark theme must not override explicit data-theme');
assert(/:focus-visible[\s\S]{0,220}--ds-focus-ring/i.test(html), 'focus-visible must use design focus ring');
assert(/@media\s*\(prefers-reduced-motion:\s*reduce\)/i.test(html), 'reduced-motion media query missing');
assert(new RegExp(`@media\\s*\\(max-width:${contract.breakpoints_px.tablet_max}px\\)`).test(html), 'tablet breakpoint drift');
assert(new RegExp(`@media\\s*\\(max-width:${contract.breakpoints_px.mobile_max}px\\)`).test(html), 'mobile breakpoint drift');

for (const semanticUse of [
  /body\{[^}]*background:var\(--ds-canvas\)[^}]*color:var\(--ds-text\)/,
  /\.nav-wrap\{[^}]*background:var\(--ds-surface\)/,
  /\.filter-card\{[^}]*background:var\(--ds-surface\)/,
  /\.panel\{[^}]*background:var\(--ds-surface\)/,
  /\.action-button\{[^}]*border:[^;]*var\(--ds-border-strong\)/,
  /\.tabs\{[^}]*border-radius:var\(--ds-radius-md\)/
]) assert(semanticUse.test(html), `semantic shell token usage missing: ${semanticUse}`);

assert(!/https?:\/\/(?:fonts\.|cdn\.|unpkg\.|jsdelivr\.)/i.test(html), 'Dashboard design must not require external CDN/font assets');
const contractText = JSON.stringify(contract).toLowerCase();
for (const forbidden of ['amount_minor', 'transaction_id', 'source_fingerprint', 'household amount', 'financial rows']) {
  assert(!contractText.includes(forbidden), `design contract leaked finance-domain payload field: ${forbidden}`);
}

console.log('design_system_contract_test: OK', {
  contract: 'PRH_DESIGN_SYSTEM_V1@1.0.0',
  themes: Object.keys(contract.themes),
  contrastPairs: contract.contrast_pairs.length,
  breakpoints: contract.breakpoints_px,
  semanticCssTokens: true,
  focusVisible: true,
  reducedMotion: true,
  externalAssets: false,
  financialPayload: false
});
