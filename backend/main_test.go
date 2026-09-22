package main

// Testes de INTEGRAÇÃO da cadeia real de autenticação/autorização definida em
// main.go (registerRoutes). Diferente dos testes unitários de middleware, que
// exercitam cada gate isolado com contexto pré-populado, aqui o teste monta o
// mux EXATAMENTE como produção (Require → Allow/RequireApproved/RequireFeature
// → handler) e dispara requests com token fake:
//
//	fakeVerifier  → simula VerifyIDToken do Firebase Auth
//	chainFakeRepo → simula users/{uid} (perfil com role/status/features)
//
// A ordem real da composição é o que está em jogo: com a ordem antiga
// Allow(Require(...))/RequireApproved(Require(...)), os gates rodavam antes do
// Require popular o contexto e estes testes falhavam (ADMIN 403, pendente 200).

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	firebaseAuth "firebase.google.com/go/v4/auth"

	"treino-louise/backend/handlers"
	"treino-louise/backend/middleware"
	"treino-louise/backend/models"
	"treino-louise/backend/repository"
	"treino-louise/backend/service"
)

const testUID = "uid-integration-test"

// fakeVerifier simula o ID token do Firebase Auth. err != nil ⇒ token inválido
// (VerifyIDToken falha → Require responde 401).
type fakeVerifier struct {
	uid string
	err error
}

func (f *fakeVerifier) VerifyIDToken(_ context.Context, _ string) (*firebaseAuth.Token, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &firebaseAuth.Token{
		UID:      f.uid,
		Firebase: firebaseAuth.FirebaseInfo{SignInProvider: "password"},
	}, nil
}

// chainFakeRepo emula o repository apenas nos pontos que a cadeia testada
// alcança. Métodos não sobrescritos ficam no embedded nil — se algum handler
// tocá-los sem sobrescrita, o teste quebra na hora (prova que nada ficou
// pendente de fake).
type chainFakeRepo struct {
	repository.Repository

	profile *models.UserProfile // perfil devolvido em users/{uid} (usado pelo Require)

	listUsers       []*models.UserProfile
	listPending     []*models.UserProfile
	listPlans       []*models.Plan
	listStudents    []*models.UserProfile
	listStudentsAll []*models.UserProfile
	listWorkouts    []*models.WorkoutDefine
	listWorkoutsSt  []*models.WorkoutDefine
	listDiets       []*models.Diet
	listDietsSt     []*models.Diet
	plan            *models.Plan

	createdUsers               []*models.UserProfile
	updateUserCalled           bool
	lastStudentsNutritionistID string // uid filtrado em ListStudents (escopo do nutricionista)

	// FASE 5 (I2): treinos/dietas para os handlers de UPDATE.
	studentsByID   map[string]*models.UserProfile // GetUserProfile por UID (alunos reais do nutri)
	workout        *models.WorkoutDefine
	diet           *models.Diet
	updatedWorkout *models.WorkoutDefine
	updatedDiet    *models.Diet
	createdDiet    *models.Diet
	createdWorkout *models.WorkoutDefine

	// FASE 1 (feed): posts em memória para as rotas sociais.
	posts map[string]*models.Post
}

// postsMap inicializa (se preciso) o mapa de posts do fake.
func (f *chainFakeRepo) postsMap() map[string]*models.Post {
	if f.posts == nil {
		f.posts = map[string]*models.Post{}
	}
	return f.posts
}

func (f *chainFakeRepo) CreatePost(_ context.Context, p *models.Post) (*models.Post, error) {
	f.postsMap()[p.ID] = p
	return p, nil
}

func (f *chainFakeRepo) GetPost(_ context.Context, id string) (*models.Post, error) {
	p, ok := f.postsMap()[id]
	if !ok {
		return nil, nil
	}
	cp := *p
	return &cp, nil
}

func (f *chainFakeRepo) DeletePost(_ context.Context, id string) error {
	delete(f.postsMap(), id)
	return nil
}

// UpdatePostTx aplica a mutação sobre o post em memória — espelha o contrato
// da implementação Firestore (transação): post inexistente aborta com
// ErrPostNotFound; o mutate roda sobre o post atual e o resultado é gravado.
func (f *chainFakeRepo) UpdatePostTx(_ context.Context, id string, mutate func(*models.Post) error) error {
	p, ok := f.postsMap()[id]
	if !ok {
		return repository.ErrPostNotFound
	}
	cp := *p
	if err := mutate(&cp); err != nil {
		return err
	}
	f.posts[id] = &cp
	return nil
}

func (f *chainFakeRepo) GetUserProfile(_ context.Context, uid string) (*models.UserProfile, error) {
	if f.studentsByID != nil {
		if p, ok := f.studentsByID[uid]; ok {
			return p, nil
		}
	}
	return f.profile, nil
}

func (f *chainFakeRepo) GetWorkout(_ context.Context, _ string) (*models.WorkoutDefine, error) {
	if f.workout == nil {
		return nil, nil
	}
	w := *f.workout
	return &w, nil
}

func (f *chainFakeRepo) UpdateWorkout(_ context.Context, _ string, w *models.WorkoutDefine) error {
	f.updatedWorkout = w
	return nil
}

func (f *chainFakeRepo) GetDiet(_ context.Context, _ string) (*models.Diet, error) {
	if f.diet == nil {
		return nil, nil
	}
	d := *f.diet
	return &d, nil
}

func (f *chainFakeRepo) UpdateDiet(_ context.Context, _ string, d *models.Diet) error {
	f.updatedDiet = d
	return nil
}

// Criação: captura o que o handler pediu para gravar (FASE 5 — dieta/treino
// de biblioteca sem aluno, admin sem nutritionistId).
func (f *chainFakeRepo) CreateDiet(_ context.Context, d *models.Diet) (*models.Diet, error) {
	f.createdDiet = d
	d.ID = "d-novo"
	return d, nil
}

func (f *chainFakeRepo) CreateWorkout(_ context.Context, w *models.WorkoutDefine) (*models.WorkoutDefine, error) {
	f.createdWorkout = w
	w.ID = "w-novo"
	return w, nil
}

func (f *chainFakeRepo) ListDietsForNutritionist(_ context.Context, _ string) ([]*models.Diet, error) {
	return f.listDiets, nil
}

func (f *chainFakeRepo) ListWorkoutsForNutritionist(_ context.Context, _ string) ([]*models.WorkoutDefine, error) {
	return f.listWorkouts, nil
}

func (f *chainFakeRepo) ListUsers(_ context.Context) ([]*models.UserProfile, error) {
	return f.listUsers, nil
}

func (f *chainFakeRepo) ListUsersByStatus(_ context.Context, _ string) ([]*models.UserProfile, error) {
	return f.listPending, nil
}

func (f *chainFakeRepo) ListPlans(_ context.Context) ([]*models.Plan, error) {
	return f.listPlans, nil
}

// ListStudents espelha o filtro real do repository (role=student + vínculo
// com o nutricionista) e registra o nutritionistID consultado para o teste
// provar o escopo correto.
func (f *chainFakeRepo) ListStudents(_ context.Context, nutritionistID string) ([]*models.UserProfile, error) {
	f.lastStudentsNutritionistID = nutritionistID
	out := []*models.UserProfile{}
	for _, s := range f.listStudents {
		if s.NutritionistID == nutritionistID {
			out = append(out, s)
		}
	}
	return out, nil
}

