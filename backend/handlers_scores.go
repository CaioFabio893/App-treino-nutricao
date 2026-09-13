package main

import (
	"context"
	"net/http"
	"sort"
	"time"
)

// ── Cálculo da nota corrente ──

// recomputeScore recalcula a nota do ciclo em andamento do aluno a partir dos
// dados de origem (workoutHistory + dietLogs) — sem estado parcial, evita
// drift. Se o ciclo salvo for de um ciclo anterior, arquiva a nota final em
// scores_history antes de zerar em scores/{uid}.
func (s *Server) recomputeScore(ctx context.Context, studentID, userStart string) error {
	cycle := cycleFor(time.Now())
	start, end := cycle.Start, cycle.End

	hist, err := s.listHistoryForStudentSince(ctx, studentID, start, end)
	if err != nil {
		return err
	}
	workoutDays := []string{}
	seen := map[string]bool{}
	for _, h := range hist {
		if h.CompletedAt.IsZero() {
			continue
		}
		k := h.CompletedAt.Format("2006-01-02")
		if !seen[k] {
			seen[k] = true
			workoutDays = append(workoutDays, k)
		}
	}

	to := cycle.End.AddDate(0, 0, -1).Format("2006-01-02")
	logs, err := s.listDietLogsForStudent(ctx, studentID, start.Format("2006-01-02"), to)
	if err != nil {
		return err
	}
	dietDays := map[string]DietLogStatus{}
	for _, l := range logs {
		dietDays[l.Date] = l.Status
	}

	raw, done, score, denom := cycleScoreFromData(cycle, userStart, time.Now(), workoutDays, dietDays)

	// Fechamento preguiçoso do ciclo: se havia nota de um ciclo antigo, guarda
	// no histórico antes de sobrescrever.
	existing, err := s.getScoreRecord(ctx, studentID)
	if err != nil {
		return err
	}
	if existing != nil && existing.CycleID != "" && existing.CycleID != cycle.ID {
		if existing.Score > 0 || existing.RawPoints > 0 {
			prevStart, _ := parseDateYMD(existing.CycleStart)
			prevEnd := prevStart.AddDate(0, CycleMonths, 0).AddDate(0, 0, -1)
			if prevStart.IsZero() {
				prevStart = start
				prevEnd = end.AddDate(0, 0, -1)
			}
			_ = s.putScoreHistory(ctx, studentID, existing.CycleID, &ScoreHistoryEntry{
				StudentID:  studentID,
				CycleID:    existing.CycleID,
				StartDate:  existing.CycleStart,
				EndDate:    prevEnd.Format("2006-01-02"),
				RawPoints:  existing.RawPoints,
				Days:       existing.DaysElapsed,
				Score:      existing.Score,
			})
		}
	}

	return s.putScoreRecord(ctx, &ScoreRecord{
		StudentID:     studentID,
		RawPoints:     raw,
		CycleID:       cycle.ID,
		CycleStart:    cycle.Start.Format("2006-01-02"),
		Score:         score,
		DaysElapsed:   denom,
		DaysCompleted: done,
	})
}

// ── Ranking ──

// buildRanking monta a lista ordenada de alunos com nota. students é a lista
// de alunos considerados (globais para o top público; filtrados por nutricionista
// para o ranking completo). scores é o snapshot de scores/{uid} (mapa uid→rec).
func buildRanking(students []*UserProfile, scores map[string]*ScoreRecord) []*RankingEntry {
	entries := make([]*RankingEntry, 0, len(students))
	for _, st := range students {
		sc := scores[st.ID]
		score := 0.0
		if sc != nil {
			score = sc.Score
		}
		entries = append(entries, &RankingEntry{
			StudentID: st.ID,
			Name:      st.Name,
			PhotoURL:  st.PhotoURL,
			Score:     score,
		})
	}
	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].Score != entries[j].Score {
			return entries[i].Score > entries[j].Score
		}
		return entries[i].Name < entries[j].Name
	})
	for i, e := range entries {
		e.Rank = i + 1
	}
	return entries
}

// topSlice devolve os primeiros n itens de u.
func topSlice(u []*RankingEntry, n int) []*RankingEntry {
	if n > len(u) {
		n = len(u)
	}
	return u[:n]
}

