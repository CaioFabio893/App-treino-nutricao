package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

// aggregateStatus deduz o status do dia a partir dos checks por refeição.
// Se houver status explícito no request, ele vence.
func aggregateStatus(checks []*MealCheck) DietLogStatus {
	anyFollowed := false
	allFollowed := len(checks) > 0
	for _, c := range checks {
		if c.Followed {
			anyFollowed = true
		} else {
			allFollowed = false
		}
	}
	switch {
	case len(checks) == 0 || !anyFollowed:
		return DietNotFollowed
	case allFollowed:
		return DietFollowed
	default:
		return DietPartial
	}
}

// activeDietForStudent devolve a dieta ativa do aluno (mais recente entre as
// que cobrem a data de hoje), ou a mais recente se não houver ativa.
func (s *Server) activeDietForStudent(ctx context.Context, studentID string) (*Diet, error) {
	diets, err := s.listDietsForStudent(ctx, studentID)
	if err != nil {
		return nil, err
	}
	today := time.Now().Format("2006-01-02")
	for _, d := range diets {
		if (d.StartDate == "" || d.StartDate <= today) && (d.EndDate == "" || d.EndDate >= today) {
			return d, nil
		}
	}
	if len(diets) > 0 {
		return diets[0], nil
	}
	return nil, nil
}

// handleListDietLogs devolve os logs de dieta de um aluno (para o calendário).
// Aluno só consulta o próprio; nutricionista consulta os próprios alunos;
// admin qualquer aluno.
func (s *Server) handleListDietLogs(w http.ResponseWriter, r *http.Request) {
	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())
	studentID := r.URL.Query().Get("studentId")
	if studentID == "" {
		studentID = uid
	}
	can, err := s.canAccessStudent(r.Context(), uid, role, studentID)
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
	logs, err := s.listDietLogsForStudent(r.Context(), studentID, from, to)
	if err != nil {
		http.Error(w, "falha ao listar logs de dieta", http.StatusInternalServerError)
		return
	}
	if logs == nil {
		logs = []*DietDailyLog{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"logs": logs})
}

// handleUpsertDietLog salva o log do dia (o aluno marca por refeição durante
// o dia; o status agregado alimenta calendário, feed e ranking).
func (s *Server) handleUpsertDietLog(w http.ResponseWriter, r *http.Request) {
	var req UpsertDietLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if req.Date == "" {
		req.Date = time.Now().Format("2006-01-02")
	}
	if _, ok := parseDateYMD(req.Date); !ok {
		http.Error(w, "data invalida (use AAAA-MM-DD)", http.StatusBadRequest)
		return
	}

	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())
	studentID := req.StudentID
	if studentID == "" {
		studentID = uid
	}
	// Aluno só pode marcar o próprio dia; admin pode marcar qualquer aluno.
	if role == RoleStudent && studentID != uid {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	if role == RoleNutritionist {
		http.Error(w, "sem permissao para marcar dieta (o aluno marca o próprio dia)", http.StatusForbidden)
		return
	}

	// Define donos a partir do perfil e da dieta do aluno.
	prof, err := s.getUserProfile(r.Context(), studentID)
	if err != nil {
		http.Error(w, "falha ao ler aluno", http.StatusInternalServerError)
		return
	}
	if prof == nil {
		http.Error(w, "aluno nao encontrado", http.StatusNotFound)
		return
	}

	log := &DietDailyLog{
		StudentID:      studentID,
		NutritionistID: prof.NutritionistID,
		Date:           req.Date,
		MealChecks:     req.MealChecks,
		Note:           req.Note,
		Caption:        req.Caption,
	}

	// Dieta ativa do aluno (para vínculo e nome no post).
	diet, err := s.activeDietForStudent(r.Context(), studentID)
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
		switch DietLogStatus(*req.Status) {
		case DietFollowed, DietPartial, DietNotFollowed:
			log.Status = DietLogStatus(*req.Status)
		default:
			http.Error(w, "status invalido", http.StatusBadRequest)
			return
		}
	} else {
		log.Status = aggregateStatus(req.MealChecks)
	}

	// Preserva postId de um log já existente (para saber qual post desfazer).
	existing, err := s.getDietLog(r.Context(), studentID, req.Date)
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

	if err := s.putDietLog(r.Context(), log); err != nil {
		http.Error(w, "falha ao salvar log de dieta", http.StatusInternalServerError)
		return
	}

	// Post automático: publica quando o dia passa a "followed"; se sair de
	// "followed", remove o post (removido com auditoria).
	if log.Status == DietFollowed {
		postID, err := s.publishDietPost(r.Context(), log)
		if err != nil {
			http.Error(w, "falha ao publicar no feed", http.StatusInternalServerError)
			return
		}
		if postID != "" && postID != log.PostID {
			log.PostID = postID
			_ = s.putDietLog(r.Context(), log)
		}
	} else if log.PostID != "" {
		post, err := s.getPost(r.Context(), log.PostID)
		if err == nil && post != nil && !post.Deleted {
			post.Deleted = true
			post.ModeratedBy = uid
			post.ModeratedAt = time.Now()
			_ = s.updatePost(r.Context(), log.PostID, post)
		}
		log.PostID = ""
		_ = s.putDietLog(r.Context(), log)
	}

	// Recalcula a nota do ciclo (mesmo gatilho do feed).
	if err := s.recomputeScore(r.Context(), studentID, prof.StartDate); err != nil {
		http.Error(w, "falha ao atualizar pontuacao", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, log)
}