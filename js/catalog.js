loadProducts().then(list => {
  const grid = document.getElementById("grid");
  grid.innerHTML = list.filter(p => p.disponivel).map(p => `
    <a class="card" href="produto.html?id=${encodeURIComponent(p.id)}">
      <img src="${esc(p.imagens[0])}" alt="${esc(p.nome)}" loading="lazy">
      <div class="body">
        <h2>${esc(p.nome)}</h2>
        <p>${esc(p.subtitulo)}</p>
        <span class="tag">Sob encomenda · ${esc(p.prazo)}</span>
      </div>
    </a>`).join("") || "<p>Nenhum produto disponível no momento.</p>";
}).catch(() => { document.getElementById("grid").textContent = "Não foi possível carregar o catálogo."; });
