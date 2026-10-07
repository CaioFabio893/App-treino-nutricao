// Package models contém as entidades de domínio, enums e DTOs da API.
// Nenhuma dependência externa além da stdlib — camada pura de dados.
package models

import "time"

// ── Models: gestão de aluno/admin ──

// Role define o papel do usuário no sistema.
type Role string

const (
	RoleAdmin   Role = "admin"
	RoleStudent Role = "student"
)

// ── Status de acesso do usuário (estende o campo Status já existente) ──
// Valores possíveis para UserProfile.Status (string livre, mantido por
// compatibilidade — os novos valores são adicionados como constantes).
const (
	StatusPendingApproval = "pending_approval" // cadastro feito (email/senha ou Google), aguardando admin aprovar o aluno
	StatusActive          = "active"           // já existia
	StatusPaused          = "paused"           // já existia
	StatusInactive        = "inactive"         // já existia
	StatusRejected        = "rejected"         // admin recusou o cadastro
)

// UserProfile é o documento raiz do usuário no Firestore (users/{uid}).
type UserProfile struct {
	ID        string    `json:"id,omitempty"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      Role      `json:"role"`
	Status    string    `json:"status,omitempty"` // "active", "pending_approval", "paused", "inactive", "rejected"
	CreatedAt time.Time `json:"createdAt,omitempty"`

	// ── Gestão: aprovação (spec gestao-cadastro-papeis-planos-google.md) ──
	AuthProvider   string    `json:"authProvider,omitempty"` // "password" | "google.com" — de onde veio o login
	ApprovedBy     string    `json:"approvedBy,omitempty"`   // uid do admin que aprovou
	ApprovedAt     time.Time `json:"approvedAt,omitempty"`
	RejectedReason string    `json:"rejectedReason,omitempty"`
}

// ── Treinos ──

// WorkoutDefine é o treino criado pelo nutricionista.
// Os exercícios ficam embutidos no documento (array `exercises`).
type WorkoutDefine struct {
	Modality       string             `json:"modality,omitempty"`       // gym/home; absent = legacy
	CircuitSeconds int                `json:"circuitSeconds,omitempty"` // AMRAP duration, outside warm-up
	ID             string             `json:"id,omitempty"`
	StudentID      string             `json:"studentId"`
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
	Phase           string `json:"phase,omitempty"` // warmup/main/cardio/stretching
	DurationSeconds int    `json:"durationSeconds,omitempty"`
	TimerExcluded   bool   `json:"timerExcluded,omitempty"`
	ID              string `json:"id,omitempty"`
	Name            string `json:"name"`
	Description     string `json:"description,omitempty"`
	Sets            int    `json:"sets"`
	Repetitions     string `json:"repetitions"`
	Weight          string `json:"weight,omitempty"`
	RestSeconds     int    `json:"restSeconds,omitempty"`
	VideoURL        string `json:"videoUrl,omitempty"` // link do YouTube (só nutri/admin edita)
	Notes           string `json:"notes,omitempty"`
	Order           int    `json:"order"`
}

// ── Programas de treinamento (F19) ──

// TrainingProgram agrupa vários TREINOS em um programa (coleção programs/{id}).
//
// Decisão de modelagem (F19): um treino do programa NÃO é uma entidade nova —
// é um `WorkoutDefine` já existente em `workouts/{id}`. O programa guarda apenas
// uma lista ORDENADA de REFERÊNCIAS (`Workouts []ProgramWorkout`). Isso mantém
// uma única implementação de treino (histórico, execução, impressão e UI do aluno
// continuam apontando para `workouts/{id}`) e permite, no futuro, reordenar
// treinos sem duplicar conteúdo, duplicar um programa e reatribuí-lo a outro aluno
// materializando cópias dos treinos.
type TrainingProgram struct {
	ID          string            `json:"id,omitempty"`
	StudentID   string            `json:"studentId"` // vazio = programa de biblioteca (não atribuído)
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Objective   string            `json:"objective,omitempty"`
	Workouts    []*ProgramWorkout `json:"workouts,omitempty"`
	Notes       string            `json:"notes,omitempty"`  // trechos da fonte preservados verbatim (PRs, periodização, estrutura semanal)
	Source      string            `json:"source,omitempty"` // proveniência da importação (ex.: nome do arquivo)
	CreatedAt   time.Time         `json:"createdAt,omitempty"`
	UpdatedAt   time.Time         `json:"updatedAt,omitempty"`
}

// ProgramWorkout é a referência a um treino do programa (workouts/{id}).
// Label/Name/DayOfWeek são SNAPSHOT do momento do vínculo, para a listagem do
// programa continuar legível mesmo que o treino seja renomeado depois.
type ProgramWorkout struct {
	WorkoutID string `json:"workoutId"`
	Order     int    `json:"order"`
	Label     string `json:"label,omitempty"`     // "A", "B", ... (rótulo vindo da fonte)
	Name      string `json:"name,omitempty"`      // nome do treino no momento do vínculo
	DayOfWeek string `json:"dayOfWeek,omitempty"` // "monday".."sunday"
}

// ── Biblioteca de exercícios ──

// ExerciseItem é um exercício da biblioteca compartilhada (coleção exercises/{id}).
// O catálogo é GLOBAL (sem ownerId): nutricionista/admin mantêm; alunos apenas
// consultam. Ao selecionar um exercício num treino, os dados são COPIADOS para
// um WorkoutExercise (snapshot) — a biblioteca nunca vira referência viva.
// (Nome distinto do tipo legado `Exercise` do modo original, que descreve a
// execução de séries dentro de uma Session.)
type ExerciseItem struct {
	ID          string    `json:"id,omitempty"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	MuscleGroup string    `json:"muscleGroup,omitempty"` // grupo muscular (ex.: "Peito", "Costas")
	Equipment   string    `json:"equipment,omitempty"`   // equipamento (ex.: "Barra", "Halter")
	VideoURL    string    `json:"videoUrl,omitempty"`    // link http(s) de vídeo (YouTube etc.)
	CreatedAt   time.Time `json:"createdAt,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty"`
}

