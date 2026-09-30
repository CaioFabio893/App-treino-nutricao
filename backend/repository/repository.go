// Package repository é a camada de persistência. Define a interface
// Repository (fácil de trocar/mockar em testes) e uma implementação
// Firestore. Nenhuma regra de negócio vive aqui.
package repository

import (
	"context"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"treino-louise/backend/models"
)

// Estrutura no Firestore:
//
//	users/{uid}                                       → UserProfile
//
//	workouts/{workoutId}                               → WorkoutDefine (com Exercises [] dentro)
//	diets/{dietId}                                     → Diet (com Meals [] dentro, cada Meal com Foods [])
//	workoutHistory/{historyId}                         → WorkoutHistoryEntry
//
// Obs.: os arrays ficam dentro dos documentos principais — simples, confiável
// e com folga para o tamanho máximo de 1 MiB do Firestore (um treino ou dieta
// tem dezenas de itens, muito abaixo do limite).

// Repository encapsula todo o acesso ao Firestore.
type Repository interface {
	// Perfil de usuário
	GetUserProfile(ctx context.Context, uid string) (*models.UserProfile, error)
	PutUserProfile(ctx context.Context, uid string, p *models.UserProfile) error
	CreateUser(ctx context.Context, uid string, p *models.UserProfile) error
	DeleteUserProfile(ctx context.Context, uid string) error
	ListStudentsAll(ctx context.Context) ([]*models.UserProfile, error)
	ListUsers(ctx context.Context) ([]*models.UserProfile, error)
	// ListUsersByStatus devolve os perfis com um status exato
	// (ex.: pending_approval para a fila de aprovação do admin).
	ListUsersByStatus(ctx context.Context, status string) ([]*models.UserProfile, error)

	// Planos (pacotes de funcionalidades)
	CreatePlan(ctx context.Context, p *models.Plan) (*models.Plan, error)
	GetPlan(ctx context.Context, id string) (*models.Plan, error)
	ListPlans(ctx context.Context) ([]*models.Plan, error)
	UpdatePlan(ctx context.Context, id string, p *models.Plan) error
	DeletePlan(ctx context.Context, id string) error
	// CountStudentsWithPlan conta quantos alunos ativos/atribuídos usam o plano
	// (usado para bloquear exclusão de plano em uso com 409).
	CountStudentsWithPlan(ctx context.Context, planID string) (int, error)

	// Treinos
	CreateWorkout(ctx context.Context, w *models.WorkoutDefine) (*models.WorkoutDefine, error)
	GetWorkout(ctx context.Context, id string) (*models.WorkoutDefine, error)
	ListWorkoutsForStudent(ctx context.Context, studentID string) ([]*models.WorkoutDefine, error)
	ListWorkouts(ctx context.Context) ([]*models.WorkoutDefine, error)
	UpdateWorkout(ctx context.Context, id string, w *models.WorkoutDefine) error
	DeleteWorkout(ctx context.Context, id string) error

	// Programas de treinamento (F19) — lista ordenada de referências a treinos
	// existentes (workouts/{id}); o conteúdo do treino NÃO é duplicado aqui.
	CreateProgram(ctx context.Context, p *models.TrainingProgram) (*models.TrainingProgram, error)
	GetProgram(ctx context.Context, id string) (*models.TrainingProgram, error)
	ListProgramsForStudent(ctx context.Context, studentID string) ([]*models.TrainingProgram, error)
	ListPrograms(ctx context.Context) ([]*models.TrainingProgram, error)
	UpdateProgram(ctx context.Context, id string, p *models.TrainingProgram) error
	DeleteProgram(ctx context.Context, id string) error

	// Dietas
	CreateDiet(ctx context.Context, d *models.Diet) (*models.Diet, error)
	GetDiet(ctx context.Context, id string) (*models.Diet, error)
	ListDietsForStudent(ctx context.Context, studentID string) ([]*models.Diet, error)
	ListDiets(ctx context.Context) ([]*models.Diet, error)
	UpdateDiet(ctx context.Context, id string, d *models.Diet) error
	DeleteDiet(ctx context.Context, id string) error

	// Biblioteca de exercícios (catálogo global — exercises/{id})
	CreateExercise(ctx context.Context, e *models.ExerciseItem) (*models.ExerciseItem, error)
	GetExercise(ctx context.Context, id string) (*models.ExerciseItem, error)
	ListExercises(ctx context.Context) ([]*models.ExerciseItem, error)
	UpdateExercise(ctx context.Context, id string, e *models.ExerciseItem) error
	DeleteExercise(ctx context.Context, id string) error

	// Histórico de treinos
	CreateHistoryEntry(ctx context.Context, h *models.WorkoutHistoryEntry) (*models.WorkoutHistoryEntry, error)
	ListHistoryForStudent(ctx context.Context, studentID string) ([]*models.WorkoutHistoryEntry, error)
	ListHistory(ctx context.Context) ([]*models.WorkoutHistoryEntry, error)
	ListHistoryForStudentSince(ctx context.Context, studentID string, since, until time.Time) ([]*models.WorkoutHistoryEntry, error)

	// Dieta diária
	GetDietLog(ctx context.Context, studentID, date string) (*models.DietDailyLog, error)
	PutDietLog(ctx context.Context, log *models.DietDailyLog) error
	ListDietLogsForStudent(ctx context.Context, studentID, from, to string) ([]*models.DietDailyLog, error)
}

