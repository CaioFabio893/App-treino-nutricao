package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

// ── Helpers de permissão ──

// profileOk verifica se o usuário logado pode acessar o recurso do aluno.
// Admin vê tudo; nutricionista só os próprios alunos; aluno só a si mesmo.
func (s *Server) canAccessStudent(ctx context.Context, uid string, role Role, studentID string) (bool, error) {
	if role == RoleAdmin {
		return true, nil
	}
	if role == RoleStudent {
		return uid == studentID, nil
	}
	// Nutricionista: ver se studentID é aluno dele.
	if role == RoleNutritionist {
		prof, err := s.getUserProfile(ctx, studentID)
		if err != nil {
			return false, err
		}
		return prof != nil && prof.NutritionistID == uid, nil
	}
	return false, nil
}

// ── Perfil do usuário logado ──

// handleGetMe devolve o perfil do usuário autenticado (com `id` preenchido).
func (s *Server) handleGetMe(w http.ResponseWriter, r *http.Request) {
	uid := uidFrom(r.Context())
	prof, err := s.getUserProfile(r.Context(), uid)
	if err != nil {
		http.Error(w, "falha ao ler perfil", http.StatusInternalServerError)
		return
	}
	if prof == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"id": uid,
			"role": string(RoleStudent),
			"needsProfile": true,
		})
		return
	}
	writeJSON(w, http.StatusOK, prof)
}