func (f *chainFakeRepo) ListStudentsAll(_ context.Context) ([]*models.UserProfile, error) {
	return f.listStudentsAll, nil
}

func (f *chainFakeRepo) ListWorkouts(_ context.Context) ([]*models.WorkoutDefine, error) {
	return f.listWorkouts, nil
}

func (f *chainFakeRepo) ListWorkoutsForStudent(_ context.Context, _ string) ([]*models.WorkoutDefine, error) {
	return f.listWorkoutsSt, nil
}

func (f *chainFakeRepo) ListDiets(_ context.Context) ([]*models.Diet, error) {
	return f.listDiets, nil
}

func (f *chainFakeRepo) ListDietsForStudent(_ context.Context, _ string) ([]*models.Diet, error) {
	return f.listDietsSt, nil
}

func (f *chainFakeRepo) GetPlan(_ context.Context, _ string) (*models.Plan, error) {
	return f.plan, nil
}

func (f *chainFakeRepo) CreateUser(_ context.Context, _ string, p *models.UserProfile) error {
	f.createdUsers = append(f.createdUsers, p)
	return nil
}

func (f *chainFakeRepo) PutUserProfile(_ context.Context, _ string, _ *models.UserProfile) error {
	f.updateUserCalled = true
	return nil
}

// newChainMux monta o mux real de produção (registerRoutes) com fakes.
func newChainMux(repo repository.Repository) http.Handler {
	return newChainMuxWithVerifier(repo, &fakeVerifier{uid: testUID})
}

func newChainMuxWithVerifier(repo repository.Repository, ver *fakeVerifier) http.Handler {
	a := middleware.NewAuth(ver, repo)
	h := handlers.New(service.New(repo), repo, nil)
	mux := http.NewServeMux()
	registerRoutes(mux, h, a)
	return mux
}

// autoCreateRepo emula o comportamento real do Firestore depois de um
// CreateUser: o documento users/{uid} criado passa a ser legível pelo
// GetUserProfile seguinte. O chainFakeRepo base não faz isso (o perfil devolvido
// é sempre o campo fixo `profile`), então os testes do fluxo de auto-criação no
// GET /api/me usam este wrapper.
type autoCreateRepo struct {
	*chainFakeRepo
	created *models.UserProfile
}

func (r *autoCreateRepo) GetUserProfile(ctx context.Context, uid string) (*models.UserProfile, error) {
	if r.created != nil {
		return r.created, nil
	}
	return r.chainFakeRepo.GetUserProfile(ctx, uid)
}

func (r *autoCreateRepo) CreateUser(_ context.Context, uid string, p *models.UserProfile) error {
	cp := *p
	cp.ID = uid
	r.created = &cp
	return nil
}

// capturePutRepo captura o perfil que o handler mandou gravar em
// PutUserProfile (PUT /api/me) — o chainFakeRepo base apenas marca
// updateUserCalled; a ALLOWLIST da F13 precisa inspecionar os campos do
// perfil que chegaria ao Firestore.
type capturePutRepo struct {
	*chainFakeRepo
	updated *models.UserProfile
}

func (r *capturePutRepo) PutUserProfile(_ context.Context, _ string, p *models.UserProfile) error {
	cp := *p
	r.updated = &cp
	return nil
}

// baseRepo devolve um fake com listas vazias (nenhum dado "real" criado).
func baseRepo(profile *models.UserProfile) *chainFakeRepo {
	return &chainFakeRepo{
		profile:         profile,
		listUsers:       []*models.UserProfile{},
		listPending:     []*models.UserProfile{},
		listPlans:       []*models.Plan{},
		listStudents:    []*models.UserProfile{},
		listStudentsAll: []*models.UserProfile{},
	}
}

func adminProfile(status string) *models.UserProfile {
	return &models.UserProfile{ID: testUID, Name: "Admin", Role: models.RoleAdmin, Status: status}
}

func studentProfile(status string, features []models.Feature) *models.UserProfile {
	return &models.UserProfile{ID: testUID, Name: "Aluno", Role: models.RoleStudent, Status: status, Features: features}
}

func nutritionistProfile(status string) *models.UserProfile {
	return &models.UserProfile{ID: testUID, Name: "Nutricionista", Role: models.RoleNutritionist, Status: status}
}

// doChainRequest dispara um request contra a cadeia real. token vazio = sem
// header Authorization.
func doChainRequest(h http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, rd)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

// ── ADMIN (role=admin, status=active) ──
//
// Com a ordem antiga (Allow por fora de Require) estas rotas retornavam 403
// até para o ADMIN (RoleFrom lia "student" antes do Require popular o
// contexto). Com `Require(Allow(...))` elas passam.
func TestChainAdminActiveCanAccessAdminEndpoints(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	cases := []struct {
		name   string
		method string
		path   string
	}{
		{"GET /api/users", "GET", "/api/users"},
		{"GET /api/users/pending", "GET", "/api/users/pending"},
		{"GET /api/plans", "GET", "/api/plans"},
		{"GET /api/students", "GET", "/api/students"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rr := doChainRequest(h, c.method, c.path, "", "token-valido")
			if rr.Code != http.StatusOK {
				t.Fatalf("%s code = %d, want 200 (body: %s)", c.name, rr.Code, rr.Body.String())
			}
		})
	}
}

// ── ADMIN com status pending_approval/rejected/inactive ──
//
// O bypass do RequireApproved (e do RequireFeature) para ADMIN continua
// funcionando na cadeia real: Require roda primeiro, injeta role=admin no
// contexto, e os gates deixam o ADMIN passar independente do status.
func TestChainAdminBypassesRequireApprovedAndFeature(t *testing.T) {
	statuses := []string{
		models.StatusPendingApproval,
		models.StatusRejected,
		models.StatusInactive,
		models.StatusActive,
	}
	for _, st := range statuses {
		t.Run("admin_"+st, func(t *testing.T) {
			repo := baseRepo(adminProfile(st))
			h := newChainMux(repo)

			// GET /api/workouts: protegida por RequireApproved.
			rr := doChainRequest(h, "GET", "/api/workouts", "", "token-valido")
			if rr.Code != http.StatusOK {
				t.Fatalf("workouts code = %d, want 200 (bypass admin)", rr.Code)
			}

			// GET /api/diets: protegida por RequireFeature(diet) + RequireApproved.
			rr = doChainRequest(h, "GET", "/api/diets", "", "token-valido")
			if rr.Code != http.StatusOK {
				t.Fatalf("diets code = %d, want 200 (bypass admin em feature+aprovacao)", rr.Code)
			}
		})
	}
}

// ── ALUNO PENDENTE (role=student, status=pending_approval) ──
//
// Deve continuar BLOQUEADO nas rotas de negócio protegidas por
// RequireApproved. Com a ordem antiga (RequireApproved por fora de Require) o
// status lido era "" (aprovado por compatibilidade) e o pendente passava —
// este teste falha na ordem antiga e passa na corrigida.
func TestChainStudentPendingBlockedFromBusinessRoutes(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusPendingApproval, nil))
	h := newChainMux(repo)

	cases := []struct {
		name   string
		method string
		path   string
	}{
		{"GET /api/workouts", "GET", "/api/workouts"},
		{"GET /api/diets", "GET", "/api/diets"},
		{"GET /api/sessions/1/ta", "GET", "/api/sessions/1/ta"},
		{"GET /api/prs", "GET", "/api/prs"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rr := doChainRequest(h, c.method, c.path, "", "token-valido")
			if rr.Code != http.StatusForbidden {
				t.Fatalf("%s code = %d, want 403 (pendente bloqueado; body: %s)", c.name, rr.Code, rr.Body.String())
			}
		})
	}
}

