const id = new URLSearchParams(location.search).get("id");
const root = document.getElementById("root");

let widgetId = null;
function mountTurnstile() {
  const el = document.getElementById("ts");
  if (widgetId !== null || !el || !window.turnstile) return;
  widgetId = turnstile.render(el, { sitekey: CONFIG.TURNSTILE_SITEKEY, language: "pt-br" });
}
window.onTurnstile = mountTurnstile;

loadProducts().then(list => {
  const p = list.find(x => x.id === id && x.disponivel);
  if (!p) { root.innerHTML = '<a class="back" href="index.html">← Voltar</a><p>Produto não encontrado.</p>'; return; }
  document.title = p.nome + " — Lojinha";
  root.innerHTML = `
    <a class="back" href="index.html">← Voltar ao catálogo</a>
    <div class="product">
      <div class="gallery">
        <img class="main" id="main" src="${esc(p.imagens[0])}" alt="${esc(p.nome)}">
        <div class="thumbs">${p.imagens.map((src, i) => `
          <button type="button" data-src="${esc(src)}" aria-current="${i === 0}" aria-label="Foto ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join("")}
        </div>
      </div>
      <div>
        <h1>${esc(p.nome)}</h1>
        <p class="lead">${esc(p.subtitulo)}</p>
        <div class="price">${brl(p.preco)}</div>
        <span class="tag">Sob encomenda · ${esc(p.prazo)} para confecção, contados a partir do início da produção</span>
        <p>${esc(p.descricao)}</p>
        <ul class="det">${p.detalhes.map(d => `<li>${esc(d)}</li>`).join("")}</ul>
        <form id="order" novalidate>
          <h2>Fazer encomenda</h2>
          <p class="hint">Preencha seus dados e entrarei em contato para combinar produção, prazo e pagamento.</p>
          <label for="nome">Nome</label>
          <input id="nome" name="nome" autocomplete="name" required>
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" autocomplete="email" required>
          <label for="telefone">Telefone (WhatsApp)</label>
          <input id="telefone" name="telefone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 91234-5678" required>
          <label for="quantidade">Quantidade</label>
          <input id="quantidade" name="quantidade" type="number" min="1" max="20" value="1" required>
          <div class="hp" aria-hidden="true"><label>Não preencha <input name="website" tabindex="-1" autocomplete="off"></label></div>
          <div id="ts" style="margin-top:14px"></div>
          <button class="submit" type="submit">Enviar encomenda</button>
          <div class="msg" id="msg" role="status"></div>
        </form>
      </div>
    </div>`;

  const main = document.getElementById("main");
  root.querySelectorAll(".thumbs button").forEach(b => b.onclick = () => {
    main.src = b.dataset.src;
    root.querySelectorAll(".thumbs button").forEach(x => x.setAttribute("aria-current", x === b));
  });

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

    const token = widgetId !== null ? turnstile.getResponse(widgetId) : "";
    if (!token) return show("err", "Confirme que você não é um robô antes de enviar.");

    if (CONFIG.ORDER_ENDPOINT.startsWith("COLE_AQUI")) return show("err", "Formulário ainda não configurado (falta a URL do Apps Script).");

    btn.disabled = true; btn.textContent = "Enviando…"; msg.className = "msg";
    try {
      const res = await fetch(CONFIG.ORDER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ produtoId: p.id, produto: p.nome, nome: f.nome.trim(), email: f.email.trim(), telefone: f.telefone.trim(), quantidade: qtd, preco: p.preco, token })
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
      show("ok", "Encomenda recebida! Enviamos uma confirmação para o seu e-mail e entrarei em contato em breve.");
    } catch (err) {
      show("err", "Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      if (widgetId !== null) turnstile.reset(widgetId);
      btn.disabled = false; btn.textContent = "Enviar encomenda";
    }
  });
}).catch(() => { root.textContent = "Não foi possível carregar o produto."; });
