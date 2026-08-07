var GA4_PATH = '/g/collect';

function isGA4Path(url) { return typeof url === 'string' && url.indexOf(GA4_PATH) !== -1; }
function isGA4(url) { return isGA4Path(url) && url.indexOf('tid=G-') !== -1; }

function parseQS(str) {
  var out = {};
  if (!str) return out;
  var s = str.charAt(0) === '?' ? str.slice(1) : str;
  s.split('&').forEach(function (pair) {
    if (!pair) return;
    var eq = pair.indexOf('=');
    if (eq === -1) { out[decodeURIComponent(pair)] = ''; return; }
    var k = decodeURIComponent(pair.slice(0, eq));
    var v = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
    out[k] = v;
  });
  return out;
}

function parseBody(body) { return body && typeof body === 'string' ? parseQS(body) : {}; }

function mergeParams(url, body) {
  var qi = url.indexOf('?');
  var merged = qi !== -1 ? parseQS(url.slice(qi + 1)) : {};
  var bodyParams = parseBody(body);
  for (var k in bodyParams) merged[k] = bodyParams[k];
  return merged;
}

// gtag.js agrupa múltiplos hits (page_view, session_start, first_visit, etc.)
// num único POST, um evento por linha do body, separados por '\n'.
function splitBatchBody(body) {
  if (!body || typeof body !== 'string') return [''];
  var lines = body.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
  return lines.length ? lines : [''];
}

// Retorna um array de params, um por evento do batch — cada um mesclado com
// os params comuns da URL. Substitui mergeParams nos pontos de interceptação
// para não perder eventos batchados (ex: session_start junto do page_view).
function mergeParamsBatch(url, body) {
  var qi = url.indexOf('?');
  var urlParams = qi !== -1 ? parseQS(url.slice(qi + 1)) : {};
  return splitBatchBody(body).map(function (line) {
    var merged = {};
    for (var k in urlParams) merged[k] = urlParams[k];
    var bodyParams = parseBody(line);
    for (var k2 in bodyParams) merged[k2] = bodyParams[k2];
    return merged;
  });
}

// gcs format: G1XX onde index 3 = analytics_storage (0=denied, 1=granted)
function consentGranted(params) {
  return !params.gcs || params.gcs.charAt(3) !== '0';
}

function shouldExclude(key, list) {
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (key === p || (p.slice(-1) === '*' && key.indexOf(p.slice(0, -1)) === 0)) return true;
  }
  return false;
}

module.exports = {
  isGA4Path: isGA4Path,
  isGA4: isGA4,
  parseQS: parseQS,
  parseBody: parseBody,
  mergeParams: mergeParams,
  splitBatchBody: splitBatchBody,
  mergeParamsBatch: mergeParamsBatch,
  consentGranted: consentGranted,
  shouldExclude: shouldExclude
};
