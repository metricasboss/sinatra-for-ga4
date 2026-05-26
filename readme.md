# Sinatra for Google Analytics 4 — Métricas Boss

Replica eventos do GA4 para um endpoint personalizado. Disponível em duas versões: **web** (client-side) e **server-side**.

![template](https://imagens.metricasboss.com.br/image_7fe387523b.png)

---

## Qual versão usar?

| | Web (`sinatra.tpl`) | Server-Side (`sinatra-server.tpl`) |
|---|---|---|
| **Método de envio** | POST (sendBeacon/XHR) | POST (sendHttpRequest) |
| **Requisito** | Qualquer container web GTM | Server-side GTM container |
| **Como funciona** | Intercepta os hits do GA4 via fetch/sendBeacon | Captura o payload completo no servidor |
| **Dados capturados** | Hit byte-a-byte: todos os params que o GA4 envia | Payload completo recebido pelo container |
| **Fidelidade ao GA4** | Máxima — é o mesmo hit que o GA4 envia | Máxima — é o mesmo hit que chegou ao servidor |
| **Latência** | Nenhuma — captura no momento do hit | Mínima — processamento server-side |
| **Instalação** | Simples, funciona em qualquer setup | Requer sGTM configurado com GA4 client |
| **Custo extra** | Nenhum | Hosting do server container |

**Use a versão web** se o cliente não tem server-side GTM ou quer começar rápido.

**Use a versão server-side** se o cliente já tem sGTM ou quer o payload exato que o GA4 recebe no servidor.

---

## Versão Web — `sinatra.tpl`

### Como funciona

A tag injeta um script externo (`sinatra.js`) no browser via `injectScript`. Esse script:

1. Lê a configuração salva em `window.__sinatra` (account_id, token, measurement_id)
2. Faz monkey-patch em `window.fetch` e `navigator.sendBeacon`
3. Intercepta todas as requisições para `google-analytics.com/g/collect`
4. Extrai os parâmetros do hit (URL + body)
5. Envia para o endpoint Sinatra via POST no formato GA4 Measurement Protocol

### Campos capturados

Por interceptar o hit diretamente, captura **todos** os campos que o GA4 envia — incluindo os coletados pelo browser que não estão no dataLayer:

```json
{
  "client_id": "111111111.222222222",
  "measurement_id": "G-XXXXXXXX",
  "account_id": "seu-account-id",
  "timestamp_micros": 1700000000000000,
  "events": [{
    "name": "purchase",
    "params": {
      "session_id": "1700000000",
      "session_number": 3,
      "page_location": "https://loja.com/checkout",
      "page_referrer": "https://google.com",
      "page_title": "Checkout",
      "language": "pt-br",
      "screen_resolution": "1920x1080",
      "session_engaged": 1,
      "transaction_id": "T123",
      "value": 99.90,
      "currency": "BRL",
      "items": [...]
    }
  }]
}
```

### Configuração

| Campo | Obrigatório | Descrição |
|---|---|---|
| **Account ID** | Sim | Identificador da conta no Sinatra (ex: `metricasboss`) |
| **Token** | Sim | Token de autenticação da conta |
| **GA4 Measurement ID** | Não | Fallback caso o hit não contenha o campo `tid` (raro) |

### Trigger recomendado

Configure para disparar em **Initialization - All Pages**. Isso garante que o monkey-patch esteja ativo antes de qualquer hit do GA4 ser enviado.

> **Importante:** Configure o trigger em Initialization, não em All Pages. O script precisa estar carregado antes do primeiro hit do GA4.

### Como o script é carregado

O `sinatra.js` é injetado uma única vez por página via `injectScript` (GTM faz cache por URL). A partir daí, qualquer hit do GA4 naquela página é automaticamente replicado para o Sinatra — sem precisar vincular o Sinatra aos mesmos triggers do GA4.

---

## Versão Server-Side — `sinatra-server.tpl`

### Como funciona

Roda no server-side GTM container após o GA4 client processar o hit recebido do browser. Usa `getAllEventData()` para capturar o payload completo e envia via POST para o endpoint configurado.

### Payload

Mesmo formato GA4 Measurement Protocol, com `timestamp_micros` incluído e todos os campos disponíveis no evento server-side:

```json
{
  "client_id": "111111111.222222222",
  "measurement_id": "G-XXXXXXXX",
  "account_id": "seu-account-id",
  "timestamp_micros": 1700000000000000,
  "events": [{
    "name": "purchase",
    "params": {
      "event_name": "purchase",
      "client_id": "111111111.222222222",
      "currency": "BRL",
      "value": 99.90,
      "transaction_id": "T123",
      "items": [...],
      ...
    }
  }]
}
```

### Configuração

| Campo | Obrigatório | Descrição |
|---|---|---|
| **Account ID** | Sim | Identificador da conta no Sinatra (ex: `metricasboss`) |
| **Token** | Sim | Token de autenticação da conta |
| **GA4 Measurement ID** | Não | ID da propriedade GA4 (G-XXXXXXXX) |
| **Request timeout (ms)** | Não | Timeout da requisição POST (padrão: 5000ms) |

### Pré-requisito

O server-side GTM container precisa ter o **GA4 client** configurado para receber os hits do browser. O fluxo é:

```
Browser → sGTM container → GA4 client processa
                         → Sinatra tag replica via POST → seu endpoint
                         → GA4 tag encaminha para Google
```

### Reenvio para o GA4

Como o payload já está no formato Measurement Protocol, seu servidor pode reencaminhar para o GA4 adicionando apenas o `api_secret`:

```
POST https://www.google-analytics.com/mp/collect?measurement_id=G-XXXX&api_secret=XXXX
Body: { o mesmo payload recebido }
```

---

## Instalação

1. No GTM, vá em **Templates > Novo**
2. Clique em **importar** e selecione o arquivo `.tpl` correspondente
3. Salve o template
4. Crie uma nova **Tag** usando o template instalado
5. Configure os campos obrigatórios (Account ID e Token)
6. Configure o trigger:
   - Web: **Initialization - All Pages**
   - Server-side: **All Events**
7. Teste em **Preview Mode**
8. Publique

---

## Segurança do endpoint receptor

O endpoint que receber os eventos deve:
- Aceitar requisições POST com `Content-Type: application/json`
- Validar o `account_id` e `token` nos query params
- Usar HTTPS

---

**Desenvolvido por [Métricas Boss](https://metricasboss.com.br)**
