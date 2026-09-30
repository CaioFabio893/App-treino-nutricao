package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"treino-louise/backend/middleware"
	"treino-louise/backend/models"
	"treino-louise/backend/service"
)

// ── Perfil do usuário logado ──

// HandleGetMe devolve o perfil do usuário autenticado (com `id` preenchido).
// Sem perfil, CRIA o cadastro automaticamente como `pending_approval` (papel
// vazio — quem decide role/plano é o admin). Isso faz qualquer conta criada no
// Firebase Auth aparecer na fila de aprovação do admin imediatamente, mesmo
// antes de o usuário completar o nome no ProfileSetup (spec 4.1: "se perfil não
// existe, criar automaticamente como status: pending_approval"). O frontend usa
// needsProfile (monta o ProfileSetup) e needsApproval (tela de espera) para
// decidir o próximo passo.
func (h *Handlers) HandleGetMe(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	prof, err := h.repo.GetUserProfile(r.Context(), uid)
	if err != nil {
		http.Error(w, "falha ao ler perfil", http.StatusInternalServerError)
		return
	}
	if prof == nil {
		// Cadastro novo: preenche name/email com o registro do
		// Firebase Auth (login Google já traz tudo pronto; e-mail/senha entra
		// sem nome e o ProfileSetup coleta depois).
		p := &models.UserProfile{AuthProvider: middleware.AuthProviderFrom(r.Context())}
		if h.auth != nil {
			if rec, err := h.auth.GetUser(r.Context(), uid); err == nil {
				p.Name = rec.DisplayName
				p.Email = rec.Email
			}
		}
		if err := h.svc.GetOrCreateProfile(r.Context(), uid, p); err != nil {
			http.Error(w, "falha ao criar perfil", http.StatusInternalServerError)
			return
		}
		prof, err = h.repo.GetUserProfile(r.Context(), uid)
		if err != nil {
			http.Error(w, "falha ao ler perfil", http.StatusInternalServerError)
			return
		}
		if prof == nil {
			http.Error(w, "falha ao criar perfil", http.StatusInternalServerError)
			return
		}
	}
	// Cadastro pendente sem nome (ex.: e-mail/senha): o frontend ainda precisa
	// coletar o nome antes da tela de espera — mantém o contrato needsProfile.
	if prof.Role == "" && prof.Status == models.StatusPendingApproval && prof.Name == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"id":            prof.ID,
			"name":          prof.Name,
			"email":         prof.Email,
			"role":          "",
			"status":        prof.Status,
			"authProvider":  prof.AuthProvider,
			"needsProfile":  true,
			"needsApproval": true,
		})
		return
	}
	writeJSON(w, http.StatusOK, prof)
}

