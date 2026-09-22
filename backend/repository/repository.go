// Package repository é a camada de persistência. Define a interface
// Repository (fácil de trocar/mockar em testes) e uma implementação
// Firestore. Nenhuma regra de negócio vive aqui.
package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"treino-louise/backend/models"
)

// Erros sentinela de domínio do feed, traduzidos em HTTP pelos handlers.
var (
	// ErrPostNotFound indica que o post não existe (nem como documento) ou já
	// foi removido por moderação no momento da transação.
	ErrPostNotFound = errors.New("post nao encontrado")
	// ErrCommentNotFound indica que o comentário alvo não existe mais.
	ErrCommentNotFound = errors.New("comentario nao encontrado")
)

// Estrutura no Firestore:
//
//	users/{uid}/sessions/{1_ta}                        → Session (modo original)
//	users/{uid}/prs/main                               → PR (modo original)
//	users/{uid}/state/current                          → AppState (modo original)
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
	// Sessions (modo original)
	GetSession(ctx context.Context, uid string, week int, day string) (*models.Session, error)
	PutSession(ctx context.Context, uid string, sess *models.Session) error

	// PRs (modo original)
	GetPRs(ctx context.Context, uid string) (*models.PR, error)
	PutPRs(ctx context.Context, uid string, p *models.PR) error

	// State (modo original)
	GetState(ctx context.Context, uid string) (*models.AppState, error)
	PutState(ctx context.Context, uid string, st *models.AppState) error

	// Perfil de usuário
	GetUserProfile(ctx context.Context, uid string) (*models.UserProfile, error)
	PutUserProfile(ctx context.Context, uid string, p *models.UserProfile) error
	CreateUser(ctx context.Context, uid string, p *models.UserProfile) error
	DeleteUserProfile(ctx context.Context, uid string) error
	ListStudents(ctx context.Context, nutritionistID string) ([]*models.UserProfile, error)
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
	ListWorkoutsForNutritionist(ctx context.Context, nutritionistID string) ([]*models.WorkoutDefine, error)
	ListWorkoutsForStudent(ctx context.Context, studentID string) ([]*models.WorkoutDefine, error)
	ListWorkouts(ctx context.Context) ([]*models.WorkoutDefine, error)
	UpdateWorkout(ctx context.Context, id string, w *models.WorkoutDefine) error
	DeleteWorkout(ctx context.Context, id string) error

	// Dietas
	CreateDiet(ctx context.Context, d *models.Diet) (*models.Diet, error)
	GetDiet(ctx context.Context, id string) (*models.Diet, error)
	ListDietsForNutritionist(ctx context.Context, nutritionistID string) ([]*models.Diet, error)
	ListDietsForStudent(ctx context.Context, studentID string) ([]*models.Diet, error)
	ListDiets(ctx context.Context) ([]*models.Diet, error)
	UpdateDiet(ctx context.Context, id string, d *models.Diet) error
	DeleteDiet(ctx context.Context, id string) error

	// Histórico de treinos
	CreateHistoryEntry(ctx context.Context, h *models.WorkoutHistoryEntry) (*models.WorkoutHistoryEntry, error)
	ListHistoryForStudent(ctx context.Context, studentID string) ([]*models.WorkoutHistoryEntry, error)
	ListHistoryForNutritionist(ctx context.Context, nutritionistID string) ([]*models.WorkoutHistoryEntry, error)
	ListHistory(ctx context.Context) ([]*models.WorkoutHistoryEntry, error)
	ListHistoryForStudentSince(ctx context.Context, studentID string, since, until time.Time) ([]*models.WorkoutHistoryEntry, error)

	// Rede social: posts
	CreatePost(ctx context.Context, p *models.Post) (*models.Post, error)
	GetPost(ctx context.Context, id string) (*models.Post, error)
	ListPosts(ctx context.Context, limit int, cursor string) ([]*models.Post, string, error)
	// UpdatePostTx executa leitura-modificação-escrita de um post DENTRO de uma
	// transação (RunTransaction): o post atual é lido, passado para mutate (que
	// pode abortar devolvendo erro), e regravado na mesma transação. Elimina a
	// race do feed (curtidas/comentários perdidos) do padrão antigo
	// GetPost→modifica→UpdatePost.
	UpdatePostTx(ctx context.Context, id string, mutate func(*models.Post) error) error
	DeletePost(ctx context.Context, id string) error
	// FindAutoPostToday devolve o post automático do tipo dado criado a partir
	// de start (inclusive) pelo aluno — para não publicar duas vezes no dia.
	FindAutoPostToday(ctx context.Context, userID string, postType models.PostType, start time.Time) (*models.Post, error)

	// Dieta diária
	GetDietLog(ctx context.Context, studentID, date string) (*models.DietDailyLog, error)
	PutDietLog(ctx context.Context, log *models.DietDailyLog) error
	ListDietLogsForStudent(ctx context.Context, studentID, from, to string) ([]*models.DietDailyLog, error)

	// Ranking / pontuação
	GetScoreRecord(ctx context.Context, uid string) (*models.ScoreRecord, error)
	PutScoreRecord(ctx context.Context, rec *models.ScoreRecord) error
	ListScoreRecords(ctx context.Context) ([]*models.ScoreRecord, error)
	PutScoreHistory(ctx context.Context, uid, cycleID string, h *models.ScoreHistoryEntry) error
	ListScoreHistory(ctx context.Context, uid string) ([]*models.ScoreHistoryEntry, error)
}

