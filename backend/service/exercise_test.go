package service

import (
	"errors"
	"strings"
	"testing"

	"treino-louise/backend/models"
)

func TestValidateExerciseNameRequired(t *testing.T) {
	e := &models.ExerciseItem{Name: "  "}
	NormalizeExercise(e)
	if err := ValidateExercise(e); !errors.Is(err, ErrExerciseNameRequired) {
		t.Fatalf("esperava ErrExerciseNameRequired, got %v", err)
	}
}

func TestValidateExerciseNameTooLong(t *testing.T) {
	e := &models.ExerciseItem{Name: strings.Repeat("a", MaxExerciseNameLength+1)}
	NormalizeExercise(e)
	if err := ValidateExercise(e); !errors.Is(err, ErrExerciseNameTooLong) {
		t.Fatalf("esperava ErrExerciseNameTooLong, got %v", err)
	}
}

func TestValidateExerciseDescriptionTooLong(t *testing.T) {
	e := &models.ExerciseItem{Name: "Supino", Description: strings.Repeat("d", MaxExerciseDescriptionLength+1)}
	NormalizeExercise(e)
	if err := ValidateExercise(e); !errors.Is(err, ErrExerciseFieldTooLong) {
		t.Fatalf("esperava ErrExerciseFieldTooLong, got %v", err)
	}
}

func TestValidateExerciseMuscleGroupTooLong(t *testing.T) {
	e := &models.ExerciseItem{Name: "Supino", MuscleGroup: strings.Repeat("m", MaxMuscleGroupLength+1)}
	NormalizeExercise(e)
	if err := ValidateExercise(e); !errors.Is(err, ErrExerciseFieldTooLong) {
		t.Fatalf("esperava ErrExerciseFieldTooLong, got %v", err)
	}
}

func TestValidateExerciseEquipmentTooLong(t *testing.T) {
	e := &models.ExerciseItem{Name: "Supino", Equipment: strings.Repeat("e", MaxEquipmentLength+1)}
	NormalizeExercise(e)
	if err := ValidateExercise(e); !errors.Is(err, ErrExerciseFieldTooLong) {
		t.Fatalf("esperava ErrExerciseFieldTooLong, got %v", err)
	}
}

func TestValidateExerciseVideoURLTooLong(t *testing.T) {
	e := &models.ExerciseItem{Name: "Supino", VideoURL: "https://example.com/" + strings.Repeat("v", MaxVideoURLLength)}
	NormalizeExercise(e)
	if err := ValidateExercise(e); !errors.Is(err, ErrExerciseFieldTooLong) {
		t.Fatalf("esperava ErrExerciseFieldTooLong, got %v", err)
	}
}

func TestValidateExerciseInvalidURL(t *testing.T) {
	e := &models.ExerciseItem{Name: "Supino", VideoURL: "nao-e-url"}
	NormalizeExercise(e)
	if err := ValidateExercise(e); !errors.Is(err, ErrExerciseInvalidURL) {
		t.Fatalf("esperava ErrExerciseInvalidURL, got %v", err)
	}
}

func TestValidateExerciseURLWithoutScheme(t *testing.T) {
	e := &models.ExerciseItem{Name: "Supino", VideoURL: "www.youtube.com/watch?v=1"}
	NormalizeExercise(e)
	if err := ValidateExercise(e); !errors.Is(err, ErrExerciseInvalidURL) {
		t.Fatalf("esperava ErrExerciseInvalidURL, got %v", err)
	}
}

func TestValidateExerciseValid(t *testing.T) {
	e := &models.ExerciseItem{
		Name:        "Supino reto",
		Description: "Exercício básico de peito",
		MuscleGroup: "Peito",
		Equipment:   "Barra",
		VideoURL:    "https://www.youtube.com/watch?v=abc123",
	}
	NormalizeExercise(e)
	if err := ValidateExercise(e); err != nil {
		t.Fatalf("esperava validação ok, got %v", err)
	}
}

func TestValidateExerciseEmptyVideoURLIsFine(t *testing.T) {
	e := &models.ExerciseItem{Name: "Supino reto"}
	NormalizeExercise(e)
	if err := ValidateExercise(e); err != nil {
		t.Fatalf("esperava validação ok (videoUrl opcional), got %v", err)
	}
}

func TestNormalizeExerciseTrimsFields(t *testing.T) {
	e := &models.ExerciseItem{
		Name:        "  Supino reto  ",
		Description: "  Desc  ",
		MuscleGroup: "  Peito  ",
		Equipment:   "  Barra  ",
		VideoURL:    "  https://example.com/v  ",
	}
	NormalizeExercise(e)
	if e.Name != "Supino reto" || e.Description != "Desc" || e.MuscleGroup != "Peito" ||
		e.Equipment != "Barra" || e.VideoURL != "https://example.com/v" {
		t.Fatalf("NormalizeExercise não fez trim: %+v", e)
	}
}
