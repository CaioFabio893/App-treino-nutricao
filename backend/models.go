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
	Bio            string    `json:"bio,omitempty"`            // bio curta exibida no perfil público
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
	VideoURL     string  `json:"videoUrl,omitempty"` // link do YouTube (só nutri/admin edita)
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
	WorkoutName        string              `json:"workoutName,omitempty"`
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
	Caption            string            `json:"caption,omitempty"` // legenda opcional do post automático
}

// ── Rede social ──

// PostType classifica o post do feed.
type PostType string

const (
	PostWorkout PostType = "workout"
	PostDiet    PostType = "diet"
	PostText    PostType = "text"
)

// PostComment é um comentário embutido no documento do post.
// A remoção é soft delete (Deleted=true) quando feita por moderador, para
// auditoria (ModeratedBy/ModeratedAt registram quem removeu e quando).
type PostComment struct {
	ID           string    `json:"id,omitempty"`
	UserID       string    `json:"userId"`
	UserName     string    `json:"userName"`
	UserPhotoURL string    `json:"userPhotoURL,omitempty"`
	Text         string    `json:"text"`
	CreatedAt    time.Time `json:"createdAt,omitempty"`
	Deleted      bool      `json:"deleted,omitempty"`
	ModeratedBy  string    `json:"moderatedBy,omitempty"`
	ModeratedAt  time.Time `json:"moderatedAt,omitempty"`
}

// Post é um documento da coleção posts/{postId}.
// O autor pode apagar o próprio post; nutricionista/admin podem apagar
// qualquer post (soft delete para auditoria). Curtidas ficam num map uid→true.
type Post struct {
	ID           string         `json:"id,omitempty"`
	UserID       string         `json:"userId"`
	UserName     string         `json:"userName"`
	UserPhotoURL string         `json:"userPhotoURL,omitempty"`
	Type         PostType       `json:"type"`
	Text         string         `json:"text,omitempty"`   // legenda opcional
	WorkoutID    string         `json:"workoutId,omitempty"`
	WorkoutName  string         `json:"workoutName,omitempty"`
	DietID       string         `json:"dietId,omitempty"`
	DietName     string         `json:"dietName,omitempty"`
	Date         string         `json:"date,omitempty"` // data da conclusão (YYYY-MM-DD)
	Likes        map[string]bool `json:"likes,omitempty"`
	LikeCount    int            `json:"likeCount"`
	Comments     []*PostComment `json:"comments,omitempty"`
	Deleted      bool           `json:"deleted,omitempty"` // soft delete por moderação
	ModeratedBy  string         `json:"moderatedBy,omitempty"`
	ModeratedAt  time.Time      `json:"moderatedAt,omitempty"`
	CreatedAt    time.Time      `json:"createdAt,omitempty"`
	UpdatedAt    time.Time      `json:"updatedAt,omitempty"`
}

// CreatePostRequest é o payload para criar um post no feed.
type CreatePostRequest struct {
	Text      string `json:"text"`
	WorkoutID string `json:"workoutId,omitempty"`
	DietID    string `json:"dietId,omitempty"`
	Date      string `json:"date,omitempty"`
}

// CommentRequest é o payload para adicionar um comentário.
type CommentRequest struct {
	Text string `json:"text"`
}

// ── Dieta diária ──

// DietLogStatus é o estado agregado do dia de dieta.
type DietLogStatus string

const (
	DietNotFollowed DietLogStatus = "not_followed"
	DietPartial     DietLogStatus = "partial"
	DietFollowed    DietLogStatus = "followed"
)

// MealCheck é a marcação por refeição dentro do log do dia.
// Essa granularidade (por refeição) só é exibida para nutricionista/admin;
// o aluno marca durante o dia, mas o resumo dele (e o feed/ranking) usa o
// status agregado do dia.
type MealCheck struct {
	MealID    string    `json:"mealId"`
	MealName  string    `json:"mealName"`
	Followed  bool      `json:"followed"`
	Note      string    `json:"note,omitempty"`
	UpdatedAt time.Time `json:"updatedAt,omitempty"`
}

