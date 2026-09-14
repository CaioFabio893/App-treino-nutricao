---
name: backend-development
description: "Implementa funcionalidades backend em Go 1.22+ com Clean Layered Architecture para Sites e Plataformas Web. Use quando: criar endpoints de API REST, processamento de formulários/leads, autenticação admin, integração com banco de dados, envio de emails/notificações e testes unitários/integração com TDD."
---

# Desenvolvimento Backend (Go) - Criação de Sites & Portais

Implementação de serviços e APIs em Go 1.22+ com Clean Layered Architecture (Ports & Adapters), alto desempenho, baixo consumo de recursos e segurança rigorosa para dar suporte a websites, portais de conteúdo e plataformas online.

---

## Contexto e Stack

- **Linguagem:** Go 1.22+
- **Roteamento:** Go 1.22+ `net/http` padrão (com suporte nativo a métodos e wildcards) ou `chi`
- **Banco de Dados:** PostgreSQL, SQLite ou Firestore/NoSQL (abstraído via `RepositoryInterface`)
- **Autenticação:** JWT seguro com cookies HttpOnly ou Bearer Tokens para área administrativa
- **Integrações:** Envio transacional de email (Resend, SMTP, SendGrid), webhooks e links de mensageria
- **Segurança:** Rate Limiting por IP, proteção Honeypot contra robôs de spam, CORS restrito e Security Headers
- **Deploy:** Container Docker leve (< 25MB) para Cloud Run ou VPS

### Estrutura Padrão do Backend (`backend/`)

```
backend/
├── main.go                       # Bootstrap, injeção de dependência e rotas (< 80 linhas)
├── config/
│   └── config.go                 # Leitura de variáveis de ambiente e flags
├── models/
│   └── types.go                  # Structs de domínio (Lead, Contact, User, Post) e DTOs
├── repository/
│   ├── repository.go             # RepositoryInterface desacoplada
│   └── db_repo.go                # Implementação de persistência com queries parametrizadas
├── service/
│   ├── contact_service.go        # Validação, honeypot, persistência e disparo de notificações
│   └── auth_service.go           # Hashing de senha (bcrypt), geração e validação de JWT
├── handlers/
│   ├── contact_handler.go        # Recebimento de formulários de contato e leads
│   ├── auth_handler.go           # Login/Logout de administradores
│   └── helpers.go                # RespondJSON, RespondError e parsing seguro
└── middleware/
    └── middleware.go             # CORS, Rate Limiter, Auth JWT e Security Headers
```

---

## Quando Usar

Use quando:
- Criar ou atualizar endpoints de captura de leads e formulários de contato do site
- Implementar envio de emails de notificação ou integração com CRM/WhatsApp
- Configurar autenticação para gerenciamento de conteúdo ou visualização de leads
- Implementar persistência de dados em banco relacional ou NoSQL
- Adicionar proteção contra spam (validação de honeypot, rate limiting)
- Escrever testes automatizados em Go (unitários e de integração)

---

## Constraints e Regras de Ouro

1. **Clean Layered Architecture (Desacoplamento Rigoroso)**:
   - Handlers **nunca** acessam o banco de dados diretamente; apenas decodificam HTTP e invocam a camada `service`.
   - A camada `service` orquestra regras de negócio e acessa a persistência exclusivamente através da `RepositoryInterface`.
   - DTOs e entidades residem em `models/`.
2. **Go Idiomático e Error Wrapping**:
   - Sempre tratar erros com `if err != nil { return ..., fmt.Errorf("contexto do erro: %w", err) }`.
   - Propagação obrigatória de `context.Context` em todas as camadas (`handlers -> service -> repository`).
3. **Proteção Anti-Spam e Sanitização**:
   - Todo formulário público de contato deve implementar técnica de **Honeypot** (campo invisível que, se preenchido por robô, descarta silenciosamente o envio).
   - Sanitizar entradas de texto contra injeções ou tags HTML maliciosas.
4. **TDD Obrigatório (Red -> Green -> Refactor)**:
   - Testes unitários de regras de negócio antes de qualquer implementação de produção (`go test -v ./service/...`).