func (s *Server) handleGetRanking(w http.ResponseWriter, r *http.Request) {
	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())

	// Snapshot único de scores para não fazer N+1 leituras.
	scoreRecs, err := s.listScoreRecords(r.Context())
	if err != nil {
		http.Error(w, "falha ao ler pontuacoes", http.StatusInternalServerError)
		return
	}
	scores := map[string]*ScoreRecord{}
	for _, sc := range scoreRecs {
		scores[sc.StudentID] = sc
	}

	allStudents, err := s.listStudentsAll(r.Context())
	if err != nil {
		http.Error(w, "falha ao listar alunos", http.StatusInternalServerError)
		return
	}

	cycle := cycleFor(time.Now())

	// Ranking global (base do top público).
	global := buildRanking(allStudents, scores)

	resp := &RankingResponse{
		CycleID:    cycle.ID,
		CycleStart: cycle.Start.Format("2006-01-02"),
		CycleEnd:   cycle.End.AddDate(0, 0, -1).Format("2006-01-02"),
		Top:        topSlice(global, RankingPublicTop),
		Total:      len(allStudents),
	}

	switch role {
	case RoleStudent:
		// O aluno sempre vê a própria posição, mesmo fora do top 20.
		for _, e := range global {
			if e.StudentID == uid {
				resp.Self = e
				break
			}
		}
	case RoleNutritionist:
		myStudents, err := s.listStudents(r.Context(), uid) // alunos do nutricionista
		if err != nil {
			http.Error(w, "falha ao listar alunos", http.StatusInternalServerError)
			return
		}
		resp.Full = buildRanking(myStudents, scores)
	default: // admin
		resp.Full = global
	}

	writeJSON(w, http.StatusOK, resp)
}

// handleGetScoreHistory devolve a evolução de ciclos fechados do aluno.
func (s *Server) handleGetScoreHistory(w http.ResponseWriter, r *http.Request) {
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
	history, err := s.listScoreHistory(r.Context(), studentID)
	if err != nil {
		http.Error(w, "falha ao ler historico", http.StatusInternalServerError)
		return
	}
	if history == nil {
		history = []*ScoreHistoryEntry{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"history": history})
}

// ── Perfil público ──

// computeStreak conta os dias seguidos (até hoje, ou ontem se hoje ainda não
// registrou nada) com treino concluído ou dieta seguida/parcial.
func (s *Server) computeStreak(ctx context.Context, uid string) (int, error) {
	hist, err := s.listHistoryForStudent(ctx, uid)
	if err != nil {
		return 0, err
	}
	dates := map[string]bool{}
	for _, h := range hist {
		if !h.CompletedAt.IsZero() {
			dates[h.CompletedAt.Format("2006-01-02")] = true
		}
	}
	logs, err := s.listDietLogsForStudent(ctx, uid, "", "")
	if err != nil {
		return 0, err
	}
	for _, l := range logs {
		if l.Status == DietFollowed || l.Status == DietPartial {
			dates[l.Date] = true
		}
	}
	cur := startOfDay(time.Now())
	if !dates[cur.Format("2006-01-02")] {
		cur = cur.AddDate(0, 0, -1) // hoje ainda pode estar em andamento
	}
	streak := 0
	for {
		if !dates[cur.Format("2006-01-02")] {
			break
		}
		streak++
		cur = cur.AddDate(0, 0, -1)
	}
	return streak, nil
}

// handleGetPublicProfile devolve a mini página de perfil visível a qualquer
// usuário autenticado (a partir do feed).
func (s *Server) handleGetPublicProfile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	prof, err := s.getUserProfile(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler perfil", http.StatusInternalServerError)
		return
	}
	if prof == nil {
		http.Error(w, "usuario nao encontrado", http.StatusNotFound)
		return
	}

	out := &PublicProfile{
		ID:       id,
		Name:     prof.Name,
		PhotoURL: prof.PhotoURL,
		Bio:      prof.Bio,
		Role:     prof.Role,
	}

	streak, err := s.computeStreak(r.Context(), id)
	if err == nil {
		out.Streak = streak
	}

	if prof.Role == RoleStudent {
		// Nota corrente + posição no ranking (global).
		rec, err := s.getScoreRecord(r.Context(), id)
		if err == nil && rec != nil && rec.CycleID == cycleFor(time.Now()).ID {
			out.Score = rec.Score
			out.CycleID = rec.CycleID
		}
		if out.Score > 0 {
			allStudents, err := s.listStudentsAll(r.Context())
			if err == nil {
				scoreRecs, _ := s.listScoreRecords(r.Context())
				scores := map[string]*ScoreRecord{}
				for _, sc := range scoreRecs {
					scores[sc.StudentID] = sc
				}
				global := buildRanking(allStudents, scores)
				for _, e := range global {
					if e.StudentID == id {
						out.Rank = e.Rank
						break
					}
				}
			}
		}
	}

	writeJSON(w, http.StatusOK, out)
}