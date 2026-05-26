# sinatra inject-script

Script injetado pelo template GTM `sinatra.tpl` que intercepta hits do GA4 no browser e replica para o endpoint do Sinatra preservando o wire format original.

## Como funciona

O bundle (`sinatra-bundle.js`) é carregado em S3 (`gtm-templates` bucket) e injetado na página via `injectScript` pelo template GTM. Ao executar:

1. Lê config em `window.__sinatra` (`accountId`, `token`, opcional `measurementId`)
2. Faz monkey-patch em `window.fetch`, `navigator.sendBeacon` e `XMLHttpRequest`
3. Detecta hits para `/g/collect` com `tid=G-*`
4. Mergeia query string + body URL-encoded → params object
5. Forwarda como **GET** para `integrations.sinatra.pro/analytics/webhooks/events` com todos os params do wire format intactos + `account_id` e `token`

Zero transformação. O backend recebe o mesmo conjunto de chaves que o GA4 enviaria (`v`, `tid`, `cid`, `en`, `sid`, `sct`, `seg`, `dl`, `dr`, `dt`, `ul`, `sr`, `ep.*`, `epn.*`, `pr1.*`, `uap`, `uapv`, `ur`, `gcd`, `npa`, `dma`, `ecid`, etc.).

## Por que GET e não POST JSON

GA4 envia hits via GET (com tudo na query string) ou sendBeacon POST (split entre query e body). Replicar como GET evita:
- Preflight CORS
- Transformação de payload (que perde campos)
- Necessidade do backend parsear formato customizado

O endpoint do Sinatra aceita GET na mesma URL.

## Limitações conhecidas

**Setups com `server_container_url` (sGTM):** capturamos apenas o primeiro `page_view`. Os demais eventos saem do `sw_iframe.html` injetado pelo Google — iframe cross-origin (origem `*.run.app`) cujo `window.fetch` é inacessível a partir da página principal. Para esses casos, use o template server-side (`sinatra-server.tpl`) que captura tudo direto no container sGTM.

**Setups sem `server_container_url`:** captura 100% dos hits via fetch/sendBeacon/XHR.

## Build & deploy

```bash
# build local
npm run build

# deploy direto pro S3 (precisa de credenciais válidas)
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
  aws s3 cp dist/sinatra-bundle.js s3://gtm-templates/sinatra-bundle.js \
  --region us-east-1 \
  --content-type "application/javascript" \
  --acl public-read
```

O bucket é `gtm-templates` em `us-east-1`. URL pública: `https://gtm-templates.s3.us-east-1.amazonaws.com/sinatra-bundle.js`.

## Estrutura

- `sinatra.js` — código fonte
- `webpack.config.js` — bundling config (mode production, minify)
- `dist/sinatra-bundle.js` — output do webpack (gitignored)
- `.env` — credenciais AWS para o webpack-s3-plugin (gitignored)

Os testes ficam no diretório raiz do projeto (`../sinatra.test.js`), rodam com `npm test` lá.
