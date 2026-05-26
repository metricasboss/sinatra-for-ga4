# Sinatra for Google Analytics 4 — Métricas Boss

Replica eventos do GA4 para um endpoint personalizado. Disponível em duas versões: **web** (client-side) e **server-side**.

![template](https://imagens.metricasboss.com.br/image_7fe387523b.png)

---

## Qual versão usar?

| | Web (`sinatra.tpl`) | Server-Side (`sinatra-server.tpl`) |
|---|---|---|
| **Método de envio para o Sinatra** | GET com wire format na query string | POST JSON via `sendHttpRequest` |
| **Requisito** | Qualquer container web GTM | Server-side GTM container |
| **Como funciona** | Monkey-patch em `window.fetch` / `navigator.sendBeacon` / `XMLHttpRequest` para interceptar hits `/g/collect` | Recebe o evento no client GA4 do sGTM e encaminha o payload |
| **Dados capturados** | Wire format bruto do GA4 (todos os params da URL + body) | Payload completo via `getAllEventData()` |
| **Fidelidade ao GA4** | Máxima — é o mesmo hit que o GA4 envia | Máxima — é o mesmo hit que chegou ao servidor |
| **Latência** | Nenhuma — captura no momento do hit | Mínima — processamento server-side |
| **Cobertura com sGTM ativo** | Limitada (ver "Limitações" abaixo) | Total |
| **Instalação** | Simples, funciona em qualquer setup | Requer sGTM configurado com GA4 client |
| **Custo extra** | Nenhum | Hosting do server container |

**Use a versão web** se o cliente não tem server-side GTM ou quer começar rápido.

**Use a versão server-side** se o cliente já tem sGTM ou quer capturar 100% dos eventos sem depender de interceptação no browser.

---

## Versão Web — `sinatra.tpl`

### Como funciona

A tag injeta um script externo (`sinatra.js`) no browser via `injectScript`. Esse script:

1. Lê a configuração salva em `window.__sinatra`
2. Faz monkey-patch em `window.fetch`, `navigator.sendBeacon` e `XMLHttpRequest`
3. Intercepta requisições para `/g/collect` com `tid=G-*` (qualquer endpoint GA4: `google-analytics.com` ou sGTM custom)
4. Mergeia URL params + body URL-encoded → params object
5. Encaminha como **GET** para `integrations.sinatra.pro/analytics/webhooks/events` com **todos os params do wire format intactos** + `account_id` e `token`

Zero transformação. O backend recebe o mesmo conjunto de chaves que o GA4 enviaria (`v`, `tid`, `cid`, `en`, `sid`, `sct`, `seg`, `dl`, `dr`, `dt`, `ul`, `sr`, `ep.*`, `epn.*`, `pr1.*`, `uap`, `uapv`, `ur`, `gcd`, `npa`, `dma`, `ecid`, etc.).

### Configuração

| Campo | Obrigatório | Descrição |
|---|---|---|
| **Account ID** | Sim | Identificador da conta no Sinatra (ex: `metricasboss`) |
| **Token** | Sim | Token de autenticação da conta |
| **GA4 Measurement ID** | Não | Fallback caso o hit não contenha `tid` |
| **Habilitar logs no console** | Não | Liga logs `[Sinatra]` detalhados (use só em debug; ver "Segurança") |
| **Respeitar Google Consent Mode** | Não | Descarta hits com `analytics_storage=denied` antes de enviar — necessário se o site tem banner de consent (LGPD/GDPR) |
| **Campos a excluir** | Não | Lista de campos a remover do wire format antes de enviar (data minimization). Aceita wildcard `*` no final |

### Trigger recomendado

**Initialization - All Pages.** O monkey-patch precisa estar ativo antes de qualquer hit do GA4 ser disparado.

> Configure em **Initialization**, não em All Pages — o script tem que estar carregado antes do primeiro hit.

### Como o script é carregado

O `sinatra.js` é injetado uma única vez por página via `injectScript` (GTM faz cache por URL). A partir daí, qualquer hit do GA4 naquela página é automaticamente replicado — sem precisar vincular o Sinatra aos mesmos triggers do GA4.

### Limitações

**Setups com `server_container_url` configurado (sGTM em first-party):** o Google injeta um `sw_iframe.html` cross-origin que envia os hits subsequentes a partir do origin do sGTM (`*.run.app` ou domínio customizado). Como o iframe roda numa origin diferente da página, nosso patch em `window.fetch` não alcança esses requests. Resultado: capturamos o primeiro `page_view` mas perdemos os hits de engajamento e ecommerce subsequentes.

**Solução:** use a versão **server-side** quando o cliente tem sGTM.

---

## Versão Server-Side — `sinatra-server.tpl`

### Como funciona

Roda no server-side GTM container, dispara em todo evento que chega no client GA4 e captura o payload completo via `getAllEventData()`. Envia via POST para o endpoint.

### Configuração

| Campo | Obrigatório | Descrição |
|---|---|---|
| **Account ID** | Sim | Identificador da conta no Sinatra |
| **Token** | Sim | Token de autenticação |
| **GA4 Measurement ID** | Não | ID da propriedade GA4 (G-XXXXXXXX) |
| **Request timeout (ms)** | Não | Timeout da requisição POST (padrão: 5000ms) |

### Pré-requisito

O server-side GTM container precisa ter o **GA4 client** configurado. Fluxo:

```
Browser → sGTM container → GA4 client processa
                         → Sinatra tag replica via POST → integrations.sinatra.pro
                         → GA4 tag encaminha para Google
```

---

## LGPD e privacidade

O Sinatra encaminha os mesmos dados que o GA4 coleta. Se você usa Sinatra, **você precisa**:

1. Listar `integrations.sinatra.pro` como operador na sua política de privacidade
2. Ter contrato de tratamento de dados (DPA) com a Métricas Boss
3. Configurar consent + data minimization conforme finalidade

### Configurações de compliance disponíveis no template

**Respeitar Google Consent Mode** — quando ativo, hits com `gcs` indicando `analytics_storage=denied` (cookieless pings do Consent Mode v2) são descartados antes de chegar ao Sinatra. Habilite sempre que o site tiver banner de consent (OneTrust, Cookiebot, banner próprio, etc.).

**Campos a excluir (data minimization)** — lista separada por vírgula, aceita wildcard `*` no final. Presets úteis:

| Cenário | Lista sugerida |
|---|---|
| Reduzir fingerprinting | `uafvl, uaa, uab, uam, uamb, uap, uapv, uaw, sr` |
| Tirar metadata do sGTM | `sst.*` |
| Tirar enhanced conversions | `ecid` |
| Anonimização agressiva | `uafvl, uaa, uab, uam, uamb, uap, uapv, uaw, sr, sst.*, ecid, _p, _s` |

📄 **Documentação completa de privacidade:** [`docs/PRIVACY.md`](docs/PRIVACY.md) — catalogação de cada campo, bases legais, fluxo de direitos do titular e trecho pronto pra colar em política de privacidade.

---

## Instalação

1. No GTM, vá em **Templates > Novo**
2. Clique em **importar** e selecione o arquivo `.tpl` correspondente
3. Salve o template
4. Crie uma nova **Tag** usando o template
5. Configure os campos obrigatórios (Account ID e Token)
6. Configure o trigger:
   - Web: **Initialization - All Pages**
   - Server-side: **All Events**
7. Em produção, **mantenha "Habilitar logs no console" desmarcado**
8. Teste em **Preview Mode** (pode ligar o debug temporariamente)
9. Publique

---

## Desenvolvimento

```bash
# Testes (root)
npm test

# Build do bundle web
cd inject-script
npm run build

# Deploy para S3 (precisa de credenciais AWS no .env)
npm run deploy
```

Mais detalhes do inject-script em [`inject-script/readme.md`](inject-script/readme.md).

---

## Segurança

- O `token` é transmitido como query param tanto na versão web (GET) quanto server-side (POST). Use HTTPS sempre, prefira tokens rotacionáveis curtos, e considere rate limit + IP allowlist no backend.
- Em produção, deixe a opção "Habilitar logs no console" **desmarcada**. Quando marcada, URLs interceptadas do GA4 aparecem no DevTools — incluindo PII que esteja em `ep.*`.

---

**Desenvolvido por [Métricas Boss](https://metricasboss.com.br)**
