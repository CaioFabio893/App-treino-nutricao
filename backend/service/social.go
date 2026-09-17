package service

import (
	"context"
	"strings"

	"treino-louise/backend/models"
)

// defaultPostText monta o texto padrão dos posts automáticos.
func defaultPostText(postType models.PostType) string {
	if postType == models.PostDiet {
		return "Seguiu a dieta hoje 🥗"
	}
	return "Concluiu o treino de hoje 💪"
}

// PublishWorkoutPost cria (uma vez por dia) o post automático de treino
// concluído. Reaproveita o WorkoutHistoryEntry e a legenda opcional do aluno.
func (s *Service) PublishWorkoutPost(ctx context.Context, h *models.WorkoutHistoryEntry, caption string) error {
	existing, err := s.repo.FindAutoPostToday(ctx, h.StudentID, models.PostWorkout, startOfDay(Now()))
	if err != nil {
		return err
	}
	if existing != nil {
		return nil // já publicou hoje — um post por dia
	}
	prof, err := s.repo.GetUserProfile(ctx, h.StudentID)
	if err != nil {
		return err
	}
	name, photo := h.StudentID, ""
	if prof != nil {
		if prof.Name != "" {
			name = prof.Name
		}
		photo = prof.PhotoURL
	}
	text := caption
	if strings.TrimSpace(text) == "" {
		text = defaultPostText(models.PostWorkout)
	}
	_, err = s.repo.CreatePost(ctx, &models.Post{
		UserID:       h.StudentID,
		UserName:     name,
		UserPhotoURL: photo,
		Type:         models.PostWorkout,
		Text:         text,
		WorkoutID:    h.WorkoutID,
		WorkoutName:  h.WorkoutName,
		Date:         h.CompletedAt.In(AppLoc).Format("2006-01-02"),
		Likes:        map[string]bool{},
		Comments:     []*models.PostComment{},
		CreatedAt:    Now(),
	})
	return err
}

// PublishDietPost cria o post automático de dieta seguida. Devolve o ID do
// post criado (ou "" se já existir um post de dieta hoje).
func (s *Service) PublishDietPost(ctx context.Context, log *models.DietDailyLog) (string, error) {
	if log.PostID != "" {
		return log.PostID, nil
	}
	existing, err := s.repo.FindAutoPostToday(ctx, log.StudentID, models.PostDiet, startOfDay(Now()))
	if err != nil {
		return "", err
	}
	if existing != nil {
		return existing.ID, nil
	}
	prof, err := s.repo.GetUserProfile(ctx, log.StudentID)
	if err != nil {
		return "", err
	}
	name, photo := log.StudentID, ""
	if prof != nil {
		if prof.Name != "" {
			name = prof.Name
		}
		photo = prof.PhotoURL
	}
	text := log.Caption
	if strings.TrimSpace(text) == "" {
		text = defaultPostText(models.PostDiet)
	}
	created, err := s.repo.CreatePost(ctx, &models.Post{
		UserID:       log.StudentID,
		UserName:     name,
		UserPhotoURL: photo,
		Type:         models.PostDiet,
		Text:         text,
		DietID:       log.DietID,
		DietName:     log.DietName,
		Date:         log.Date,
		Likes:        map[string]bool{},
		Comments:     []*models.PostComment{},
		CreatedAt:    Now(),
	})
	if err != nil {
		return "", err
	}
	return created.ID, nil
}
