# Shape do payload — o que o backend Sinatra recebe

> Referência pra equipe do backend planejar parsing, validação e armazenamento dos hits que chegam em `/analytics/webhooks/events`.

**Última atualização:** 2026-06-08

---

## TL;DR

- **Método:** GET ou POST (espelha o que o browser enviou pro sGTM / GA4 endpoint)
- **Content-Type (em POST):** `text/plain;charset=UTF-8` (sendBeacon do browser)
- **Auth:** sempre na query string — `?account_id=<workspace>&token=<token>`
- **Dados do hit:** todos os params do wire format GA4 (`/g/collect`) anexados à query string ou no body
- **Volume típico:** 30-50 params por hit; payload total ~2-4 KB

---

## Exemplo real (evento `view_promotion`)

### Request que chega no Sinatra

```
GET /analytics/webhooks/events
  ?account_id=metricasboss
  &token=<token>
  &v=2
  &tid=G-S04J9NY9T4
  &cid=1196176808.1780772543
  &sid=1780924007
  &sct=2
  &seg=1
  &en=view_promotion
  &dl=https%3A%2F%2Fwww.lojastorra.com.br%2F
  &dr=https%3A%2F%2Ftagassistant.google.com%2F
  &dt=Lojas%20Torra%3A%20moda%20casual...
  &ul=pt-br
  &sr=3840x1080
  &gcs=G111
  &gcd=13r3v3r3r5l1
  &ep.ecomm_pagetype=home
  &ep.promotion_name=jeans%20leve%203%20pague2_rotativo2
  &ep.location_id=Top_Full_Banner
  &sst.etld=google.com.br
  &sst.tft=1780926819962
  &sst.lpc=199104562
  &sst.navt=n
  &sst.ude=1
  &sst.sw_exp=1
  &uap=macOS
  &uapv=26.3.1
  &uaa=arm
  &uab=64
  &ur=BR-RJ
  ...
```

### Representação semântica (após parsing)

```jsonc
{
  // === Identificadores ===
  "tid": "G-S04J9NY9T4",                      // GA4 Measurement ID
  "cid": "1196176808.1780772543",             // Client ID (cookie _ga)
  "sid": "1780924007",                        // Session ID

  // === Sessão ===
  "sct": "2",                                 // Session count (2ª sessão)
  "seg": "1",                                 // Session engaged (bool)
  "_et": "1159",                              // Engagement time (ms)
  "tfd": "9473",                              // Time from first interaction (ms)

  // === Evento ===
  "en": "view_promotion",                     // Event name
  "_p": "1780926819962",                      // Page load ID
  "_s": "17",                                 // Hit sequence number
  "_tu": "BA",                                // Internal tracking flag

  // === Página ===
  "dl": "https://www.lojastorra.com.br/...",  // Document location
  "dr": "https://tagassistant.google.com/",   // Document referrer
  "dt": "Lojas Torra: moda casual...",        // Document title

  // === Browser / locale ===
  "ul": "pt-br",                              // User language
  "ur": "BR-RJ",                              // User region
  "sr": "3840x1080",                          // Screen resolution
  "v": "2",                                   // Protocol version

  // === Device / UA Client Hints ===
  "uaa": "arm",                               // Architecture
  "uab": "64",                                // Bits
  "uafvl": "Chromium;148...|Google Chrome...", // Full brand list
  "uam": "",                                  // Model
  "uamb": "0",                                // Is mobile
  "uap": "macOS",                             // Platform
  "uapv": "26.3.1",                           // Platform version
  "uaw": "0",                                 // WoW64

  // === Consent (Google Consent Mode v2) ===
  "gcs": "G111",                              // Consent status agregado
  "gcd": "13r3v3r3r5l1",                      // Consent detalhado
  "npa": "0",                                 // Non-personalized ads
  "dma": "0",                                 // DMA flag

  // === sGTM system properties (objeto aninhado) ===
  "sst": {
    "etld": "google.com.br",
    "tft": "1780926819962",
    "lpc": "199104562",
    "navt": "n",                              // navigation type
    "ude": "1",
    "sw_exp": "1",
    "rnd": "900575694.1780926821"             // random fingerprint
  },

  // === Custom event params (objeto aninhado, prefixo ep.) ===
  "ep": {
    "ecomm_pagetype": "home",
    "promotion_name": "jeans leve 3 pague2_rotativo2",
    "promotion_id": "",
    "location_id": "Top_Full_Banner",
    "creative_name": "",
    "creative_slot": "",
    "ga4_event": "true"
  },

  // === Numeric custom params (objeto aninhado, prefixo epn.) ===
  "epn": {
    "value": 99.90                            // exemplo — não está no hit acima
  },

  // === Items de ecommerce (array, prefixo pr1., pr2., ...) ===
  "items": [                                  // exemplo de purchase
    {
      "id": "SKU001",
      "nm": "Tênis Bebê Molekinho Branco",
      "pr": 99.90,
      "qt": 1,
      "ca": "Calçados",
      "br": "Molekinho"
    }
  ],

  // === Outros flags do GA4 SDK ===
  "_dbg": "1",                                // Debug mode
  "_eu": "IAAAAGQ",                           // Event params bitmask
  "_tu": "BA",                                // Test/preview marker
  "are": "1",                                 // App report enabled
  "frm": "0",                                 // From iframe
  "pscdl": "noapi",                           // Privacy Sandbox CDL
  "rcb": "16",                                // Retry counter
  "gaf": "2",                                 // GA features bitmask
  "ec_mode": "c",                             // Enhanced conversions mode
  "ecid": "1158796093",                       // Enhanced conv. ID (hash PII)
  "gdid": "dZmNiZj",                          // Google Display ID
  "gtm": "45je6631v9190056522...",            // GTM container fingerprint
  "tag_exp": "0~115938465~115938469~...",     // Tag experiments
  "richsstsse": ""                            // SSE rich feature flag
}
```