// ── Dietas ──

// Diet é a dieta criada pelo nutricionista.
// Suporta dois formatos:
//   - Content: texto livre (copiar/colar) — formato atual simplificado;
//   - Meals: refeições com alimentos — formato legado, mantido para
//     compatibilidade com dietas já cadastradas.
type Diet struct {
	Document    *DietDocument `json:"document,omitempty"`
	Kind        string        `json:"kind,omitempty"` // recipe = receitas; vazio/diet = dieta existente
	ID          string        `json:"id,omitempty"`
	StudentID   string        `json:"studentId"`
	Name        string        `json:"name"`
	Description string        `json:"description,omitempty"`
	StartDate   string        `json:"startDate,omitempty"`
	EndDate     string        `json:"endDate,omitempty"`
	Content     string        `json:"content,omitempty"` // texto livre da dieta (formato simplificado)
	Meals       []*Meal       `json:"meals,omitempty"`   // legado: refeições estruturadas
	CreatedAt   time.Time     `json:"createdAt,omitempty"`
	UpdatedAt   time.Time     `json:"updatedAt,omitempty"`
}

// DietDocument references immutable raster pages in private storage, never a PDF URL.
type DietDocument struct {
	ID        string `json:"id" firestore:"id"`
	PageCount int    `json:"pageCount" firestore:"pageCount"`
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

// ── Requests de API ──

// DuplicateRequest é o payload para duplicar treino ou dieta.
type DuplicateRequest struct {
	NewStudentID string `json:"newStudentId"`
	NewName      string `json:"newName,omitempty"`
}

// ApproveUserRequest é o payload para aprovar um cadastro pendente.
// role é obrigatório e aceita somente "student".
type ApproveUserRequest struct {
	Role Role `json:"role"`
}

// RejectUserRequest é o payload para recusar um cadastro pendente.
type RejectUserRequest struct {
	Reason string `json:"reason,omitempty"`
}

// ImportProgramRequest é o payload de POST /api/programs/import.
// `Markdown` é o programa de treino no formato markdown: o backend parseia
// (pacote programmd) e cria os treinos + o programa. Só o admin pode importar.
type ImportProgramRequest struct {
	Markdown  string `json:"markdown"`
	Source    string `json:"source,omitempty"`    // ex.: "treino.md"
	Name      string `json:"name,omitempty"`      // sobrescreve o nome extraído do markdown
	StudentID string `json:"studentId,omitempty"` // opcional: já atribui a um aluno
}

// AssignProgramRequest é o payload de POST /api/programs/{id}/assign.
type AssignProgramRequest struct {
	StudentID string `json:"studentId"`
}
