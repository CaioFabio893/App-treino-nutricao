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

// HandleApproveUser aprova um cadastro, define papel e (para aluno) plano —
// com snapshot das features do plano. O nutricionista de um aluno também é
// registrado aqui (nutritionistID), validado via CanAccessStudent.
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

	err := h.svc.ApproveUser(r.Context(), adminID, id, req.Role, req.PlanID, req.NutritionistID)
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

// ── Planos (features) — CRUD admin ──

func (h *Handlers) HandleListPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := h.repo.ListPlans(r.Context())
	if err != nil {
		http.Error(w, "falha ao listar planos", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, plans)
}

func (h *Handlers) HandleCreatePlan(w http.ResponseWriter, r *http.Request) {
	var p models.Plan
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if p.Name == "" {
		http.Error(w, "nome do plano obrigatorio", http.StatusBadRequest)
		return
	}
	p.Features = sanitizeFeatures(p.Features)
	created, err := h.repo.CreatePlan(r.Context(), &p)
	if err != nil {
		http.Error(w, "falha ao criar plano", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

func (h *Handlers) HandleUpdatePlan(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var p models.Plan
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if p.Name == "" {
		http.Error(w, "nome do plano obrigatorio", http.StatusBadRequest)
		return
	}
	p.Features = sanitizeFeatures(p.Features)
	if err := h.repo.UpdatePlan(r.Context(), id, &p); err != nil {
		http.Error(w, "falha ao atualizar plano", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// HandleDeletePlan bloqueia a exclusão de plano que ainda tem alunos vinculados
// (409 + contagem para o frontend). Planos sem alunos são removidos.
func (h *Handlers) HandleDeletePlan(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	count, err := h.repo.CountStudentsWithPlan(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao verificar plano em uso", http.StatusInternalServerError)
		return
	}
	if count > 0 {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error": "plano em uso",
			"count": count,
		})
		return
	}
	if err := h.repo.DeletePlan(r.Context(), id); err != nil {
		http.Error(w, "falha ao excluir plano", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// HandleAssignPlan troca o plano (e o snapshot de features) de um aluno já
// aprovado, sem passar por re-aprovação.
func (h *Handlers) HandleAssignPlan(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.AssignPlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if err := h.svc.AssignPlan(r.Context(), id, req.PlanID); err != nil {
		h.serviceError(err, w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ── helpers ──

// sanitizeFeatures mantém só features conhecidas e remove duplicatas.
func sanitizeFeatures(in []models.Feature) []models.Feature {
	valid := map[models.Feature]bool{
		models.FeatureWorkouts:  true,
		models.FeatureDiet:      true,
		models.FeatureCommunity: true,
		models.FeatureRanking:   true,
	}
	seen := map[models.Feature]bool{}
	out := []models.Feature{}
	for _, f := range in {
		if valid[f] && !seen[f] {
			seen[f] = true
			out = append(out, f)
		}
	}
	return out
}

// serviceError traduz erros de negócio do service em respostas HTTP.
func (h *Handlers) serviceError(err error, w http.ResponseWriter) {
	switch {
	case errors.Is(err, service.ErrUserNotFound):
		http.Error(w, "usuario nao encontrado", http.StatusNotFound)
	case errors.Is(err, service.ErrInvalidRole):
		http.Error(w, "papel invalido", http.StatusBadRequest)
	case errors.Is(err, service.ErrPlanNotFound):
		http.Error(w, "plano nao encontrado", http.StatusNotFound)
	case errors.Is(err, service.ErrPlanInactive):
		http.Error(w, "plano inativo — ative o plano antes de atribuir", http.StatusBadRequest)
	case errors.Is(err, service.ErrInvalidPlanID):
		http.Error(w, "planID obrigatorio", http.StatusBadRequest)
	default:
		http.Error(w, "falha ao processar", http.StatusInternalServerError)
	}
}