// DietDailyLog é o log diário de adesão à dieta (uma refeição ou o dia todo).
// Documento em dietLogs/{studentID}_{date} — um por aluno por dia.
type DietDailyLog struct {
	ID             string        `json:"id,omitempty"`
	StudentID      string        `json:"studentId"`
	NutritionistID string        `json:"nutritionistId"`
	DietID         string        `json:"dietId,omitempty"`
	DietName       string        `json:"dietName,omitempty"`
	Date           string        `json:"date"` // YYYY-MM-DD
	Status         DietLogStatus `json:"status"`
	MealChecks     []*MealCheck  `json:"mealChecks,omitempty"`
	Note           string        `json:"note,omitempty"`
	Caption        string        `json:"caption,omitempty"` // legenda do post automático
	PostID         string        `json:"postId,omitempty"`  // post automático criado
	CreatedAt      time.Time     `json:"createdAt,omitempty"`
	UpdatedAt      time.Time     `json:"updatedAt,omitempty"`
}

// UpsertDietLogRequest é o payload para salvar/atualizar o log de um dia.
type UpsertDietLogRequest struct {
	StudentID  string        `json:"studentId,omitempty"` // opcional (admin marca p/ qualquer aluno)
	Date       string        `json:"date"`
	Status     *string       `json:"status,omitempty"` // força o status do dia (opcional)
	MealChecks []*MealCheck  `json:"mealChecks,omitempty"`
	Note       string        `json:"note,omitempty"`
	Caption    string        `json:"caption,omitempty"`
}

// ── Ranking / pontuação ──

// ScoreRecord guarda a nota corrente do ciclo em andamento (scores/{uid}).
type ScoreRecord struct {
	StudentID     string    `json:"studentId"`
	RawPoints     float64   `json:"rawPoints"`
	CycleID       string    `json:"cycleId"`
	CycleStart    string    `json:"cycleStart"`
	Score         float64   `json:"score"`
	DaysElapsed   int       `json:"daysElapsed"`
	DaysCompleted int       `json:"daysCompleted"`
	UpdatedAt     time.Time `json:"updatedAt,omitempty"`
}

// ScoreHistoryEntry guarda a nota FINAL de um ciclo fechado
// (scores_history/{uid}/{cicloId}) — não zera quando o ranking reseta.
type ScoreHistoryEntry struct {
	StudentID  string    `json:"studentId"`
	CycleID    string    `json:"cycleId"`
	StartDate  string    `json:"startDate"`
	EndDate    string    `json:"endDate"`
	RawPoints  float64   `json:"rawPoints"`
	Days       int       `json:"days"`
	Score      float64   `json:"score"`
	RecordedAt time.Time `json:"recordedAt,omitempty"`
}

// RankingEntry é uma linha do ranking.
type RankingEntry struct {
	Rank      int     `json:"rank"`
	StudentID string  `json:"studentId"`
	Name      string  `json:"name"`
	PhotoURL  string  `json:"photoURL,omitempty"`
	Score     float64 `json:"score"`
}

// RankingResponse é o formato devolvido pelo endpoint de ranking.
// top20 é público; self mostra a posição do aluno logado (mesmo fora do top);
// full só é preenchido para nutricionista/admin (ranking completo).
type RankingResponse struct {
	CycleID    string          `json:"cycleId"`
	CycleStart string          `json:"cycleStart"`
	CycleEnd   string          `json:"cycleEnd"`
	Top        []*RankingEntry `json:"top"`
	Self       *RankingEntry   `json:"self,omitempty"`
	Full       []*RankingEntry `json:"full,omitempty"`
	Total      int             `json:"total"`
}

// PublicProfile é a versão de perfil visível para qualquer usuário autenticado
// (usada no feed e na mini página de perfil).
type PublicProfile struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	PhotoURL string  `json:"photoURL,omitempty"`
	Bio      string  `json:"bio,omitempty"`
	Role     Role    `json:"role"`
	Streak   int     `json:"streak"`         // dias seguidos com treino e/ou dieta
	Score    float64 `json:"score,omitempty"` // nota corrente (aluno)
	CycleID  string  `json:"cycleId,omitempty"`
	Rank     int     `json:"rank,omitempty"` // posição atual (0 se fora/indisponível)
}
