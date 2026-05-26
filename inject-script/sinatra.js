var GA4_PATH = '/g/collect';
var ENDPOINT = 'https://integrations.sinatra.pro/analytics/webhooks/events';

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

// Envia wire format GA4 como GET (para eventos interceptados da rede)
function sendRaw(params, config) {
  var debug = config.debug === true;
  if (config.requireConsent && !consentGranted(params)) {
    if (debug) console.log('[Sinatra] consent denied, skip:', params.en);
    return;
  }
  var ex = config.excludeFields || [];
  var qs = '?account_id=' + encodeURIComponent(config.accountId)
         + '&token=' + encodeURIComponent(config.token);
  for (var k in params) {
    if (ex.length && shouldExclude(k, ex)) continue;
    qs += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }
  var en = params['en'] || 'unknown';
  if (debug) console.log('[Sinatra] enviando (raw):', en);
  fetch(ENDPOINT + qs, { method: 'GET', keepalive: true })
    .then(function (r) { if (debug) console.log('[Sinatra] ✅ status:', r.status, '| evento:', en); })
    .catch(function (e) { console.error('[Sinatra] ❌ erro:', e); });
}

// Browser auto-init
(function () {
  if (typeof window === 'undefined') return;

  if (window.__sinatraLoaded) {
    if (window.__sinatra && window.__sinatra.debug) console.log('[Sinatra] já carregado.');
    return;
  }
  window.__sinatraLoaded = true;

  var config = window.__sinatra;
  if (!config || !config.accountId || !config.token) {
    var miss = !config ? 'config' : [!config.accountId && 'accountId', !config.token && 'token'].filter(Boolean).join(', ');
    console.warn('[Sinatra] ❌ config inválida. faltando:', miss);
    return;
  }
  var DEBUG = config.debug === true;
  function log() { if (DEBUG) console.log.apply(console, arguments); }
  log('[Sinatra] ✅ init | account:', config.accountId);

  // === fetch intercept — captura page_view, scroll e eventos automáticos via GET ===
  var _fetch = window.fetch;
  if (_fetch) {
    window.fetch = function (resource, init) {
      var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
      if (isGA4(url)) {
        log('[Sinatra] 🎯 GA4 via fetch:', url);
        var bodyStr = (init && typeof init.body === 'string') ? init.body : null;
        var params = mergeParams(url, bodyStr);
        try { sendRaw(params, config); } catch (e) { console.error('[Sinatra] erro fetch intercept:', e); }
      }
      return _fetch.apply(this, arguments);
    };
    log('[Sinatra] fetch patchado.');
  }

  // === sendBeacon intercept ===
  function handleBeacon(urlStr, bodyStr) {
    var params = mergeParams(urlStr, bodyStr);
    if (!params.tid || params.tid.indexOf('G-') !== 0) return;
    log('[Sinatra] 🎯 GA4 via sendBeacon:', urlStr);
    try { sendRaw(params, config); } catch (e) { console.error('[Sinatra] erro sendBeacon intercept:', e); }
  }
  var _sendBeacon = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
  if (_sendBeacon) {
    navigator.sendBeacon = function (url, data) {
      var urlStr = String(url || '');
      if (isGA4Path(urlStr)) {
        if (data instanceof Blob) data.text().then(function (b) { handleBeacon(urlStr, b); });
        else handleBeacon(urlStr, typeof data === 'string' ? data : (data instanceof URLSearchParams ? data.toString() : null));
      }
      return _sendBeacon(url, data);
    };
    log('[Sinatra] sendBeacon patchado.');
  }

  // === XHR fallback ===
  var _xhrOpen = XMLHttpRequest.prototype.open;
  var _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._sinatraUrl = String(url || '');
    return _xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    var url = this._sinatraUrl || '';
    if (isGA4(url)) {
      log('[Sinatra] 🎯 GA4 via XHR:', url);
      var params = mergeParams(url, typeof body === 'string' ? body : null);
      try { sendRaw(params, config); } catch (e) { console.error('[Sinatra] erro XHR intercept:', e); }
    }
    return _xhrSend.apply(this, arguments);
  };

  log('[Sinatra] 🚀 pronto. fetch + sendBeacon + XHR ativos.');
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isGA4: isGA4, parseQS: parseQS, mergeParams: mergeParams, buildPayload: function() {} };
}
