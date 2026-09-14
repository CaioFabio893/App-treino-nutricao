package handlers

import (
	"net/http"

	"treino-louise/backend/middleware"
	"treino-louise/backend/models"
	"treino-louise/backend/service"
)

// HandleGetRanking devolve o ranking global (público), o top do nutricionista
// (full) e a posição do aluno logado (self).
func (h *Handlers) HandleGetRanking(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())

	// Snapshot único de scores para não fazer N+1 leituras.
	scoreRecs, err := h.repo.ListScoreRecords(r.Context())
	if err != nil {
		http.Error(w, "falha ao ler pontuacoes", http.StatusInternalServerError)
		return
	}
	scores := map[string]*models.ScoreRecord{}
	for _, sc := range scoreRecs {
		scores[sc.StudentID] = sc
	}

	allStudents, err := h.repo.ListStudentsAll(r.Context())
	if err != nil {
		http.Error(w, "falha ao listar alunos", http.StatusInternalServerError)
		return
	}

	cycle := service.CurrentCycle()

	// Ranking global (base do top público).
	global := service.BuildRanking(allStudents, scores)

	resp := &models.RankingResponse{
		CycleID:    cycle.ID,
		CycleStart: cycle.Start.Format("2006-01-02"),
		CycleEnd:   cycle.End.AddDate(0, 0, -1).Format("2006-01-02"),
		Top:        service.TopSlice(global, service.RankingPublicTop),
		Total:      len(allStudents),
	}

	switch role {
	case models.RoleStudent:
		// O aluno sempre vê a própria posição, mesmo fora do top 20.
		for _, e := range global {
			if e.StudentID == uid {
				resp.Self = e
				break
			}
		}
	case models.RoleNutritionist:
		myStudents, err := h.repo.ListStudents(r.Context(), uid) // alunos do nutricionista
		if err != nil {
			http.Error(w, "falha ao listar alunos", http.StatusInternalServerError)
			return
		}
		resp.Full = service.BuildRanking(myStudents, scores)
	default: // admin
		resp.Full = global
	}

	writeJSON(w, http.StatusOK, resp)
}

// HandleGetScoreHistory devolve a evolução de ciclos fechados do aluno.
func (h *Handlers) HandleGetScoreHistory(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())
	studentID := r.URL.Query().Get("studentId")
	if studentID == "" {
		studentID = uid
	}
	can, err := h.svc.CanAccessStudent(r.Context(), uid, role, studentID)
	if err != nil {
		http.Error(w, "erro ao verificar permissao", http.StatusInternalServerError)
		return
	}
	if !can {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	history, err := h.repo.ListScoreHistory(r.Context(), studentID)
	if err != nil {
		http.Error(w, "falha ao ler historico", http.StatusInternalServerError)
		return
	}
	if history == nil {
		history = []*models.ScoreHistoryEntry{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"history": history})
}

// HandleGetPublicProfile devolve a mini página de perfil visível a qualquer
// usuário autenticado (a partir do feed).
func (h *Handlers) HandleGetPublicProfile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	out, err := h.svc.GetPublicProfile(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler perfil", http.StatusInternalServerError)
		return
	}
	if out == nil {
		http.Error(w, "usuario nao encontrado", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, out)
}
