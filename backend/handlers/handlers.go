// Package handlers é a camada HTTP: decodifica o request, valida entrada,
// delega para service (regra de negócio) ou repository (persistência) e
// serializa a resposta. Nenhuma regra de negócio vive aqui.
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	firebaseAuth "firebase.google.com/go/v4/auth"

	"treino-louise/backend/middleware"
	"treino-louise/backend/models"
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
// vinculado a studentID/nutritionistID (delega à regra pura do service).
func canAccessResource(r *http.Request, studentID, nutritionistID string) bool {
	return service.CanAccessResource(
		middleware.UIDFrom(r.Context()),
		middleware.RoleFrom(r.Context()),
		studentID,
		nutritionistID,
	)
}

// validDate valida uma data no formato AAAA-MM-DD.
func validDate(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

func (h *Handlers) HandleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ── Sessions ──

func parseWeekDay(r *http.Request) (int, string, bool) {
	week, err := strconv.Atoi(r.PathValue("week"))
	if err != nil || week < 1 || week > 12 {
		return 0, "", false
	}
	day := r.PathValue("day")
	if day == "" {
		return 0, "", false
	}
	return week, day, true
}

func (h *Handlers) HandleGetSession(w http.ResponseWriter, r *http.Request) {
	week, day, ok := parseWeekDay(r)
	if !ok {
		http.Error(w, "week/day invalido", http.StatusBadRequest)
		return
	}

	sess, err := h.repo.GetSession(r.Context(), middleware.UIDFrom(r.Context()), week, day)
	if err != nil {
		http.Error(w, "falha ao ler sessao", http.StatusInternalServerError)
		return
	}
	if sess == nil {
		writeJSON(w, http.StatusOK, map[string]any{"week": week, "day": day, "exercise": nil})
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *Handlers) HandlePutSession(w http.ResponseWriter, r *http.Request) {
	week, day, ok := parseWeekDay(r)
	if !ok {
		http.Error(w, "week/day invalido", http.StatusBadRequest)
		return
	}

	var sess models.Session
	if err := json.NewDecoder(r.Body).Decode(&sess); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	sess.Week = week
	if sess.Day == "" {
		sess.Day = day
	}

	if err := h.repo.PutSession(r.Context(), middleware.UIDFrom(r.Context()), &sess); err != nil {
		http.Error(w, "falha ao salvar sessao", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── PRs ──

func (h *Handlers) HandleGetPRs(w http.ResponseWriter, r *http.Request) {
	p, err := h.repo.GetPRs(r.Context(), middleware.UIDFrom(r.Context()))
	if err != nil {
		http.Error(w, "falha ao ler PRs", http.StatusInternalServerError)
		return
	}
	if p == nil {
		writeJSON(w, http.StatusOK, map[string]any{"a": 0, "b": 0, "c": 0})
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *Handlers) HandlePutPRs(w http.ResponseWriter, r *http.Request) {
	var p models.PR
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if err := h.repo.PutPRs(r.Context(), middleware.UIDFrom(r.Context()), &p); err != nil {
		http.Error(w, "falha ao salvar PRs", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── State ──

func (h *Handlers) HandleGetState(w http.ResponseWriter, r *http.Request) {
	st, err := h.repo.GetState(r.Context(), middleware.UIDFrom(r.Context()))
	if err != nil {
		http.Error(w, "falha ao ler estado", http.StatusInternalServerError)
		return
	}
	if st == nil {
		writeJSON(w, http.StatusOK, map[string]any{"week": 1, "day": 0})
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (h *Handlers) HandlePutState(w http.ResponseWriter, r *http.Request) {
	var st models.AppState
	if err := json.NewDecoder(r.Body).Decode(&st); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if err := h.repo.PutState(r.Context(), middleware.UIDFrom(r.Context()), &st); err != nil {
		http.Error(w, "falha ao salvar estado", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