---

## Padrões de Código

### 1. Handler Pattern (Go 1.22+)

```go
package handlers

import (
    "encoding/json"
    "net/http"
    "danver-site/backend/models"
    "danver-site/backend/service"
)

type ContactHandler struct {
    service service.ContactServiceInterface
}

func NewContactHandler(svc service.ContactServiceInterface) *ContactHandler {
    return &ContactHandler{service: svc}
}

func (h *ContactHandler) SubmitLead(w http.ResponseWriter, r *http.Request) {
    var req models.CreateLeadRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondError(w, http.StatusBadRequest, "Corpo da requisição inválido")
        return
    }

    // Se o campo honeypot estiver preenchido, é um bot: responder 200 sem salvar
    if req.WebsiteHoneypot != "" {
        RespondJSON(w, http.StatusOK, map[string]string{"message": "Mensagem enviada com sucesso"})
        return
    }

    lead, err := h.service.ProcessNewLead(r.Context(), &req)
    if err != nil {
        RespondError(w, http.StatusUnprocessableEntity, err.Error())
        return
    }

    RespondJSON(w, http.StatusCreated, lead)
}
```

### 2. Service Pattern

```go
package service

import (
    "context"
    "fmt"
    "strings"
    "danver-site/backend/models"
    "danver-site/backend/repository"
)

type ContactService struct {
    repo   repository.RepositoryInterface
    mailer MailerInterface
}

func NewContactService(repo repository.RepositoryInterface, mailer MailerInterface) *ContactService {
    return &ContactService{repo: repo, mailer: mailer}
}

func (s *ContactService) ProcessNewLead(ctx context.Context, req *models.CreateLeadRequest) (*models.Lead, error) {
    if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Email) == "" {
        return nil, fmt.Errorf("nome e email são obrigatórios")
    }

    lead := &models.Lead{
        Name:      strings.TrimSpace(req.Name),
        Email:     strings.ToLower(strings.TrimSpace(req.Email)),
        Phone:     strings.TrimSpace(req.Phone),
        Message:   strings.TrimSpace(req.Message),
        Source:    req.Source,
        CreatedAt: req.CreatedAt,
    }

    savedLead, err := s.repo.SaveLead(ctx, lead)
    if err != nil {
        return nil, fmt.Errorf("falha ao salvar lead: %w", err)
    }

    // Disparo de notificação assíncrona ou em goroutine monitorada
    go s.mailer.SendNewLeadAlert(context.Background(), savedLead)

    return savedLead, nil
}
```

### 3. Repository Interface Pattern

```go
package repository

import (
    "context"
    "danver-site/backend/models"
)

type RepositoryInterface interface {
    SaveLead(ctx context.Context, lead *models.Lead) (*models.Lead, error)
    ListLeads(ctx context.Context, limit, offset int) ([]models.Lead, error)
    GetAdminByEmail(ctx context.Context, email string) (*models.AdminUser, error)
}
```

---

## Processo TDD no Backend

1. **VERMELHO (Red)**: Escrever teste em `service/*_test.go` ou `handlers/*_test.go` com o comportamento esperado:
   ```bash
   go test -v ./service -run TestProcessNewLead_Validation
   ```
2. **VERDE (Green)**: Escrever a lógica mínima no service/handler para satisfazer o teste.
3. **REFATORAR (Refactor)**: Ajustar nomenclatura, remover duplicações e assegurar que toda a suíte passe:
   ```bash
   go test -v ./...
   ```

---

## Checklist de Conclusão de Endpoint Backend

- [ ] Arquitetura: Handler, Service e Repository devidamente desacoplados?
- [ ] Tratamento de Erros: Todos os retornos de erro encapsulados com contexto explicativo?
- [ ] Validação: Campos obrigatórios, formato de email e honeypot anti-spam validados?
- [ ] TDD: Teste unitário criado antes da implementação?
- [ ] Cobertura: `go test -v ./...` rodou com 100% de sucesso?
