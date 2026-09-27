/** @OnlyCurrentDoc */
// Google Apps Script — recebe pedidos do site, grava na planilha e envia e-mails.
// Deve ser criado a partir de Extensões > Apps Script dentro da planilha de pedidos.

const SHEET_NAME = "Pedidos";
const HEADERS = ["Data", "Produto", "Qtd", "Nome", "E-mail", "Telefone", "Preço unit.", "Status", "Observações"];
const LOJA = "Lojinha";
const MAX_POR_HORA = 15;  // pedidos verificados por hora (todos os clientes somados)
const MAX_POR_DIA = 40;   // cada pedido gera 2 e-mails; a cota gratuita é ~100/dia

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.acao === "frete") return json({ ok: true, opcoes: cotarFrete(d.cep, d.valor) });
    validate(d);
    verifyCaptcha(d.token);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      throttle(d.email);
      checkGlobalLimit();
      const sheet = getSheet();
      sheet.appendRow([new Date(), d.produto, d.quantidade, d.nome, d.email, d.telefone, d.preco == null ? "" : d.preco, "Novo", ""]);
      sheet.getRange(sheet.getLastRow(), 7).setNumberFormat('"R$" #,##0.00');
    } finally { lock.releaseLock(); }

    const owner = Session.getEffectiveUser().getEmail();
    const itens = "Produto: " + d.produto + "\nQuantidade: " + d.quantidade +
      "\nPreço unitário: " + (d.preco == null ? "sob consulta" : brl(d.preco)) +
      (d.preco == null ? "" : "\nTotal: " + brl(d.preco * d.quantidade));
    const resumo = itens + "\nNome: " + d.nome + "\nE-mail: " + d.email + "\nTelefone: " + d.telefone;

    MailApp.sendEmail({ to: owner, replyTo: d.email, subject: "Novo pedido: " + d.produto + " (" + d.nome + ")",
      body: resumo + "\n\nPlanilha: " + SpreadsheetApp.getActive().getUrl() });

    MailApp.sendEmail({ to: d.email, name: LOJA, replyTo: owner, subject: "Recebemos sua encomenda — " + d.produto,
      body: "Olá, " + d.nome + "!\n\nRecebemos sua encomenda:\n\n" + itens +
        "\n\nEntrarei em contato em breve pelo telefone/e-mail informado para combinar produção, prazo e pagamento.\n\n" + LOJA });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }
}

function validate(d) {
  const s = v => typeof v === "string" && v.length > 0 && v.length <= 200;
  if (!s(d.nome) || !s(d.email) || !s(d.telefone) || !s(d.produto)) throw new Error("dados inválidos");
  if (!/^\S+@\S+\.\S+$/.test(d.email)) throw new Error("e-mail inválido");
  const q = Number(d.quantidade);
  if (!(q >= 1 && q <= 20)) throw new Error("quantidade inválida");
  d.quantidade = q;
  if (d.preco != null && !(typeof d.preco === "number" && isFinite(d.preco) && d.preco >= 0 && d.preco < 1000000)) throw new Error("preço inválido");
}

function brl(n) {
  return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Confere o token do Cloudflare Turnstile. A chave secreta fica em
// Configurações do projeto > Propriedades do script > TURNSTILE_SECRET.
// Domínios em que o token pode ter sido gerado. A propriedade do script
// TURNSTILE_HOSTNAMES (lista separada por vírgula) substitui este padrão —
// ex.: "lucasleal.dev,localhost" para testar localmente.
const TURNSTILE_ACTION = "pedido";
const TURNSTILE_HOSTNAMES_PADRAO = "lucasleal.dev";

function verifyCaptcha(token) {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty("TURNSTILE_SECRET");
  if (!secret) throw new Error("captcha não configurado");
  if (typeof token !== "string" || !token || token.length > 2048) throw new Error("captcha");
  const res = UrlFetchApp.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "post", payload: { secret: secret, response: token }, muteHttpExceptions: true
  });
  let r = {};
  try { r = JSON.parse(res.getContentText()); } catch (e) {}
  const hosts = (props.getProperty("TURNSTILE_HOSTNAMES") || TURNSTILE_HOSTNAMES_PADRAO).split(",").map(h => h.trim()).filter(Boolean);
  if (r.success !== true || r.action !== TURNSTILE_ACTION || (hosts.length && hosts.indexOf(r.hostname) === -1)) {
    throw new Error("captcha");
  }
}