// ── ALUNO APROVADO (status=active) ──
//
// Só o perfil aprovado chega ao handler — o free tier (workouts) abre, e o
// diet só abre com a feature diet no plano.
func TestChainStudentApprovedAccessFreeTierWorkouts(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive, []models.Feature{models.FeatureWorkouts}))
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/workouts", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("workouts code = %d, want 200 (aluno ativo tem free tier)", rr.Code)
	}
}

func TestChainStudentWithoutDietFeatureBlockedOnDiets(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive, []models.Feature{models.FeatureWorkouts}))
	h := newChainMux(repo)

	// feature diet ausente do plano ⇒ RequireFeature bloqueia (403) mesmo com
	// cadastro ativo.
	rr := doChainRequest(h, "GET", "/api/diets", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("diets code = %d, want 403 (plan sem diet; body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainStudentWithDietFeatureAllowedOnDiets(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive, []models.Feature{models.FeatureWorkouts, models.FeatureDiet}))
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/diets", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("diets code = %d, want 200 (plano inclui diet)", rr.Code)
	}
}

// ── STUDENT em rotas de ADMIN ──
func TestChainStudentBlockedFromAdminRoutes(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive, []models.Feature{models.FeatureWorkouts}))
	h := newChainMux(repo)

	cases := []struct {
		name   string
		method string
		path   string
	}{
		{"GET /api/users", "GET", "/api/users"},
		{"GET /api/plans", "GET", "/api/plans"},
		{"GET /api/users/pending", "GET", "/api/users/pending"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rr := doChainRequest(h, c.method, c.path, "", "token-valido")
			if rr.Code != http.StatusForbidden {
				t.Fatalf("%s code = %d, want 403 (student sem role admin; body: %s)", c.name, rr.Code, rr.Body.String())
			}
		})
	}
}

// ── NÃO AUTENTICADO ──
//
// Nenhuma rota protegida pode virar pública: sem token ⇒ 401 em TODAS as
// cadeias (Require continua obrigatório e é o primeiro elo).
func TestChainUnauthenticatedNotPublic(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	cases := []struct {
		name   string
		method string
		path   string
	}{
		{"GET /api/users", "GET", "/api/users"},
		{"GET /api/plans", "GET", "/api/plans"},
		{"GET /api/workouts", "GET", "/api/workouts"},
		{"GET /api/me", "GET", "/api/me"},
		{"GET /api/sessions/1/ta", "GET", "/api/sessions/1/ta"},
		{"GET /api/diets", "GET", "/api/diets"},
		{"GET /api/ranking", "GET", "/api/ranking"},
	}
	for _, c := range cases {
		t.Run(c.name+"_sem_token", func(t *testing.T) {
			rr := doChainRequest(h, c.method, c.path, "", "")
			if rr.Code != http.StatusUnauthorized {
				t.Fatalf("%s sem token: code = %d, want 401 (rota nunca publica; body: %s)", c.name, rr.Code, rr.Body.String())
			}
		})
	}

	t.Run("token_invalido", func(t *testing.T) {
		bad := baseRepo(adminProfile(models.StatusActive))
		hBad := newChainMuxWithVerifier(bad, &fakeVerifier{uid: testUID, err: errors.New("token invalido")})
		rr := doChainRequest(hBad, "GET", "/api/plans", "", "token-lixo")
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("token invalido: code = %d, want 401", rr.Code)
		}
	})
}

// ── Validar o cadastro administrativo (item 4) ──
//
// Fluxo: ADMIN autenticado → GET /api/users → POST /api/users →
// POST /api/users/{id}/assign-plan. Usa fakes — nenhum aluno real é criado.
func TestChainAdminCanCreateStudentFlow(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.plan = &models.Plan{ID: "plan-1", Name: "Completo", Active: true, Features: []models.Feature{models.FeatureWorkouts, models.FeatureDiet}}
	h := newChainMux(repo)

	// 1) ADMIN lista usuários.
	rr := doChainRequest(h, "GET", "/api/users", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/users code = %d, want 200", rr.Code)
	}

	// 2) ADMIN cria um aluno (perfil via POST /api/users).
	body := `{"id":"student-novo","name":"Aluno Novo","email":"aluno@novo.com","role":"student","status":"pending_approval"}`
	rr = doChainRequest(h, "POST", "/api/users", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST /api/users code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if len(repo.createdUsers) != 1 {
		t.Fatalf("createdUsers = %d, want 1", len(repo.createdUsers))
	}
	if got := repo.createdUsers[0].Role; got != models.RoleStudent {
		t.Errorf("role criado = %q, want student", got)
	}

	// 3) ADMIN atribui plano ao aluno.
	rr = doChainRequest(h, "POST", "/api/users/student-novo/assign-plan", `{"planID":"plan-1"}`, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("assign-plan code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if !repo.updateUserCalled {
		t.Error("PutUserProfile deveria ter sido chamado no assign-plan")
	}
}

// ── Planos vazios (item 6) ──
//
// Coleção plans vazia deve aparecer como "0 planos" (200 []) e NUNCA como erro
// de permissão.
func TestChainPlansEmptyReturnsZeroNotForbidden(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.listPlans = []*models.Plan{}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/plans", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/plans code = %d, want 200 (0 planos, não erro de permissão; body: %s)", rr.Code, rr.Body.String())
	}
	if got := strings.TrimSpace(rr.Body.String()); got != "[]" {
		t.Errorf("body = %q, want [] (lista vazia)", got)
	}
}

// ── Contrato JSON de coleções: null → [] ──
//
// Todo endpoint de listagem deve serializar coleção vazia como `[]`, nunca
// `null`. A normalização de slice nil vive no repository (ver
// repository_test.go); estes testes garantem, pela cadeia HTTP real, que o
// endpoint entrega o contrato esperado pelo frontend.
func TestChainCollectionEndpointsSerializeEmptyAsArray(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	// baseRepo já inicializa users/pending/plans/students; workouts/diets aqui.
	repo.listWorkouts = []*models.WorkoutDefine{}
	repo.listDiets = []*models.Diet{}
	h := newChainMux(repo)

	cases := []struct {
		name string
		path string
	}{
		{"GET /api/users", "/api/users"},
		{"GET /api/users/pending", "/api/users/pending"},
		{"GET /api/plans", "/api/plans"},
		{"GET /api/students", "/api/students"},
		{"GET /api/workouts", "/api/workouts"},
		{"GET /api/diets", "/api/diets"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rr := doChainRequest(h, "GET", c.path, "", "token-valido")
			if rr.Code != http.StatusOK {
				t.Fatalf("%s code = %d, want 200 (body: %s)", c.name, rr.Code, rr.Body.String())
			}
			if got := strings.TrimSpace(rr.Body.String()); got != "[]" {
				t.Errorf("%s body = %q, want [] (nunca null)", c.name, got)
			}
		})
	}
}

