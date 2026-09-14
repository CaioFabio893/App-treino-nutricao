package service

import "treino-louise/backend/models"

// NormalizeExercises ordena e renumera os exercícios de um treino.
func NormalizeExercises(w *models.WorkoutDefine) {
	for i, e := range w.Exercises {
		if e == nil {
			continue
		}
		e.Order = i + 1
	}
}

// NormalizeMeals ordena e renumera as refeições de uma dieta.
func NormalizeMeals(d *models.Diet) {
	for i, m := range d.Meals {
		if m == nil {
			continue
		}
		m.Order = i + 1
	}
}