---

## Categorias de campos

### 🔑 Identificadores (PII-sensitive)
| Campo | Descrição | Tratamento |
|---|---|---|
| `cid` | Client ID persistente (cookie `_ga`) | **Sempre presente.** Pode ser usado pra atribuição. Tratar como pseudo-anônimo. |
| `sid` | Session ID | Presente em ~100% dos hits. |
| `uid` | User ID | Só presente se o site configurou. Pode ser email-hash, ID logado, etc. |
| `ecid` | Enhanced Conversion ID | Hash de email/telefone. **PII sensível.** |
| `ip` (implícito) | IP do cliente (no header HTTP) | Capturado server-side. |

### 📍 Contexto (página + sessão)
| Campo | Descrição |
|---|---|
| `dl`, `dr`, `dt` | URL, referrer, título da página |
| `ul`, `ur` | Idioma e região do usuário |
| `sr` | Resolução de tela |
| `sct` | Número da sessão |
| `seg` | Engajamento da sessão |
| `_et` | Tempo de engajamento (ms) |
| `tfd` | Tempo desde primeira interação (ms) |

### 🎯 Evento
| Campo | Descrição |
|---|---|
| `en` | Nome do evento (`page_view`, `purchase`, `view_item`, etc.) |
| `ep.*` | Custom params string (objeto aninhado após parsing) |
| `epn.*` | Custom params numéricos (objeto aninhado) |
| `pr1.*`, `pr2.*` | Items de ecommerce (parseiam pra array `items`) |

### 🛡️ Consent & compliance
| Campo | Descrição | Valor recomendado |
|---|---|---|
| `gcs` | `G1<ad><analytics>` — G111 = ambos granted | Pode ser usado pra filtrar no backend também (defense-in-depth) |
| `gcd` | Detalhe por categoria | Para auditoria de consent state |
| `npa` | Non-personalized ads (1 = restrito) | |
| `dma` | Digital Markets Act flag | |

### 🖥️ Device / browser fingerprinting
| Campo | Descrição |
|---|---|
| `uap`, `uapv` | Plataforma (macOS, Windows) e versão |
| `uaa`, `uab` | Arquitetura e bits do processador |
| `uafvl` | Lista completa de UA Client Hints (brand+version) |
| `uam`, `uamb` | Modelo e flag mobile |
| `uaw` | WoW64 |

> **Atenção LGPD:** esses campos juntos formam um fingerprint razoavelmente único. Considerar excluir/agregar se o cliente tem perfil de compliance mais rigoroso.

### 🔧 sGTM metadata (campos `sst.*`)
Aninhados em `sst: {}` após parsing. São metadados internos do server-side GTM (effective TLD, last page change, navigation type, sandbox worker experiment, etc.). **Não são necessários pra análise comportamental** — podem ser descartados.

### 🤖 Flags internos do GA4 SDK (não documentados)
`_dbg`, `_eu`, `_tu`, `_p`, `_s`, `_et`, `tfd`, `are`, `frm`, `pscdl`, `rcb`, `gaf`, `gtm`, `tag_exp`, `richsstsse`, `ec_mode`, `gdid`.

São fingerprints internos e flags de processamento do Google. Não têm interpretação clara no nosso lado. Recomendação: armazenar mas não modelar.

---

## Variações por tipo de evento

### `page_view` (e auto-events: `scroll`, `click`, `first_visit`, `session_start`)
- Sem `ep.*` / `epn.*` / `items`
- ~30 params totais

### `view_promotion`, `view_item_list`
- Tem `ep.*` com `promotion_name`, `location_id`, `creative_name`, etc.
- Sem `items[]` na maioria dos casos
- ~35-45 params

### `view_item`, `add_to_cart`
- Tem `items[]` (geralmente 1 item)
- Tem `ep.currency` ou `epn.value`
- ~45-55 params

### `purchase`
- Tem `items[]` (1 a N items, pode passar de 20 em pedidos grandes)
- Tem `ep.transaction_id`, `epn.value`, `epn.tax`, `epn.shipping`, `ep.currency`, `ep.coupon`
- ~60-100+ params dependendo do número de items
- **Payload pode passar de 8 KB facilmente** → planejar limite de URL

---

## Considerações de implementação

### Idempotência
Use `cid + _p + _s` como chave de deduplicação se quiser garantir at-most-once delivery. O `_s` é o hit sequence dentro do mesmo pageload (`_p`), então o trio é único por hit.

### Ordenação
Os hits podem chegar **fora de ordem** — `_s=5` pode chegar antes de `_s=3` se um foi retry. Use `_s` ou `tfd` pra reordenar se necessário.

### Volume
Em loja média de e-commerce, espera ~50-100 hits por sessão. Multiplicar pelo MAU para dimensionar.

### Timeout
Cliente envia com timeout default de 5000ms (configurável no template). Backend tem que responder rápido — `200 OK` com body curto.

### Códigos de resposta esperados
- `200 OK` — recebido com sucesso
- `400 Bad Request` — params inválidos (falta `account_id` ou `token`)
- `401/403` — autenticação inválida
- `4xx/5xx` — cliente vai chamar `gtmOnFailure()` e GTM marca como erro no Debug

### Não responder com headers grandes
Os clientes não usam o body da resposta. Manter body pequeno (`{"status":"OK"}` é suficiente).
