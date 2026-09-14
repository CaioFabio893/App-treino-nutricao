---
name: test-driven-development
description: "Use ao implementar qualquer funcionalidade, componente ou endpoint na Criação de Sites. Regra de ouro: Red -> Green -> Refactor com Go test, Vitest e Playwright para garantir qualidade, acessibilidade e ausência de regressões."
---

# Desenvolvimento Dirigido por Testes (TDD) - Criação de Sites

## Visão Geral

Escreva o teste primeiro. Assista-o falhar. Escreva o código mínimo para passar. Refatore mantendo a barra verde.

**Princípio central:** Se você não assistiu ao teste falhar, você não sabe se ele testa o comportamento correto.

---

## A Lei de Ferro do TDD

```
NENHUM CÓDIGO DE PRODUÇÃO SEM UM TESTE FALHANDO PRIMEIRO
```

Escreveu código antes do teste? Revierta e comece de novo pelo teste.

---

## As 3 Fases do Ciclo

### 1. VERMELHO (Red) - Escrever Teste Falhando
Escreva um teste focado em um comportamento observável específico.
- **Backend Go:** Em `backend/service/` ou `backend/handlers/` (ex: `*_test.go`).
- **Frontend TS/React:** Em `frontend/tests/unit/` (usando Vitest e React Testing Library).

Execute o teste e **confirme a falha esperada**:
```bash
# Backend (Go):
cd backend
go test -v ./service -run TestNomeDoTeste

# Frontend (Vitest):
cd frontend
npm run test:run -- tests/unit/nome_do_arquivo.test.tsx
```

> **Atenção:** Se o teste passar imediatamente ou der erro de sintaxe/import ao invés de asserção de comportamento, corrija o teste até que ele falhe pelo motivo exato da regra de negócio ausente.

### 2. VERDE (Green) - Código Mínimo
Implemente apenas o código estritamente necessário para fazer o teste passar.
- Sem antecipar cenários não especificados (YAGNI).
- Sem complexidade prematura ou abstrações desnecessárias.

Reexecute o teste e confirme sucesso:
```bash
# Backend:
go test -v ./...

# Frontend:
npm run test:run
```

### 3. REFATORAR (Refactor) - Limpeza e Padrão
Após a barra verde:
- Eliminar duplicações de código.
- Melhorar clareza de nomes de funções, variáveis e componentes.
- Garantir separação de camadas (Clean Architecture no Go, hooks/componentes puros no React).
- Confirmar que a suíte inteira permanece verde.

---

## Comandos da Suíte de Testes

### 1. Backend (Go)
```bash
# Todos os testes de backend:
cd backend
go test -v ./...

# Teste específico com medição de cobertura:
go test -v -cover ./service
```

### 2. Frontend Unitários & Componentes (Vitest)
```bash
cd frontend
# Execução única de todos os testes:
npm run test:run

# Modo interativo (watch) durante desenvolvimento:
npm test

# Testar arquivo específico:
npx vitest run tests/unit/contact_form.test.tsx
```

### 3. Frontend End-to-End (Playwright)
```bash
cd frontend
# Executar todos os testes E2E:
npx playwright test

# Executar fluxo específico (ex: envio de lead ou menu mobile):
npx playwright test tests/e2e/lead-flow.spec.ts
```

---

## Padrões de Testes por Camada de Website

| Domínio | Local | Ferramenta | O que testar |
|---|---|---|---|
| **Validação de Formulário** | `backend/service/` | `go test` | Bloqueio de campos vazios, validação de formato de email e descarte de spam via honeypot |
| **API Handlers** | `backend/handlers/` | `go test` | Código de resposta HTTP (201 Created vs 422 Unprocessable), parsing JSON |
| **Componentes de UI** | `frontend/tests/unit/` | Vitest + RTL | Renderização de inputs, mensagens de erro inline, estado de botão desabilitado em loading |
| **Navegação & Mobile** | `frontend/tests/e2e/` | Playwright | Abertura/fechamento do menu mobile hambúrguer e rolagem para seções âncora |
| **Fluxo Completo de Lead** | `frontend/tests/e2e/` | Playwright | Visitante preenche o formulário no site, clica em enviar e recebe feedback visual de sucesso |

---

## Anti-Padrões a Evitar

- ❌ **Mocks Excessivos**: Não teste os mocks; prefira repositórios em memória ou estruturas fakes leves.
- ❌ **Testar Detalhe de Implementação**: Teste a resposta HTTP, a mudança visível na tela ou o retorno da função, e não variáveis internas privadas.
- ❌ **Pular a Verificação do Vermelho**: Sem ver a falha acontecer primeiro, o teste pode ser um falso positivo permanente.
