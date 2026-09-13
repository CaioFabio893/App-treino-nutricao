package main

import (
	"time"
)

// ── Models existentes (preservados para compatibilidade) ──

// Set representa os dados de uma série de um exercício (modo original).
type Set struct {
	W *float64 `json:"w,omitempty"`
	R *float64 `json:"r,omitempty"`
	C string   `json:"c,omitempty"` // "", "ok" ou "fail"
}

// Exercise representa os dados salvos de um exercício em um treino (modo original).
type Exercise struct {
	Sets []Set  `json:"sets,omitempty"`
	Note string `json:"note,omitempty"`
}

// Session é o registro completo de um dia de treino em uma semana (modo original).
type Session struct {
	Week      int        `json:"week"`
	Day       string     `json:"day"`
	Exercise  []Exercise `json:"exercise,omitempty"`
	UpdatedAt time.Time  `json:"updatedAt,omitempty"`
}

// PR guarda os recordes pessoais dos 3 exercícios principais.
type PR struct {
	A float64 `json:"a"`
	B float64 `json:"b"`
	C float64 `json:"c"`
}

// AppState guarda a semana e o dia em que o usuário parou.
type AppState struct {
	Week int `json:"week"`
	Day  int `json:"day"`
}

// ── Novos models: gestão de nutricionista/aluno ──

// Role define o papel do usuário no sistema.
type Role string

const (
	RoleAdmin         Role = "admin"
	RoleNutritionist  Role = "nutritionist"
	RoleStudent       Role = "student"
)

// UserProfile é o documento raiz do usuário no Firestore (users/{uid}).
type UserProfile struct {
	ID             string    `json:"id,omitempty"`
	Name           string    `json:"name"`
	Email          string    `json:"email"`
	PhotoURL       string    `json:"photoURL,omitempty"`
	Role           Role      `json:"role"`
	NutritionistID string    `json:"nutritionistID,omitempty"` // preenchido se role=student
	StartDate      string    `json:"startDate,omitempty"`      // "2026-01-15"
	EndDate        string    `json:"endDate,omitempty"`        // "2026-04-15"
	Status         string    `json:"status,omitempty"`         // "active", "inactive", "paused"
	CreatedAt      time.Time `json:"createdAt,omitempty"`
}

// ── Treinos ──

// WorkoutDefine é o treino criado pelo nutricionista.
// Os exercícios ficam embutidos no documento (array `exercises`).
type WorkoutDefine struct {
	ID             string             `json:"id,omitempty"`
	StudentID      string             `json:"studentId"`
	NutritionistID string             `json:"nutritionistId"`
	Name           string             `json:"name"`
	Description    string             `json:"description,omitempty"`
	Objective      string             `json:"objective,omitempty"`
	DayOfWeek      string             `json:"dayOfWeek,omitempty"` // "monday", "tuesday", etc.
	Exercises      []*WorkoutExercise `json:"exercises,omitempty"`
	CreatedAt      time.Time          `json:"createdAt,omitempty"`
	UpdatedAt      time.Time          `json:"updatedAt,omitempty"`
}

// WorkoutExercise é um exercício dentro de um treino.
type WorkoutExercise struct {
	ID           string  `json:"id,omitempty"`
	Name         string  `json:"name"`
	Description  string  `json:"description,omitempty"`
	Sets         int     `json:"sets"`
	Repetitions  string  `json:"repetitions"`
	Weight       string  `json:"weight,omitempty"`
	RestSeconds  int     `json:"restSeconds,omitempty"`
	Notes        string  `json:"notes,omitempty"`
	Order        int     `json:"order"`
}

// ── Dietas ──

// Diet é a dieta criada pelo nutricionista.
// As refeições (com seus alimentos) ficam embutidas no documento (array `meals`).
type Diet struct {
	ID             string       `json:"id,omitempty"`
	StudentID      string       `json:"studentId"`
	NutritionistID string       `json:"nutritionistId"`
	Name           string       `json:"name"`
	Description    string       `json:"description,omitempty"`
	StartDate      string       `json:"startDate,omitempty"`
	EndDate        string       `json:"endDate,omitempty"`
	Meals          []*Meal      `json:"meals,omitempty"`
	CreatedAt      time.Time    `json:"createdAt,omitempty"`
	UpdatedAt      time.Time    `json:"updatedAt,omitempty"`
}

// Meal é uma refeição dentro de uma dieta.
type Meal struct {
	ID    string  `json:"id,omitempty"`
	Name  string  `json:"name"`
	Time  string  `json:"time"`
	Notes string  `json:"notes,omitempty"`
	Order int     `json:"order"`
	Foods []*Food `json:"foods,omitempty"`
}

// Food é um alimento dentro de uma refeição.
type Food struct {
	ID       string  `json:"id,omitempty"`
	Name     string  `json:"name"`
	Quantity float64 `json:"quantity"`
	Unit     string  `json:"unit"`
	Notes    string  `json:"notes,omitempty"`
}

// ── Histórico ──

// HistorySet registra a execução real de um exercício (peso/repetições feitas).
type HistorySet struct {
	Weight string `json:"weight,omitempty"` // ex.: "60 kg"
	Reps   string `json:"reps,omitempty"`   // ex.: "10"
	Done   bool   `json:"done"`
}

// HistoryExercise registra o que o aluno marcou de um exercício do treino.
type HistoryExercise struct {
	Name  string        `json:"name"`
	Order int           `json:"order"`
	Sets  []HistorySet  `json:"sets,omitempty"`
	Note  string        `json:"note,omitempty"`
}

// WorkoutHistoryEntry registra um treino concluído pelo aluno.
type WorkoutHistoryEntry struct {
	ID                 string              `json:"id,omitempty"`
	StudentID          string              `json:"studentId"`
	WorkoutID          string              `json:"workoutId"`
	NutritionistID     string              `json:"nutritionistId"`
	CompletedAt        time.Time           `json:"completedAt,omitempty"`
	Duration           int                 `json:"duration,omitempty"` // minutos
	ExercisesCompleted int                 `json:"exercisesCompleted"`
	TotalExercises     int                 `json:"totalExercises"`
	Exercises          []HistoryExercise   `json:"exercises,omitempty"` // execução marcada pelo aluno
}

// ── Requests de API ──

// DuplicateRequest é o payload para duplicar treino ou dieta.
type DuplicateRequest struct {
	NewStudentID string `json:"newStudentId"`
	NewName      string `json:"newName,omitempty"`
}

// CompleteWorkoutRequest é o payload para concluir um treino.
type CompleteWorkoutRequest struct {
	WorkoutID          string            `json:"workoutId"`
	Duration           int               `json:"duration"`
	ExercisesCompleted int               `json:"exercisesCompleted"`
	TotalExercises     int               `json:"totalExercises"`
	Exercises          []HistoryExercise `json:"exercises,omitempty"`
}
