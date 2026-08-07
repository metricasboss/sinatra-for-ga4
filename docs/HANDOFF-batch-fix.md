# Handoff — fix de eventos batchados perdidos (session_start, first_visit)

> Pra equipe do fork [`sinatrapro/sinatra-for-ga`](https://github.com/sinatrapro/sinatra-for-ga) aplicar o mesmo patch no bundle hospedado em `ga.sinatra.pro`.

**Data:** 2026-08-07
**Commit:** [`ffcc571`](https://github.com/metricasboss/sinatra-for-ga4/commit/ffcc571)
**Status:** já em produção no bucket S3 do Métricas Boss (`gtm-templates.s3.us-east-1.amazonaws.com/sinatra-bundle.js`)

---

## O bug

O `gtag.js` agrupa (batch) múltiplos eventos que disparam próximos no tempo — o caso mais comum é `page_view` + `session_start` + `first_visit` na primeira visita da sessão — em um único POST para `/g/collect`. O body desse POST tem **um evento por linha**, separadas por `\n`, compartilhando os params comuns (cid, sid, tid, etc.) que ficam só na query string da URL:

```
en=page_view&dl=https://site.com...
en=session_start&_ss=1
en=first_visit&_fv=1
```

O `mergeParams` antigo tratava o body inteiro como uma única query string (`split('&')`), sem considerar o `\n`. Resultado: qualquer evento que não fosse o primeiro token da string acabava grudado como valor de outro campo (ex: `dl=xyz\nen=session_start`) em vez de virar um hit próprio.

**Impacto prático:** quando `session_start` chegava batchado junto com `page_view` (o caso comum na primeira visita), ele nunca era enviado como um evento próprio pro Sinatra — os dados ficavam corrompidos dentro do valor de outro campo.

---

## O fix

Duas funções novas em `inject-script/params.js`:

- **`splitBatchBody(body)`** — separa o body por `\n`, ignora linhas em branco, retorna um array de strings (uma por evento).
- **`mergeParamsBatch(url, body)`** — pra cada linha do batch, mescla os params comuns da URL com os params daquela linha específica, retornando um array de objetos de params (um por evento).

Os três pontos de interceptação em `inject-script/sinatra.js` (`fetch`, `sendBeacon`, `XHR`) agora chamam `mergeParamsBatch` em vez de `mergeParams`, e enviam **um `sendRaw` por evento do batch** — em vez de um único hit achatado.

### Diff resumido

```diff
- function mergeParams(url, body) {
-   var merged = ...;               // 1 objeto achatado, ignora \n no body
-   return merged;
- }

+ function splitBatchBody(body) {
+   // split por \n, remove linhas em branco
+ }
+
+ function mergeParamsBatch(url, body) {
+   // 1 objeto por linha do batch, cada um com os params comuns da URL
+   return splitBatchBody(body).map(...);
+ }
```

Nos intercepts:

```diff
- var params = mergeParams(url, bodyStr);
- sendRaw(params, config);
+ var batch = mergeParamsBatch(url, bodyStr);
+ for (var i = 0; i < batch.length; i++) sendRaw(batch[i], config);
```

Diff completo em: https://github.com/metricasboss/sinatra-for-ga4/commit/ffcc571

---

## Como aplicar no fork

1. Puxar `inject-script/params.js` e `inject-script/sinatra.js` do commit `ffcc571` (ou reimplementar a mesma lógica de split-por-linha no bundle de vocês).
2. Recompilar e subir o bundle atualizado pra `ga.sinatra.pro/sinatra-bundle.js`.
3. Validar em GTM Preview Mode: disparar uma página nova (sessão limpa) e confirmar que o Sinatra recebe **hits separados** com `en=page_view`, `en=session_start` e `en=first_visit` — não só o `page_view`.

## Testes

31 testes cobrindo o cenário de batch em `sinatra.batch.test.js` (repo `metricasboss/sinatra-for-ga4`), incluindo:
- 1 evento único (não regressão)
- 2 eventos batchados (`page_view` + `session_start`)
- 3 eventos batchados (`page_view` + `session_start` + `first_visit`)
- body vazio / linhas em branco

---

## Contato

Dúvidas sobre o fix: equipe Métricas Boss.