// handlePutMe atualiza o perfil do usuário autenticado.
func (s *Server) handlePutMe(w http.ResponseWriter, r *http.Request) {
	uid := uidFrom(r.Context())
	var p UserProfile
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	// Não permite trocar role por si mesmo via /me (só admin gerencia roles).
	p.Role = "" // força o default (student) em perfis novos; preserva o existente.
	if err := s.getOrCreateProfile(r.Context(), uid, &p); err != nil {
		http.Error(w, "falha ao salvar perfil", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) getOrCreateProfile(ctx context.Context, uid string, p *UserProfile) error {
	existing, err := s.getUserProfile(ctx, uid)
	if err != nil {
		return err
	}
	if existing != nil {
		// Mantém role atual — mais seguro.
		p.Role = existing.Role
		if p.NutritionistID == "" && existing.NutritionistID != "" {
			p.NutritionistID = existing.NutritionistID
		}
		p.CreatedAt = existing.CreatedAt
		return s.putUserProfile(ctx, uid, p)
	}
	// Cria novo perfil. Sem role = student por padrão.
	if p.Role == "" {
		p.Role = RoleStudent
	}
	return s.createUser(ctx, uid, p)
}

// ── Usuários (admin) ──

func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := s.listUsers(r.Context())
	if err != nil {
		http.Error(w, "falha ao listar usuarios", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (s *Server) handleGetUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	prof, err := s.getUserProfile(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler usuario", http.StatusInternalServerError)
		return
	}
	if prof == nil {
		http.Error(w, "usuario nao encontrado", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, prof)
}

func (s *Server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var p UserProfile
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if p.ID == "" {
		http.Error(w, "campo id (uid do Firebase) obrigatorio", http.StatusBadRequest)
		return
	}
	if p.Role == "" {
		p.Role = RoleStudent
	}
	if err := s.createUser(r.Context(), p.ID, &p); err != nil {
		http.Error(w, "falha ao criar usuario", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handleUpdateUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var p UserProfile
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	existing, err := s.getUserProfile(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler usuario", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		p.ID = id
		if p.Role == "" {
			p.Role = RoleStudent
		}
		if err := s.createUser(r.Context(), id, &p); err != nil {
			http.Error(w, "falha ao criar usuario", http.StatusInternalServerError)
			return
		}
	} else {
		p.CreatedAt = existing.CreatedAt
		if err := s.putUserProfile(r.Context(), id, &p); err != nil {
			http.Error(w, "falha ao atualizar usuario", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleUpdateStudent permite que o NUTRICIONISTA edite dados do próprio aluno
// (nome, foto, status, datas) e que o ADMIN edite qualquer aluno.
// Campo sensíveis (role, nutritionistID) são preservados do registro existente.
func (s *Server) handleUpdateStudent(w http.ResponseWriter, r *http.Request) {
	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())
	id := r.PathValue("id")

	can, err := s.canAccessStudent(r.Context(), uid, role, id)
	if err != nil {
		http.Error(w, "erro ao verificar permissao", http.StatusInternalServerError)
		return
	}
	if !can {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	existing, err := s.getUserProfile(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler aluno", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "aluno nao encontrado", http.StatusNotFound)
		return
	}

	var p UserProfile
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	// Só campos do aluno são editáveis aqui; role/vínculo são preservados.
	p.Role = existing.Role
	p.NutritionistID = existing.NutritionistID
	p.Email = existing.Email
	p.CreatedAt = existing.CreatedAt
	p.ID = id
	if err := s.putUserProfile(r.Context(), id, &p); err != nil {
		http.Error(w, "falha ao atualizar aluno", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.deleteUserProfile(r.Context(), id); err != nil {
		http.Error(w, "falha ao excluir usuario", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Alunos do nutricionista ──

func (s *Server) handleListMyStudents(w http.ResponseWriter, r *http.Request) {
	uid := uidFrom(r.Context())
	students, err := s.listStudents(r.Context(), uid)
	if err != nil {
		http.Error(w, "falha ao listar alunos", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, students)
}

func (s *Server) handleGetStudent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	can, err := s.canAccessStudent(r.Context(), uidFrom(r.Context()), roleFrom(r.Context()), id)
	if err != nil {
		http.Error(w, "erro ao verificar permissao", http.StatusInternalServerError)
		return
	}
	if !can {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	prof, err := s.getUserProfile(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler aluno", http.StatusInternalServerError)
		return
	}
	if prof == nil {
		http.Error(w, "aluno nao encontrado", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, prof)
}

// ── Treinos ──

func (s *Server) handleListWorkouts(w http.ResponseWriter, r *http.Request) {
	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())
	var workouts []*WorkoutDefine
	var err error
	switch role {
	case RoleAdmin:
		workouts, err = s.listWorkouts(r.Context())
	case RoleNutritionist:
		workouts, err = s.listWorkoutsForNutritionist(r.Context(), uid)
	default: // student
		workouts, err = s.listWorkoutsForStudent(r.Context(), uid)
	}
	if err != nil {
		http.Error(w, "falha ao listar treinos", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, workouts)
}

func (s *Server) handleGetWorkout(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	workout, err := s.getWorkout(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
		return
	}
	if workout == nil {
		http.Error(w, "treino nao encontrado", http.StatusNotFound)
		return
	}
	if !s.canAccessResource(r, workout.StudentID, workout.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	writeJSON(w, http.StatusOK, workout)
}

func (s *Server) handleCreateWorkout(w http.ResponseWriter, r *http.Request) {
	var workout WorkoutDefine
	if err := json.NewDecoder(r.Body).Decode(&workout); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if workout.Name == "" || workout.StudentID == "" {
		http.Error(w, "nome e aluno sao obrigatorios", http.StatusBadRequest)
		return
	}
	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())
	if role == RoleNutritionist {
		workout.NutritionistID = uid
		can, err := s.canAccessStudent(r.Context(), uid, role, workout.StudentID)
		if err != nil || !can {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
	} else if role == RoleAdmin {
		if workout.NutritionistID == "" {
			http.Error(w, "nutritionistId obrigatorio (ou use role de nutricionista)", http.StatusBadRequest)
			return
		}
	} else {
		http.Error(w, "sem permissao para criar treino", http.StatusForbidden)
		return
	}
	normalizeExercises(&workout)
	created, err := s.createWorkout(r.Context(), &workout)
	if err != nil {
		http.Error(w, "falha ao criar treino", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

func (s *Server) handleUpdateWorkout(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := s.getWorkout(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "treino nao encontrado", http.StatusNotFound)
		return
	}
	if !s.canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	var workout WorkoutDefine
	if err := json.NewDecoder(r.Body).Decode(&workout); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if workout.Name == "" {
		http.Error(w, "nome obrigatorio", http.StatusBadRequest)
		return
	}
	// Preserva donos se não vierem no body.
	if workout.StudentID == "" {
		workout.StudentID = existing.StudentID
	}
	if workout.NutritionistID == "" {
		workout.NutritionistID = existing.NutritionistID
	}
	if roleFrom(r.Context()) == RoleNutritionist {
		can, err := s.canAccessStudent(r.Context(), uidFrom(r.Context()), RoleNutritionist, workout.StudentID)
		if err != nil || !can {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
	}
	normalizeExercises(&workout)
	if err := s.updateWorkout(r.Context(), id, &workout); err != nil {
		http.Error(w, "falha ao atualizar treino", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleDeleteWorkout(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := s.getWorkout(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "treino nao encontrado", http.StatusNotFound)
		return
	}
	if !s.canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	if err := s.deleteWorkout(r.Context(), id); err != nil {
		http.Error(w, "falha ao excluir treino", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleDuplicateWorkout(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := s.getWorkout(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "treino nao encontrado", http.StatusNotFound)
		return
	}
	if !s.canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	var req DuplicateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())
	newStudentID := req.NewStudentID
	if newStudentID == "" {
		newStudentID = existing.StudentID
	}
	if role == RoleNutritionist {
		can, err := s.canAccessStudent(r.Context(), uid, role, newStudentID)
		if err != nil || !can {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
	}

	dup := *existing
	dup.ID = ""
	dup.StudentID = newStudentID
	if req.NewName != "" {
		dup.Name = req.NewName
	} else {
		dup.Name = existing.Name + " (copia)"
	}
	dup.CreatedAt = time.Time{}
	dup.UpdatedAt = time.Time{}
	// Copia exercícios sem IDs.
	exs := make([]*WorkoutExercise, 0, len(existing.Exercises))
	for _, e := range existing.Exercises {
		c := *e
		c.ID = ""
		exs = append(exs, &c)
	}
	dup.Exercises = exs

	created, err := s.createWorkout(r.Context(), &dup)
	if err != nil {
		http.Error(w, "falha ao duplicar treino", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

// normalizeExercises ordena e renumera os exercícios.
func normalizeExercises(w *WorkoutDefine) {
	for i, e := range w.Exercises {
		if e == nil {
			continue
		}
		e.Order = i + 1
	}
}

// canAccessResource verifica se o usuário logado pode acessar um recurso
// vinculado a studentID/nutritionistID.
func (s *Server) canAccessResource(r *http.Request, studentID, nutritionistID string) bool {
	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())
	if role == RoleAdmin {
		return true
	}
	if role == RoleStudent {
		return uid == studentID
	}
	if role == RoleNutritionist {
		return uid == nutritionistID
	}
	return false
}

// ── Dietas ──

func (s *Server) handleListDiets(w http.ResponseWriter, r *http.Request) {
	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())
	var diets []*Diet
	var err error
	switch role {
	case RoleAdmin:
		diets, err = s.listDiets(r.Context())
	case RoleNutritionist:
		diets, err = s.listDietsForNutritionist(r.Context(), uid)
	default: // student
		diets, err = s.listDietsForStudent(r.Context(), uid)
	}
	if err != nil {
		http.Error(w, "falha ao listar dietas", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, diets)
}

func (s *Server) handleGetDiet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	d, err := s.getDiet(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
		return
	}
	if d == nil {
		http.Error(w, "dieta nao encontrada", http.StatusNotFound)
		return
	}
	if !s.canAccessResource(r, d.StudentID, d.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	writeJSON(w, http.StatusOK, d)
}

func (s *Server) handleCreateDiet(w http.ResponseWriter, r *http.Request) {
	var d Diet
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if d.Name == "" || d.StudentID == "" {
		http.Error(w, "nome e aluno sao obrigatorios", http.StatusBadRequest)
		return
	}
	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())
	if role == RoleNutritionist {
		d.NutritionistID = uid
		can, err := s.canAccessStudent(r.Context(), uid, role, d.StudentID)
		if err != nil || !can {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
	} else if role == RoleAdmin {
		if d.NutritionistID == "" {
			http.Error(w, "nutritionistId obrigatorio", http.StatusBadRequest)
			return
		}
	} else {
		http.Error(w, "sem permissao para criar dieta", http.StatusForbidden)
		return
	}
	normalizeMeals(&d)
	created, err := s.createDiet(r.Context(), &d)
	if err != nil {
		http.Error(w, "falha ao criar dieta", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

func (s *Server) handleUpdateDiet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := s.getDiet(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "dieta nao encontrada", http.StatusNotFound)
		return
	}
	if !s.canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	var d Diet
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if d.Name == "" {
		http.Error(w, "nome obrigatorio", http.StatusBadRequest)
		return
	}
	if d.StudentID == "" {
		d.StudentID = existing.StudentID
	}
	if d.NutritionistID == "" {
		d.NutritionistID = existing.NutritionistID
	}
	if roleFrom(r.Context()) == RoleNutritionist {
		can, err := s.canAccessStudent(r.Context(), uidFrom(r.Context()), RoleNutritionist, d.StudentID)
		if err != nil || !can {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
	}
	normalizeMeals(&d)
	if err := s.updateDiet(r.Context(), id, &d); err != nil {
		http.Error(w, "falha ao atualizar dieta", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleDeleteDiet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := s.getDiet(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "dieta nao encontrada", http.StatusNotFound)
		return
	}
	if !s.canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	if err := s.deleteDiet(r.Context(), id); err != nil {
		http.Error(w, "falha ao excluir dieta", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleDuplicateDiet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := s.getDiet(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "dieta nao encontrada", http.StatusNotFound)
		return
	}
	if !s.canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	var req DuplicateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	role := roleFrom(r.Context())
	uid := uidFrom(r.Context())
	newStudentID := req.NewStudentID
	if newStudentID == "" {
		newStudentID = existing.StudentID
	}
	if role == RoleNutritionist {
		can, err := s.canAccessStudent(r.Context(), uid, role, newStudentID)
		if err != nil || !can {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
	}

	dup := *existing
	dup.ID = ""
	dup.StudentID = newStudentID
	if req.NewName != "" {
		dup.Name = req.NewName
	} else {
		dup.Name = existing.Name + " (copia)"
	}
	dup.CreatedAt = time.Time{}
	dup.UpdatedAt = time.Time{}
	meals := make([]*Meal, 0, len(existing.Meals))
	for _, m := range existing.Meals {
		c := *m
		c.ID = ""
		if c.Foods != nil {
			foods := make([]*Food, 0, len(c.Foods))
			for _, f := range c.Foods {
				fc := *f
				fc.ID = ""
				foods = append(foods, &fc)
			}
			c.Foods = foods
		}
		meals = append(meals, &c)
	}
	dup.Meals = meals

	created, err := s.createDiet(r.Context(), &dup)
	if err != nil {
		http.Error(w, "falha ao duplicar dieta", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

// normalizeMeals ordena e renumera refeições.
func normalizeMeals(d *Diet) {
	for i, m := range d.Meals {
		if m == nil {
			continue
		}
		m.Order = i + 1
	}
}

// ── Histórico de treinos ──

// handleListHistory lista o histórico. Nutricionista vê o de seus alunos,
// aluno vê o próprio, admin vê tudo.
func (s *Server) handleListHistory(w http.ResponseWriter, r *http.Request) {
	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())
	var entries []*WorkoutHistoryEntry
	var err error
	switch role {
	case RoleAdmin:
		entries, err = s.listHistory(r.Context())
	case RoleNutritionist:
		entries, err = s.listHistoryForNutritionist(r.Context(), uid)
	default:
		entries, err = s.listHistoryForStudent(r.Context(), uid)
	}
	if err != nil {
		http.Error(w, "falha ao listar historico", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

// handleCompleteWorkout registra a conclusão de um treino (aluno).
func (s *Server) handleCompleteWorkout(w http.ResponseWriter, r *http.Request) {
	var req CompleteWorkoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if req.WorkoutID == "" {
		http.Error(w, "workoutId obrigatorio", http.StatusBadRequest)
		return
	}
	uid := uidFrom(r.Context())
	role := roleFrom(r.Context())

	workout, err := s.getWorkout(r.Context(), req.WorkoutID)
	if err != nil {
		http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
		return
	}
	if workout == nil {
		http.Error(w, "treino nao encontrado", http.StatusNotFound)
		return
	}
	// Só o próprio aluno (ou admin) pode concluir.
	if role != RoleAdmin && uid != workout.StudentID {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	entry := &WorkoutHistoryEntry{
		StudentID:          workout.StudentID,
		WorkoutID:          workout.ID,
		WorkoutName:        workout.Name,
		NutritionistID:     workout.NutritionistID,
		CompletedAt:        time.Now(),
		Duration:           req.Duration,
		ExercisesCompleted: req.ExercisesCompleted,
		TotalExercises:     req.TotalExercises,
		Exercises:          req.Exercises,
	}
	created, err := s.createHistoryEntry(r.Context(), entry)
	if err != nil {
		http.Error(w, "falha ao registrar conclusao", http.StatusInternalServerError)
		return
	}

	// Rede social: publicação automática no feed (uma por dia) com a legenda
	// opcional do aluno.
	if err := s.publishWorkoutPost(r.Context(), created, req.Caption); err != nil {
		http.Error(w, "falha ao publicar no feed", http.StatusInternalServerError)
		return
	}

	// Ranking: recalcula a nota do ciclo em andamento.
	studentProf, err := s.getUserProfile(r.Context(), created.StudentID)
	if err != nil {
		http.Error(w, "falha ao ler aluno", http.StatusInternalServerError)
		return
	}
	startDate := ""
	if studentProf != nil {
		startDate = studentProf.StartDate
	}
	if err := s.recomputeScore(r.Context(), created.StudentID, startDate); err != nil {
		http.Error(w, "falha ao atualizar pontuacao", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, created)
}