const id = new URLSearchParams(location.search).get("id");
const root = document.getElementById("root");
const isVideo = src => /\.(mp4|webm|mov)$/i.test(src);
const mediaTag = (src, cls, alt = "") => isVideo(src)
  ? `<video class="${cls}" src="${esc(src)}" autoplay loop muted playsinline></video>`
  : `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}">`;

let widgetId = null;
function mountTurnstile() {
  const el = document.getElementById("ts");
  if (widgetId !== null || !el || !window.turnstile) return;
  widgetId = turnstile.render(el, { sitekey: CONFIG.TURNSTILE_SITEKEY, action: "pedido", language: "pt-br" });
}
window.onTurnstile = mountTurnstile;

// Tabela em base64: "<chave>:<n>" separados por ";". Ver CLAUDE.md.
const _t = "MjJ1ZXFlZHp0dno6MTQx";
const norm = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const h53 = (str, seed) => {
  let a = 0xdeadbeef ^ seed, b = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return 4294967296 * (2097151 & b) + (a >>> 0);
};
function lookup(code) {
  if (!code) return 0;
  const row = atob(_t).split(";").map(x => x.split(":")).find(x => x[0] === h53(code, 7).toString(36));
  return row ? Number(row[1]) ^ (h53(code, 11) & 255) : 0;
}