// TestChainCollectionEndpointsKeepRecords garante que a normalização não
// esvazia coleções com conteúdo: os registros continuam presentes no array.
func TestChainCollectionEndpointsKeepRecords(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.listPlans = []*models.Plan{{ID: "plan-1", Name: "Premium", Active: true}}
	repo.listWorkouts = []*models.WorkoutDefine{{ID: "w-1", Name: "Treino A"}}
	repo.listDiets = []*models.Diet{{ID: "d-1", Name: "Dieta A"}}
	// GET /api/students é chamado por ADMIN aqui ⇒ a rota usa ListStudentsAll.
	repo.listStudentsAll = []*models.UserProfile{{ID: "s-1", Name: "Aluno", Role: models.RoleStudent}}
	h := newChainMux(repo)

	cases := []struct {
		name   string
		path   string
		needle string
	}{
		{"GET /api/plans", "/api/plans", `"id":"plan-1"`},
		{"GET /api/workouts", "/api/workouts", `"id":"w-1"`},
		{"GET /api/diets", "/api/diets", `"id":"d-1"`},
		{"GET /api/students", "/api/students", `"id":"s-1"`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rr := doChainRequest(h, "GET", c.path, "", "token-valido")
			if rr.Code != http.StatusOK {
				t.Fatalf("%s code = %d, want 200 (body: %s)", c.name, rr.Code, rr.Body.String())
			}
			body := strings.TrimSpace(rr.Body.String())
			if !strings.HasPrefix(body, "[") {
				t.Errorf("%s body = %q, want array", c.name, body)
			}
			if !strings.Contains(body, c.needle) {
				t.Errorf("%s body = %q, should contain %s", c.name, body, c.needle)
			}
		})
	}
}

// ── Regressão: GetUserProfile deve devolver o `id` no JSON ──
//
// GET /api/students/{id} e GET /api/me consomem GetUserProfile. O documento
// é users/{uid}, então o perfil devolvido precisa serializar "id":"<UID>"
// (sem omitempty): sem isso o frontend monta links com student=undefined.
func TestChainProfileEndpointsSerializeID(t *testing.T) {
	// Perfil com ID preenchido (o que GetUserProfile deve garantir).
	repo := baseRepo(studentProfile(models.StatusActive, nil))
	repo.profile.ID = testUID
	h := newChainMux(repo)

	cases := []struct {
		name string
		path string
	}{
		{"GET /api/students/{id}", "/api/students/uid-integration-test"},
		{"GET /api/me", "/api/me"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rr := doChainRequest(h, "GET", c.path, "", "token-valido")
			if rr.Code != http.StatusOK {
				t.Fatalf("%s code = %d, want 200 (body: %s)", c.name, rr.Code, rr.Body.String())
			}
			if !strings.Contains(rr.Body.String(), `"id":"uid-integration-test"`) {
				t.Errorf("%s body = %q, deveria conter \"id\":\"uid-integration-test\"", c.name, rr.Body.String())
			}
		})
	}
}

// ── GET /api/me CRIA o cadastro pendente (spec 4.1) ──
//
// Usuário que criou a conta no Firebase Auth mas ainda não tem documento no
// Firestore: o GET /api/me deve criar o perfil automaticamente como
// `pending_approval` com papel vazio. É isso que faz a conta "criada" aparecer
// na fila de aprovação do admin (GET /api/users/pending consulta status
// pending_approval). Antes da correção, o /me devolvia um perfil virtual sem
// gravar nada — e o usuário sumia da fila até completar o ProfileSetup.
func TestChainGetMeCreatesPendingProfile(t *testing.T) {
	repo := &autoCreateRepo{chainFakeRepo: baseRepo(nil)}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/me", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/me code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.created == nil {
		t.Fatal("GET /api/me não criou o perfil no Firestore")
	}
	if repo.created.Status != models.StatusPendingApproval {
		t.Errorf("status criado = %q, want pending_approval", repo.created.Status)
	}
	if repo.created.Role != "" {
		t.Errorf("role criado = %q, want vazio (quem decide é o admin)", repo.created.Role)
	}
	// Contrato de resposta: cadastro pendente SEM nome ainda → needsProfile +
	// needsApproval para o frontend montar o ProfileSetup antes da tela de
	// espera.
	body := rr.Body.String()
	for _, needle := range []string{
		`"needsProfile":true`,
		`"needsApproval":true`,
		`"status":"pending_approval"`,
		`"id":"uid-integration-test"`,
	} {
		if !strings.Contains(body, needle) {
			t.Errorf("GET /api/me body = %q, deveria conter %s", body, needle)
		}
	}

	// Segunda chamada: o perfil já existe → retorna o documento criado, sem
	// duplicar/criar de novo.
	rr = doChainRequest(h, "GET", "/api/me", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/me (2ª vez) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"status":"pending_approval"`) {
		t.Errorf("2ª chamada body = %q, deveria conter status pending_approval", rr.Body.String())
	}
}

// ── FASE 13 (segurança): PUT /api/me é ALLOWLIST — mass assignment bloqueado ──
//
// Achado A da revisão final: HandlePutMe decodifica o UserProfile inteiro e
// só zera Role/Status/PlanID/Features. GetOrCreateProfile preserva os campos
// administrativos do registro (nutritionistID, approvedBy, ...) mas NÃO
// StartDate/EndDate — e startDate alimenta o denominador da pontuação
// (daysElapsedInCycle): um aluno podia enviar uma data recente e INFLAR a
// própria nota do ranking. O mesmo furo valia para authProvider/approvedAt/
// rejectedReason (client-sent, sem preservação). Contrato (rules Firestore
// allowedSelfProfileUpdate + docs/api): o cliente só edita name/email/
// photoURL/bio; TODO o resto é definido pela API Go em fluxos dedicados.
func TestChainPutMeIsAllowlistBlockingMassAssignment(t *testing.T) {
	existing := &models.UserProfile{
		ID:             testUID,
		Name:           "Nome Original",
		Email:          "original@email.com",
		Role:           models.RoleStudent,
		Status:         models.StatusActive,
		NutritionistID: "nutri-1",
		PlanID:         "plano-1",
		Features:       []models.Feature{models.FeatureWorkouts, models.FeatureDiet},
		StartDate:      "2026-09-01",
		EndDate:        "2026-12-01",
		AuthProvider:   "password",
		ApprovedBy:     "admin-1",
		RejectedReason: "",
		CreatedAt:      time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC),
	}
	repo := &capturePutRepo{chainFakeRepo: baseRepo(existing)}
	h := newChainMux(repo)

	// O body tenta "vender" o perfil inteiro: edita name/email (legítimos) e
	// envenena tudo que é de decisão do admin/nutricionista.
	body := `{
		"id":"` + testUID + `",
		"name":"Nome Editado",
		"email":"editado@email.com",
		"role":"admin",
		"status":"rejected",
		"planID":"plano-hack",
		"features":["community","ranking"],
		"nutritionistID":"nutri-hack",
		"startDate":"2026-10-01",
		"endDate":"2026-10-02",
		"authProvider":"google.com",
		"approvedBy":"admin-hack",
		"approvedAt":"2026-10-01T00:00:00Z",
		"rejectedReason":"hack",
		"createdAt":"2026-01-01T00:00:00Z"
	}`
	rr := doChainRequest(h, "PUT", "/api/me", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/me code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updated == nil {
		t.Fatal("PUT /api/me não chamou PutUserProfile")
	}
	got := repo.updated

	// O que o cliente PODE editar (allowlist) passa.
	if got.Name != "Nome Editado" {
		t.Errorf("name = %q, want %q (editável via /me)", got.Name, "Nome Editado")
	}
	if got.Email != "editado@email.com" {
		t.Errorf("email = %q, want %q (editável via /me)", got.Email, "editado@email.com")
	}

	// O resto é decisão do admin/nutricionista — o registro manda.
	if got.Role != models.RoleStudent {
		t.Errorf("role = %q, want preservar student", got.Role)
	}
	if got.Status != models.StatusActive {
		t.Errorf("status = %q, want preservar active", got.Status)
	}
	if got.PlanID != "plano-1" {
		t.Errorf("planID = %q, want preservar plano-1", got.PlanID)
	}
	if len(got.Features) != 2 || got.Features[0] != models.FeatureWorkouts || got.Features[1] != models.FeatureDiet {
		t.Errorf("features = %v, want preservar [workouts diet]", got.Features)
	}
	if got.NutritionistID != "nutri-1" {
		t.Errorf("nutritionistID = %q, want preservar nutri-1 (aluno não define vínculo)", got.NutritionistID)
	}
	if got.StartDate != "2026-09-01" {
		t.Errorf("startDate = %q, want preservar 2026-09-01 (startDate alimenta o denominador do score)", got.StartDate)
	}
	if got.EndDate != "2026-12-01" {
		t.Errorf("endDate = %q, want preservar 2026-12-01", got.EndDate)
	}
	if got.AuthProvider != "password" {
		t.Errorf("authProvider = %q, want preservar password (provém do token, nunca do body)", got.AuthProvider)
	}
	if got.ApprovedBy != "admin-1" {
		t.Errorf("approvedBy = %q, want preservar admin-1", got.ApprovedBy)
	}
	if !got.ApprovedAt.IsZero() {
		t.Errorf("approvedAt = %v, want zero (histórico de aprovação é do admin)", got.ApprovedAt)
	}
	if got.RejectedReason != "" {
		t.Errorf("rejectedReason = %q, want preservar vazio", got.RejectedReason)
	}
	if !got.CreatedAt.Equal(existing.CreatedAt) {
		t.Errorf("createdAt = %v, want preservar %v (nunca sobrescrito)", got.CreatedAt, existing.CreatedAt)
	}
}

// ── ADMIN lista alunos SEM plano e SEM nutricionista ──
//
// Aluno aprovado com NutritionistID == "" não pode ficar invisível na Gestão:
// ADMIN deve usar ListStudentsAll (todos os alunos), em vez do filtro por
// nutricionista, e o aluno sem plano (PlanID == "") continua sendo retornado.
func TestChainAdminListsStudentWithoutPlanOrNutritionist(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.listStudentsAll = []*models.UserProfile{
		{
			ID:             "s-sem-plano",
			Name:           "Teste",
			Role:           models.RoleStudent,
			Status:         models.StatusActive,
			PlanID:         "",
			NutritionistID: "",
		},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/students", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/students code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"id":"s-sem-plano"`) {
		t.Errorf("body = %q, deveria conter o aluno sem plano/sem nutricionista", rr.Body.String())
	}
	// ADMIN não pode passar pelo filtro por nutricionista.
	if repo.lastStudentsNutritionistID != "" {
		t.Errorf("ListStudents foi chamado com %q; ADMIN deve usar ListStudentsAll", repo.lastStudentsNutritionistID)
	}
}

