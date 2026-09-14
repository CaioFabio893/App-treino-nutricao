---
name: writing-plans
description: "Converte especificações ou designs aprovados em planos de implementação técnica atômica e orientada a testes para Criação de Sites. Garante o fluxo: Spec -> Plano com Cenários BDD -> TDD -> Implementação (Next.js + Go)."
---

# Escrita de Planos (Criação de Sites)

Transforma especificações de design, arquitetura de páginas e contratos de API em planos técnicos executáveis, divididos em tarefas atômicas e testáveis.

---

## Fluxo de Trabalho

### 1. Ingestão da Especificação
- Ler a especificação aprovada em `docs/superpowers/specs/` ou o item correspondente em `docs/sdd/backlog.md`.
- Mapear as camadas e áreas envolvidas:
  - **Frontend Next.js:** `src/app/` (páginas, layout, metadados), `src/components/` (seções, navbar, cards, formulários), `src/lib/` (utilitários, API client).
  - **Backend Go:** `handlers/`, `service/`, `repository/`, `models/` (quando houver recebimento de formulários, leads ou área restrita).
  - **Estilos & Assets:** Tokens em `tailwind.config.ts`, `src/app/globals.css`, imagens otimizadas em `public/`.

### 2. Quebra em Tarefas Atômicas (Bite-Sized)
- Dividir a implementação em tarefas incrementais que possam ser desenvolvidas e validadas de forma independente.
- Cada tarefa deve conter:
  - Objetivo técnico e escopo visual claro.
  - Arquivos que serão criados ou modificados.
  - Cenário BDD (Dado / Quando / Então).
  - Verificação de sucesso (teste automatizado ou validação de renderização/responsividade).

### 3. Modelo do Plano de Implementação

```markdown
# Plano de Implementação: [Nome da Página ou Seção]

## 1. Resumo e Objetivo
[Descrição concisa do objetivo comercial da página/seção e experiência do usuário]

## 2. Matriz de Tarefas (Task Breakdown)

| ID | Camada | Descrição da Tarefa | Verificação / Teste |
|---|---|---|---|
| TS-01 | Backend (Go) | Criar model de Lead e contrato de persistência | `go test -v ./service -run Test...` |
| TS-02 | Backend (Go) | Implementar endpoint de envio com honeypot | `go test -v ./handlers -run Test...` |
| TS-03 | Frontend (UI) | Criar componente de formulário com validação visual | `npm run test:run -- tests/unit/contact-form.test.tsx` |
| TS-04 | Frontend (Page)| Montar a seção Hero e integrar Navbar responsiva | Inspeção visual (Mobile + Desktop) |
| TS-05 | E2E / SEO | Configurar OpenGraph metadata e teste de envio E2E | `npx playwright test tests/e2e/lead-flow.spec.ts` |

## 3. Cenários BDD Detalhados por Tarefa

### TS-03: Formulário de Contato / Lead
- **Cenário:** Envio de formulário com dados válidos
  - **Dado que** o visitante preenche nome, email e mensagem válidos
  - **Quando** clica no botão "Solicitar Orçamento"
  - **Então** o botão deve exibir estado de carregamento (spinner)
  - **E** após o retorno 201 da API, exibir feedback visual de sucesso
  - **E** limpar os campos do formulário

## 4. Checklist de Verificação e Gates
- [ ] Backend Go: `go test -v ./...` sem falhas
- [ ] Frontend: `npm run test:run` sem falhas
- [ ] Responsividade: Validado em 320px (mobile), 768px (tablet) e 1440px (desktop)
- [ ] SEO: Title, Description e tags OpenGraph configuradas
```

### 4. Transição
- Concluído o plano, acionar a skill `executing-plans` para execução rigorosa das etapas.