// firestoreRepo é a implementação concreta sobre o Firestore.
type firestoreRepo struct {
	fs *firestore.Client
}

// New cria um Repository apontando para o Firestore.
func New(fs *firestore.Client) Repository {
	return &firestoreRepo{fs: fs}
}

// isNotFound devolve true se o erro for "documento não encontrado".
func isNotFound(err error) bool {
	return err != nil && status.Code(err) == codes.NotFound
}

// docIterator abstrai *firestore.DocumentIterator para permitir testar os
// coletores de lista sem um emulador do Firestore (ver repository_test.go).
// *firestore.DocumentIterator satisfaz esta interface.
type docIterator interface {
	Next() (*firestore.DocumentSnapshot, error)
	Stop()
}

// ensureNonNilSlice garante o contrato JSON de coleções: o encoding/json
// serializa um slice nil como "null", enquanto o frontend espera um array.
// Normalizamos para um slice vazio (não-nil) para que a resposta seja sempre
// "[]" quando a coleção não tiver registros — nunca `null`.
func ensureNonNilSlice[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

// ── Perfil de usuário ──

func (r *firestoreRepo) GetUserProfile(ctx context.Context, uid string) (*models.UserProfile, error) {
	doc, err := r.fs.Collection("users").Doc(uid).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.UserProfile{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	// O documento é users/{uid}: o ID do perfil é o próprio UID. Sem isso o
	// campo `id` é omitido do JSON (omitempty) e o frontend perde o vínculo
	// (ex.: GET /api/students/{id} e GET /api/me) — mesmo mapeamento que
	// profilesFromIter faz nas listagens.
	out.ID = doc.Ref.ID
	return out, nil
}

// userProfileData monta o mapa de escrita de users/{uid} (sem o ID, que é a
// chave do documento). `createdAt` preserva o valor original quando existir
// (ex.: atualização de perfil — jamais sobrescreve a data de criação) e usa
// ServerTimestamp apenas na criação de um perfil novo.
func userProfileData(p *models.UserProfile) map[string]any {
	createdAt := any(firestore.ServerTimestamp)
	if !p.CreatedAt.IsZero() {
		createdAt = p.CreatedAt
	}
	return map[string]any{
		"name":           p.Name,
		"email":          p.Email,
		"role":           string(p.Role),
		"startDate":      p.StartDate,
		"endDate":        p.EndDate,
		"status":         p.Status,
		"planID":         p.PlanID,
		"features":       p.Features,
		"authProvider":   p.AuthProvider,
		"approvedBy":     p.ApprovedBy,
		"approvedAt":     p.ApprovedAt,
		"rejectedReason": p.RejectedReason,
		"createdAt":      createdAt,
		"updatedAt":      firestore.ServerTimestamp,
	}
}

func (r *firestoreRepo) PutUserProfile(ctx context.Context, uid string, p *models.UserProfile) error {
	_, err := r.fs.Collection("users").Doc(uid).Set(ctx, userProfileData(p))
	return err
}

// CreateUser cria o perfil (mantém o campo role).
func (r *firestoreRepo) CreateUser(ctx context.Context, uid string, p *models.UserProfile) error {
	_, err := r.fs.Collection("users").Doc(uid).Set(ctx, userProfileData(p))
	return err
}

func (r *firestoreRepo) DeleteUserProfile(ctx context.Context, uid string) error {
	_, err := r.fs.Collection("users").Doc(uid).Delete(ctx)
	return err
}

// ListStudents lista usuários com role=student vinculados a um nutricionista.
// ListStudentsAll lista todos os usuários com role=student (ranking global).
func (r *firestoreRepo) ListStudentsAll(ctx context.Context) ([]*models.UserProfile, error) {
	iter := r.fs.Collection("users").
		Where("role", "==", string(models.RoleStudent)).
		Documents(ctx)
	return profilesFromIter(iter)
}

func (r *firestoreRepo) ListUsers(ctx context.Context) ([]*models.UserProfile, error) {
	iter := r.fs.Collection("users").Documents(ctx)
	return profilesFromIter(iter)
}

// ListUsersByStatus devolve os perfis com status exato (fila de aprovação).
func (r *firestoreRepo) ListUsersByStatus(ctx context.Context, status string) ([]*models.UserProfile, error) {
	iter := r.fs.Collection("users").
		Where("status", "==", status).
		Documents(ctx)
	return profilesFromIter(iter)
}

// ── Planos (pacotes de funcionalidades) ──

func (r *firestoreRepo) CreatePlan(ctx context.Context, p *models.Plan) (*models.Plan, error) {
	ref, _, err := r.fs.Collection("plans").Add(ctx, map[string]any{
		"name":        p.Name,
		"description": p.Description,
		"features":    p.Features,
		"active":      p.Active,
		"createdAt":   firestore.ServerTimestamp,
		"updatedAt":   firestore.ServerTimestamp,
	})
	if err != nil {
		return nil, err
	}
	p.ID = ref.ID
	return p, nil
}

func (r *firestoreRepo) GetPlan(ctx context.Context, id string) (*models.Plan, error) {
	doc, err := r.fs.Collection("plans").Doc(id).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.Plan{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	out.ID = doc.Ref.ID
	return out, nil
}

func (r *firestoreRepo) ListPlans(ctx context.Context) ([]*models.Plan, error) {
	iter := r.fs.Collection("plans").OrderBy("createdAt", firestore.Asc).Documents(ctx)
	defer iter.Stop()
	var out []*models.Plan
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		p := &models.Plan{}
		if err := doc.DataTo(p); err != nil {
			continue
		}
		p.ID = doc.Ref.ID
		out = append(out, p)
	}
	return ensureNonNilSlice(out), nil
}

func (r *firestoreRepo) UpdatePlan(ctx context.Context, id string, p *models.Plan) error {
	_, err := r.fs.Collection("plans").Doc(id).Set(ctx, map[string]any{
		"name":        p.Name,
		"description": p.Description,
		"features":    p.Features,
		"active":      p.Active,
		"updatedAt":   firestore.ServerTimestamp,
	}, firestore.MergeAll)
	return err
}

func (r *firestoreRepo) DeletePlan(ctx context.Context, id string) error {
	_, err := r.fs.Collection("plans").Doc(id).Delete(ctx)
	return err
}

// CountStudentsWithPlan conta quantos perfis têm planID preenchido com o plano
// dado (bloqueia exclusão de plano em uso). Alunos sem perfil/planID não contam.
func (r *firestoreRepo) CountStudentsWithPlan(ctx context.Context, planID string) (int, error) {
	iter := r.fs.Collection("users").
		Where("planID", "==", planID).
		Documents(ctx)
	defer iter.Stop()
	n := 0
	for {
		_, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return 0, err
		}
		n++
	}
	return n, nil
}

func profilesFromIter(iter docIterator) ([]*models.UserProfile, error) {
	defer iter.Stop()
	var out []*models.UserProfile
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		p := &models.UserProfile{}
		if err := doc.DataTo(p); err != nil {
			continue
		}
		p.ID = doc.Ref.ID
		out = append(out, p)
	}
	return ensureNonNilSlice(out), nil
}

