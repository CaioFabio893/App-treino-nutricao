package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"treino-louise/backend/middleware"
	"treino-louise/backend/models"
	"treino-louise/backend/repository"
	"treino-louise/backend/service"
)

// HandleListDietLogs devolve os logs de dieta de um aluno (para o calendário).
// Aluno só consulta o próprio; nutricionista consulta os próprios alunos;
// admin qualquer aluno.
func (h *Handlers) HandleListDietLogs(w http.ResponseWriter, r *http.Request) {
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
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	logs, err := h.repo.ListDietLogsForStudent(r.Context(), studentID, from, to)
	if err != nil {
		http.Error(w, "falha ao listar logs de dieta", http.StatusInternalServerError)
		return
	}
	if logs == nil {
		logs = []*models.DietDailyLog{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"logs": logs})
}

// HandleUpsertDietLog salva o log do dia (o aluno marca por refeição durante
// o dia; o status agregado alimenta calendário, feed e ranking).
func (h *Handlers) HandleUpsertDietLog(w http.ResponseWriter, r *http.Request) {
	var req models.UpsertDietLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if req.Date == "" {
		req.Date = service.Now().Format("2006-01-02")
	}
	if !validDate(req.Date) {
		http.Error(w, "data invalida (use AAAA-MM-DD)", http.StatusBadRequest)
		return
	}
	if tooLong(req.Note, service.MaxNoteLength) {
		http.Error(w, "nota muito longa", http.StatusBadRequest)
		return
	}
	if tooLong(req.Caption, service.MaxPostText) {
		http.Error(w, "legenda muito longa", http.StatusBadRequest)
		return
	}

	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())
	studentID := req.StudentID
	if studentID == "" {
		studentID = uid
	}
	// Aluno só pode marcar o próprio dia; admin pode marcar qualquer aluno.
	if role == models.RoleStudent && studentID != uid {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	if role == models.RoleNutritionist {
		http.Error(w, "sem permissao para marcar dieta (o aluno marca o próprio dia)", http.StatusForbidden)
		return
	}

	// Define donos a partir do perfil e da dieta do aluno.
	prof, err := h.repo.GetUserProfile(r.Context(), studentID)
	if err != nil {
		http.Error(w, "falha ao ler aluno", http.StatusInternalServerError)
		return
	}
	if prof == nil {
		http.Error(w, "aluno nao encontrado", http.StatusNotFound)
		return
	}

	log := &models.DietDailyLog{
		StudentID:      studentID,
		NutritionistID: prof.NutritionistID,
		Date:           req.Date,
		MealChecks:     req.MealChecks,
		Note:           req.Note,
		Caption:        req.Caption,
	}

	// Dieta ativa do aluno (para vínculo e nome no post).
	diet, err := h.svc.ActiveDietForStudent(r.Context(), studentID)
	if err != nil {
		http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
		return
	}
	if diet != nil {
		log.DietID = diet.ID
		log.DietName = diet.Name
		if log.NutritionistID == "" {
			log.NutritionistID = diet.NutritionistID
		}
	}

	// Status do dia: explícito no request OU agregado dos checks por refeição.
	if req.Status != nil {
		switch models.DietLogStatus(*req.Status) {
		case models.DietFollowed, models.DietPartial, models.DietNotFollowed:
			log.Status = models.DietLogStatus(*req.Status)
		default:
			http.Error(w, "status invalido", http.StatusBadRequest)
			return
		}
	} else {
		log.Status = service.AggregateStatus(req.MealChecks)
	}

	// Preserva postId de um log já existente (para saber qual post desfazer).
	existing, err := h.repo.GetDietLog(r.Context(), studentID, req.Date)
	if err != nil {
		http.Error(w, "falha ao ler log", http.StatusInternalServerError)
		return
	}
	if existing != nil {
		log.PostID = existing.PostID
		log.CreatedAt = existing.CreatedAt
		if log.NutritionistID == "" {
			log.NutritionistID = existing.NutritionistID
		}
		if log.Caption == "" {
			log.Caption = existing.Caption
		}
	}

	if err := h.repo.PutDietLog(r.Context(), log); err != nil {
		http.Error(w, "falha ao salvar log de dieta", http.StatusInternalServerError)
		return
	}

	// Post automático: publica quando o dia passa a "followed"; se sair de
	// "followed", remove o post (removido com auditoria).
	if log.Status == models.DietFollowed {
		postID, err := h.svc.PublishDietPost(r.Context(), log)
		if err != nil {
			http.Error(w, "falha ao publicar no feed", http.StatusInternalServerError)
			return
		}
		if postID != "" && postID != log.PostID {
			log.PostID = postID
			_ = h.repo.PutDietLog(r.Context(), log)
		}
	} else if log.PostID != "" {
		// Remove o post automático (soft delete auditado) dentro de uma
		// transação — o aluno/nutricionista que salvou o log é o moderador.
		err := h.repo.UpdatePostTx(r.Context(), log.PostID, func(post *models.Post) error {
			if post == nil || post.Deleted {
				return repository.ErrPostNotFound // já removido: nada a fazer
			}
			post.Deleted = true
			post.ModeratedBy = uid
			post.ModeratedAt = service.Now()
			post.UpdatedAt = service.Now()
			return nil
		})
		if err != nil && !errors.Is(err, repository.ErrPostNotFound) {
			http.Error(w, "falha ao remover post do feed", http.StatusInternalServerError)
			return
		}
		log.PostID = ""
		_ = h.repo.PutDietLog(r.Context(), log)
	}

	// Recalcula a nota do ciclo (mesmo gatilho do feed).
	if err := h.svc.RecomputeScore(r.Context(), studentID, prof.StartDate); err != nil {
		http.Error(w, "falha ao atualizar pontuacao", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, log)
}
