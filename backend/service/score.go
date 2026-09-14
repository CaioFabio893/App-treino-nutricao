package service

import (
	"context"
	"time"

	"treino-louise/backend/models"
)

// RecomputeScore recalcula a nota do ciclo em andamento do aluno a partir dos
// dados de origem (workoutHistory + dietLogs) — sem estado parcial, evita
// drift. Se o ciclo salvo for de um ciclo anterior, arquiva a nota final em
// scores_history antes de zerar em scores/{uid}.
func (s *Service) RecomputeScore(ctx context.Context, studentID, userStart string) error {
	cycle := cycleFor(time.Now())
	start, end := cycle.Start, cycle.End

	hist, err := s.repo.ListHistoryForStudentSince(ctx, studentID, start, end)
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
	logs, err := s.repo.ListDietLogsForStudent(ctx, studentID, start.Format("2006-01-02"), to)
	if err != nil {
		return err
	}
	dietDays := map[string]models.DietLogStatus{}
	for _, l := range logs {
		dietDays[l.Date] = l.Status
	}

	raw, done, score, denom := cycleScoreFromData(cycle, userStart, time.Now(), workoutDays, dietDays)

	// Fechamento preguiçoso do ciclo: se havia nota de um ciclo antigo, guarda
	// no histórico antes de sobrescrever.
	existing, err := s.repo.GetScoreRecord(ctx, studentID)
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
			_ = s.repo.PutScoreHistory(ctx, studentID, existing.CycleID, &models.ScoreHistoryEntry{
				StudentID: studentID,
				CycleID:   existing.CycleID,
				StartDate: existing.CycleStart,
				EndDate:   prevEnd.Format("2006-01-02"),
				RawPoints: existing.RawPoints,
				Days:      existing.DaysElapsed,
				Score:     existing.Score,
			})
		}
	}

	return s.repo.PutScoreRecord(ctx, &models.ScoreRecord{
		StudentID:     studentID,
		RawPoints:     raw,
		CycleID:       cycle.ID,
		CycleStart:    cycle.Start.Format("2006-01-02"),
		Score:         score,
		DaysElapsed:   denom,
		DaysCompleted: done,
	})
}

// ComputeStreak conta os dias seguidos (até hoje, ou ontem se hoje ainda não
// registrou nada) com treino concluído ou dieta seguida/parcial.
func (s *Service) ComputeStreak(ctx context.Context, uid string) (int, error) {
	hist, err := s.repo.ListHistoryForStudent(ctx, uid)
	if err != nil {
		return 0, err
	}
	dates := map[string]bool{}
	for _, h := range hist {
		if !h.CompletedAt.IsZero() {
			dates[h.CompletedAt.Format("2006-01-02")] = true
		}
	}
	logs, err := s.repo.ListDietLogsForStudent(ctx, uid, "", "")
	if err != nil {
		return 0, err
	}
	for _, l := range logs {
		if l.Status == models.DietFollowed || l.Status == models.DietPartial {
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