// ── Treinos (exercícios embutidos no documento) ──

func (r *firestoreRepo) CreateWorkout(ctx context.Context, w *models.WorkoutDefine) (*models.WorkoutDefine, error) {
	ref, _, err := r.fs.Collection("workouts").Add(ctx, map[string]any{
		"studentId":   w.StudentID,
		"name":        w.Name,
		"description": w.Description,
		"objective":   w.Objective,
		"dayOfWeek":   w.DayOfWeek,
		"exercises":   w.Exercises,
		"createdAt":   firestore.ServerTimestamp,
		"updatedAt":   firestore.ServerTimestamp,
	})
	if err != nil {
		return nil, err
	}
	w.ID = ref.ID
	return w, nil
}

func (r *firestoreRepo) GetWorkout(ctx context.Context, id string) (*models.WorkoutDefine, error) {
	doc, err := r.fs.Collection("workouts").Doc(id).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.WorkoutDefine{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	out.ID = doc.Ref.ID
	return out, nil
}

func (r *firestoreRepo) ListWorkoutsForStudent(ctx context.Context, studentID string) ([]*models.WorkoutDefine, error) {
	iter := r.fs.Collection("workouts").
		Where("studentId", "==", studentID).
		OrderBy("createdAt", firestore.Desc).
		Documents(ctx)
	return workoutsFromIter(iter)
}

func (r *firestoreRepo) ListWorkouts(ctx context.Context) ([]*models.WorkoutDefine, error) {
	iter := r.fs.Collection("workouts").OrderBy("createdAt", firestore.Desc).Documents(ctx)
	return workoutsFromIter(iter)
}

func workoutsFromIter(iter docIterator) ([]*models.WorkoutDefine, error) {
	defer iter.Stop()
	var out []*models.WorkoutDefine
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		w := &models.WorkoutDefine{}
		if err := doc.DataTo(w); err != nil {
			continue
		}
		w.ID = doc.Ref.ID
		out = append(out, w)
	}
	return ensureNonNilSlice(out), nil
}