// Estimativa de frete pelo Melhor Envio. O token fica em
// Configurações do projeto > Propriedades do script > MELHORENVIO_TOKEN.
// Todos os produtos usam a mesma caixa (cm / kg), cotada para 1 unidade.
const FRETE_CEP_ORIGEM = "12286410";
const FRETE_CAIXA = { width: 16, height: 11, length: 25, weight: 0.3 };
const MAX_COTACOES_POR_HORA = 300;

function cotarFrete(cep, valor) {
  cep = String(cep || "").replace(/\D/g, "");
  if (cep.length !== 8) throw new Error("cep inválido");
  valor = Number(valor);
  if (!(isFinite(valor) && valor >= 0 && valor <= 1000)) valor = 0;
  const cache = CacheService.getScriptCache(), key = "f3_" + cep + "_" + Math.round(valor);
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const hKey = "fh_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHH");
  const n = Number(cache.get(hKey)) || 0;
  if (n >= MAX_COTACOES_POR_HORA) throw new Error("limite");
  cache.put(hKey, String(n + 1), 3600);

  const token = PropertiesService.getScriptProperties().getProperty("MELHORENVIO_TOKEN");
  if (!token) throw new Error("frete não configurado");
  const res = UrlFetchApp.fetch("https://melhorenvio.com.br/api/v2/me/shipment/calculate", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json",
      "User-Agent": LOJA + " (" + Session.getEffectiveUser().getEmail() + ")" },
    payload: JSON.stringify({ from: { postal_code: FRETE_CEP_ORIGEM }, to: { postal_code: cep },
      package: FRETE_CAIXA, options: { insurance_value: valor, receipt: false, own_hand: false } })
  });
  let r;
  try { r = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() !== 200 || !Array.isArray(r)) throw new Error("frete indisponível");
  const opcoes = r.filter(o => !o.error && o.price)
    .map(o => ({ servico: (o.company && o.company.name ? o.company.name + " " : "") + o.name,
      preco: Number(o.custom_price || o.price), prazo: Number(o.custom_delivery_time || o.delivery_time) || null }))
    .sort((a, b) => a.preco - b.preco).slice(0, 5);
  cache.put(key, JSON.stringify(opcoes), 21600);
  return opcoes;
}

// Teto global de pedidos por hora e por dia (protege a cota de e-mails)
function checkGlobalLimit() {
  const props = PropertiesService.getScriptProperties();
  const tz = Session.getScriptTimeZone(), now = new Date();
  const hKey = "h_" + Utilities.formatDate(now, tz, "yyyyMMddHH");
  const dKey = "d_" + Utilities.formatDate(now, tz, "yyyyMMdd");
  const h = Number(props.getProperty(hKey)) || 0, d = Number(props.getProperty(dKey)) || 0;
  if (h >= MAX_POR_HORA || d >= MAX_POR_DIA) throw new Error("limite");
  const all = props.getProperties();
  Object.keys(all).forEach(k => { if (/^[hd]_/.test(k) && k !== hKey && k !== dKey) props.deleteProperty(k); });
  props.setProperty(hKey, String(h + 1));
  props.setProperty(dKey, String(d + 1));
}

// Limita a 1 pedido por e-mail a cada 60 s (anti-spam simples)
function throttle(email) {
  const cache = CacheService.getScriptCache(), key = "t_" + email.toLowerCase();
  if (cache.get(key)) throw new Error("aguarde um instante");
  cache.put(key, "1", 60);
}

function getSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sh.getRange(2, 8, 500).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(["Novo", "Em contato", "Em produção", "Pronto", "Entregue", "Cancelado"], true).build());
  }
  return sh;
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Rodar UMA vez manualmente no editor (menu de funções > autorizar > Executar)
// para conceder todas as permissões que o script usa. Não altera nada.
function autorizar() {
  UrlFetchApp.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "post", muteHttpExceptions: true });
  MailApp.getRemainingDailyQuota();
  Logger.log("Planilha: " + SpreadsheetApp.getActive().getName() + " — permissões OK");
}
