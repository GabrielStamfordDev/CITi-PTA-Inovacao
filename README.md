# CuiDA — Apoio Acolhedor a Cuidadores de Pessoas com Alzheimer

> Aplicação web *mobile-first*, acessível e baseada em evidências científicas para apoiar cuidadores informais e familiares de pessoas com Doença de Alzheimer, desenvolvida no contexto da disciplina de **Inovação / PTA (CIn–UFPE)**.

---

## 🌐 Acesso Rápido: Testar na Nuvem vs. Rodar Localmente

Você pode avaliar e utilizar o **CuiDA** de duas formas: diretamente pelo link publicado na nuvem (recomendado para testes rápidos) ou clonando o repositório para executar localmente.

### Opção 1 — Acessar pela Nuvem (Recomendado para Avaliadores)

🔗 **Acesse a aplicação:** **[https://cuida-app.onrender.com](https://cuida-app.onrender.com)**

> [!WARNING]
> **Possível espera inicial de 30 a 50 segundos (*Cold Start*):**
> Como a aplicação e o banco de dados estão hospedados nos planos gratuitos do **Render** e do **Neon**, o serviço entra em hibernação após períodos de inatividade. No **primeiro acesso**, a página pode levar cerca de **30 a 50 segundos** para responder enquanto o servidor e o banco despertam. Após o carregamento inicial, a navegação ocorre em velocidade normal.

- **Zero instalação:** funciona direto no navegador do celular ou computador.
- **Tudo pré-configurado:** já está conectado ao banco PostgreSQL (**Neon** com `pgvector`), com o acervo científico indexado, as 4 salas do Fórum populadas e as chaves de API do **Google Gemini** (`GEMINI_API_KEY`) e de envio de e-mails **Brevo** (`BREVO_API_KEY`) ativas no servidor.
- **Conta de demonstração opcional:** você pode criar seu próprio cadastro na tela inicial ou entrar com a conta de exemplo `maria@cuida.com` (senha `123456`).

---

### Opção 2 — Clonar o Repositório e Rodar Localmente

Ideal para desenvolvedores ou avaliadores que desejam inspecionar o código-fonte, executar os testes de avaliação do RAG (`yarn rag:eval`), visualizar logs do servidor ou personalizar variáveis de ambiente com um PostgreSQL local via Docker.

| Aspecto | Link na Nuvem (`cuida-app.onrender.com`) | Execução Local (`git clone`) |
| :--- | :--- | :--- |
| **Instalação** | Nenhuma (apenas navegador) | Node.js, Yarn e Docker Compose |
| **Tempo inicial** | Pode levar **30–50s** no 1º acesso (*cold start*) | Inicialização imediata após subir o container |
| **Banco de Dados** | Neon PostgreSQL + `pgvector` já populado | PostgreSQL local (`pgvector/pgvector:pg15`) via Docker |
| **Gemini (`GEMINI_API_KEY`)** | Já configurada no servidor | Precisa da **sua chave** no `.env` *(ou roda no fallback local)* |
| **Brevo (`BREVO_API_KEY`)** | Já configurada no servidor | Precisa da **sua chave** no `.env` *(ou exibe o código no terminal)* |

#### 🔑 Sobre as chaves `GEMINI_API_KEY` e `BREVO_API_KEY` ao clonar localmente

Por boas práticas de segurança, o arquivo `.env` com segredos **não vai para o GitHub** (ele é ignorado pelo `.gitignore`). Portanto, quem clona o repositório começa copiando o arquivo modelo `.env.example` para `.env`:

1. **Para ter a experiência completa idêntica à nuvem localmente:** sim, é necessário inserir suas próprias chaves no `.env` local:
   - `GEMINI_API_KEY`: obtida no Google AI Studio, habilita a geração de respostas humanizadas com Gemini e embeddings vetoriais (`gemini-embedding-001`).
   - `BREVO_API_KEY` (com `MAIL_PROVIDER=brevo` e `MAIL_FROM_EMAIL`): habilita o disparo real de e-mails de recuperação de senha.
2. **Mesmo sem nenhuma chave API configurada, o projeto roda localmente:** o CuiDA possui *fallbacks* automáticos para desenvolvimento e avaliação offline:
   - **Sem `GEMINI_API_KEY`:** o Assistente CuiDA passa a operar automaticamente no modo **`rag-local`** (usando o acervo curado em memória ou os PDFs indexados via `yarn rag:ingest --lexical-only`), retornando orientações estruturadas com citações sem exigir chamada à API do Gemini.
   - **Sem `BREVO_API_KEY` (com `MAIL_PROVIDER=console`, padrão do `.env.example`):** na recuperação de senha, o código de 6 dígitos (válido por 15 minutos) é exibido diretamente no terminal onde o servidor Node.js está rodando.

---

## 📄 Relatório Técnico e Processo de Design Thinking

Todo o embasamento da pesquisa com cuidadores, definição de problema, ideação, prototipação e validação está documentado no repositório:

- 📘 **Relatório Principal:** [`relatorio.pdf`](./relatorio.pdf)
- 🗂️ **Artefatos do Processo de Design Thinking:** [`design_thinking/`](./design_thinking)
  - Imersão e Entendimento: [`Definição-Tema.pdf`](./design_thinking/Definição-Tema.pdf), [`Recrutamento ABRAZ.pdf`](./design_thinking/Recrutamento%20ABRAZ.pdf), [`Entrevistas.pdf`](./design_thinking/Entrevistas.pdf), [`Revisão da Literatura.pdf`](./design_thinking/Revisão%20da%20Literatura.pdf), [`Analise-Competidores.pdf`](./design_thinking/Analise-Competidores.pdf)
  - Síntese e Experiência: [`Mapa-Mental.pdf`](./design_thinking/Mapa-Mental.pdf), [`Personas.pdf`](./design_thinking/Personas.pdf), [`Jornada-Usuário.png`](./design_thinking/Jornada-Usuário.png), [`Sintese-Geral.pdf`](./design_thinking/Sintese-Geral.pdf)
  - Ideação e Validação: [`Geracao-Ideias.pdf`](./design_thinking/Geracao-Ideias.pdf), [`Seleção de ideias.pdf`](./design_thinking/Seleção%20de%20ideias.pdf), [`Teste-Protótipo.pdf`](./design_thinking/Teste-Protótipo.pdf)

---

## ✨ Funcionalidades Principais

### 1. Experiência Inicial Acolhedora e Acessibilidade Global
- **Tela inicial redesenhada:** saudação personalizada ao cuidador, atalhos diretos para o Assistente, Comunidades e Orientação do Dia.
- **Barra de navegação inferior fixa:** acesso constante a **Voltar**, **Início**, **Assistente**, **Fórum** e **Perfil**.
- **Controle global de tamanho do texto (`A-` / `A+`):** ajusta proporcionalmente todos os textos da interface (telas, formulários, assistente, fórum e modais) com persistência da preferência.
- **Modais internos de confirmação:** confirmações dentro do próprio app antes de ações importantes (como *Nova conversa* no Assistente ou *Sair da conta*), evitando diálogos genéricos do navegador.

### 2. Assistente CuiDA (IA + RAG Híbrido em Acervo Científico)
- **Respostas fundamentadas em 8 documentos oficiais (`acervo-pdf/`):**
  - Ministério da Saúde (`API_01-MS-PCDT-DA.pdf`), Organização Mundial da Saúde — *iSupport* (`API_02-iSupport-DA.pdf`), Guia de Manejo de Demências (`API_03-dementia-assessment-management-and-support.pdf`), ABRAz (`abraz-orientacoes.pdf`) e guias práticos sobre banho, diálogo, saída de casa e perambulação.
- **Busca Híbrida + RRF + MMR (`pgvector` + busca lexical):** recupera trechos relevantes preservando diversidade entre documentos e número exato de página.
- **Citações clicáveis por página (`#page=N`):** cada resposta exibe os documentos consultados com link direto para a página exata do PDF.
- **Botão "Copiar orientação":** copia a orientação junto com as referências para compartilhar facilmente com familiares ou equipe de saúde.
- **Sugestões de rotina não farmacológicas:** perguntas rápidas focadas em manejo diário, comunicação, banho, alimentação e apoio ao cuidador (sem sugestões relacionadas a medicamentos).
- **Travas clínicas, éticas e de cota:** o Assistente não realiza diagnósticos nem prescreve medicamentos, recusa com segurança perguntas médicas agudas fora do acervo (orientando atendimento presencial) e conta com *rate limiting* (`rateLimitMiddleware.ts`) e orçamento diário de chamadas (`dailyCallBudget.ts`).

### 3. Fórum de Cuidadores (Comunidades Estilo Telegram)
- **4 comunidades temáticas e regionais já configuradas:**
  - *Acolhimento Geral* (entrada automática ao criar conta)
  - *Perambulação e Rotina*
  - *Cuidadores de Pernambuco*
  - *Saúde Mental do Cuidador*
- **Fluxo completo de comunidade:** pré-visualização das conversas antes de entrar na sala, contagem real de membros participantes, separadores de data, contador de caracteres e atualização periódica automática.
- **Privacidade e conformidade LGPD:** nas mensagens públicas do Fórum, os participantes aparecem apenas pelo **primeiro nome e inicial do sobrenome** (ex.: *Maria S.*), sem expor nome do familiar com Alzheimer, estágio clínico, parentesco ou cidade.

### 4. Perfil do Cuidador, Conteúdo Educativo e Autenticação Segura
- **Cadastro contextualizado:** dados sobre o parentesco, fase da doença e localização ficam restritos ao perfil privado para personalizar orientações do Assistente.
- **Sessão autenticada com JWT em cookie `HttpOnly`** e senha criptografada com `bcryptjs`.
- **Recuperação de senha com código de 6 dígitos** (validade de 15 minutos) via **Brevo** em produção ou terminal no modo local.

---

## 🛠️ Tecnologias Utilizadas

- **Back-end:** Node.js, TypeScript, Express, Prisma ORM
- **Banco de Dados & Busca Vetorial:** PostgreSQL 15 + `pgvector`
- **IA & Processamento de PDFs:** Google Gemini (`@google/genai`), `gemini-embedding-001`, `pdf-parse`, RAG híbrido (vetorial + lexical)
- **Front-end:** HTML5, CSS3 e JavaScript *mobile-first* (SPA servida diretamente pela pasta `public/`)
- **Segurança & E-mail:** JWT (`HttpOnly` cookie), `bcryptjs`, *rate limiting* por janela de tempo, cota diária de API e envio transacional via Brevo API / Console
- **Infraestrutura:** Docker Compose (desenvolvimento local), Render + Neon PostgreSQL (produção via `render.yaml`)

---

## 💻 Passo a Passo para Rodar Localmente

### Pré-requisitos
- **Git**
- **Node.js** (`>= 22.13.0`) e **Yarn**
- **Docker Desktop** (ou Docker Engine + Docker Compose)

### 1. Clonar, instalar dependências e criar o `.env`

```bash
git clone https://github.com/GabrielStamfordDev/CITi-PTA-Inovacao.git
cd CITi-PTA-Inovacao
yarn install
```

Crie o `.env` copiando o `.env.example` (que já vem configurado para o PostgreSQL do Docker e modo terminal):

- **Linux / macOS / Git Bash:**
  ```bash
  cp .env.example .env
  ```
- **Windows PowerShell:**
  ```powershell
  Copy-Item .env.example .env
  ```

> **Quer rodar sem configurar chaves externas?** Você não precisa editar nada no `.env`! Basta seguir para o Passo 2. Se quiser ativar **Gemini** e **Brevo** localmente, preencha as variáveis opcionais abaixo no `.env`:

| Variável | Obrigatória localmente? | Descrição e comportamento |
| :--- | :--- | :--- |
| `DATABASE_URL` / `DIRECT_URL` | **Sim** (já preenchida) | Já apontam por padrão para o PostgreSQL do Docker (`postgresql://postgres:docker@localhost:5432/cuida`). |
| `AUTH_SECRET` | Opcional em dev | Chave aleatória longa para assinar cookies JWT (recomendada em produção). |
| `GEMINI_API_KEY` | Opcional em dev | Coloque sua chave do Google AI Studio para ativar o Gemini. **Se deixada comentada/vazia, usa o modo `rag-local` automaticamente.** |
| `MAIL_PROVIDER` | Já vem como `console` | Com `console`, códigos de redefinição de senha aparecem no terminal. Para enviar e-mails reais, defina `brevo`. |
| `BREVO_API_KEY` | Apenas se `MAIL_PROVIDER=brevo` | Sua chave transacional da Brevo + `MAIL_FROM_EMAIL` verificado. |

### 2. Subir e iniciar com os 4 comandos essenciais

Com apenas esses 4 comandos, toda a aplicação (login, perfil, Fórum e Assistente CuiDA) já entra no ar em **[http://localhost:3001](http://localhost:3001)**:

```bash
docker-compose up -d
yarn migration
yarn seed
yarn dev
```

*(Para testar em build de produção local, use `yarn build` seguido de `yarn start`.)*

### 3. (Opcional) Indexar os 8 PDFs completos para busca página a página

Mesmo sem rodar este passo, o Assistente já funciona normalmente usando os resumos científicos curados embarcados no código (`src/data/acervoCientifico.ts`). Caso queira ativar o **RAG híbrido completo com citações por página** direto dos 8 PDFs de `acervo-pdf/` no PostgreSQL local:

- **Com `GEMINI_API_KEY` no `.env` (vetorial + lexical):**
  ```bash
  yarn rag:ingest
  ```
- **Sem `GEMINI_API_KEY` (apenas indexação lexical local):**
  ```bash
  yarn rag:ingest --lexical-only
  ```

---

## 🧪 Avaliação Objetiva do RAG (`yarn rag:eval`)

O projeto inclui um conjunto de **15 cenários de avaliação** (`src/rag/evaluateCli.ts`: 11 perguntas no escopo clínico/assistencial + 4 casos negativos e sintomas agudos fora do acervo) para medir *Precision@6*, *Document Recall*, *MRR* e taxa de recusa segura:

- **Com `GEMINI_API_KEY`:**
  ```bash
  yarn rag:eval
  ```
- **Sem `GEMINI_API_KEY` (modo lexical local):**
  ```bash
  yarn rag:eval --lexical-only
  ```

---

## 📂 Estrutura de Pastas

```text
.
├── acervo-pdf/                 # 8 documentos científicos e guias oficiais (PDF)
├── design_thinking/            # 12 artefatos completos do processo de Design Thinking
├── figuras/                    # Figuras de apoio da documentação/relatório
├── prisma/
│   ├── migrations/             # Histórico de migrations (incluindo pgvector e Fórum)
│   ├── schema.prisma           # Modelagem User, RagChunk, ForumRoom, ForumMessage, etc.
│   └── seed.ts                 # Dados iniciais (usuários demo, eventos, FAQs e 4 salas do Fórum)
├── public/
│   ├── assets/                 # Logos, avatares e imagens da interface
│   ├── app.js                  # Lógica da SPA mobile-first, Assistente, Fórum e acessibilidade
│   └── index.html              # Estrutura HTML + estilos responsivos e acessíveis
├── src/
│   ├── controllers/            # Controladores HTTP (AppController, UserController)
│   ├── data/                   # Metadados curados das 8 fontes científicas
│   ├── database/               # Instância singleton do Prisma Client
│   ├── middlewares/            # Autenticação JWT (authMiddleware) e rate limit (rateLimitMiddleware)
│   ├── prompts/                # Prompt estruturado PTCF do Assistente (assistente-cuida.ptcf.md)
│   ├── rag/                    # Extrator PDF, chunker, embeddings, ingestão, retriever e eval (15 casos)
│   ├── repositories/           # Consultas Prisma e mascaramento LGPD do Fórum
│   ├── services/               # Lógica de negócio (AssistantService, MailService)
│   ├── utils/                  # Token JWT, orçamento diário de chamadas (dailyCallBudget) e paths
│   ├── routes.ts               # Definição das rotas /api/*
│   └── server.ts               # Inicialização do servidor Express e static files
├── .env.example                # Modelo das variáveis de ambiente
├── docker-compose.yml          # Container pgvector/pgvector:pg15 para uso local
├── render.yaml                 # Configuração de deploy no Render
├── relatorio.pdf               # Relatório técnico final do projeto
└── README.md                   # Esta documentação
```
