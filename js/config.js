// Cole aqui a URL do Apps Script implantado (veja README.md)
window.CONFIG = {
  TURNSTILE_SITEKEY: "0x4AAAAAAFBQHok785riSpYR",
  ORDER_ENDPOINT: "https://script.google.com/macros/s/AKfycbw7G5NKDKNP4uVJE-QhDB2Vkf0QNwKo19HivznIppEOACPVFjmZuYQmFKlI_VqcKenIWQ/exec"
};

window.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
window.brl = n => n == null ? "Preço sob consulta" : n.toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
window.loadProducts = () => fetch("products.json").then(r => r.json());
