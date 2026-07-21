# GiroFood — publicar o app com login e dados na nuvem

Este guia leva você do zero até o app funcionando no celular (iPhone e Android),
com **login por conta** e **dados salvos na nuvem** (Supabase), publicado no **Vercel**.

Como funciona a divisão dos dados:
- Cada representante entra com o próprio e-mail e senha e vê **só os dados dele**
  (clientes, pedidos, visitas, prospecção e rotas).
- **Produtos e empresas** ficam num **catálogo único, compartilhado** por toda a equipe.

---

## Parte 1 — Guardar o código no GitHub

1. Crie uma conta grátis em https://github.com (se ainda não tiver).
2. Clique em **New repository**, dê o nome `girofood`, deixe **Private** e crie.
3. Suba os arquivos deste projeto. Sem linha de comando: no repositório novo, clique
   em **uploading an existing file** e arraste TODA a pasta do projeto
   (menos as pastas `node_modules` e `dist`, que não precisam ir).

---

## Parte 2 — Criar o banco de dados (Supabase)

1. Crie uma conta grátis em https://supabase.com e clique em **New project**.
2. Dê um nome (ex.: `girofood`), defina uma senha para o banco (guarde-a) e crie.
   Aguarde 1–2 minutos até o projeto ficar pronto.
3. No menu lateral, abra **SQL Editor** → **New query**.
4. Abra o arquivo `supabase-setup.sql` deste projeto, copie TODO o conteúdo,
   cole no editor e clique em **Run**. Isso cria as tabelas e a segurança.
5. Pegue suas chaves: menu **Project Settings** (engrenagem) → **API**. Você vai usar:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **anon public** (a chave que começa com `eyJ...`)
   > Essas duas podem ficar no app com segurança — a proteção real é feita
   > pelas regras (RLS) que você acabou de criar.

### Importante: liberar o login imediato
Para que o representante entre assim que criar a conta (sem precisar confirmar e-mail):
- Menu **Authentication** → **Providers** (ou **Sign In / Providers**) → **Email**.
- **Desligue** a opção **Confirm email** e salve.
(Se preferir manter a confirmação por e-mail, o app funciona também — só que o
usuário terá que clicar no link do e-mail antes do primeiro login.)

---

## Parte 3 — Publicar no Vercel

1. Crie uma conta grátis em https://vercel.com e entre com o GitHub.
2. Clique em **Add New… → Project**, escolha o repositório `girofood` e clique em **Import**.
3. O Vercel detecta o Vite sozinho. Antes de publicar, abra **Environment Variables**
   e adicione as duas chaves da Parte 2:
   - `VITE_SUPABASE_URL` = a Project URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` = a chave anon public
4. Clique em **Deploy**. Em 1–2 minutos você recebe um link tipo
   `girofood.vercel.app`.

> Se você adicionar as variáveis **depois** do primeiro deploy, vá em
> **Settings → Environment Variables**, adicione, e então **Deployments → ⋯ → Redeploy**.

---

## Parte 4 — Instalar no celular (PWA, sem loja de apps)

**iPhone (Safari):** abra o link → botão de compartilhar → **Adicionar à Tela de Início**.
**Android (Chrome):** abra o link → menu ⋮ → **Instalar aplicativo** / **Adicionar à tela inicial**.

O ícone verde do GiroFood aparece como um app normal e abre em tela cheia.

---

## Parte 5 — Primeiro acesso e equipe

1. Abra o app, toque em **Criar conta**, use e-mail e senha (mínimo 6 caracteres).
2. Você entra já com dados de demonstração, para ver tudo funcionando.
3. Para começar limpo: **Mais → Configurações → Apagar meus dados**
   (isso apaga só os seus dados; o catálogo compartilhado continua).
4. Cada representante da equipe repete o passo 1 com o próprio e-mail — cada um
   terá os próprios clientes/pedidos, mas todos veem o mesmo catálogo de produtos.

---

## Como atualizar o app depois

1. Corrija o código e suba a alteração para o GitHub.
2. O Vercel publica sozinho em 1–2 minutos.
3. Na próxima vez que abrirem o app, todos já recebem a correção. Não precisa
   reinstalar nada no celular.

---

## Rodar no seu computador (opcional, para testar)

1. Instale o Node.js (https://nodejs.org).
2. Na pasta do projeto: `npm install`
3. Crie um arquivo `.env` (copie de `.env.example`) com suas duas chaves.
4. Rode `npm run dev` e abra o endereço que aparecer (ex.: http://localhost:5173).

---

## (Opcional) Domínio próprio

Registre um domínio (ex.: em registro.br) e conecte no Vercel em
**Settings → Domains** — o Vercel mostra qual DNS apontar. O HTTPS é automático.