func (r *firestoreRepo) UpdateWorkout(ctx context.Context, id string, w *models.WorkoutDefine) error {
	_, err := r.fs.Collection("workouts").Doc(id).Set(ctx, map[string]any{
		"studentId":   w.StudentID,
		"name":        w.Name,
		"description": w.Description,
		"objective":   w.Objective,
		"dayOfWeek":   w.DayOfWeek,
		"exercises":   w.Exercises,
		"updatedAt":   firestore.ServerTimestamp,
	}, firestore.MergeAll)
	return err
}

func (r *firestoreRepo) DeleteWorkout(ctx context.Context, id string) error {
	_, err := r.fs.Collection("workouts").Doc(id).Delete(ctx)
	return err
}

// ── Programas de treinamento (F19) ──
//
// O programa NÃO duplica o treino: `workouts` é uma lista ordenada de
// referências (ProgramWorkout.WorkoutID) para documentos de workouts/{id}. As
// cópias materializadas na atribuição usam o mesmo formato dos treinos normais.

func (r *firestoreRepo) CreateProgram(ctx context.Context, p *models.TrainingProgram) (*models.TrainingProgram, error) {
	ref, _, err := r.fs.Collection("programs").Add(ctx, map[string]any{
		"studentId":   p.StudentID,
		"name":        p.Name,
		"description": p.Description,
		"objective":   p.Objective,
		"workouts":    p.Workouts,
		"notes":       p.Notes,
		"source":      p.Source,
		"createdAt":   firestore.ServerTimestamp,
		"updatedAt":   firestore.ServerTimestamp,
	})
	if err != nil {
		return nil, err
	}
	p.ID = ref.ID
	return p, nil
}

