# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

Catálogo online de figuras decorativas em resina, vendidas **sob encomenda** (sem estoque). Site 100% estático, sem build, sem dependências, sem testes, sem back-end próprio. Textos e mensagens ao usuário são em português (pt-BR).

## Rodar localmente

```
python3 -m http.server 8000   # abrir http://localhost:8000 e /produto.html?id=joabinho
```

Não há lint nem suite de testes. O Turnstile só carrega em domínios cadastrados no painel da Cloudflare (incluir `localhost` para testar o envio de pedido).

## Arquitetura

Duas metades ligadas por um único POST:

- **Front-end (raiz do repo, publicado via GitHub Pages):** `index.html` (catálogo) e `produto.html?id=<id>` (página do produto + formulário de encomenda). O HTML é só casca; `js/catalog.js` e `js/product.js` renderizam tudo a partir de `products.json` (fonte única dos produtos: nome, descrição, preço, prazo, imagens). `js/config.js` guarda `ORDER_ENDPOINT` (URL do Apps Script) e `TURNSTILE_SITEKEY`, além de helpers globais (`esc`, `brl`, `loadProducts`).
- **Back-end (`apps-script/Code.gs`):** Google Apps Script vinculado a uma planilha, publicado como app da Web ("Executar como: eu", acesso "Qualquer pessoa"). `doPost` valida o payload, confere o token Turnstile na Cloudflare, aplica limites (1 pedido/minuto por e-mail e teto global por hora/dia), grava uma linha na aba **Pedidos** (com o preço unitário vigente no momento do pedido) e envia dois e-mails: aviso ao dono e confirmação ao cliente.

Detalhes que exigem ler vários arquivos para entender:

- O POST usa `Content-Type: text/plain` de propósito, para evitar preflight de CORS com o Apps Script. A resposta é JSON `{ok, error}`; `js/product.js` trata os erros especiais `"aguarde um instante"`, `"limite"` e `"captcha"` com mensagens próprias — se mudar esses códigos em `Code.gs`, atualizar `product.js`.
- O preço vem do navegador (o Apps Script não tem acesso ao `products.json`); o back-end só valida que é número. O registro na planilha e nos e-mails é o preço combinado no momento do pedido, então **mudar o preço em `products.json` não afeta pedidos antigos**.
- A honeypot (`website`) é só front-end; a proteção real contra requisições diretas ao endpoint é Turnstile + limites globais no `Code.gs`.
- A chave secreta do Turnstile fica nas Propriedades do script (`TURNSTILE_SECRET`), nunca no repo. O widget usa `action: "pedido"` e o `Code.gs` rejeita tokens com outra action; a propriedade opcional `TURNSTILE_HOSTNAMES` (ex.: `lucasleal.dev`) também restringe o domínio de origem do token. `@OnlyCurrentDoc` no topo do `Code.gs` restringe a permissão à planilha vinculada.

## Adicionar produto

Novo bloco em `products.json` + fotos em `images/`. `preco: null` exibe "Preço sob consulta". `prazo` é só o número de dias (ex.: `"10 dias"`); as páginas montam a frase "… para confecção".

## Publicar mudanças do Apps Script (lojinha-deploy)

Existe um projeto **fora deste repo**, em `~/lojinha-deploy/`, que envia o `apps-script/Code.gs` para o Apps Script via `clasp` e atualiza a implantação existente (a URL de `ORDER_ENDPOINT` não muda). Ele guarda o ID do script e o ID da implantação; o login do clasp (`~/.clasprc.json`) também fica fora do repo — nunca copiar nada disso para cá.

```
~/lojinha-deploy/deploy.sh      # mostra o diff, pede confirmação, faz push + deploy
~/lojinha-deploy/deploy.sh -y   # sem confirmação
```

- **Quem roda:** preferencialmente o próprio Claude executa o `deploy.sh -y` depois de alterar o `Code.gs`, sem pedir ao usuário para publicar manualmente. **Exceção:** se a mudança for incompatível com o front-end atualmente publicado (ex.: novo campo obrigatório no payload, código de erro renomeado, nova exigência de token/action — como aconteceu ao exigir `action: "pedido"`), **não** rodar sozinho: o backend novo quebraria o site no ar até o push do front. Nesse caso, avisar o usuário e combinar a ordem (front primeiro, se compatível com o backend antigo; ou push do front e deploy juntos).
- Editar `Code.gs` **aqui no repo** (é a versão canônica); edições feitas no editor online são sobrescritas no próximo deploy.
- `clasp` vem do nvm: se não estiver no PATH, usar `export PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH`.
- O deploy não altera as Propriedades do script. Se uma mudança exigir novo escopo OAuth (ex.: novo serviço do Google), o clasp não autoriza sozinho: abrir o editor do Apps Script, rodar uma função e aceitar.
- Após um deploy, testar o endpoint com um payload inválido (não gera linha nem e-mail): a resposta esperada é `{"ok":false,"error":"dados inválidos"}`. Um pedido válido grava na planilha e envia e-mails reais.
- Mudanças no site (HTML/CSS/JS/`products.json`) não passam pelo lojinha-deploy: vão pelo `git push` para o GitHub Pages.
