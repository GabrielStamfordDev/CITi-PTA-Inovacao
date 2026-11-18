<div align="center">

# 💜 CuiDA

**Plataforma de apoio informativo, comunitário e assistência por IA baseada em evidências para cuidadores informais de pessoas com Doença de Alzheimer.**

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)

</div>

---

## Sobre o Projeto

O **CuiDA** centraliza informações práticas confiáveis, rede de apoio emocional e orientação contextualizada em uma interface pensada para cuidadores familiares (incluindo público 50+):

* **Assistente CuiDA (IA + RAG Científico):** Responde dúvidas do cuidado diário com base nos 8 documentos oficiais em [`acervo-pdf/`](./acervo-pdf) (*ABRAz*, *PCDT Ministério da Saúde*, *OMS iSupport*, *NICE NG97* e artigos de geriatria), usando prompt estruturado em **PTCF** ([`assistente-cuida.ptcf.md`](./src/prompts/assistente-cuida.ptcf.md)) e citando os PDFs clicáveis ao final de cada resposta.
* **Eventos e Encontros:** Divulgação de webinários e simpósios com inscrição integrada ao banco.
* **Links de Apoio:** Acesso direto a associações e grupos moderados (ABRAz-PE, WhatsApp e Facebook).
* **Sobre Alzheimer & FAQ:** Guias objetivos sobre alimentação, síndrome do pôr do sol, saúde mental do cuidador e perguntas frequentes.
* **Acessibilidade Sênior & Responsividade:** Controle global de tamanho de fonte (`A-` / `A+`), leitura em voz alta (*Text-to-Speech* com normalização de datas e horários) e alternância entre visualização **Mobile** e **Site PC**.
* **Segurança de Sessão:** Senhas com hash `bcryptjs`, recuperação de senha por código temporário e autenticação via **cookie `HttpOnly` JWT (HS256)** protegendo todas as rotas contra acesso indevido (*IDOR*).

---

## Como Rodar o Projeto Localmente

> **Sobre dependências:** Este projeto utiliza Node.js (`package.json` + `yarn.lock`). **Não existe `requirements.txt` nem é necessário baixar bibliotecas manualmente** — o próprio `yarn install` instala tudo de forma automática e versionada.

### Pré-requisitos

