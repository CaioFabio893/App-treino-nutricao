package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"treino-louise/backend/middleware"
	"treino-louise/backend/models"
	"treino-louise/backend/service"
)

// ── Aprovação de cadastro (admin) ──

// HandleListPendingUsers lista os cadastros aguardando aprovação (admin).
func (h *Handlers) HandleListPendingUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.ListUsersByStatus(r.Context(), models.StatusPendingApproval)
	if err != nil {
		http.Error(w, "falha ao listar cadastros pendentes", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, users)
}

// HandleApproveUser aprova um cadastro e confirma o papel de aluno.
func (h *Handlers) HandleApproveUser(w http.ResponseWriter, r *http.Request) {
	adminID := middleware.UIDFrom(r.Context())
	id := r.PathValue("id")

	var req models.ApproveUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if req.Role == "" {
		http.Error(w, "papel obrigatorio", http.StatusBadRequest)
		return
	}

	err := h.svc.ApproveUser(r.Context(), adminID, id, req.Role)
	if err != nil {
		h.serviceError(err, w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// HandleRejectUser recusa o cadastro: marca rejected no Firestore (auditoria)
// e exclui a conta do Firebase Auth (decisão SB-001 — pessoa não consegue mais
// logar). Se a exclusão no Auth falhar, o cadastro permanece recusado no
// Firestore e o frontend informa o admin do estado parcial.
func (h *Handlers) HandleRejectUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req models.RejectUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if tooLong(req.Reason, service.MaxRejectReason) {
		http.Error(w, "motivo muito longo", http.StatusBadRequest)
		return
	}

	if err := h.svc.RejectUser(r.Context(), id, req.Reason); err != nil {
		h.serviceError(err, w)
		return
	}

	if h.auth != nil {
		if err := h.auth.DeleteUser(r.Context(), id); err != nil {
			http.Error(w, `{"error":"cadastro recusado, mas falha ao excluir conta Firebase"}`, http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// serviceError traduz erros de negócio do service em respostas HTTP.
func (h *Handlers) serviceError(err error, w http.ResponseWriter) {
	switch {
	case errors.Is(err, service.ErrUserNotFound):
		http.Error(w, "usuario nao encontrado", http.StatusNotFound)
	case errors.Is(err, service.ErrInvalidRole):
		http.Error(w, "papel invalido", http.StatusBadRequest)
	default:
		http.Error(w, "falha ao processar", http.StatusInternalServerError)
	}
}
