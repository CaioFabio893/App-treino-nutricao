package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"treino-louise/backend/middleware"
	"treino-louise/backend/models"
	"treino-louise/backend/service"
)

// ── Perfil do usuário logado ──

// HandleGetMe devolve o perfil do usuário autenticado (com `id` preenchido).
// Sem perfil, devolve um perfil "virtual" pendente de aprovação: o frontend usa
// needsProfile (monta o ProfileSetup) e needsApproval (tela de espera) para
// decidir o próximo passo — o perfil real só é criado no PUT /api/me.
func (h *Handlers) HandleGetMe(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	prof, err := h.repo.GetUserProfile(r.Context(), uid)
	if err != nil {
		http.Error(w, "falha ao ler perfil", http.StatusInternalServerError)
		return
	}
	if prof == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"id":            uid,
			"role":          "",
			"status":        models.StatusPendingApproval,
			"authProvider":  middleware.AuthProviderFrom(r.Context()),
			"needsProfile":  true,
			"needsApproval": true,
		})
		return
	}
	writeJSON(w, http.StatusOK, prof)
}

// HandlePutMe atualiza o perfil do usuário autenticado (só dados de perfil).
// role/status/planID/features são definidos pelo admin no fluxo de aprovação —
// o cliente jamais envia esses campos por aqui. Perfil novo é criado como
// pending_approval (via GetOrCreateProfile).
func (h *Handlers) HandlePutMe(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	var p models.UserProfile
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	// Não permite trocar role/status/plano por si mesmo via /me.
	p.Role = ""
	p.Status = ""
	p.PlanID = ""
	p.Features = nil
	if p.AuthProvider == "" {
		p.AuthProvider = middleware.AuthProviderFrom(r.Context())
	}
	if err := h.svc.GetOrCreateProfile(r.Context(), uid, &p); err != nil {
		http.Error(w, "falha ao salvar perfil", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ── Usuários (admin) ──

func (h *Handlers) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.ListUsers(r.Context())
	if err != nil {
		http.Error(w, "falha ao listar usuarios", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *Handlers) HandleGetUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	prof, err := h.repo.GetUserProfile(r.Context(), id)
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

func (h *Handlers) HandleCreateUser(w http.ResponseWriter, r *http.Request) {
	var p models.UserProfile
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if p.ID == "" {
		http.Error(w, "campo id (uid do Firebase) obrigatorio", http.StatusBadRequest)
		return
	}
	if p.Role == "" {
		p.Role = models.RoleStudent
	}
	if err := h.repo.CreateUser(r.Context(), p.ID, &p); err != nil {
		http.Error(w, "falha ao criar usuario", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *Handlers) HandleUpdateUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var p models.UserProfile
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	existing, err := h.repo.GetUserProfile(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler usuario", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		p.ID = id
		if p.Role == "" {
			p.Role = models.RoleStudent
		}
		if err := h.repo.CreateUser(r.Context(), id, &p); err != nil {
			http.Error(w, "falha ao criar usuario", http.StatusInternalServerError)
			return
		}
	} else {
		p.ID = id
		// Merge com o registro existente: a edição comum de usuário jamais
		// altera silenciosamente o plano, as features, o provedor de login ou
		// o histórico de aprovação — esses campos vêm só dos fluxos
		// administrativos dedicados (assign-plan / approve / reject).
		preserveAdminFields(existing, &p)
		p.CreatedAt = existing.CreatedAt
		if err := h.repo.PutUserProfile(r.Context(), id, &p); err != nil {
			http.Error(w, "falha ao atualizar usuario", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// preserveAdminFields copia do perfil existente os campos que uma edição
// comum de usuário NUNCA pode alterar silenciosamente: plano (planID),
// features, provedor de login e o histórico de aprovação/rejeição.
func preserveAdminFields(existing, p *models.UserProfile) {
	p.PlanID = existing.PlanID
	p.Features = existing.Features
	p.AuthProvider = existing.AuthProvider
	p.ApprovedBy = existing.ApprovedBy
	p.ApprovedAt = existing.ApprovedAt
	p.RejectedReason = existing.RejectedReason
}

// HandleUpdateStudent permite que o NUTRICIONISTA edite dados do próprio aluno
// (nome, foto, status, datas) e que o ADMIN edite qualquer aluno.
// Campos sensíveis (role, nutritionistID) são preservados do registro existente.
func (h *Handlers) HandleUpdateStudent(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())
	id := r.PathValue("id")

	can, err := h.svc.CanAccessStudent(r.Context(), uid, role, id)
	if err != nil {
		http.Error(w, "erro ao verificar permissao", http.StatusInternalServerError)
		return
	}
	if !can {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	existing, err := h.repo.GetUserProfile(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler aluno", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "aluno nao encontrado", http.StatusNotFound)
		return
	}

	var p models.UserProfile
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	// Merge com o perfil existente: esta rota só permite editar dados do aluno
	// (nome, foto, bio, status e datas). Role, vínculo, plano, features e o
	// histórico de aprovação são SEMPRE preservados do registro existente —
	// nunca vêm do body do nutricionista.
	merged := mergeStudentEdits(existing, &p)
	merged.ID = id
	if err := h.repo.PutUserProfile(r.Context(), id, merged); err != nil {
		http.Error(w, "falha ao atualizar aluno", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// mergeStudentEdits produz o perfil final de uma edição de aluno feita pelo
// nutricionista/admin: parte do perfil existente (preservando TODOS os campos
// administrativos — role, vínculo, plano, features e histórico de aprovação)
// e aplica somente os campos de dados editáveis por esta rota.
func mergeStudentEdits(existing, p *models.UserProfile) *models.UserProfile {
	out := *existing
	out.ID = existing.ID
	out.Name = p.Name
	out.PhotoURL = p.PhotoURL
	out.Bio = p.Bio
	out.Status = p.Status
	out.StartDate = p.StartDate
	out.EndDate = p.EndDate
	return &out
}

// HandleDeleteUser exclui o perfil do Firestore e a conta do Firebase Auth
// (decisão SB-001: exclusão administrativa também derruba o login da pessoa).
func (h *Handlers) HandleDeleteUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.repo.DeleteUserProfile(r.Context(), id); err != nil {
		http.Error(w, "falha ao excluir usuario", http.StatusInternalServerError)
		return
	}
	if h.auth != nil {
		if err := h.auth.DeleteUser(r.Context(), id); err != nil {
			// Perfil já removido; só reporta que a conta externa sobra órfã.
			http.Error(w, `{"error":"perfil excluido, mas falha ao excluir conta Firebase"}`, http.StatusInternalServerError)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Alunos do nutricionista ──

// HandleListMyStudents lista alunos. Nutricionista vê somente os alunos
// vinculados a ele; ADMIN vê todos os alunos (mesmo os aprovados SEM
// nutricionista e SEM plano — casos válidos que não podem ficar invisíveis) —
// mesmo padrão de escopo de ListWorkouts/ListDiets/ListHistory.
// A rota exige role admin|nutritionist (Allow no main.go), então os demais
// papéis nem chegam aqui; o default preserva o escopo atual por nutricionista.
func (h *Handlers) HandleListMyStudents(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())

	var (
		students []*models.UserProfile
		err      error
	)
	switch role {
	case models.RoleAdmin:
		students, err = h.repo.ListStudentsAll(r.Context())
	case models.RoleNutritionist:
		students, err = h.repo.ListStudents(r.Context(), uid)
	default:
		students, err = h.repo.ListStudents(r.Context(), uid)
	}
	if err != nil {
		http.Error(w, "falha ao listar alunos", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, students)
}

func (h *Handlers) HandleGetStudent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	can, err := h.svc.CanAccessStudent(r.Context(), middleware.UIDFrom(r.Context()), middleware.RoleFrom(r.Context()), id)
	if err != nil {
		http.Error(w, "erro ao verificar permissao", http.StatusInternalServerError)
		return
	}
	if !can {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	prof, err := h.repo.GetUserProfile(r.Context(), id)
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

func (h *Handlers) HandleListWorkouts(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())
	var workouts []*models.WorkoutDefine
	var err error
	switch role {
	case models.RoleAdmin:
		workouts, err = h.repo.ListWorkouts(r.Context())
	case models.RoleNutritionist:
		workouts, err = h.repo.ListWorkoutsForNutritionist(r.Context(), uid)
	default: // student
		workouts, err = h.repo.ListWorkoutsForStudent(r.Context(), uid)
	}
	if err != nil {
		http.Error(w, "falha ao listar treinos", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, workouts)
}

func (h *Handlers) HandleGetWorkout(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	workout, err := h.repo.GetWorkout(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
		return
	}
	if workout == nil {
		http.Error(w, "treino nao encontrado", http.StatusNotFound)
		return
	}
	if !canAccessResource(r, workout.StudentID, workout.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	writeJSON(w, http.StatusOK, workout)
}

func (h *Handlers) HandleCreateWorkout(w http.ResponseWriter, r *http.Request) {
	var workout models.WorkoutDefine
	if err := json.NewDecoder(r.Body).Decode(&workout); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if workout.Name == "" || workout.StudentID == "" {
		http.Error(w, "nome e aluno sao obrigatorios", http.StatusBadRequest)
		return
	}
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())
	if role == models.RoleNutritionist {
		workout.NutritionistID = uid
		can, err := h.svc.CanAccessStudent(r.Context(), uid, role, workout.StudentID)
		if err != nil || !can {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
	} else if role == models.RoleAdmin {
		if workout.NutritionistID == "" {
			http.Error(w, "nutritionistId obrigatorio (ou use role de nutricionista)", http.StatusBadRequest)
			return
		}
	} else {
		http.Error(w, "sem permissao para criar treino", http.StatusForbidden)
		return
	}
	service.NormalizeExercises(&workout)
	created, err := h.repo.CreateWorkout(r.Context(), &workout)
	if err != nil {
		http.Error(w, "falha ao criar treino", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

func (h *Handlers) HandleUpdateWorkout(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.repo.GetWorkout(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "treino nao encontrado", http.StatusNotFound)
		return
	}
	if !canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	var workout models.WorkoutDefine
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
	// Nutricionista NUNCA pode transferir o treino para outro nutricionista
	// (mesmo enviando nutritionistId no body): o vínculo fica o do registro.
	if middleware.RoleFrom(r.Context()) == models.RoleNutritionist {
		workout.NutritionistID = existing.NutritionistID
		can, err := h.svc.CanAccessStudent(r.Context(), middleware.UIDFrom(r.Context()), models.RoleNutritionist, workout.StudentID)
		if err != nil || !can {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
	} else if workout.NutritionistID == "" {
		// Admin sem nutritionistId no body preserva o vínculo atual.
		workout.NutritionistID = existing.NutritionistID
	}
	service.NormalizeExercises(&workout)
	if err := h.repo.UpdateWorkout(r.Context(), id, &workout); err != nil {
		http.Error(w, "falha ao atualizar treino", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handlers) HandleDeleteWorkout(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.repo.GetWorkout(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "treino nao encontrado", http.StatusNotFound)
		return
	}
	if !canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	if err := h.repo.DeleteWorkout(r.Context(), id); err != nil {
		http.Error(w, "falha ao excluir treino", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) HandleDuplicateWorkout(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.repo.GetWorkout(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "treino nao encontrado", http.StatusNotFound)
		return
	}
	if !canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	var req models.DuplicateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())
	newStudentID := req.NewStudentID
	if newStudentID == "" {
		newStudentID = existing.StudentID
	}
	if role == models.RoleNutritionist {
		can, err := h.svc.CanAccessStudent(r.Context(), uid, role, newStudentID)
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
	exs := make([]*models.WorkoutExercise, 0, len(existing.Exercises))
	for _, e := range existing.Exercises {
		c := *e
		c.ID = ""
		exs = append(exs, &c)
	}
	dup.Exercises = exs

	created, err := h.repo.CreateWorkout(r.Context(), &dup)
	if err != nil {
		http.Error(w, "falha ao duplicar treino", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

// ── Dietas ──

func (h *Handlers) HandleListDiets(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())
	var diets []*models.Diet
	var err error
	switch role {
	case models.RoleAdmin:
		diets, err = h.repo.ListDiets(r.Context())
	case models.RoleNutritionist:
		diets, err = h.repo.ListDietsForNutritionist(r.Context(), uid)
	default: // student
		diets, err = h.repo.ListDietsForStudent(r.Context(), uid)
	}
	if err != nil {
		http.Error(w, "falha ao listar dietas", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, diets)
}

func (h *Handlers) HandleGetDiet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	d, err := h.repo.GetDiet(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
		return
	}
	if d == nil {
		http.Error(w, "dieta nao encontrada", http.StatusNotFound)
		return
	}
	if !canAccessResource(r, d.StudentID, d.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	writeJSON(w, http.StatusOK, d)
}

func (h *Handlers) HandleCreateDiet(w http.ResponseWriter, r *http.Request) {
	var d models.Diet
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if d.Name == "" || d.StudentID == "" {
		http.Error(w, "nome e aluno sao obrigatorios", http.StatusBadRequest)
		return
	}
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())
	if role == models.RoleNutritionist {
		d.NutritionistID = uid
		can, err := h.svc.CanAccessStudent(r.Context(), uid, role, d.StudentID)
		if err != nil || !can {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
	} else if role == models.RoleAdmin {
		if d.NutritionistID == "" {
			http.Error(w, "nutritionistId obrigatorio", http.StatusBadRequest)
			return
		}
	} else {
		http.Error(w, "sem permissao para criar dieta", http.StatusForbidden)
		return
	}
	service.NormalizeMeals(&d)
	created, err := h.repo.CreateDiet(r.Context(), &d)
	if err != nil {
		http.Error(w, "falha ao criar dieta", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

func (h *Handlers) HandleUpdateDiet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.repo.GetDiet(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "dieta nao encontrada", http.StatusNotFound)
		return
	}
	if !canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	var d models.Diet
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
	// Nutricionista NUNCA pode transferir a dieta para outro nutricionista
	// (mesmo enviando nutritionistId no body): o vínculo fica o do registro.
	if middleware.RoleFrom(r.Context()) == models.RoleNutritionist {
		d.NutritionistID = existing.NutritionistID
		can, err := h.svc.CanAccessStudent(r.Context(), middleware.UIDFrom(r.Context()), models.RoleNutritionist, d.StudentID)
		if err != nil || !can {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
	} else if d.NutritionistID == "" {
		// Admin sem nutritionistId no body preserva o vínculo atual.
		d.NutritionistID = existing.NutritionistID
	}
	service.NormalizeMeals(&d)
	if err := h.repo.UpdateDiet(r.Context(), id, &d); err != nil {
		http.Error(w, "falha ao atualizar dieta", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handlers) HandleDeleteDiet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.repo.GetDiet(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "dieta nao encontrada", http.StatusNotFound)
		return
	}
	if !canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	if err := h.repo.DeleteDiet(r.Context(), id); err != nil {
		http.Error(w, "falha ao excluir dieta", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) HandleDuplicateDiet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.repo.GetDiet(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "dieta nao encontrada", http.StatusNotFound)
		return
	}
	if !canAccessResource(r, existing.StudentID, existing.NutritionistID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	var req models.DuplicateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	role := middleware.RoleFrom(r.Context())
	uid := middleware.UIDFrom(r.Context())
	newStudentID := req.NewStudentID
	if newStudentID == "" {
		newStudentID = existing.StudentID
	}
	if role == models.RoleNutritionist {
		can, err := h.svc.CanAccessStudent(r.Context(), uid, role, newStudentID)
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
	meals := make([]*models.Meal, 0, len(existing.Meals))
	for _, m := range existing.Meals {
		c := *m
		c.ID = ""
		if c.Foods != nil {
			foods := make([]*models.Food, 0, len(c.Foods))
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

	created, err := h.repo.CreateDiet(r.Context(), &dup)
	if err != nil {
		http.Error(w, "falha ao duplicar dieta", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

// ── Histórico de treinos ──

// HandleListHistory lista o histórico. Nutricionista vê o de seus alunos,
// aluno vê o próprio, admin vê tudo.
//
// Suporta paginação por offset/limit: sem parâmetros devolve a lista completa
// (comportamento original); com `limit` devolve { entries, total, offset,
// limit, hasMore }. Os itens vêm sempre mais recentes primeiro.
func (h *Handlers) HandleListHistory(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())
	var all []*models.WorkoutHistoryEntry
	var err error
	switch role {
	case models.RoleAdmin:
		all, err = h.repo.ListHistory(r.Context())
	case models.RoleNutritionist:
		all, err = h.repo.ListHistoryForNutritionist(r.Context(), uid)
	default:
		all, err = h.repo.ListHistoryForStudent(r.Context(), uid)
	}
	if err != nil {
		http.Error(w, "falha ao listar historico", http.StatusInternalServerError)
		return
	}

	offset := 0
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, e := strconv.Atoi(v); e == nil && n >= 0 {
			offset = n
		}
	}
	limit := 0 // 0 = sem paginação (lista completa)
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, e := strconv.Atoi(v); e == nil && n > 0 {
			limit = n
		}
	}
	if limit == 0 {
		if all == nil {
			all = []*models.WorkoutHistoryEntry{}
		}
		writeJSON(w, http.StatusOK, all)
		return
	}

	if offset > len(all) {
		offset = len(all)
	}
	end := offset + limit
	if end > len(all) {
		end = len(all)
	}
	page := all[offset:end]
	if page == nil {
		page = []*models.WorkoutHistoryEntry{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"entries": page,
		"total":   len(all),
		"offset":  offset,
		"limit":   limit,
		"hasMore": end < len(all),
	})
}

// HandleCompleteWorkout registra a conclusão de um treino (aluno).
func (h *Handlers) HandleCompleteWorkout(w http.ResponseWriter, r *http.Request) {
	var req models.CompleteWorkoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if req.WorkoutID == "" {
		http.Error(w, "workoutId obrigatorio", http.StatusBadRequest)
		return
	}
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())

	workout, err := h.repo.GetWorkout(r.Context(), req.WorkoutID)
	if err != nil {
		http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
		return
	}
	if workout == nil {
		http.Error(w, "treino nao encontrado", http.StatusNotFound)
		return
	}
	// Só o próprio aluno (ou admin) pode concluir.
	if role != models.RoleAdmin && uid != workout.StudentID {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	entry := &models.WorkoutHistoryEntry{
		StudentID:          workout.StudentID,
		WorkoutID:          workout.ID,
		WorkoutName:        workout.Name,
		NutritionistID:     workout.NutritionistID,
		CompletedAt:        service.Now(),
		Duration:           req.Duration,
		ExercisesCompleted: req.ExercisesCompleted,
		TotalExercises:     req.TotalExercises,
		Exercises:          req.Exercises,
	}
	created, err := h.repo.CreateHistoryEntry(r.Context(), entry)
	if err != nil {
		http.Error(w, "falha ao registrar conclusao", http.StatusInternalServerError)
		return
	}

	// Rede social: publicação automática no feed (uma por dia) com a legenda
	// opcional do aluno.
	if err := h.svc.PublishWorkoutPost(r.Context(), created, req.Caption); err != nil {
		http.Error(w, "falha ao publicar no feed", http.StatusInternalServerError)
		return
	}

	// Ranking: recalcula a nota do ciclo em andamento.
	studentProf, err := h.repo.GetUserProfile(r.Context(), created.StudentID)
	if err != nil {
		http.Error(w, "falha ao ler aluno", http.StatusInternalServerError)
		return
	}
	startDate := ""
	if studentProf != nil {
		startDate = studentProf.StartDate
	}
	if err := h.svc.RecomputeScore(r.Context(), created.StudentID, startDate); err != nil {
		http.Error(w, "falha ao atualizar pontuacao", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, created)
}