// HandlePutMe atualiza o perfil do usuário autenticado (só dados de perfil —
// ALLOWLIST). role/status/planID/features/startDate/endDate/
// histórico de aprovação/criadoEm são definidos pelos fluxos da API Go
// (admin/nutricionista/approval); qualquer valor desses campos no body é
// IGNORADO. Antes da F13, startDate/endDate passavam direto para o Firestore:
// como startDate alimenta o denominador da pontuação (daysElapsedInCycle), um
// aluno podia enviar uma data recente e inflar a própria nota do ranking.
// AuthProvider também vem do ID token verificado — nunca do body.
func (h *Handlers) HandlePutMe(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	var p models.UserProfile
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	// Allowlist estrita (mesmo contrato do allowedSelfProfileUpdate das regras
	// Firestore): o cliente só edita name/email/bio. Todo o resto é
	// decisão de servidor — zera cada campo não editável para que o body não
	// tenha efeito algum sobre eles.
	p.Role = ""
	p.Status = ""
	p.ApprovedBy = ""
	p.ApprovedAt = time.Time{}
	p.RejectedReason = ""
	p.CreatedAt = time.Time{}
	// Provedor de login vem do ID token verificado pelo Require — nunca
	// aceita spoof via body ("google.com", etc.).
	p.AuthProvider = middleware.AuthProviderFrom(r.Context())
	if tooLong(p.Name, service.MaxNameLength) {
		http.Error(w, "nome muito longo", http.StatusBadRequest)
		return
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
	p.AuthProvider = existing.AuthProvider
	p.ApprovedBy = existing.ApprovedBy
	p.ApprovedAt = existing.ApprovedAt
	p.RejectedReason = existing.RejectedReason
}

// HandleUpdateStudent permite que o admin edite dados do aluno
// (nome, foto, status, datas).
// Campos sensíveis (role) são preservados do registro existente.
func (h *Handlers) HandleUpdateStudent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if !canAccessResource(r, id) {
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
	if tooLong(p.Name, service.MaxNameLength) {
		http.Error(w, "nome muito longo", http.StatusBadRequest)
		return
	}
	// Merge com o perfil existente: esta rota só permite editar dados do aluno
	// (nome, status e datas). Role, vínculo, plano, features e o
	// histórico de aprovação são SEMPRE preservados do registro existente —
	// nunca vêm do body do admin.
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
	out.Status = p.Status
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

// ── Alunos ──

// HandleListMyStudents lista todos os alunos (inclusive os aprovados SEM plano
// — casos válidos que não podem ficar invisíveis). Só o admin chega aqui: a
// rota exige RoleAdmin no main.go.
func (h *Handlers) HandleListMyStudents(w http.ResponseWriter, r *http.Request) {
	students, err := h.repo.ListStudentsAll(r.Context())
	if err != nil {
		http.Error(w, "falha ao listar alunos", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, students)
}

func (h *Handlers) HandleGetStudent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !canAccessResource(r, id) {
		http.Error(w, "aluno nao encontrado", http.StatusNotFound)
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
	if !canAccessResource(r, workout.StudentID) {
		http.Error(w, "treino nao encontrado", http.StatusNotFound)
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
	if workout.Name == "" {
		http.Error(w, "nome obrigatorio", http.StatusBadRequest)
		return
	}
	if tooLong(workout.Name, service.MaxNameLength) ||
		tooLong(workout.Description, service.MaxDescriptionLength) ||
		tooLong(workout.Objective, service.MaxDescriptionLength) {
		http.Error(w, "nome, descricao ou objetivo muito longo", http.StatusBadRequest)
		return
	}
	role := middleware.RoleFrom(r.Context())
	// Treino de biblioteca (sem aluno) é válido: o aluno pode ser atribuído
	// depois via edição (studentId) — mecanismo existente. Admin pode criar
	// com aluno ou como template.
	if role != models.RoleAdmin {
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
	if !canAccessResource(r, existing.StudentID) {
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
	if tooLong(workout.Name, service.MaxNameLength) ||
		tooLong(workout.Description, service.MaxDescriptionLength) ||
		tooLong(workout.Objective, service.MaxDescriptionLength) {
		http.Error(w, "nome, descricao ou objetivo muito longo", http.StatusBadRequest)
		return
	}
	// Preserva o aluno se não vier no body.
	if workout.StudentID == "" {
		workout.StudentID = existing.StudentID
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
	if !canAccessResource(r, existing.StudentID) {
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
	if !canAccessResource(r, existing.StudentID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	var req models.DuplicateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if req.NewName != "" && tooLong(req.NewName, service.MaxNameLength) {
		http.Error(w, "nome muito longo", http.StatusBadRequest)
		return
	}
	newStudentID := req.NewStudentID
	if newStudentID == "" {
		newStudentID = existing.StudentID
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
	if !canAccessResource(r, d.StudentID) {
		http.Error(w, "dieta nao encontrada", http.StatusNotFound)
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
	if d.Name == "" {
		http.Error(w, "nome obrigatorio", http.StatusBadRequest)
		return
	}
	if tooLong(d.Name, service.MaxNameLength) ||
		tooLong(d.Description, service.MaxDescriptionLength) ||
		tooLong(d.Content, service.MaxDietContentLength) {
		http.Error(w, "nome, descricao ou conteudo muito longo", http.StatusBadRequest)
		return
	}
	role := middleware.RoleFrom(r.Context())
	// Dieta de biblioteca (sem aluno) é válida: o aluno pode ser atribuído
	// depois via edição (studentId) — mecanismo existente. Admin pode criar
	// com aluno ou como template.
	if role != models.RoleAdmin {
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
	if !canAccessResource(r, existing.StudentID) {
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
	if tooLong(d.Name, service.MaxNameLength) ||
		tooLong(d.Description, service.MaxDescriptionLength) ||
		tooLong(d.Content, service.MaxDietContentLength) {
		http.Error(w, "nome, descricao ou conteudo muito longo", http.StatusBadRequest)
		return
	}
	if d.StudentID == "" {
		d.StudentID = existing.StudentID
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
	if !canAccessResource(r, existing.StudentID) {
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
	if !canAccessResource(r, existing.StudentID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}

	var req models.DuplicateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if req.NewName != "" && tooLong(req.NewName, service.MaxNameLength) {
		http.Error(w, "nome muito longo", http.StatusBadRequest)
		return
	}
	newStudentID := req.NewStudentID
	if newStudentID == "" {
		newStudentID = existing.StudentID
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
