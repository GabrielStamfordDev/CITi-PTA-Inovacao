# Prompt para Continuação da Documentação: Produto, Tecnologias e Uso de IA (Projeto CuiDA)

## Contexto e Diretriz Inicial

Você deverá redigir a **segunda metade do relatório final do projeto CuiDA**, dando continuidade direta ao conteúdo já documentado em `relatorio.pdf` (que cobriu toda a etapa de Design Thinking). 

**Atenção:** Descarte completamente qualquer versão anterior escrita em `relatorio.tex`. Parta exclusivamente do ponto onde o `relatorio.pdf` termina, garantindo uma transição natural entre a validação do protótipo e a construção do produto funcional para atender aos critérios de documentação do Desafio de Inovação do CITi.

---

## Tom de Voz e Estilo de Escrita

* **Continuidade Estilística:** Adote **exatamente o mesmo tom de escrita** utilizado em `relatorio.pdf` — narrado em **primeira pessoa do singular** (*"desenvolvi"*, *"optei"*, *"utilizei"*, *"estruturei"*), com linguagem natural, fluida, acessível, humana e objetiva.
* **Visão de Produto e Negócio:** Explique as decisões sob a ótica de valor entregue ao usuário final (cuidadoras informais de pessoas com Doença de Alzheimer) e de viabilidade prática de construção, sem transformar o texto em um manual técnico de engenharia de software.

---

## Tópicos Obrigatórios a Serem Desenvolvidos

Desenvolva a continuação do relatório cobrindo todos os pontos abaixo (organizados na ordem que proporcionar a melhor fluidez de leitura):

1. **Apresentação da Plataforma e Principais Funcionalidades:**
   * Apresente o **CuiDA** como uma solução web responsiva (*Mobile-First*), explicando a decisão estratégica de implementá-la como um site acessível via navegador em vez de um aplicativo nativo de loja (eliminando barreiras de instalação para cuidadoras sobrecarregadas).
   * Descreva, de forma clara e orientada ao uso, as **principais funcionalidades implementadas** na plataforma (inspecionando o projeto real no repositório): autenticação e perfil personalizado do cuidador, mural de Eventos e Encontros com inscrição funcional, diretório ativo de Links de Apoio (ABRAz-PE, WhatsApp e Facebook), central de conteúdo educativo (*Sobre Alzheimer*), seção interativa de Perguntas Frequentes (FAQ) e o **Assistente Virtual CuiDA** com Inteligência Artificial.

2. **Ferramentas Utilizadas e Funcionamento em Alto Nível:**
   * Explique em **alto nível** como a plataforma funciona por trás das telas (como o front-end se comunica com o servidor e o banco de dados para salvar perfis, inscrições e entregar os conteúdos).
   * Explique o funcionamento conceitual do **Assistente de IA do CuiDA** baseado em **RAG** (*Retrieval-Augmented Generation*), deixando claro como ele consulta exclusivamente um acervo confiável de manuais e diretrizes clínicas sobre Alzheimer para responder às dúvidas das cuidadoras com segurança, empatia e sem inventar informações médicas.
   * **Menção Breve ao Design:** Cite brevemente o uso do **Figma** (prototipação) e do **Maze** (testes de usabilidade) como ferramentas fundamentais na concepção do produto, pontuando explicitamente que o detalhamento de ambas já foi apresentado na primeira parte deste relatório.

3. **Infraestrutura e Hospedagem em Nuvem (Render e Neon):**
   * Aborde a escolha das plataformas **Render** (hospedagem da aplicação) e **Neon** (banco de dados PostgreSQL em nuvem) para colocar o CuiDA no ar.
   * Explique o **porquê do uso** de ambas (agilidade de deploy, integração direta com o GitHub e disponibilidade imediata da camada gratuita para validar o MVP em produção) e seja transparente quanto às **suas limitações** (como a hibernação/tempo de inicialização a frio — *cold start* — após períodos de inatividade na camada gratuita do Render e os limites de armazenamento/computação do plano gratuito do Neon).

4. **Uso Estratégico de Inteligência Artificial no Desenvolvimento:**
   * Detalhe como a Inteligência Artificial foi utilizada como aceleradora em diferentes frentes do projeto, especificando exatamente o papel de cada uma das ferramentas abaixo:
     * **NotebookLM (Google Gemini):** Utilizado **exclusivamente** para realizar um *Deep Search* e minerar artigos científicos, manuais oficiais e fontes confiáveis sobre a Doença de Alzheimer e boas práticas de cuidado, formando o acervo documental que alimenta o assistente do aplicativo.
     * **Antigravity:** Utilizado para acelerar o desenvolvimento e a implementação de toda a estrutura de código da aplicação, transformando o protótipo validado em um sistema funcional em tempo recorde.
     * **ChatGPT e Argon Gemini (com acesso direto ao repositório no GitHub):** Utilizados em conjunto como "segunda opinião" técnica e de produto, analisando o código real do repositório para sugerir melhorias contínuas, refinar fluxos de experiência do usuário (UX/UI) e propor novas adições funcionais ao aplicativo.

---

## Restrições Absolutas (O QUE EVITAR A TODO CUSTO)

Para manter o relatório alinhado ao público avaliador e ao estilo narrativo do documento, **NÃO FAÇA** em hipótese alguma:

1. **Zero Código ou Estrutura de Arquivos:** Nunca cite, escreva ou exemplifique trechos de código, comandos de terminal, nomes de funções/arquivos ou hierarquias de pastas do repositório.
2. **Zero Jargões Técnicos de Baixo Nível:** Evite completamente termos técnicos excessivamente específicos ou siglas de implementação (tais como *SHA-256*, *HMAC*, *embedding*, *pgvector*, *HNSW*, *tsvector*, *RRF*, *ORM*, *endpoints*, *tokens JWT* ou detalhes de criptografia).
   * **Única exceção permitida:** O termo **RAG** (*Retrieval-Augmented Generation*), que **deve** ser usado e explicado em alto nível para descrever como o assistente de IA do CuiDA busca informações nas fontes confiáveis antes de responder ao usuário.