* **[Node.js](https://nodejs.org/)** (versão 20 ou superior)
* **[Yarn](https://yarnpkg.com/)** (`npm install -g yarn`)
* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** *(recomendado para subir o PostgreSQL com 1 comando)* ou PostgreSQL 15+ instalado localmente

---

### Passo 1 — Clonar o repositório e instalar as dependências

```bash
git clone https://github.com/GabrielStamfordDev/CITi-PTA-Inovacao.git
cd CITi-PTA-Inovacao
yarn install
```

### Passo 2 — Configurar as variáveis de ambiente (`.env`)

Copie o arquivo modelo `.env.example` para `.env`:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / macOS / Git Bash
cp .env.example .env
```

O arquivo `.env` já vem pronto para rodar em modo local:

| Variável | Obrigatória? | Para que serve |
| :--- | :---: | :--- |
| `DATABASE_URL` e `DIRECT_URL` | **Sim** | Conexões com o PostgreSQL. Localmente, ambas apontam para o banco Docker (`postgresql://postgres:docker@localhost:5432/cuida`). Na nuvem (Neon), `DATABASE_URL` usa o endpoint *pooled* e `DIRECT_URL` usa o endpoint direto para migrações. |
| `SERVER_PORT` | **Sim** | Porta HTTP da aplicação (padrão: `3001`). |
| `GEMINI_API_KEY` | Opcional | Chave gratuita do [Google AI Studio](https://aistudio.google.com/) para respostas generativas com o Gemini. **Sem ela**, o assistente continua funcionando via motor científico local (`rag-local`). |
| `MAIL_PROVIDER` / `BREVO_API_KEY` | Opcional | Envio real de código de recuperação de senha por e-mail. Com `MAIL_PROVIDER=console`, o código de 6 dígitos é exibido no terminal do servidor. |
| `AUTH_SECRET` | Opcional em dev | Segredo de assinatura do token JWT (obrigatório apenas se `NODE_ENV=production`). |

### Passo 3 — Subir o banco de dados PostgreSQL

Com o **Docker Desktop** aberto, execute na raiz do projeto (`CITi-PTA-Inovacao`):

```bash
docker compose up -d
```

*(Caso utilize PostgreSQL instalado direto no sistema sem Docker, garanta que exista um banco chamado `cuida` com usuário/senha compatíveis com seu `.env`.)*

### Passo 4 — Preparar o banco (Prisma + Migrações + Seed)

Execute os três comandos abaixo em sequência para gerar o Prisma Client, criar as tabelas e popular os conteúdos iniciais (eventos, links, artigos, FAQs e conta de demonstração):

```bash
yarn generate
yarn migration
yarn seed
```

### Passo 5 — Iniciar a aplicação

```bash
yarn dev
```

Quando aparecer no terminal **`🚀 CuiDA rodando em http://localhost:3001`**, abra no navegador:

```text
http://localhost:3001
```

---

## Conta de Demonstração (criada pelo `yarn seed`)

Você pode criar sua própria conta clicando em **Registrar** ou entrar imediatamente com o perfil pré-cadastrado pelo seed:

* **E-mail:** `maria@cuida.com`
* **Senha:** `123456`

---

## Scripts Úteis

| Comando | Descrição |
| :--- | :--- |
| `yarn dev` | Sobe o servidor Express com recarregamento automático (`ts-node-dev`) e observa o schema do Prisma. |
| `yarn build` | Gera o Prisma Client e compila o TypeScript para `./dist` (produção). |
| `yarn start` | Inicia o servidor compilado (`node dist/src/server.js`) em modo produção. |
| `yarn typecheck` | Verifica toda a tipagem TypeScript sem gerar arquivos (`tsc --noEmit`). |
| `yarn seed` | Popula o banco local com conta demo, eventos, links de apoio, artigos e FAQs. |
| `yarn seed:prod` | Executa o seed compilado (`node dist/prisma/seed.js`) em produção. |
| `yarn studio` | Abre a interface visual do **Prisma Studio** no navegador para inspecionar o banco de dados. |
| `yarn migration` | Executa migrações pendentes do Prisma em desenvolvimento. |
| `yarn migration:deploy` | Aplica migrações existentes no banco de produção sem alterar histórico. |

---

## Deploy Gratuito na Nuvem (Neon + Render)

Além de rodar localmente via Docker + `yarn dev`, o **CuiDA** já está configurado para publicação gratuita na nuvem mantendo o modo local intacto:

1. **Banco PostgreSQL no [Neon](https://neon.tech/):**
   * Crie um projeto gratuito e abra o botão **Connect**.
   * Copie **duas URLs**:
     * **`DATABASE_URL` (Pooled):** ative a opção **Connection pooling** (hostname com `-pooler`) — usada pela aplicação em execução.
     * **`DIRECT_URL` (Direta):** desative **Connection pooling** (hostname sem `-pooler`) — usada pelo Prisma para executar migrações (`yarn migration:deploy`).
2. **Backend + Frontend no [Render](https://render.com/):**
   * Conecte este repositório no Render como **Web Service** (ou use [`render.yaml`](./render.yaml) via **New → Blueprint**).
   * **Build Command:** `yarn install --production=false && yarn build`
   * **Start Command:** `yarn migration:deploy && yarn seed:prod && yarn start`
     *(O `seed` é idempotente e não destrutivo: popula apenas quando as tabelas ainda estão vazias e ignora reinicializações seguintes; passe `--force` caso queira sincronizar os itens padrão manualmente.)*
   * **Health Check Path:** `/api/health`
3. **Variáveis de Ambiente no painel do Render (`Environment`):**
   * `NODE_ENV` = `production`
   * `DATABASE_URL` = *(URL do Neon com `Connection pooling` ligado — `-pooler`)*
   * `DIRECT_URL` = *(URL direta do Neon com `Connection pooling` desligado — sem `-pooler`)*
   * `AUTH_SECRET` = *(string aleatória longa, ou gerada automaticamente pelo `render.yaml`)*
   * `GEMINI_API_KEY` = *(sua chave do Google AI Studio)*
   * `MAIL_PROVIDER` = `brevo` *(envio real automático; mantenha `console` apenas em desenvolvimento local)*
   * `BREVO_API_KEY` = *(sua chave da Brevo)*
   * `MAIL_FROM_NAME` = `CuiDA Apoio`
   * `MAIL_FROM_EMAIL` = *(seu e-mail remetente verificado na Brevo)*

> **Nota do plano gratuito do Render:** Após ~15 minutos sem acessos, a instância hiberna e leva cerca de **30 a 50 segundos** para acordar na primeira requisição (os dados permanecem salvos no Neon).

> **Sobre o seed manual (opcional):** se precisar forçar a carga inicial a partir de um build local conectado ao banco remoto, execute `yarn build && yarn seed:prod` (ou `node dist/prisma/seed.js --force`).

---

## Estrutura de Pastas

```text
CITi-PTA-Inovacao/
├── acervo-pdf/          # PDFs científicos e guias oficiais indexados pelo Assistente
├── prisma/
│   ├── migrations/      # Histórico de migrações do banco
│   ├── schema.prisma    # Modelagem do banco PostgreSQL
│   └── seed.ts          # Carga inicial de dados e usuário demo
├── public/
│   ├── assets/          # Imagens e ilustrações do aplicativo
│   ├── index.html       # Interface responsiva (Mobile + Site PC)
│   └── app.js           # Lógica de telas, acessibilidade, voz e chat do Assistente
├── src/
│   ├── controllers/     # Controladores HTTP (UserController, AppController)
│   ├── data/            # Base estruturada dos documentos científicos
│   ├── database/        # Instância compartilhada do Prisma Client
│   ├── middlewares/     # Autenticação JWT HttpOnly e proteção anti-IDOR
│   ├── prompts/         # Prompt PTCF em Markdown (assistente-cuida.ptcf.md)
│   ├── repositories/    # Camada de acesso ao banco via Prisma
│   ├── services/        # Motor RAG + Gemini (AssistantService) e envio de e-mail (MailService)
│   ├── utils/           # Assinatura HS256 e resolução de caminhos dev/produção
│   ├── routes.ts        # Definição das rotas da API
│   └── server.ts        # Entrada do servidor Express, proxy reverso e arquivos estáticos
├── .env.example         # Modelo seguro de variáveis de ambiente
├── docker-compose.yml   # Container PostgreSQL 15 para desenvolvimento local
├── package.json         # Dependências e scripts Yarn
└── render.yaml          # Blueprint de deploy gratuito no Render
```