// firestoreRepo é a implementação concreta sobre o Firestore.
type firestoreRepo struct {
	fs *firestore.Client
}

// New cria um Repository apontando para o Firestore.
func New(fs *firestore.Client) Repository {
	return &firestoreRepo{fs: fs}
}

func docKey(week int, day string) string {
	return fmt.Sprintf("%d_%s", week, day)
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

// ── Sessions (modo original) ──

func (r *firestoreRepo) GetSession(ctx context.Context, uid string, week int, day string) (*models.Session, error) {
	doc, err := r.fs.Collection("users").Doc(uid).
		Collection("sessions").Doc(docKey(week, day)).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.Session{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *firestoreRepo) PutSession(ctx context.Context, uid string, sess *models.Session) error {
	_, err := r.fs.Collection("users").Doc(uid).
		Collection("sessions").Doc(docKey(sess.Week, sess.Day)).Set(ctx, map[string]any{
		"week":      sess.Week,
		"day":       sess.Day,
		"exercise":  sess.Exercise,
		"updatedAt": firestore.ServerTimestamp,
	})
	return err
}

// ── PRs (modo original) ──

func (r *firestoreRepo) GetPRs(ctx context.Context, uid string) (*models.PR, error) {
	doc, err := r.fs.Collection("users").Doc(uid).
		Collection("prs").Doc("main").Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.PR{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *firestoreRepo) PutPRs(ctx context.Context, uid string, p *models.PR) error {
	_, err := r.fs.Collection("users").Doc(uid).
		Collection("prs").Doc("main").Set(ctx, map[string]any{
		"a": p.A, "b": p.B, "c": p.C,
		"updatedAt": firestore.ServerTimestamp,
	})
	return err
}

// ── State (modo original) ──

func (r *firestoreRepo) GetState(ctx context.Context, uid string) (*models.AppState, error) {
	doc, err := r.fs.Collection("users").Doc(uid).
		Collection("state").Doc("current").Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.AppState{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *firestoreRepo) PutState(ctx context.Context, uid string, st *models.AppState) error {
	_, err := r.fs.Collection("users").Doc(uid).
		Collection("state").Doc("current").Set(ctx, map[string]any{
		"week": st.Week, "day": st.Day,
		"updatedAt": firestore.ServerTimestamp,
	})
	return err
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
		"name":            p.Name,
		"email":           p.Email,
		"photoURL":        p.PhotoURL,
		"bio":             p.Bio,
		"role":            string(p.Role),
		"nutritionistID":  p.NutritionistID,
		"startDate":       p.StartDate,
		"endDate":         p.EndDate,
		"status":          p.Status,
		"planID":          p.PlanID,
		"features":        p.Features,
		"authProvider":    p.AuthProvider,
		"approvedBy":      p.ApprovedBy,
		"approvedAt":      p.ApprovedAt,
		"rejectedReason":  p.RejectedReason,
		"createdAt":       createdAt,
		"updatedAt":       firestore.ServerTimestamp,
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
func (r *firestoreRepo) ListStudents(ctx context.Context, nutritionistID string) ([]*models.UserProfile, error) {
	iter := r.fs.Collection("users").
		Where("role", "==", string(models.RoleStudent)).
		Where("nutritionistID", "==", nutritionistID).
		Documents(ctx)
	return profilesFromIter(iter)
}

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
		"studentId":      w.StudentID,
		"nutritionistId": w.NutritionistID,
		"name":           w.Name,
		"description":    w.Description,
		"objective":      w.Objective,
		"dayOfWeek":      w.DayOfWeek,
		"exercises":      w.Exercises,
		"createdAt":      firestore.ServerTimestamp,
		"updatedAt":      firestore.ServerTimestamp,
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

func (r *firestoreRepo) ListWorkoutsForNutritionist(ctx context.Context, nutritionistID string) ([]*models.WorkoutDefine, error) {
	iter := r.fs.Collection("workouts").
		Where("nutritionistId", "==", nutritionistID).
		OrderBy("createdAt", firestore.Desc).
		Documents(ctx)
	return workoutsFromIter(iter)
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
		"studentId":      w.StudentID,
		"nutritionistId": w.NutritionistID,
		"name":           w.Name,
		"description":    w.Description,
		"objective":      w.Objective,
		"dayOfWeek":      w.DayOfWeek,
		"exercises":      w.Exercises,
		"updatedAt":      firestore.ServerTimestamp,
	}, firestore.MergeAll)
	return err
}

func (r *firestoreRepo) DeleteWorkout(ctx context.Context, id string) error {
	_, err := r.fs.Collection("workouts").Doc(id).Delete(ctx)
	return err
}

// ── Dietas (refeições/alimentos embutidos no documento) ──

func (r *firestoreRepo) CreateDiet(ctx context.Context, d *models.Diet) (*models.Diet, error) {
	ref, _, err := r.fs.Collection("diets").Add(ctx, map[string]any{
		"studentId":      d.StudentID,
		"nutritionistId": d.NutritionistID,
		"name":           d.Name,
		"description":    d.Description,
		"startDate":      d.StartDate,
		"endDate":        d.EndDate,
		"content":        d.Content,
		"meals":          d.Meals,
		"createdAt":      firestore.ServerTimestamp,
		"updatedAt":      firestore.ServerTimestamp,
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

func (r *firestoreRepo) ListDietsForNutritionist(ctx context.Context, nutritionistID string) ([]*models.Diet, error) {
	iter := r.fs.Collection("diets").
		Where("nutritionistId", "==", nutritionistID).
		OrderBy("createdAt", firestore.Desc).
		Documents(ctx)
	return dietsFromIter(iter)
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
		"studentId":      d.StudentID,
		"nutritionistId": d.NutritionistID,
		"name":           d.Name,
		"description":    d.Description,
		"startDate":      d.StartDate,
		"endDate":        d.EndDate,
		"content":        d.Content,
		"meals":          d.Meals,
		"updatedAt":      firestore.ServerTimestamp,
	}, firestore.MergeAll)
	return err
}

func (r *firestoreRepo) DeleteDiet(ctx context.Context, id string) error {
	_, err := r.fs.Collection("diets").Doc(id).Delete(ctx)
	return err
}

// ── Histórico de treinos ──

func (r *firestoreRepo) CreateHistoryEntry(ctx context.Context, h *models.WorkoutHistoryEntry) (*models.WorkoutHistoryEntry, error) {
	ref, _, err := r.fs.Collection("workoutHistory").Add(ctx, map[string]any{
		"studentId":          h.StudentID,
		"workoutId":          h.WorkoutID,
		"nutritionistId":     h.NutritionistID,
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

func (r *firestoreRepo) ListHistoryForNutritionist(ctx context.Context, nutritionistID string) ([]*models.WorkoutHistoryEntry, error) {
	iter := r.fs.Collection("workoutHistory").
		Where("nutritionistId", "==", nutritionistID).
		OrderBy("completedAt", firestore.Desc).
		Limit(500).
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

// ── Rede social: posts ──

func (r *firestoreRepo) CreatePost(ctx context.Context, p *models.Post) (*models.Post, error) {
	ref, _, err := r.fs.Collection("posts").Add(ctx, map[string]any{
		"userId":       p.UserID,
		"userName":     p.UserName,
		"userPhotoURL": p.UserPhotoURL,
		"type":         string(p.Type),
		"text":         p.Text,
		"workoutId":    p.WorkoutID,
		"workoutName":  p.WorkoutName,
		"dietId":       p.DietID,
		"dietName":     p.DietName,
		"date":         p.Date,
		"likes":        map[string]bool{},
		"likeCount":    0,
		"comments":     p.Comments,
		"deleted":      p.Deleted,
		"moderatedBy":  p.ModeratedBy,
		"moderatedAt":  p.ModeratedAt,
		"createdAt":    p.CreatedAt,
		"updatedAt":    p.UpdatedAt,
	})
	if err != nil {
		return nil, err
	}
	p.ID = ref.ID
	return p, nil
}

func (r *firestoreRepo) GetPost(ctx context.Context, id string) (*models.Post, error) {
	doc, err := r.fs.Collection("posts").Doc(id).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.Post{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	out.ID = doc.Ref.ID
	if out.Likes == nil {
		out.Likes = map[string]bool{}
	}
	if out.Comments == nil {
		out.Comments = []*models.PostComment{}
	}
	return out, nil
}

// ListPosts lista o feed do mais recente para o mais antigo, paginado.
// cursor tem o formato "<createdAtUnixMilli>,<postId>" (da página anterior).
func (r *firestoreRepo) ListPosts(ctx context.Context, limit int, cursor string) ([]*models.Post, string, error) {
	if limit < 1 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	q := r.fs.Collection("posts").
		OrderBy("createdAt", firestore.Desc).
		OrderBy(firestore.DocumentID, firestore.Desc).
		Limit(limit)
	if cursor != "" {
		if milli, id, ok := parseCursor(cursor); ok {
			q = q.StartAfter(time.UnixMilli(milli), id)
		}
	}
	iter := q.Documents(ctx)
	defer iter.Stop()
	var out []*models.Post
	var last *models.Post
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, "", err
		}
		p := &models.Post{}
		if err := doc.DataTo(p); err != nil {
			continue
		}
		p.ID = doc.Ref.ID
		if p.Likes == nil {
			p.Likes = map[string]bool{}
		}
		if p.Comments == nil {
			p.Comments = []*models.PostComment{}
		}
		out = append(out, p)
		last = p
	}
	next := ""
	if last != nil {
		next = encodeCursor(last)
	}
	return ensureNonNilSlice(out), next, nil
}

// parseCursor decodifica "<milli>,<id>".
func parseCursor(cursor string) (milli int64, id string, ok bool) {
	for i := 0; i < len(cursor); i++ {
		if cursor[i] == ',' {
			var m int64
			n, err := fmt.Sscanf(cursor[:i], "%d", &m)
			if err != nil || n != 1 {
				return 0, "", false
			}
			return m, cursor[i+1:], true
		}
	}
	return 0, "", false
}

func encodeCursor(p *models.Post) string {
	return fmt.Sprintf("%d,%s", p.CreatedAt.UnixMilli(), p.ID)
}

// postData monta o mapa de escrita de um post. Extraído para poder ser testado
// e compartilhado entre UpdatePost e UpdatePostTx (nunca perder campos do
// documento ao gravar).
// updatedAt usa p.UpdatedAt (preservado do struct), e NÃO time.Now() cru: o
// timestamp é definido pelo chamador (handler/service) com service.Now()
// (America/Recife) — o repository não conhece o fuso de negócio e não deve
// derivá-lo sozinho.
func postData(p *models.Post) map[string]any {
	return map[string]any{
		"userId":       p.UserID,
		"userName":     p.UserName,
		"userPhotoURL": p.UserPhotoURL,
		"type":         string(p.Type),
		"text":         p.Text,
		"workoutId":    p.WorkoutID,
		"workoutName":  p.WorkoutName,
		"dietId":       p.DietID,
		"dietName":     p.DietName,
		"date":         p.Date,
		"likes":        p.Likes,
		"likeCount":    p.LikeCount,
		"comments":     p.Comments,
		"deleted":      p.Deleted,
		"moderatedBy":  p.ModeratedBy,
		"moderatedAt":  p.ModeratedAt,
		"createdAt":    p.CreatedAt,
		"updatedAt":    p.UpdatedAt,
	}
}

// UpdatePostTx executa a leitura-modificação-escrita de um post DENTRO de uma
// transação Firestore. O callback recebe o post atual (mutações aplicadas em
// memória); ao final, o documento é regravado na mesma transação. Se o post
// não existir, o callback não é chamado e devolve ErrPostNotFound. Isso
// elimina a race do padrão antigo GetPost→modifica→UpdatePost, em que duas
// curtidas/comentários concorrentes podiam se sobrescrever (item 3.5).
func (r *firestoreRepo) UpdatePostTx(ctx context.Context, id string, mutate func(*models.Post) error) error {
	ref := r.fs.Collection("posts").Doc(id)
	err := r.fs.RunTransaction(ctx, func(_ context.Context, tx *firestore.Transaction) error {
		doc, err := tx.Get(ref)
		if err != nil {
			if isNotFound(err) {
				return ErrPostNotFound
			}
			return err
		}
		p := &models.Post{}
		if err := doc.DataTo(p); err != nil {
			return err
		}
		p.ID = id
		if err := mutate(p); err != nil {
			return err
		}
		return tx.Set(ref, postData(p), firestore.MergeAll)
	})
	return err
}

// DeletePost remove o documento do post (remoção real feita pelo autor).
func (r *firestoreRepo) DeletePost(ctx context.Context, id string) error {
	_, err := r.fs.Collection("posts").Doc(id).Delete(ctx)
	return err
}

// FindAutoPostToday devolve o post automático do tipo dado criado a partir de
// start (inclusive) pelo aluno — para não publicar duas vezes no mesmo dia.
func (r *firestoreRepo) FindAutoPostToday(ctx context.Context, userID string, postType models.PostType, start time.Time) (*models.Post, error) {
	iter := r.fs.Collection("posts").
		Where("userId", "==", userID).
		Where("type", "==", string(postType)).
		Where("createdAt", ">=", start).
		OrderBy("createdAt", firestore.Desc).
		Limit(1).
		Documents(ctx)
	defer iter.Stop()
	doc, err := iter.Next()
	if err != nil {
		if err == iterator.Done {
			return nil, nil
		}
		return nil, err
	}
	p := &models.Post{}
	if err := doc.DataTo(p); err != nil {
		return nil, err
	}
	p.ID = doc.Ref.ID
	return p, nil
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
		"studentId":      log.StudentID,
		"nutritionistId": log.NutritionistID,
		"dietId":         log.DietID,
		"dietName":       log.DietName,
		"date":           log.Date,
		"status":         string(log.Status),
		"mealChecks":     log.MealChecks,
		"note":           log.Note,
		"caption":        log.Caption,
		"postId":         log.PostID,
		"createdAt":      createdAt,
		"updatedAt":      firestore.ServerTimestamp,
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

// ── Ranking / pontuação ──

func (r *firestoreRepo) GetScoreRecord(ctx context.Context, uid string) (*models.ScoreRecord, error) {
	doc, err := r.fs.Collection("scores").Doc(uid).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &models.ScoreRecord{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *firestoreRepo) PutScoreRecord(ctx context.Context, rec *models.ScoreRecord) error {
	_, err := r.fs.Collection("scores").Doc(rec.StudentID).Set(ctx, map[string]any{
		"studentId":     rec.StudentID,
		"rawPoints":     rec.RawPoints,
		"cycleId":       rec.CycleID,
		"cycleStart":    rec.CycleStart,
		"score":         rec.Score,
		"daysElapsed":   rec.DaysElapsed,
		"daysCompleted": rec.DaysCompleted,
		"updatedAt":     firestore.ServerTimestamp,
	})
	return err
}

func (r *firestoreRepo) ListScoreRecords(ctx context.Context) ([]*models.ScoreRecord, error) {
	iter := r.fs.Collection("scores").Documents(ctx)
	defer iter.Stop()
	var out []*models.ScoreRecord
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		rec := &models.ScoreRecord{}
		if err := doc.DataTo(rec); err != nil {
			continue
		}
		rec.StudentID = doc.Ref.ID
		out = append(out, rec)
	}
	return ensureNonNilSlice(out), nil
}

// PutScoreHistory guarda a nota final de um ciclo fechado.
func (r *firestoreRepo) PutScoreHistory(ctx context.Context, uid, cycleID string, h *models.ScoreHistoryEntry) error {
	_, err := r.fs.Collection("scores_history").Doc(uid).Collection("cycles").Doc(cycleID).Set(ctx, map[string]any{
		"studentId":  h.StudentID,
		"cycleId":    h.CycleID,
		"startDate":  h.StartDate,
		"endDate":    h.EndDate,
		"rawPoints":  h.RawPoints,
		"days":       h.Days,
		"score":      h.Score,
		"recordedAt": firestore.ServerTimestamp,
	})
	return err
}

func (r *firestoreRepo) ListScoreHistory(ctx context.Context, uid string) ([]*models.ScoreHistoryEntry, error) {
	iter := r.fs.Collection("scores_history").Doc(uid).Collection("cycles").
		OrderBy("startDate", firestore.Desc).
		Documents(ctx)
	defer iter.Stop()
	var out []*models.ScoreHistoryEntry
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		h := &models.ScoreHistoryEntry{}
		if err := doc.DataTo(h); err != nil {
			continue
		}
		out = append(out, h)
	}
	return ensureNonNilSlice(out), nil
}
