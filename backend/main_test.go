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
func newChainMux(repo *chainFakeRepo) http.Handler {
	return newChainMuxWithVerifier(repo, &fakeVerifier{uid: testUID})
}

func newChainMuxWithVerifier(repo *chainFakeRepo, ver *fakeVerifier) http.Handler {
	a := middleware.NewAuth(ver, repo)
	h := handlers.New(service.New(repo), repo, nil)
	mux := http.NewServeMux()
	registerRoutes(mux, h, a)
	return mux
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
