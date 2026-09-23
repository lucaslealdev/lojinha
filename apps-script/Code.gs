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
    validate(d);
    verifyCaptcha(d.token);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      throttle(d.email);
      checkGlobalLimit();
      const sheet = getSheet();
      sheet.appendRow([new Date(), d.produto, d.quantidade, d.nome, d.email, d.telefone, d.preco == null ? "" : d.preco, "Novo", ""]);
    } finally { lock.releaseLock(); }

    const owner = Session.getEffectiveUser().getEmail();
    const resumo = "Produto: " + d.produto + "\nQuantidade: " + d.quantidade +
      "\nNome: " + d.nome + "\nE-mail: " + d.email + "\nTelefone: " + d.telefone;

    MailApp.sendEmail({ to: owner, replyTo: d.email, subject: "Novo pedido: " + d.produto + " (" + d.nome + ")",
      body: resumo + "\n\nPlanilha: " + SpreadsheetApp.getActive().getUrl() });

    MailApp.sendEmail({ to: d.email, name: LOJA, replyTo: owner, subject: "Recebemos sua encomenda — " + d.produto,
      body: "Olá, " + d.nome + "!\n\nRecebemos sua encomenda:\n\n" + resumo.split("\nNome:")[0] +
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
}

// Confere o token do Cloudflare Turnstile. A chave secreta fica em
// Configurações do projeto > Propriedades do script > TURNSTILE_SECRET
function verifyCaptcha(token) {
  const secret = PropertiesService.getScriptProperties().getProperty("TURNSTILE_SECRET");
  if (!secret) throw new Error("captcha não configurado");
  if (typeof token !== "string" || !token || token.length > 2048) throw new Error("captcha");
  const res = UrlFetchApp.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "post", payload: { secret: secret, response: token }, muteHttpExceptions: true
  });
  let ok = false;
  try { ok = JSON.parse(res.getContentText()).success === true; } catch (e) {}
  if (!ok) throw new Error("captcha");
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
