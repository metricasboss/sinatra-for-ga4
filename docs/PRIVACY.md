# Privacidade & LGPD — Sinatra for GA4

> Este documento descreve quais dados o template Sinatra coleta, encaminha e processa. Use como base para atualizar sua política de privacidade e seus contratos de tratamento de dados.

**Última atualização:** 2026-05-26

---

## Resumo

O template **Sinatra for Google Analytics 4** intercepta os mesmos hits que o GA4 já envia pelo navegador do visitante e replica esses dados para o endpoint `https://integrations.sinatra.pro/analytics/webhooks/events`. **Nenhum dado adicional é coletado além do que o GA4 já coleta.**

| Item | Quem é quem |
|---|---|
| **Controlador (data controller)** | Você / cliente que instala o template |
| **Operador (data processor)** | Sinatra (`integrations.sinatra.pro`) |
| **Subprocessador secundário** | Google (GA4) — recebe os mesmos hits independentemente |

---

## Dados coletados

O Sinatra encaminha o payload bruto (wire format) que o GA4 envia para `/g/collect`. Os campos abaixo podem estar presentes:

### Identificadores

| Campo | Descrição | Classificação LGPD |
|---|---|---|
| `cid` | Client ID — identificador persistente armazenado no cookie `_ga` | **Dado pessoal** |
| `sid` | Session ID — identificador de sessão (geralmente timestamp) | Dado pessoal |
| `tid` | Measurement ID do GA4 (ex: `G-XXXXXXXX`) | Não pessoal |
| `ecid` | Enhanced Conversions ID — hash de email/telefone se ativo | **Dado pessoal sensível** |
| IP da requisição | Vai no header HTTP, capturado pelo servidor | **Dado pessoal** |

### Contexto da sessão e página

| Campo | Descrição |
|---|---|
| `dl` | URL completa da página visitada |
| `dr` | URL de origem (referrer) |
| `dt` | Título da página |
| `ul` | Idioma do navegador |
| `ur` | Região do usuário (ex: BR-RJ) |
| `sr` | Resolução de tela |
| `sct` | Número da sessão |
| `seg` | Engajamento da sessão (0 ou 1) |
| `_p`, `_s`, `tfd` | IDs internos de pageload / sequência / tempo desde primeira interação |

### Device / browser (fingerprinting)

| Campo | Descrição |
|---|---|
| `uaa` | Arquitetura do processador (ex: arm) |
| `uab` | Bits do processador (32/64) |
| `uafvl` | Lista completa de UA brands+versões (User-Agent Client Hints) |
| `uam` | Modelo do device |
| `uamb` | Flag mobile |
| `uap` | Plataforma (ex: macOS, Windows) |
| `uapv` | Versão da plataforma |
| `uaw` | Flag WoW64 |

> **Recomendação:** Para clientes com perfil de risco LGPD mais alto, configure `excludeFields` com esses campos. Eles não são necessários para análise comportamental e contribuem para fingerprinting.

### Consent state (Consent Mode v2)

| Campo | Descrição |
|---|---|
| `gcs` | Status agregado (G100=denied, G111=granted, etc.) |
| `gcd` | Status detalhado por categoria |
| `npa` | Non-personalized ads (1 = restrito) |
| `dma` | Digital Markets Act flag |

### Server-side tagging metadata

| Campo | Descrição |
|---|---|
| `sst.etld` | Domínio efetivo para cookies first-party |
| `sst.tft`, `sst.lpc`, `sst.navt`, `sst.ude`, `sst.sw_exp` | Metadados internos do sGTM |

### Evento e parâmetros customizados

| Padrão | Descrição |
|---|---|
| `en` | Nome do evento (ex: `page_view`, `purchase`) |
| `ep.<nome>` | Parâmetro string custom enviado pelo site |
| `epn.<nome>` | Parâmetro numérico custom enviado pelo site |
| `pr<N>.<campo>` | Items de ecommerce (id, nome, preço, quantidade, categoria, etc.) |

> **Atenção:** `ep.user_id`, `ep.email_hash`, `ep.cpf`, ou qualquer custom param que o site emita pode conter PII. Reveja o que seu GTM está empurrando antes de habilitar o Sinatra.

---

## Bases legais (LGPD Art. 7º)

A base legal aplicável depende do tipo de tratamento que você faz com os dados encaminhados:

