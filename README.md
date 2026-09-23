# Lojinha — catálogo de figuras em resina

Site estático (sem back-end próprio). Pedidos vão para uma planilha Google e você recebe um e-mail a cada novo pedido.

## 1. Configurar o recebimento de pedidos (≈5 min)

1. Crie uma planilha no Google Sheets (nome livre).
2. **Extensões > Apps Script**, apague o conteúdo e cole `apps-script/Code.gs`. Salve.
3. **Implantar > Nova implantação > tipo "App da Web"**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
4. Autorize as permissões (planilha e envio de e-mail) e copie a **URL do app da Web**.
5. Cole a URL em `js/config.js` em `ORDER_ENDPOINT`.

Ao alterar o script depois, use **Implantar > Gerenciar implantações > editar > Nova versão** (a URL se mantém).

### Anti-spam (Cloudflare Turnstile)
1. Em dash.cloudflare.com > Turnstile, crie um site com o domínio onde o site será publicado (e `localhost` para testes).
2. Cole a **site key** (pública) em `js/config.js` > `TURNSTILE_SITEKEY`.
3. No Apps Script: **Configurações do projeto > Propriedades do script > Adicionar** `TURNSTILE_SECRET` = a **secret key** (privada, nunca no repositório).
4. O domínio permitido para o token é `lucasleal.dev` (constante `TURNSTILE_HOSTNAMES_PADRAO` no `Code.gs`). Para testar localmente, defina a propriedade do script `TURNSTILE_HOSTNAMES` = `lucasleal.dev,localhost` e remova-a depois.
5. Os limites globais (`MAX_POR_HORA`, `MAX_POR_DIA`) ficam no topo do `Code.gs`.

## 2. Publicar (GitHub Pages)

Suba o repositório para o GitHub e ative **Settings > Pages > Deploy from branch: main / root**.

## 3. Adicionar produtos

Edite `products.json` (um bloco por produto), coloque as fotos em `images/` e faça push. Preço `null` mostra "Preço sob consulta". Para testar localmente: `python3 -m http.server` e abra `http://localhost:8000`.
