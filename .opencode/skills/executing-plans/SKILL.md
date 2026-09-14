---
name: executing-plans
description: "Use para executar planos de implementação passo a passo na Criação de Sites, gerenciando checkpoints visuais, responsividade, testes automatizados (Go + Vitest/Playwright) e governança no SDD."
---

# Execução de Planos (Criação de Sites)

Executa tarefas de desenvolvimento planejadas com rigor técnico, garantindo validação em cada checkpoint visual e de código, e sincronização contínua dos artefatos de governança.

---

## O Ciclo de Execução

### 1. Início da Execução
- Anunciar: *"Iniciando execução do plano com a skill `executing-plans`."*
- Abrir o plano de implementação aprovado.
- Atualizar o status da funcionalidade em `docs/sdd/status.md` para `em_andamento`.

### 2. Para Cada Tarefa (TS-XX)
1. **Marcar como ativa:** Indicar explicitamente qual tarefa está em progresso.
2. **Ciclo de Construção e Validação:**
   - **Backend (Go):**
     - Escrever teste unitário primeiro (Red).
     - Implementar o código mínimo no handler/service (Green).
     - Confirmar que o teste passa com `go test -v ./...`.
   - **Frontend (Next.js):**
     - Construir o componente respeitando os tokens do `design-system` e evitando UI genérica (Anti-UI Slop).
     - Implementar testes de interação ou validação de formulário (Vitest).
     - Conferir visualmente a responsividade (garantindo que não ocorra rolagem horizontal em telas de 320px).
3. **Marcar como concluída:** Atualizar o checkbox da tarefa no plano.

### 3. Em Caso de Bloqueios
- Se houver divergência de design, conflito de dependências ou dúvida sobre o tom de voz do texto:
  - **PARE imediatamente**. Não adivinhe requisitos críticos de produto ou identidade visual.
  - Formule a pergunta de forma objetiva ao usuário ou revise a especificação de design.

### 4. Conclusão e Handoff
Ao finalizar todas as tarefas do plano:
1. Executar a suíte completa de verificação:
   - Backend: `go test -v ./...` na pasta `backend/` (se aplicável)
   - Frontend: `npm run test:run` na pasta `frontend/`
   - Build de produção para validar tipos e imports: `npm run build`
2. Disparar a skill `requesting-code-review` para auditoria do diff de código, SEO e estética visual.
3. Atualizar:
   - `docs/sdd/status.md`: Mudar estado para `testado` ou `revisado`.
   - `docs/sdd/handoff.md`: Registrar o que foi entregue, comandos validados e próximos passos.