func (r *firestoreRepo) GetProgram(ctx context.Context, id string) (*models.TrainingProgram, error) {
	doc, err := r.fs.Collection("programs").Doc(id).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.TrainingProgram{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	out.ID = doc.Ref.ID
	return out, nil
}

func (r *firestoreRepo) ListProgramsForStudent(ctx context.Context, studentID string) ([]*models.TrainingProgram, error) {
	iter := r.fs.Collection("programs").
		Where("studentId", "==", studentID).
		OrderBy("createdAt", firestore.Desc).
		Documents(ctx)
	return programsFromIter(iter)
}

func (r *firestoreRepo) ListPrograms(ctx context.Context) ([]*models.TrainingProgram, error) {
	iter := r.fs.Collection("programs").OrderBy("createdAt", firestore.Desc).Documents(ctx)
	return programsFromIter(iter)
}

func programsFromIter(iter docIterator) ([]*models.TrainingProgram, error) {
	defer iter.Stop()
	var out []*models.TrainingProgram
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		p := &models.TrainingProgram{}
		if err := doc.DataTo(p); err != nil {
			continue
		}
		p.ID = doc.Ref.ID
		out = append(out, p)
	}
	return ensureNonNilSlice(out), nil
}

// UpdateProgram não envia createdAt: o MergeAll sem esse campo preserva o valor
// gravado na criação (regra: createdAt NUNCA é sobrescrito).
func (r *firestoreRepo) UpdateProgram(ctx context.Context, id string, p *models.TrainingProgram) error {
	_, err := r.fs.Collection("programs").Doc(id).Set(ctx, map[string]any{
		"studentId":   p.StudentID,
		"name":        p.Name,
		"description": p.Description,
		"objective":   p.Objective,
		"workouts":    p.Workouts,
		"notes":       p.Notes,
		"source":      p.Source,
		"updatedAt":   firestore.ServerTimestamp,
	}, firestore.MergeAll)
	return err
}

func (r *firestoreRepo) DeleteProgram(ctx context.Context, id string) error {
	_, err := r.fs.Collection("programs").Doc(id).Delete(ctx)
	return err
}

// ── Dietas (refeições/alimentos embutidos no documento) ──

func (r *firestoreRepo) CreateDiet(ctx context.Context, d *models.Diet) (*models.Diet, error) {
	ref, _, err := r.fs.Collection("diets").Add(ctx, map[string]any{
		"studentId":   d.StudentID,
		"name":        d.Name,
		"description": d.Description,
		"startDate":   d.StartDate,
		"endDate":     d.EndDate,
		"content":     d.Content,
		"meals":       d.Meals,
		"createdAt":   firestore.ServerTimestamp,
		"updatedAt":   firestore.ServerTimestamp,
	})
	if err != nil {
		return nil, err
	}
	d.ID = ref.ID
	return d, nil
}

func (r *firestoreRepo) GetDiet(ctx context.Context, id string) (*models.Diet, error) {
	doc, err := r.fs.Collection("diets").Doc(id).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.Diet{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	out.ID = doc.Ref.ID
	return out, nil
}

func (r *firestoreRepo) ListDietsForStudent(ctx context.Context, studentID string) ([]*models.Diet, error) {
	iter := r.fs.Collection("diets").
		Where("studentId", "==", studentID).
		OrderBy("createdAt", firestore.Desc).
		Documents(ctx)
	return dietsFromIter(iter)
}

func (r *firestoreRepo) ListDiets(ctx context.Context) ([]*models.Diet, error) {
	iter := r.fs.Collection("diets").OrderBy("createdAt", firestore.Desc).Documents(ctx)
	return dietsFromIter(iter)
}

func dietsFromIter(iter docIterator) ([]*models.Diet, error) {
	defer iter.Stop()
	var out []*models.Diet
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		d := &models.Diet{}
		if err := doc.DataTo(d); err != nil {
			continue
		}
		d.ID = doc.Ref.ID
		out = append(out, d)
	}
	return ensureNonNilSlice(out), nil
}