// ── Nutricionista continua vendo SÓ os próprios alunos ──
//
// A mudança não amplia o escopo do nutricionista: o handler continua
// repassando o UID autenticado ao ListStudents (que filtra os vínculos) e o
// aluno sem plano continua retornado na lista do responsável.
func TestChainNutritionistListStudentsRemainsScopedToOwn(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.listStudents = []*models.UserProfile{
		{ID: "meu-aluno", Name: "Meu Aluno", Role: models.RoleStudent, Status: models.StatusActive, PlanID: "", NutritionistID: testUID},
		{ID: "aluno-outro-nutri", Name: "Outro", Role: models.RoleStudent, Status: models.StatusActive, NutritionistID: "outro-nutri"},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/students", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/students code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.lastStudentsNutritionistID != testUID {
		t.Errorf("ListStudents filtrou por %q, want %q (uid autenticado)", repo.lastStudentsNutritionistID, testUID)
	}
	if !strings.Contains(rr.Body.String(), `"id":"meu-aluno"`) {
		t.Errorf("body = %q, deveria conter o aluno vinculado ao nutricionista", rr.Body.String())
	}
	if strings.Contains(rr.Body.String(), `"id":"aluno-outro-nutri"`) {
		t.Errorf("body = %q, NÃO deveria conter aluno de outro nutricionista", rr.Body.String())
	}
}

