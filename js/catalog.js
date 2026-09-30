loadProducts().then(list => {
  const grid = document.getElementById("grid");
  grid.innerHTML = list.filter(p => p.disponivel).map(p => `
    <a class="card" href="produto.html?id=${encodeURIComponent(p.id)}">
      <div class="frame"><img src="${esc(p.imagens[0])}" alt="${esc(p.nome)}" loading="lazy"></div>
      <div class="body">
        <p class="kind">${p.pintada ? "Pintada à mão · Peça única" : "Sem pintura · Acabamento em primer"}</p>
        <h2>${esc(p.nome)}</h2>
        <p>${esc(p.subtitulo)}</p>
        <div class="card-price">${brl(p.preco)}${p.preco == null ? "" : ' <small>+ frete</small>'}</div>
        ${prontaEntregaTag(p)}
        <span class="tag">Sob encomenda · ${esc(p.prazo)} para confecção</span>
      </div>
    </a>`).join("") || "<p>Nenhuma peça disponível no momento.</p>";
}).catch(() => { document.getElementById("grid").textContent = "Não foi possível carregar o catálogo."; });

// O vídeo da pintura só carrega (e toca) quando aparece na tela.
document.querySelectorAll("video[data-src]").forEach(v => {
  if (!("IntersectionObserver" in window)) { v.src = v.dataset.src; v.play().catch(() => {}); return; }
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return v.pause();
    if (!v.src) v.src = v.dataset.src;
    v.play().catch(() => {});
  }, { threshold: .25 }).observe(v);
});