func (r *firestoreRepo) UpdateDiet(ctx context.Context, id string, d *models.Diet) error {
	_, err := r.fs.Collection("diets").Doc(id).Set(ctx, map[string]any{
		"studentId":   d.StudentID,
		"name":        d.Name,
		"description": d.Description,
		"startDate":   d.StartDate,
		"endDate":     d.EndDate,
		"content":     d.Content,
		"meals":       d.Meals,
		"updatedAt":   firestore.ServerTimestamp,
	}, firestore.MergeAll)
	return err
}

func (r *firestoreRepo) DeleteDiet(ctx context.Context, id string) error {
	_, err := r.fs.Collection("diets").Doc(id).Delete(ctx)
	return err
}

// ── Biblioteca de exercícios (catálogo global) ──

// exerciseData monta o mapa de escrita de exercises/{id}. Assim como workouts/
// diets, `createdAt` só é definido na criação (ServerTimestamp); no update usa-se
// MergeAll SEM createdAt, preservando a data de criação original.
func exerciseData(e *models.ExerciseItem) map[string]any {
	return map[string]any{
		"name":        e.Name,
		"description": e.Description,
		"muscleGroup": e.MuscleGroup,
		"equipment":   e.Equipment,
		"videoUrl":    e.VideoURL,
	}
}

func (r *firestoreRepo) CreateExercise(ctx context.Context, e *models.ExerciseItem) (*models.ExerciseItem, error) {
	ref, _, err := r.fs.Collection("exercises").Add(ctx, map[string]any{
		"name":        e.Name,
		"description": e.Description,
		"muscleGroup": e.MuscleGroup,
		"equipment":   e.Equipment,
		"videoUrl":    e.VideoURL,
		"createdAt":   firestore.ServerTimestamp,
		"updatedAt":   firestore.ServerTimestamp,
	})
	if err != nil {
		return nil, err
	}
	e.ID = ref.ID
	return e, nil
}

func (r *firestoreRepo) GetExercise(ctx context.Context, id string) (*models.ExerciseItem, error) {
	doc, err := r.fs.Collection("exercises").Doc(id).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.ExerciseItem{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	out.ID = doc.Ref.ID
	return out, nil
}

// ListExercises devolve o catálogo global ordenado por nome (índice automático
// de campo único — nenhum índice composto manual é necessário).
func (r *firestoreRepo) ListExercises(ctx context.Context) ([]*models.ExerciseItem, error) {
	iter := r.fs.Collection("exercises").OrderBy("name", firestore.Asc).Documents(ctx)
	defer iter.Stop()
	var out []*models.ExerciseItem
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		e := &models.ExerciseItem{}
		if err := doc.DataTo(e); err != nil {
			continue
		}
		e.ID = doc.Ref.ID
		out = append(out, e)
	}
	return ensureNonNilSlice(out), nil
}

// UpdateExercise atualiza um exercício da biblioteca sem tocar createdAt
// (MergeAll com os campos editáveis). A alteração NÃO afeta treinos existentes:
// eles mantêm o snapshot WorkoutExercise copiado no momento da seleção.
func (r *firestoreRepo) UpdateExercise(ctx context.Context, id string, e *models.ExerciseItem) error {
	_, err := r.fs.Collection("exercises").Doc(id).Set(ctx, exerciseData(e), firestore.MergeAll)
	return err
}

func (r *firestoreRepo) DeleteExercise(ctx context.Context, id string) error {
	_, err := r.fs.Collection("exercises").Doc(id).Delete(ctx)
	return err
}

// ── Histórico de treinos ──

func (r *firestoreRepo) CreateHistoryEntry(ctx context.Context, h *models.WorkoutHistoryEntry) (*models.WorkoutHistoryEntry, error) {
	ref, _, err := r.fs.Collection("workoutHistory").Add(ctx, map[string]any{
		"studentId":          h.StudentID,
		"workoutId":          h.WorkoutID,
		"completedAt":        h.CompletedAt,
		"duration":           h.Duration,
		"exercisesCompleted": h.ExercisesCompleted,
		"totalExercises":     h.TotalExercises,
		"exercises":          h.Exercises,
	})
	if err != nil {
		return nil, err
	}
	h.ID = ref.ID
	return h, nil
}