- **Consentimento (Art. 7º, I)** — recomendado se você coleta `cid`, `ecid` ou qualquer PII para personalização, remarketing, ou perfis comportamentais. Use o checkbox "Respeitar Google Consent Mode" no template.
- **Legítimo interesse (Art. 7º, IX)** — pode ser usado para análise agregada de tráfego desde que passe pelo teste de balanceamento. Documente.
- **Execução de contrato (Art. 7º, V)** — para eventos transacionais (`purchase`, `add_to_cart`, etc.) em contexto de e-commerce com cliente já contratado.

---

## Direitos do titular (Art. 18)

Você (controlador) precisa atender solicitações de:

- **Confirmação de tratamento** — confirmar que dados daquele `cid` existem
- **Acesso** — exportar os dados associados ao `cid`
- **Eliminação** — apagar todos os hits com aquele `cid` nos dois sistemas (GA4 + Sinatra)
- **Portabilidade** — fornecer em formato estruturado
- **Revogação de consentimento** — parar de receber novos hits daquele `cid`

> O backend do Sinatra deve expor endpoints administrativos para deleção por `cid` e por janela temporal. Consulte a equipe Sinatra.

---

## Configurações de compliance no template

O template expõe duas opções diretamente relacionadas à LGPD (em **Advanced Settings**):

### 1. Respeitar Google Consent Mode

Quando habilitado:
- Hits com `gcs` indicando `analytics_storage=denied` (cookieless pings) são **descartados** antes de chegar ao Sinatra
- Hits com consent granted seguem normalmente

**Quando habilitar:** sempre que o site implementa um banner de cookies/consent (OneTrust, Cookiebot, Iubenda, banner próprio, etc.).

### 2. Campos a excluir (data minimization)

Lista separada por vírgula de campos a remover do payload antes de enviar. Aceita wildcard com `*` no final.

**Presets recomendados:**

| Cenário | Lista sugerida |
|---|---|
| Reduzir fingerprinting | `uafvl, uaa, uab, uam, uamb, uap, uapv, uaw, sr` |
| Tirar metadata do sGTM | `sst.*` |
| Tirar enhanced conversions | `ecid` |
| Anonimizar mais agressivo (combinado) | `uafvl, uaa, uab, uam, uamb, uap, uapv, uaw, sr, sst.*, ecid, _p, _s` |

---

## O que você precisa fazer (checklist)

- [ ] Listar `integrations.sinatra.pro` na sua **política de privacidade** como operador de dados
- [ ] Ter um **contrato de tratamento de dados** assinado com o Sinatra (DPA)
- [ ] Documentar a base legal usada para cada tipo de evento
- [ ] Habilitar "Respeitar Google Consent Mode" se houver banner de consent
- [ ] Configurar `excludeFields` para minimizar dados conforme finalidade
- [ ] Documentar fluxo de eliminação por solicitação do titular
- [ ] Se o servidor Sinatra processa dados fora do Brasil, garantir mecanismo de transferência internacional (cláusulas-padrão da ANPD, decisão de adequação, ou consentimento específico)

---

## Trecho sugerido para política de privacidade

> **Compartilhamento de dados de uso com Sinatra**
>
> Utilizamos a tecnologia "Sinatra" da Métricas Boss para complementar nossa análise de comportamento dos visitantes. Os mesmos eventos que enviamos ao Google Analytics 4 são também encaminhados ao endpoint `integrations.sinatra.pro` para fins de análise interna e produto.
>
> Os dados encaminhados incluem identificadores anônimos (Client ID do GA4), informações de navegação (página visitada, referenciador, idioma), dados de device (resolução de tela, sistema operacional) e eventos de interação. Não compartilhamos seu nome, e-mail ou outros dados de cadastro com o Sinatra, exceto quando explicitamente configurado para envio de Enhanced Conversions.
>
> Você pode bloquear esse compartilhamento recusando os cookies de análise no nosso banner de consentimento. Para solicitar acesso, correção ou eliminação de seus dados, entre em contato com [DPO email].

---

## Contato

- **Dúvidas sobre o template:** [github.com/metricasboss/sinatra-for-ga4/issues](https://github.com/metricasboss/sinatra-for-ga4/issues)
- **Dúvidas sobre o serviço Sinatra:** equipe Métricas Boss
- **Dúvidas jurídicas / DPO:** consulte o jurídico da sua empresa
