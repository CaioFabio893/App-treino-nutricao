package service

import (
	"context"
	"time"

	"treino-louise/backend/models"
)

// GetPublicProfile monta a mini página de perfil visível a qualquer usuário
// autenticado (a partir do feed): dados básicos + streak + nota/posição no
// ranking (quando o usuário é aluno).
func (s *Service) GetPublicProfile(ctx context.Context, id string) (*models.PublicProfile, error) {
	prof, err := s.repo.GetUserProfile(ctx, id)
	if err != nil {
		return nil, err
	}
	if prof == nil {
		return nil, nil
	}

	out := &models.PublicProfile{
		ID:       id,
		Name:     prof.Name,
		PhotoURL: prof.PhotoURL,
		Bio:      prof.Bio,
		Role:     prof.Role,
	}

	streak, err := s.ComputeStreak(ctx, id)
	if err == nil {
		out.Streak = streak
	}

	if prof.Role == models.RoleStudent {
		// Nota corrente + posição no ranking (global).
		rec, err := s.repo.GetScoreRecord(ctx, id)
		if err == nil && rec != nil && rec.CycleID == cycleFor(time.Now()).ID {
			out.Score = rec.Score
			out.CycleID = rec.CycleID
		}
		if out.Score > 0 {
			allStudents, err := s.repo.ListStudentsAll(ctx)
			if err == nil {
				scoreRecs, _ := s.repo.ListScoreRecords(ctx)
				scores := map[string]*models.ScoreRecord{}
				for _, sc := range scoreRecs {
					scores[sc.StudentID] = sc
				}
				global := BuildRanking(allStudents, scores)
				for _, e := range global {
					if e.StudentID == id {
						out.Rank = e.Rank
						break
					}
				}
			}
		}
	}

	return out, nil
}
