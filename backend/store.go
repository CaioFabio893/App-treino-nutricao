package main

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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

func docKey(week int, day string) string {
	return fmt.Sprintf("%d_%s", week, day)
}

// isNotFound devolve true se o erro for "documento não encontrado".
func isNotFound(err error) bool {
	return err != nil && status.Code(err) == codes.NotFound
}

// ── Sessions (modo original) ──

func (s *Server) getSession(ctx context.Context, uid string, week int, day string) (*Session, error) {
	doc, err := s.fs.Collection("users").Doc(uid).
		Collection("sessions").Doc(docKey(week, day)).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &Session{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Server) putSession(ctx context.Context, uid string, sess *Session) error {
	_, err := s.fs.Collection("users").Doc(uid).
		Collection("sessions").Doc(docKey(sess.Week, sess.Day)).Set(ctx, map[string]any{
		"week":      sess.Week,
		"day":       sess.Day,
		"exercise":  sess.Exercise,
		"updatedAt": firestore.ServerTimestamp,
	})
	return err
}

// ── PRs (modo original) ──

func (s *Server) getPRs(ctx context.Context, uid string) (*PR, error) {
	doc, err := s.fs.Collection("users").Doc(uid).
		Collection("prs").Doc("main").Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &PR{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Server) putPRs(ctx context.Context, uid string, p *PR) error {
	_, err := s.fs.Collection("users").Doc(uid).
		Collection("prs").Doc("main").Set(ctx, map[string]any{
			"a": p.A, "b": p.B, "c": p.C,
			"updatedAt": firestore.ServerTimestamp,
		})
	return err
}

// ── State (modo original) ──

func (s *Server) getState(ctx context.Context, uid string) (*AppState, error) {
	doc, err := s.fs.Collection("users").Doc(uid).
		Collection("state").Doc("current").Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &AppState{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Server) putState(ctx context.Context, uid string, st *AppState) error {
	_, err := s.fs.Collection("users").Doc(uid).
		Collection("state").Doc("current").Set(ctx, map[string]any{
			"week": st.Week, "day": st.Day,
			"updatedAt": firestore.ServerTimestamp,
		})
	return err
}

// ── Perfil de usuário ──

func (s *Server) getUserProfile(ctx context.Context, uid string) (*UserProfile, error) {
	doc, err := s.fs.Collection("users").Doc(uid).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &UserProfile{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Server) putUserProfile(ctx context.Context, uid string, p *UserProfile) error {
	_, err := s.fs.Collection("users").Doc(uid).Set(ctx, map[string]any{
		"name":           p.Name,
		"email":          p.Email,
		"photoURL":       p.PhotoURL,
		"role":           string(p.Role),
		"nutritionistID": p.NutritionistID,
		"startDate":      p.StartDate,
		"endDate":        p.EndDate,
		"status":         p.Status,
		"createdAt":      firestore.ServerTimestamp,
		"updatedAt":      firestore.ServerTimestamp,
	})
	return err
}

// createUser cria o perfil (mantém o campo role).
func (s *Server) createUser(ctx context.Context, uid string, p *UserProfile) error {
	_, err := s.fs.Collection("users").Doc(uid).Set(ctx, map[string]any{
		"name":           p.Name,
		"email":          p.Email,
		"photoURL":       p.PhotoURL,
		"role":           string(p.Role),
		"nutritionistID": p.NutritionistID,
		"startDate":      p.StartDate,
		"endDate":        p.EndDate,
		"status":         p.Status,
		"createdAt":      firestore.ServerTimestamp,
		"updatedAt":      firestore.ServerTimestamp,
	})
	return err
}

func (s *Server) deleteUserProfile(ctx context.Context, uid string) error {
	_, err := s.fs.Collection("users").Doc(uid).Delete(ctx)
	return err
}

// listStudents lista usuários com role=student vinculados a um nutricionista.
func (s *Server) listStudents(ctx context.Context, nutritionistID string) ([]*UserProfile, error) {
	iter := s.fs.Collection("users").
		Where("role", "==", string(RoleStudent)).
		Where("nutritionistID", "==", nutritionistID).
		Documents(ctx)
	return profilesFromIter(iter)
}

func (s *Server) listUsers(ctx context.Context) ([]*UserProfile, error) {
	iter := s.fs.Collection("users").Documents(ctx)
	return profilesFromIter(iter)
}

func profilesFromIter(iter *firestore.DocumentIterator) ([]*UserProfile, error) {
	defer iter.Stop()
	var out []*UserProfile
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		p := &UserProfile{}
		if err := doc.DataTo(p); err != nil {
			continue
		}
		p.ID = doc.Ref.ID
		out = append(out, p)
	}
	return out, nil
}

// ── Treinos (exercícios embutidos no documento) ──

func (s *Server) createWorkout(ctx context.Context, w *WorkoutDefine) (*WorkoutDefine, error) {
	ref, _, err := s.fs.Collection("workouts").Add(ctx, map[string]any{
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

func (s *Server) getWorkout(ctx context.Context, id string) (*WorkoutDefine, error) {
	doc, err := s.fs.Collection("workouts").Doc(id).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &WorkoutDefine{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	out.ID = doc.Ref.ID
	return out, nil
}

func (s *Server) listWorkoutsForNutritionist(ctx context.Context, nutritionistID string) ([]*WorkoutDefine, error) {
	iter := s.fs.Collection("workouts").
		Where("nutritionistId", "==", nutritionistID).
		OrderBy("createdAt", firestore.Desc).
		Documents(ctx)
	return workoutsFromIter(iter)
}

func (s *Server) listWorkoutsForStudent(ctx context.Context, studentID string) ([]*WorkoutDefine, error) {
	iter := s.fs.Collection("workouts").
		Where("studentId", "==", studentID).
		OrderBy("createdAt", firestore.Desc).
		Documents(ctx)
	return workoutsFromIter(iter)
}

func (s *Server) listWorkouts(ctx context.Context) ([]*WorkoutDefine, error) {
	iter := s.fs.Collection("workouts").OrderBy("createdAt", firestore.Desc).Documents(ctx)
	return workoutsFromIter(iter)
}

func workoutsFromIter(iter *firestore.DocumentIterator) ([]*WorkoutDefine, error) {
	defer iter.Stop()
	var out []*WorkoutDefine
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		w := &WorkoutDefine{}
		if err := doc.DataTo(w); err != nil {
			continue
		}
		w.ID = doc.Ref.ID
		out = append(out, w)
	}
	return out, nil
}

func (s *Server) updateWorkout(ctx context.Context, id string, w *WorkoutDefine) error {
	_, err := s.fs.Collection("workouts").Doc(id).Set(ctx, map[string]any{
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

func (s *Server) deleteWorkout(ctx context.Context, id string) error {
	_, err := s.fs.Collection("workouts").Doc(id).Delete(ctx)
	return err
}

// ── Dietas (refeições/alimentos embutidos no documento) ──

func (s *Server) createDiet(ctx context.Context, d *Diet) (*Diet, error) {
	ref, _, err := s.fs.Collection("diets").Add(ctx, map[string]any{
		"studentId":      d.StudentID,
		"nutritionistId": d.NutritionistID,
		"name":           d.Name,
		"description":    d.Description,
		"startDate":      d.StartDate,
		"endDate":        d.EndDate,
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

func (s *Server) getDiet(ctx context.Context, id string) (*Diet, error) {
	doc, err := s.fs.Collection("diets").Doc(id).Get(ctx)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	out := &Diet{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	out.ID = doc.Ref.ID
	return out, nil
}

func (s *Server) listDietsForNutritionist(ctx context.Context, nutritionistID string) ([]*Diet, error) {
	iter := s.fs.Collection("diets").
		Where("nutritionistId", "==", nutritionistID).
		OrderBy("createdAt", firestore.Desc).
		Documents(ctx)
	return dietsFromIter(iter)
}

func (s *Server) listDietsForStudent(ctx context.Context, studentID string) ([]*Diet, error) {
	iter := s.fs.Collection("diets").
		Where("studentId", "==", studentID).
		OrderBy("createdAt", firestore.Desc).
		Documents(ctx)
	return dietsFromIter(iter)
}

func (s *Server) listDiets(ctx context.Context) ([]*Diet, error) {
	iter := s.fs.Collection("diets").OrderBy("createdAt", firestore.Desc).Documents(ctx)
	return dietsFromIter(iter)
}

func dietsFromIter(iter *firestore.DocumentIterator) ([]*Diet, error) {
	defer iter.Stop()
	var out []*Diet
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		d := &Diet{}
		if err := doc.DataTo(d); err != nil {
			continue
		}
		d.ID = doc.Ref.ID
		out = append(out, d)
	}
	return out, nil
}

func (s *Server) updateDiet(ctx context.Context, id string, d *Diet) error {
	_, err := s.fs.Collection("diets").Doc(id).Set(ctx, map[string]any{
		"studentId":      d.StudentID,
		"nutritionistId": d.NutritionistID,
		"name":           d.Name,
		"description":    d.Description,
		"startDate":      d.StartDate,
		"endDate":        d.EndDate,
		"meals":          d.Meals,
		"updatedAt":      firestore.ServerTimestamp,
	}, firestore.MergeAll)
	return err
}

func (s *Server) deleteDiet(ctx context.Context, id string) error {
	_, err := s.fs.Collection("diets").Doc(id).Delete(ctx)
	return err
}

// ── Histórico de treinos ──

func (s *Server) createHistoryEntry(ctx context.Context, h *WorkoutHistoryEntry) (*WorkoutHistoryEntry, error) {
	ref, _, err := s.fs.Collection("workoutHistory").Add(ctx, map[string]any{
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

func (s *Server) listHistoryForStudent(ctx context.Context, studentID string) ([]*WorkoutHistoryEntry, error) {
	iter := s.fs.Collection("workoutHistory").
		Where("studentId", "==", studentID).
		OrderBy("completedAt", firestore.Desc).
		Limit(200).
		Documents(ctx)
	return historyFromIter(iter)
}

func (s *Server) listHistoryForNutritionist(ctx context.Context, nutritionistID string) ([]*WorkoutHistoryEntry, error) {
	iter := s.fs.Collection("workoutHistory").
		Where("nutritionistId", "==", nutritionistID).
		OrderBy("completedAt", firestore.Desc).
		Limit(500).
		Documents(ctx)
	return historyFromIter(iter)
}

func (s *Server) listHistory(ctx context.Context) ([]*WorkoutHistoryEntry, error) {
	iter := s.fs.Collection("workoutHistory").
		OrderBy("completedAt", firestore.Desc).
		Limit(1000).
		Documents(ctx)
	return historyFromIter(iter)
}

func historyFromIter(iter *firestore.DocumentIterator) ([]*WorkoutHistoryEntry, error) {
	defer iter.Stop()
	var out []*WorkoutHistoryEntry
	for {
		doc, err := iter.Next()
		if err != nil {
			if err == iterator.Done {
				break
			}
			return nil, err
		}
		h := &WorkoutHistoryEntry{}
		if err := doc.DataTo(h); err != nil {
			continue
		}
		h.ID = doc.Ref.ID
		out = append(out, h)
	}
	return out, nil
}