loadProducts().then(list => {
  const p = list.find(x => x.id === id && x.disponivel);
  if (!p) { root.innerHTML = '<a class="back" href="index.html">← Voltar</a><p>Peça não encontrada.</p>'; return; }
  document.title = p.nome + " — Lojinha";
  root.innerHTML = `
    <a class="back" href="index.html#pecas">← Todas as peças</a>
    <div class="product">
      <div class="gallery">
        <div id="main">${mediaTag(p.imagens[0], "main", p.nome)}</div>
        <div class="thumbs">${p.imagens.map((src, i) => `
          <button type="button" data-src="${esc(src)}" aria-current="${i === 0}" aria-label="Foto ${i + 1}">${mediaTag(src, "")}</button>`).join("")}
        </div>
        <p class="photo-note">As fotos são reais, da própria peça. Usamos IA apenas para melhorar a iluminação e o cenário, sem alterar a figura, para que você a veja com mais clareza. As imagens não são geradas por IA.</p>
      </div>
      <div>
        <p class="eyebrow">${p.pintada ? "Pintada à mão · Peça única" : "Sem pintura · Acabamento em primer"}</p>
        <h1>${esc(p.nome)}</h1>
        <p class="lead">${esc(p.subtitulo)}</p>
        <div class="price" id="price">${brl(p.preco)}</div>
        <p class="shipping">Frete cobrado à parte; o valor varia conforme o CEP do comprador.</p>
        <form class="frete" id="frete" novalidate>
          <label for="cep">Estimar frete</label>
          <div class="frete-row">
            <input id="cep" name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9">
            <button type="submit">Calcular</button>
          </div>
          <div id="frete-res" role="status"></div>
        </form>
        ${prontaEntregaTag(p)}
        <span class="tag">Sob encomenda · ${esc(p.prazo)} para confecção, contados a partir do início da produção</span>
        <p class="descr">${esc(p.descricao)}</p>
        <ul class="det">${p.detalhes.map(d => `<li>${esc(d)}</li>`).join("")}</ul>
        <div class="craft">${p.pintada
          ? `<h2>Uma peça única</h2><p>Cada exemplar é pintado individualmente, à mão, ao longo de horas de trabalho. Por isso, pequenas variações de tom e de pincelada em relação às fotos são naturais: é o que faz a sua figura ser só sua.</p>`
          : `<h2>Sem pintura, com o mesmo cuidado</h2><p>Impressa em resina de alta resolução, lavada, curada, lixada à mão e finalizada com primer: todos os detalhes da escultura aparecem, prontos para exposição ou para receber a sua própria pintura.</p>`}
          <a href="index.html#resina">Conheça o processo →</a></div>
        <form id="order" novalidate>
          <h2>Encomendar esta peça</h2>
          <p class="hint">Deixe seus dados e entrarei em contato para combinarmos os detalhes da produção, o prazo e o pagamento.</p>
          <p class="hint">Pode haver fila de produção, então a confecção pode não começar imediatamente. Nenhum pagamento é exigido antes de a encomenda estar pronta.</p>
          <label for="nome">Nome</label>
          <input id="nome" name="nome" autocomplete="name" required>
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" autocomplete="email" required>
          <label for="telefone">Telefone (WhatsApp)</label>
          <input id="telefone" name="telefone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 91234-5678" required>
          <label for="quantidade">Quantidade</label>
          <input id="quantidade" name="quantidade" type="number" min="1" max="20" value="1" required>
          ${p.preco == null ? "" : `<label for="cupom">Cupom de desconto (opcional)</label>
          <div class="frete-row">
            <input id="cupom" name="cupom" autocomplete="off" autocapitalize="characters" spellcheck="false">
            <button type="button" id="cupom-btn">Aplicar</button>
          </div>
          <div id="cupom-res" role="status"></div>`}
          <div class="hp" aria-hidden="true"><label>Não preencha <input name="website" tabindex="-1" autocomplete="off"></label></div>
          <div id="ts" style="margin-top:14px"></div>
          <button class="submit" type="submit">Solicitar encomenda</button>
          <div class="msg" id="msg" role="status"></div>
        </form>
      </div>
    </div>`;

  const main = document.getElementById("main");
  root.querySelectorAll(".thumbs button").forEach(b => b.onclick = () => {
    main.innerHTML = mediaTag(b.dataset.src, "main", p.nome);
    root.querySelectorAll(".thumbs button").forEach(x => x.setAttribute("aria-current", x === b));
  });

  const freteForm = document.getElementById("frete"), freteRes = document.getElementById("frete-res");
  freteForm.addEventListener("submit", async e => {
    e.preventDefault();
    const cep = freteForm.cep.value.replace(/\D/g, "");
    if (cep.length !== 8) { freteRes.className = "msg err"; freteRes.textContent = "Informe um CEP válido com 8 dígitos."; return; }
    const fbtn = freteForm.querySelector("button");
    fbtn.disabled = true; freteRes.className = ""; freteRes.textContent = "Calculando…";
    try {
      const res = await fetch(CONFIG.ORDER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ acao: "frete", cep, valor: p.preco })
      });
      const data = await res.json();
      if (!data.ok || !data.opcoes.length) throw new Error(data.error);
      freteRes.className = "";
      freteRes.innerHTML = `<ul class="frete-opcoes">${data.opcoes.map(o => `
        <li><span>${esc(o.servico)}${o.prazo ? ` · ${o.prazo} dia${o.prazo > 1 ? "s" : ""} úteis` : ""}</span><strong>${brl(o.preco)}</strong></li>`).join("")}
        </ul><p class="hint">Estimativa para 1 unidade, apenas como referência: o valor final do frete pode variar. O prazo de entrega conta a partir da postagem, depois da confecção.</p>`;
    } catch (err) {
      freteRes.className = "msg err";
      freteRes.textContent = "Não foi possível estimar o frete agora. Confira o CEP ou tente novamente mais tarde.";
    } finally { fbtn.disabled = false; }
  });

  // Desconto aplicado: { c: código, d: percentual }
  let desconto = null;
  const priceEl = document.getElementById("price"), cupomIn = document.getElementById("cupom"), cupomRes = document.getElementById("cupom-res");
  const precoFinal = () => desconto ? Math.round(p.preco * (100 - desconto.d)) / 100 : p.preco;
  const aplicarCupom = async () => {
    const c = norm(cupomIn.value);
    const d = lookup(c);
    desconto = d ? { c, d } : null;
    priceEl.innerHTML = desconto ? `<s class="old">${brl(p.preco)}</s> ${brl(precoFinal())}` : brl(p.preco);
    cupomRes.className = c ? "msg " + (d ? "ok" : "err") : "";
    cupomRes.textContent = !c ? "" : d ? `Cupom ${c} aplicado: ${d}% de desconto.` : "Cupom inválido.";
    return !c || !!d;
  };
  if (cupomIn) {
    document.getElementById("cupom-btn").onclick = aplicarCupom;
    cupomIn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); aplicarCupom(); } });
  }

  mountTurnstile();
  const form = document.getElementById("order"), msg = document.getElementById("msg"), btn = form.querySelector(".submit");
  const show = (cls, text) => { msg.className = "msg " + cls; msg.textContent = text; };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    if (f.website) return;
    const digits = f.telefone.replace(/\D/g, "");
    if (!f.nome.trim()) return show("err", "Informe seu nome.");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return show("err", "Informe um e-mail válido.");
    if (digits.length < 10 || digits.length > 13) return show("err", "Informe um telefone válido com DDD.");
    const qtd = parseInt(f.quantidade, 10);
    if (!(qtd >= 1 && qtd <= 20)) return show("err", "Quantidade inválida.");

    if (cupomIn && norm(cupomIn.value) !== (desconto?.c || "") && !(await aplicarCupom())) return show("err", "Cupom inválido. Corrija ou apague o campo.");

    const token = widgetId !== null ? turnstile.getResponse(widgetId) : "";
    if (!token) return show("err", "Confirme que você não é um robô antes de enviar.");

    if (CONFIG.ORDER_ENDPOINT.startsWith("COLE_AQUI")) return show("err", "Formulário ainda não configurado (falta a URL do Apps Script).");

    btn.disabled = true; btn.textContent = "Enviando…"; msg.className = "msg";
    try {
      const res = await fetch(CONFIG.ORDER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ produtoId: p.id, produto: p.nome, nome: f.nome.trim(), email: f.email.trim(), telefone: f.telefone.trim(), quantidade: qtd, preco: precoFinal(), cupom: desconto?.c || "", desconto: desconto?.d || 0, token })
      });
      const data = await res.json();
      if (!data.ok && data.error === "aguarde um instante") {
        return show("err", "Só é permitido um pedido por minuto, aguarde um pouco para enviar mais um.");
      }
      if (!data.ok && data.error === "limite") {
        return show("err", "Estamos com muitos pedidos no momento. Tente novamente mais tarde.");
      }
      if (!data.ok && data.error === "captcha") {
        return show("err", "Não foi possível validar a verificação anti-robô. Tente de novo.");
      }
      if (!data.ok) throw new Error(data.error || "erro");
      form.reset();
      if (cupomIn) aplicarCupom();
      show("ok", "Encomenda recebida! Enviamos uma confirmação para o seu e-mail e entrarei em contato em breve para começarmos a sua peça.");
    } catch (err) {
      show("err", "Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      if (widgetId !== null) turnstile.reset(widgetId);
      btn.disabled = false; btn.textContent = "Solicitar encomenda";
    }
  });
}).catch(() => { root.textContent = "Não foi possível carregar o produto."; });