func (r *firestoreRepo) ListHistoryForStudent(ctx context.Context, studentID string) ([]*models.WorkoutHistoryEntry, error) {
	iter := r.fs.Collection("workoutHistory").
		Where("studentId", "==", studentID).
		OrderBy("completedAt", firestore.Desc).
		Limit(200).
		Documents(ctx)
	return historyFromIter(iter)
}

func (r *firestoreRepo) ListHistory(ctx context.Context) ([]*models.WorkoutHistoryEntry, error) {
	iter := r.fs.Collection("workoutHistory").
		OrderBy("completedAt", firestore.Desc).
		Limit(1000).
		Documents(ctx)
	return historyFromIter(iter)
}

func historyFromIter(iter *firestore.DocumentIterator) ([]*models.WorkoutHistoryEntry, error) {
	defer iter.Stop()
	var out []*models.WorkoutHistoryEntry
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		h := &models.WorkoutHistoryEntry{}
		if err := doc.DataTo(h); err != nil {
			continue
		}
		h.ID = doc.Ref.ID
		out = append(out, h)
	}
	return out, nil
}

// ListHistoryForStudentSince devolve o histórico de treinos de um aluno desde
// uma data (usado para recalcular a pontuação do ciclo).
func (r *firestoreRepo) ListHistoryForStudentSince(ctx context.Context, studentID string, since time.Time, until time.Time) ([]*models.WorkoutHistoryEntry, error) {
	iter := r.fs.Collection("workoutHistory").
		Where("studentId", "==", studentID).
		Where("completedAt", ">=", since).
		Where("completedAt", "<", until).
		Documents(ctx)
	return historyFromIter(iter)
}

// ── Dieta diária ──

func dietLogDocID(studentID, date string) string {
	return studentID + "_" + date
}

func (r *firestoreRepo) GetDietLog(ctx context.Context, studentID, date string) (*models.DietDailyLog, error) {
	doc, err := r.fs.Collection("dietLogs").Doc(dietLogDocID(studentID, date)).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.DietDailyLog{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	out.ID = doc.Ref.ID
	return out, nil
}

// dietLogData monta o mapa de escrita de um log de dieta diário. createdAt é
// PRESERVADO quando o log já tem data (atualização); só log novo
// (log.CreatedAt zero) usa ServerTimestamp — mesma regra do userProfileData.
// Corrige o achado 3.3 (PutDietLog regravava createdAt a cada save).
func dietLogData(log *models.DietDailyLog) map[string]any {
	createdAt := any(firestore.ServerTimestamp)
	if !log.CreatedAt.IsZero() {
		createdAt = log.CreatedAt
	}
	return map[string]any{
		"studentId":  log.StudentID,
		"dietId":     log.DietID,
		"dietName":   log.DietName,
		"date":       log.Date,
		"status":     string(log.Status),
		"mealChecks": log.MealChecks,
		"note":       log.Note,
		"createdAt":  createdAt,
		"updatedAt":  firestore.ServerTimestamp,
	}
}

func (r *firestoreRepo) PutDietLog(ctx context.Context, log *models.DietDailyLog) error {
	_, err := r.fs.Collection("dietLogs").Doc(dietLogDocID(log.StudentID, log.Date)).Set(ctx, dietLogData(log))
	return err
}

// ListDietLogsForStudent devolve os logs do aluno em um intervalo de datas
// (from/to opcionais, formato YYYY-MM-DD — ordenável lexicograficamente).
func (r *firestoreRepo) ListDietLogsForStudent(ctx context.Context, studentID, from, to string) ([]*models.DietDailyLog, error) {
	q := r.fs.Collection("dietLogs").
		Where("studentId", "==", studentID)
	if from != "" {
		q = q.Where("date", ">=", from)
	}
	if to != "" {
		q = q.Where("date", "<=", to)
	}
	q = q.OrderBy("date", firestore.Desc)
	iter := q.Documents(ctx)
	defer iter.Stop()
	var out []*models.DietDailyLog
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		d := &models.DietDailyLog{}
		if err := doc.DataTo(d); err != nil {
			continue
		}
		d.ID = doc.Ref.ID
		out = append(out, d)
	}
	return ensureNonNilSlice(out), nil
}
