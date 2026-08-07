var params = require('./params');
var isGA4Path = params.isGA4Path;
var isGA4 = params.isGA4;
var mergeParamsBatch = params.mergeParamsBatch;
var consentGranted = params.consentGranted;
var shouldExclude = params.shouldExclude;

var ENDPOINT = 'https://integrations.sinatra.pro/analytics/webhooks/events';

// Envia wire format GA4 como GET (para eventos interceptados da rede)
function sendRaw(hitParams, config) {
  var debug = config.debug === true;
  // Consent gate ligado por padrão: só desliga com requireConsent === false explícito.
  if (config.requireConsent !== false && !consentGranted(hitParams)) {
    if (debug) console.log('[Sinatra] consent denied, skip:', hitParams.en);
    return;
  }
  var ex = config.excludeFields || [];
  var qs = '?account_id=' + encodeURIComponent(config.accountId)
         + '&token=' + encodeURIComponent(config.token);
  for (var k in hitParams) {
    if (ex.length && shouldExclude(k, ex)) continue;
    qs += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(hitParams[k]);
  }
  var en = hitParams['en'] || 'unknown';
  if (debug) console.log('[Sinatra] enviando (raw):', en);
  fetch(ENDPOINT + qs, { method: 'GET', keepalive: true })
    .then(function (r) { if (debug) console.log('[Sinatra] ✅ status:', r.status, '| evento:', en); })
    .catch(function (e) { console.error('[Sinatra] ❌ erro:', e); });
}

function sendBatch(batch, config) {
  for (var bi = 0; bi < batch.length; bi++) {
    try { sendRaw(batch[bi], config); } catch (e) { console.error('[Sinatra] erro ao enviar hit:', e); }
  }
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
        sendBatch(mergeParamsBatch(url, bodyStr), config);
      }
      return _fetch.apply(this, arguments);
    };
    log('[Sinatra] fetch patchado.');
  }

  // === sendBeacon intercept ===
  function handleBeacon(urlStr, bodyStr) {
    var batch = mergeParamsBatch(urlStr, bodyStr);
    var first = batch[0];
    if (!first.tid || first.tid.indexOf('G-') !== 0) return;
    log('[Sinatra] 🎯 GA4 via sendBeacon:', urlStr);
    sendBatch(batch, config);
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
      sendBatch(mergeParamsBatch(url, typeof body === 'string' ? body : null), config);
    }
    return _xhrSend.apply(this, arguments);
  };

  log('[Sinatra] 🚀 pronto. fetch + sendBeacon + XHR ativos.');
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isGA4: isGA4,
    parseQS: params.parseQS,
    mergeParams: params.mergeParams,
    mergeParamsBatch: mergeParamsBatch,
    splitBatchBody: params.splitBatchBody,
    consentGranted: consentGranted,
    shouldExclude: shouldExclude,
    buildPayload: function () {}
  };
}
