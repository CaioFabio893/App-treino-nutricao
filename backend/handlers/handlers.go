// Package handlers é a camada HTTP: decodifica o request, valida entrada,
// delega para service (regra de negócio) ou repository (persistência) e
// serializa a resposta. Nenhuma regra de negócio vive aqui.
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"
	"unicode/utf8"

	firebaseAuth "firebase.google.com/go/v4/auth"

	"treino-louise/backend/middleware"
	"treino-louise/backend/repository"
	"treino-louise/backend/service"
)

// Handlers agrupa os casos de uso HTTP. svc concentra as regras de negócio;
// repo é usado pelos handlers que são CRUD fino (leitura/gravação direta) e
// auth (Admin SDK) é usado para excluir contas do Firebase Auth quando um
// cadastro é recusado ou um usuário é excluído.
type Handlers struct {
	svc  *service.Service
	repo repository.Repository
	auth *firebaseAuth.Client
}

// New constrói os handlers com as dependências injetadas.
func New(svc *service.Service, repo repository.Repository, auth *firebaseAuth.Client) *Handlers {
	return &Handlers{svc: svc, repo: repo, auth: auth}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	// Serializa ANTES de escrever o header: se a serialização falhar, ainda dá
	// para responder 500 sem "superfluous WriteHeader" no log.
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(v); err != nil {
		http.Error(w, "erro ao serializar resposta", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(buf.Bytes())
}

// canAccessResource verifica se o usuário logado pode acessar um recurso
// vinculado a studentID (delega à regra pura do service).
func canAccessResource(r *http.Request, studentID string) bool {
	return service.CanAccessResource(
		middleware.UIDFrom(r.Context()),
		middleware.RoleFrom(r.Context()),
		studentID,
	)
}

// validDate valida uma data no formato AAAA-MM-DD.
func validDate(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

// tooLong devolve true se s (medido em runas, não bytes) exceder max.
// Centraliza a validação de tamanho de entrada dos campos textuais controlados
// pelo cliente — os limites ficam em service/constants.go.
func tooLong(s string, max int) bool {
	return utf8.RuneCountInString(s) > max
}

func (h *Handlers) HandleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

