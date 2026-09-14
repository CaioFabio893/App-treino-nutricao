---
name: sdd-orchestrator
description: "Orquestrador mestre do ciclo de vida SDD (Spec-Driven Development) para Criação de Sites e Plataformas Web. Coordena requisitos, frontend Next.js/Tailwind, backend Go (Clean Architecture), testes TDD, design system e code-review com rastreabilidade total via BACKLOG, STATUS e HANDOFF."
---

# SDD Orchestrator (Spec-Driven Development) - Criação de Sites

Este é o **orquestrador mestre** para o desenvolvimento de **Sites e Plataformas Web Modernas**, inspirado na metodologia SDD enterprise. Ele rege o fluxo de desenvolvimento do início ao fim, garantindo que nenhuma linha de código seja produzida sem especificação prévia, que o padrão Clean Layered Architecture seja rigorosamente respeitado no backend (Go) e a excelência visual e de performance no frontend (Next.js), mantendo os artefatos de controle sempre sincronizados.

---

## 1. Matriz de Skills Integradas

O orquestrador coordena o ecossistema de skills especializadas para criação de websites de alto impacto:

| Fase SDD | Skills Primárias | Entradas / Referências | Saídas Obrigatórias |
|---|---|---|---|
| **1. Requisitos & Especificação** | `brainstorming`, `writing-plans` | Intenção do cliente, público-alvo, mapa do site, propostas de valor, conversão | `docs/superpowers/specs/`, `docs/sdd/backlog.md` |
| **2. Design & UI Specs** | `design-system`, `ui-design`, `ui-radar`, `anti-ui-slop` | Tokens semânticos, paleta do projeto, tipografia Google Fonts, referências visuais | `globals.css`, tokens Tailwind, componentes em `src/components/` |
| **3. Desenvolvimento Frontend** | `design-system`, `anti-ui-slop` | Specs de seções (Hero, Serviços, Prova Social, FAQ, Contato), responsividade mobile-first | Páginas em `src/app/`, seções e componentes em `src/components/` |
| **4. Desenvolvimento Backend** | `backend-development`, `test-driven-development` | Specs de API, endpoints de contato/leads, auth admin, CRUD de conteúdo | Handlers, Services, Repositories e testes em Go (`go test -v ./...`) |
| **5. Testes & Qualidade** | `test-driven-development` | Cenários BDD (Gherkin: Dado/Quando/Então), fluxos de usuário | `go test -v ./...`, `npm run test:run` (Vitest) e `npx playwright test` |
| **6. Revisão & Auditoria** | `requesting-code-review`, `anti-ui-slop` | Código vs Specs, responsividade (320px a 4K), SEO, Core Web Vitals, segurança de API | Relatório de conformidade e aprovação |
| **7. Handoff & Governança** | `executing-plans`, `sdd-orchestrator` | Entregas da sessão de trabalho | Atualização de `docs/sdd/status.md` e `docs/sdd/handoff.md` |

---

## 2. Ciclo de Vida da Spec (Status Transitions)

Toda funcionalidade, página ou seção percorre os seguintes estados formais:

```
[ backlog ] ───► [ em_andamento ] ───► [ pronto ] ───► [ testado ] ───► [ revisado ]
```

1. **`backlog`**: Requisito descrito com cenários BDD e escopo visual/técnico definido, aguardando início.
2. **`em_andamento`**: Frontend (Next.js) ou Backend (Go) em desenvolvimento ativo com TDD (Vermelho ➔ Verde).
3. **`pronto`**: Código implementado satisfazendo os critérios da especificação e o design aprovado.
4. **`testado`**: 100% dos testes unitários (Go + Vitest) e validações E2E/visuais (Playwright) passando sem erros.
5. **`revisado`**: Code review aprovado contra as diretrizes de Clean Architecture, Anti-UI Slop, SEO e Responsividade.

---

## 3. Arquitetura do Projeto

Adotamos uma arquitetura full-stack moderna e desacoplada:

### Frontend (Next.js 14/15 + TypeScript + Tailwind CSS)
- **`src/app/`**: Next.js App Router para rotas públicas, páginas de pouso, blog/notícias e área administrativa.
- **`src/components/layout/`**: Navbar fixa com navegação fluida, Footer completo e menu mobile responsivo.
- **`src/components/sections/`**: Seções reutilizáveis e componíveis do site (Hero, Benefícios, Serviços/Produtos, Depoimentos/Prova Social, Planos/Tabela de Preços, FAQ sanfonado, Formulário de Contato/Orçamento).
- **`src/components/ui/`**: Componentes atômicos e acessíveis (Botões com estados, Modais, Cards, Inputs com validação, Badges).
- **`src/lib/`**: Utilitários de formatação, clientes HTTP, configuração de animações e manipulação de formulários.
- **SEO & Otimização**: `next/font` para tipografia sem layout shift, `next/image` para imagens modernas (WebP/AVIF) e Metadata API configurada para OpenGraph e Schema.org.

### Backend (Go 1.22+): Clean Layered Architecture
Estrutura em camadas concisas e de alta performance:
- **`handlers/` (Transport Layer)**:
  - `contact_handler.go`: Recebimento de formulários de contato, orçamentos e captação de leads.
  - `auth_handler.go`: Autenticação e sessões para painel de administração (JWT / Cookies seguros).
  - `content_handler.go`: Gerenciamento e listagem de conteúdo dinâmico (postagens de blog, depoimentos, itens de catálogo).
  - `helpers.go`: Utilitários de parsing, resposta JSON (`RespondJSON`, `RespondError`) e validação de payloads.
- **`service/` (Application / Business Layer)**:
  - Regras de negócio puras, sanitização de dados, proteção anti-spam (honeypot/rate limiting), disparo transacional de emails/mensagens e orquestração de persistência.
- **`repository/` (Data Access Layer)**:
  - Desacoplado via `RepositoryInterface`.
  - Implementação com suporte a banco relacional (PostgreSQL, SQLite) ou Firestore/NoSQL conforme a necessidade do projeto.
- **`models/` (Domain Entities & DTOs)**:
  - Structs de domínio tipadas: `Lead`, `ContactMessage`, `User`, `ContentItem`, `SEOMetadata`.
- **`middleware/` (Security & Observability)**:
  - CORS restrito, Rate Limiting, Security Headers (CSP, HSTS), logging estruturado e Auth JWT.

---

## 4. Workflow Obrigatório de Cada Sessão

1. **Início da Sessão:**
   - Ler `docs/sdd/handoff.md` (retomar exatamente onde parou).
   - Ler `docs/sdd/status.md` e `docs/sdd/backlog.md`.
2. **Durante a Execução:**
   - Selecionar a próxima spec prioritária do site.
   - Definir design e regras de apresentação primeiro (sem UI slop).
   - Escrever testes primeiro (TDD Red: validação de formulários, asserções de componentes e endpoints).
   - Implementar código desacoplado (TDD Green).
   - Refatorar garantindo Clean Architecture no Go e padrões visuais no Next.js.
3. **Encerramento da Sessão:**
   - Rodar testes completos:
     - Backend: `go test -v ./...` na pasta `backend/`
     - Frontend: `npm run test:run` na pasta `frontend/`
   - Atualizar `docs/sdd/status.md` e `docs/sdd/backlog.md`.
   - Preencher `docs/sdd/handoff.md` com entregas, decisões e próximos passos.