// ── Autorização de GET /api/students permanece intacta ──
//
// Sem token ⇒ 401; aluno autenticado (role=student) ⇒ 403; admin e
// nutricionista ⇒ 200.
func TestChainStudentsRouteAuthzUnchanged(t *testing.T) {
	// Sem token ⇒ 401.
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)
	rr := doChainRequest(h, "GET", "/api/students", "", "")
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("sem token: code = %d, want 401", rr.Code)
	}

	// Aluno autenticado ⇒ 403 (rota exclusiva admin/nutricionista).
	repoSt := baseRepo(studentProfile(models.StatusActive, []models.Feature{models.FeatureWorkouts}))
	hSt := newChainMux(repoSt)
	rr = doChainRequest(hSt, "GET", "/api/students", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("aluno: code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}

	// Nutricionista ativo ⇒ 200 (escopo mantido).
	repoN := baseRepo(nutritionistProfile(models.StatusActive))
	hN := newChainMux(repoN)
	rr = doChainRequest(hN, "GET", "/api/students", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("nutritionist: code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
}

// ── FASE 5 (I2): vínculo nutricionista nunca é transferido ──
//
// Nutricionista que edita um treino/dieta dos próprios alunos NÃO pode
// transferi-lo para outro nutricionista — mesmo que o body envie um
// nutritionistId diferente. O handler sobrescreve com o vínculo do registro.
func TestChainNutritionistCannotTransferWorkout(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.workout = &models.WorkoutDefine{
		ID:             "w-1",
		StudentID:      "student-1",
		NutritionistID: testUID,
		Name:           "Treino A",
	}
	// studentsByID ⇒ CanAccessStudent resolve o aluno como vinculado ao nutri.
	repo.studentsByID = map[string]*models.UserProfile{
		"student-1": {ID: "student-1", Role: models.RoleStudent, Status: models.StatusActive, NutritionistID: testUID},
	}
	h := newChainMux(repo)

	// Nutricionista tenta "transferir" o treino para outro nutricionista.
	body := `{"name":"Treino A editado","studentId":"student-1","nutritionistId":"outro-nutri"}`
	rr := doChainRequest(h, "PUT", "/api/workouts/w-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/workouts/w-1 code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedWorkout == nil {
		t.Fatal("UpdateWorkout não foi chamado")
	}
	if got := repo.updatedWorkout.NutritionistID; got != testUID {
		t.Errorf("nutritionistId gravado = %q, want %q (transferência bloqueada)", got, testUID)
	}
	if got := repo.updatedWorkout.Name; got != "Treino A editado" {
		t.Errorf("name = %q, want edição aplicada", got)
	}
}

func TestChainNutritionistCannotTransferDiet(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.diet = &models.Diet{
		ID:             "d-1",
		StudentID:      "student-1",
		NutritionistID: testUID,
		Name:           "Dieta A",
	}
	repo.studentsByID = map[string]*models.UserProfile{
		"student-1": {ID: "student-1", Role: models.RoleStudent, Status: models.StatusActive, NutritionistID: testUID},
	}
	h := newChainMux(repo)

	body := `{"name":"Dieta A editada","studentId":"student-1","nutritionistId":"outro-nutri"}`
	rr := doChainRequest(h, "PUT", "/api/diets/d-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/diets/d-1 code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedDiet == nil {
		t.Fatal("UpdateDiet não foi chamado")
	}
	if got := repo.updatedDiet.NutritionistID; got != testUID {
		t.Errorf("nutritionistId gravado = %q, want %q (transferência bloqueada)", got, testUID)
	}
}

// ADMIN que edita um treino/dieta sem enviar nutritionistId no body preserva o
// vínculo atual do registro (não zera nem inventa outro).
func TestChainAdminPreservesWorkoutLinkWhenBodyOmitsNutritionist(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.workout = &models.WorkoutDefine{
		ID:             "w-1",
		StudentID:      "student-1",
		NutritionistID: "nutri-atual",
		Name:           "Treino A",
	}
	h := newChainMux(repo)

	body := `{"name":"Treino A editado","studentId":"student-1"}`
	rr := doChainRequest(h, "PUT", "/api/workouts/w-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/workouts/w-1 code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedWorkout == nil {
		t.Fatal("UpdateWorkout não foi chamado")
	}
	if got := repo.updatedWorkout.NutritionistID; got != "nutri-atual" {
		t.Errorf("nutritionistId gravado = %q, want nutri-atual (preservado sem body)", got)
	}
}

func TestChainAdminPreservesDietLinkWhenBodyOmitsNutritionist(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.diet = &models.Diet{
		ID:             "d-1",
		StudentID:      "student-1",
		NutritionistID: "nutri-atual",
		Name:           "Dieta A",
	}
	h := newChainMux(repo)

	body := `{"name":"Dieta A editada","studentId":"student-1"}`
	rr := doChainRequest(h, "PUT", "/api/diets/d-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/diets/d-1 code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedDiet == nil {
		t.Fatal("UpdateDiet não foi chamado")
	}
	if got := repo.updatedDiet.NutritionistID; got != "nutri-atual" {
		t.Errorf("nutritionistId gravado = %q, want nutri-atual (preservado sem body)", got)
	}
}

// ── FASE 5: dieta/treino de biblioteca sem aluno, admin sem nutritionistId ──

// Nutricionista cria TREINO sem aluno (biblioteca) — antes: 400 "nome e aluno
// sao obrigatorios".
func TestChainNutritionistCreatesWorkoutWithoutStudent(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	h := newChainMux(repo)

	body := `{"name":"Treino full body","exercises":[]}`
	rr := doChainRequest(h, "POST", "/api/workouts", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST /api/workouts code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdWorkout == nil {
		t.Fatal("CreateWorkout não foi chamado")
	}
	if got := repo.createdWorkout.StudentID; got != "" {
		t.Errorf("studentId gravado = %q, want \"\" (biblioteca)", got)
	}
	if got := repo.createdWorkout.NutritionistID; got != testUID {
		t.Errorf("nutritionistId gravado = %q, want %q", got, testUID)
	}
}

// Nutricionista cria DIETA sem aluno (biblioteca) — antes: 400.
func TestChainNutritionistCreatesDietWithoutStudent(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	h := newChainMux(repo)

	body := `{"name":"Dieta 2000 kcal","meals":[]}`
	rr := doChainRequest(h, "POST", "/api/diets", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST /api/diets code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdDiet == nil {
		t.Fatal("CreateDiet não foi chamado")
	}
	if got := repo.createdDiet.StudentID; got != "" {
		t.Errorf("studentId gravado = %q, want \"\" (biblioteca)", got)
	}
	if got := repo.createdDiet.NutritionistID; got != testUID {
		t.Errorf("nutritionistId gravado = %q, want %q", got, testUID)
	}
}

// Admin cria TREINO como template sem nutritionistId — antes: 400
// "nutritionistId obrigatorio (ou use role de nutricionista)".

// ── FASE 5b: formato simplificado de dieta (texto livre) ──
//
// O `content` (copiar/colar em texto) é o formato atual de dieta; refeições
// estruturadas (`meals`) continuam como legado. O handler precisa persistir
// o texto exatamente como enviado (preservando quebras de linha) tanto na
// criação quanto na edição.
func TestChainDietTextContentPersistsOnCreate(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	h := newChainMux(repo)

	body := `{"name":"Plano Outubro","content":"CAFÉ DA MANHÃ (07:00)\n• 2 ovos cozidos\n• 1 banana\n\nALMOÇO (12:30)\n• 150g de arroz integral"}`
	rr := doChainRequest(h, "POST", "/api/diets", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST /api/diets code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdDiet == nil {
		t.Fatal("CreateDiet não foi chamado")
	}
	want := "CAFÉ DA MANHÃ (07:00)\n• 2 ovos cozidos\n• 1 banana\n\nALMOÇO (12:30)\n• 150g de arroz integral"
	if got := repo.createdDiet.Content; got != want {
		t.Errorf("content gravado = %q, want %q (texto preservado integralmente)", got, want)
	}
}

func TestChainDietTextContentPersistsOnUpdate(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.diet = &models.Diet{ID: "d-1", Name: "Plano Outubro", NutritionistID: testUID}
	h := newChainMux(repo)

	body := `{"name":"Plano Outubro","content":"JANTAR (19:30)\n• Filé de peixe grelhado\n• Legumes no vapor"}`
	rr := doChainRequest(h, "PUT", "/api/diets/d-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/diets/d-1 code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedDiet == nil {
		t.Fatal("UpdateDiet não foi chamado")
	}
	want := "JANTAR (19:30)\n• Filé de peixe grelhado\n• Legumes no vapor"
	if got := repo.updatedDiet.Content; got != want {
		t.Errorf("content gravado = %q, want %q (texto preservado integralmente)", got, want)
	}
}
func TestChainAdminCreatesWorkoutTemplate(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	body := `{"name":"Treino padrão da academia","exercises":[]}`
	rr := doChainRequest(h, "POST", "/api/workouts", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST /api/workouts (admin) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdWorkout == nil {
		t.Fatal("CreateWorkout não foi chamado")
	}
	if got := repo.createdWorkout.NutritionistID; got != "" {
		t.Errorf("nutritionistId gravado = %q, want \"\" (template admin)", got)
	}
}

// Admin cria DIETA como template sem nutritionistId — antes: 400.
func TestChainAdminCreatesDietTemplate(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	body := `{"name":"Dieta padrão da academia","meals":[]}`
	rr := doChainRequest(h, "POST", "/api/diets", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST /api/diets (admin) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdDiet == nil {
		t.Fatal("CreateDiet não foi chamado")
	}
	if got := repo.createdDiet.NutritionistID; got != "" {
		t.Errorf("nutritionistId gravado = %q, want \"\" (template admin)", got)
	}
}

// Nutricionista edita TREINO ainda não atribuído (biblioteca) e preserva o
// vínculo vazio — antes: 403 (CanAccessStudent com studentId "").
func TestChainNutritionistEditsUnassignedWorkout(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.workout = &models.WorkoutDefine{
		ID:             "w-1",
		StudentID:      "",
		NutritionistID: testUID,
		Name:           "Treino A",
	}
	h := newChainMux(repo)

	body := `{"name":"Treino A editado"}`
	rr := doChainRequest(h, "PUT", "/api/workouts/w-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/workouts/w-1 (biblioteca) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedWorkout == nil {
		t.Fatal("UpdateWorkout não foi chamado")
	}
	if got := repo.updatedWorkout.StudentID; got != "" {
		t.Errorf("studentId gravado = %q, want \"\" (continua biblioteca)", got)
	}
	if got := repo.updatedWorkout.NutritionistID; got != testUID {
		t.Errorf("nutritionistId gravado = %q, want %q", got, testUID)
	}
}

// Nutricionista edita DIETA ainda não atribuída e preserva o vínculo vazio.
func TestChainNutritionistEditsUnassignedDiet(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.diet = &models.Diet{
		ID:             "d-1",
		StudentID:      "",
		NutritionistID: testUID,
		Name:           "Dieta A",
	}
	h := newChainMux(repo)

	body := `{"name":"Dieta A editada"}`
	rr := doChainRequest(h, "PUT", "/api/diets/d-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/diets/d-1 (biblioteca) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedDiet == nil {
		t.Fatal("UpdateDiet não foi chamado")
	}
	if got := repo.updatedDiet.StudentID; got != "" {
		t.Errorf("studentId gravado = %q, want \"\" (continua biblioteca)", got)
	}
	if got := repo.updatedDiet.NutritionistID; got != testUID {
		t.Errorf("nutritionistId gravado = %q, want %q", got, testUID)
	}
}

// ATRIBUIÇÃO: nutricionista atribui dieta existente (biblioteca) ao aluno via
// edição — mecanismo existente (diets.studentId), sem duplicar.
func TestChainNutritionistAssignsLibraryDietToStudent(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.diet = &models.Diet{
		ID:             "d-1",
		StudentID:      "",
		NutritionistID: testUID,
		Name:           "Dieta A",
	}
	repo.studentsByID = map[string]*models.UserProfile{
		"student-1": {ID: "student-1", Role: models.RoleStudent, Status: models.StatusActive, NutritionistID: testUID},
	}
	h := newChainMux(repo)

	body := `{"name":"Dieta A","studentId":"student-1"}`
	rr := doChainRequest(h, "PUT", "/api/diets/d-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/diets/d-1 (atribuir) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedDiet == nil {
		t.Fatal("UpdateDiet não foi chamado")
	}
	if got := repo.updatedDiet.StudentID; got != "student-1" {
		t.Errorf("studentId gravado = %q, want student-1 (atribuição)", got)
	}
	if got := repo.updatedDiet.NutritionistID; got != testUID {
		t.Errorf("nutritionistId gravado = %q, want %q", got, testUID)
	}
}

// ATRIBUIÇÃO: nutricionista atribui treino existente (biblioteca) ao aluno.
func TestChainNutritionistAssignsLibraryWorkoutToStudent(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.workout = &models.WorkoutDefine{
		ID:             "w-1",
		StudentID:      "",
		NutritionistID: testUID,
		Name:           "Treino A",
	}
	repo.studentsByID = map[string]*models.UserProfile{
		"student-1": {ID: "student-1", Role: models.RoleStudent, Status: models.StatusActive, NutritionistID: testUID},
	}
	h := newChainMux(repo)

	body := `{"name":"Treino A","studentId":"student-1"}`
	rr := doChainRequest(h, "PUT", "/api/workouts/w-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/workouts/w-1 (atribuir) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedWorkout == nil {
		t.Fatal("UpdateWorkout não foi chamado")
	}
	if got := repo.updatedWorkout.StudentID; got != "student-1" {
		t.Errorf("studentId gravado = %q, want student-1 (atribuição)", got)
	}
}

// Segurança: aluno NÃO enxerga dieta de biblioteca (sem studentId) — não é
// dele nem o vínculo é seu.
func TestChainStudentCannotReadUnassignedDiet(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive, []models.Feature{models.FeatureDiet}))
	repo.diet = &models.Diet{
		ID:             "d-1",
		StudentID:      "",
		NutritionistID: "nutri-1",
		Name:           "Dieta da biblioteca",
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/diets/d-1", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("GET /api/diets/d-1 (aluno, biblioteca) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

// Segurança: aluno NÃO enxerga treino de biblioteca.
func TestChainStudentCannotReadUnassignedWorkout(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive, nil))
	repo.workout = &models.WorkoutDefine{
		ID:             "w-1",
		StudentID:      "",
		NutritionistID: "nutri-1",
		Name:           "Treino da biblioteca",
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/workouts/w-1", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("GET /api/workouts/w-1 (aluno, biblioteca) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

// O nutricionista dono acessa normalmente a própria dieta de biblioteca.
func TestChainNutritionistReadsOwnUnassignedDiet(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.diet = &models.Diet{
		ID:             "d-1",
		StudentID:      "",
		NutritionistID: testUID,
		Name:           "Dieta da biblioteca",
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/diets/d-1", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/diets/d-1 (nutri, biblioteca) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
}

// Segurança: aluno não cria dieta nem treino (Allow só libera nutri/admin).
func TestChainStudentCannotCreateDietOrWorkout(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive, []models.Feature{models.FeatureDiet}))
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/diets", `{"name":"X","meals":[]}`, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("POST /api/diets (aluno) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
	rr = doChainRequest(h, "POST", "/api/workouts", `{"name":"X","exercises":[]}`, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("POST /api/workouts (aluno) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

// ── FEED (item 3.5: transações no feed) ──
//
// Os handlers de curtir/comentar/remover agora usam UpdatePostTx (leitura +
// escrita DENTRO da transação). Estes testes provam que os contratos HTTP
// continuam os mesmos e que a mutação observada no fake é a esperada.

// feedRepo monta um chainFakeRepo com um post + perfil do aluno autor.
func feedRepo(authorID string) *chainFakeRepo {
	repo := baseRepo(studentProfile(models.StatusActive, []models.Feature{models.FeatureCommunity}))
	repo.posts = map[string]*models.Post{
		"post-1": {
			ID:       "post-1",
			UserID:   authorID,
			UserName: "Autor",
			Type:     models.PostText,
			Text:     "Olá",
			Likes:    map[string]bool{},
			Comments: []*models.PostComment{},
		},
	}
	return repo
}

func TestChainToggleLikeOnPost(t *testing.T) {
	repo := feedRepo("outro-autor")
	h := newChainMux(repo)

	// 1ª curtida: liked=true, likeCount=1.
	rr := doChainRequest(h, "POST", "/api/posts/post-1/like", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("like code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"liked":true`) || !strings.Contains(rr.Body.String(), `"likeCount":1`) {
		t.Fatalf("like body = %s, want liked:true likeCount:1", rr.Body.String())
	}

	// 2ª curtida: descurte (liked=false, likeCount=0).
	rr = doChainRequest(h, "POST", "/api/posts/post-1/like", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("unlike code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"liked":false`) || !strings.Contains(rr.Body.String(), `"likeCount":0`) {
		t.Fatalf("unlike body = %s, want liked:false likeCount:0", rr.Body.String())
	}
}

func TestChainToggleLikePostNotFound(t *testing.T) {
	repo := feedRepo("outro-autor")
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/posts/nao-existe/like", "", "token-valido")
	if rr.Code != http.StatusNotFound {
		t.Fatalf("like em post inexistente code = %d, want 404 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainAddCommentOnPost(t *testing.T) {
	repo := feedRepo("outro-autor")
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/posts/post-1/comments", `{"text":"bom treino"}`, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("comment code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"text":"bom treino"`) {
		t.Fatalf("comment body = %s, want text salvo", rr.Body.String())
	}
	// O post em memória deve ter o comentário.
	post := repo.posts["post-1"]
	if len(post.Comments) != 1 {
		t.Fatalf("comments len = %d, want 1", len(post.Comments))
	}
}

func TestChainAddCommentEmptyTextRejected(t *testing.T) {
	repo := feedRepo("outro-autor")
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/posts/post-1/comments", `{"text":"   "}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("comment vazio code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
}

// ── Achado 3 (pre-f13): limite de tamanho de entrada ──

func TestChainAddCommentTooLongRejected(t *testing.T) {
	repo := feedRepo("outro-autor")
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/posts/post-1/comments", `{"text":"`+strings.Repeat("a", service.MaxCommentText+1)+`"}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("comentario longo code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainCreatePostTooLongRejected(t *testing.T) {
	repo := feedRepo("outro-autor")
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/posts", `{"text":"`+strings.Repeat("a", service.MaxPostText+1)+`"}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("post longo code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
}

// Duplicar treino com NewName acima do limite não pode burlar a validação de
// nome (mesma classe do achado 3 — o nome vai para o nome do treino no Firestore).
func TestChainDuplicateWorkoutTooLongRejected(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.workout = &models.WorkoutDefine{
		ID:             "w-1",
		StudentID:      "student-1",
		NutritionistID: testUID,
		Name:           "Treino A",
	}
	repo.studentsByID = map[string]*models.UserProfile{
		"student-1": {ID: "student-1", Role: models.RoleStudent, Status: models.StatusActive, NutritionistID: testUID},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/workouts/w-1/duplicate", `{"newName":"`+strings.Repeat("a", service.MaxNameLength+1)+`"}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("duplicar treino com nome longo code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainDuplicateDietTooLongRejected(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.diet = &models.Diet{
		ID:             "d-1",
		StudentID:      "student-1",
		NutritionistID: testUID,
		Name:           "Dieta A",
	}
	repo.studentsByID = map[string]*models.UserProfile{
		"student-1": {ID: "student-1", Role: models.RoleStudent, Status: models.StatusActive, NutritionistID: testUID},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/diets/d-1/duplicate", `{"newName":"`+strings.Repeat("a", service.MaxNameLength+1)+`"}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("duplicar dieta com nome longo code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
}

// Nutricionista editando aluno não pode gravar nome/bio acima do limite — mesma
// regra do PUT /api/me (nome e bio são campos de perfil exibidos na UI).
func TestChainUpdateStudentTooLongRejected(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.studentsByID = map[string]*models.UserProfile{
		"student-1": {
			ID:             "student-1",
			Name:           "Aluno 1",
			Role:           models.RoleStudent,
			Status:         models.StatusActive,
			NutritionistID: testUID,
		},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "PUT", "/api/students/student-1", `{"name":"`+strings.Repeat("a", service.MaxNameLength+1)+`","status":"active"}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("editar aluno com nome longo code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
}

// Autor apaga o próprio comentário: remoção real (sem soft delete).
func TestChainDeleteOwnComment(t *testing.T) {
	repo := feedRepo("outro-autor")
	repo.posts["post-1"].Comments = []*models.PostComment{{ID: "c1", UserID: testUID, Text: "meu comentario"}}
	h := newChainMux(repo)

	rr := doChainRequest(h, "DELETE", "/api/posts/post-1/comments/c1", "", "token-valido")
	if rr.Code != http.StatusNoContent {
		t.Fatalf("DELETE comentário próprio code = %d, want 204 (body: %s)", rr.Code, rr.Body.String())
	}
	if len(repo.posts["post-1"].Comments) != 0 {
		t.Fatalf("comentário do autor não foi removido de vez: %#v", repo.posts["post-1"].Comments)
	}
}

// Aluno NÃO pode apagar comentário alheio (não é moderador).
func TestChainStudentCannotDeleteOthersComment(t *testing.T) {
	repo := feedRepo("outro-autor")
	repo.posts["post-1"].Comments = []*models.PostComment{{ID: "c1", UserID: "outro-aluno", Text: "comentario alheio"}}
	h := newChainMux(repo)

	rr := doChainRequest(h, "DELETE", "/api/posts/post-1/comments/c1", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("DELETE comentário alheio (aluno) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

// Moderador (nutritionist) apaga comentário alheio: soft delete com auditoria.
func TestChainNutritionistSoftDeletesOthersComment(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.posts = map[string]*models.Post{
		"post-1": {
			ID:    "post-1",
			UserID: "outro-autor",
			Type:  models.PostText,
			Text:  "Olá",
			Likes: map[string]bool{},
			Comments: []*models.PostComment{
				{ID: "c1", UserID: "aluno-x", Text: "comentario alheio"},
			},
		},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "DELETE", "/api/posts/post-1/comments/c1", "", "token-valido")
	if rr.Code != http.StatusNoContent {
		t.Fatalf("DELETE comentário (nutri moderador) code = %d, want 204 (body: %s)", rr.Code, rr.Body.String())
	}
	c := repo.posts["post-1"].Comments[0]
	if !c.Deleted || c.ModeratedBy != testUID {
		t.Fatalf("soft delete não registrado: %+v", c)
	}
}

// Autor apaga o próprio post: remoção real do documento.
func TestChainAuthorDeletesOwnPost(t *testing.T) {
	repo := feedRepo(testUID)
	h := newChainMux(repo)

	rr := doChainRequest(h, "DELETE", "/api/posts/post-1", "", "token-valido")
	if rr.Code != http.StatusNoContent {
		t.Fatalf("DELETE post próprio code = %d, want 204 (body: %s)", rr.Code, rr.Body.String())
	}
	if _, ok := repo.posts["post-1"]; ok {
		t.Fatal("post do autor não foi removido de vez")
	}
}

// Moderador apaga post alheio: soft delete com auditoria.
func TestChainNutritionistSoftDeletesPost(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.posts = map[string]*models.Post{
		"post-1": {ID: "post-1", UserID: "outro-autor", Type: models.PostText, Text: "Olá", Likes: map[string]bool{}},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "DELETE", "/api/posts/post-1", "", "token-valido")
	if rr.Code != http.StatusNoContent {
		t.Fatalf("DELETE post (nutri moderador) code = %d, want 204 (body: %s)", rr.Code, rr.Body.String())
	}
	p := repo.posts["post-1"]
	if !p.Deleted || p.ModeratedBy != testUID {
		t.Fatalf("soft delete do post não registrado: %+v", p)
	}
}

// Aluno NÃO pode apagar post alheio.
func TestChainStudentCannotDeleteOthersPost(t *testing.T) {
	repo := feedRepo("outro-autor")
	h := newChainMux(repo)

	rr := doChainRequest(h, "DELETE", "/api/posts/post-1", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("DELETE post alheio (aluno) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}
