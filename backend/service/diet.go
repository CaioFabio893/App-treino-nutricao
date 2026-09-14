package service

import (
	"context"
	"time"

	"treino-louise/backend/models"
)

// AggregateStatus deduz o status do dia a partir dos checks por refeição.
// Se houver status explícito no request, ele vence (decisão na camada HTTP).
func AggregateStatus(checks []*models.MealCheck) models.DietLogStatus {
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
		return models.DietNotFollowed
	case allFollowed:
		return models.DietFollowed
	default:
		return models.DietPartial
	}
}

// ActiveDietForStudent devolve a dieta ativa do aluno (mais recente entre as
// que cobrem a data de hoje), ou a mais recente se não houver ativa.
func (s *Service) ActiveDietForStudent(ctx context.Context, studentID string) (*models.Diet, error) {
	diets, err := s.repo.ListDietsForStudent(ctx, studentID)
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
