/**
 * Privacy-safe canonical R2 Web App render smoke for trusted runtime health.
 * Uses synthetic technical metadata only and performs no workbook reads.
 */
function prhWebAppRenderSmokeToken() {
  if (typeof prhCanonicalR2WebAppSmokeToken !== 'function') {
    throw new Error('R2_CANONICAL_SMOKE_MISSING');
  }
  var token = prhCanonicalR2WebAppSmokeToken();
  if (token !== 'PRH_WEBAPP_SMOKE_V5|R2|OK') {
    throw new Error('R2_CANONICAL_SMOKE_FAILED');
  }
  return token;
}
