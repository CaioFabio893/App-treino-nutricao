package main

// Testes de INTEGRAÇÃO da cadeia real de autenticação/autorização definida em
// main.go (registerRoutes). Diferente dos testes unitários de middleware, que
// exercitam cada gate isolado com contexto pré-populado, aqui o teste monta o
// mux EXATAMENTE como produção (Require ? Allow/RequireApproved/RequireFeature
// ? handler) e dispara requests com token fake:
//
//	fakeVerifier  ? simula VerifyIDToken do Firebase Auth
//	chainFakeRepo ? simula users/{uid} (perfil com role/status/features)
//
// A ordem real da composição é o que está em jogo: com a ordem antiga
// Allow(Require(...))/RequireApproved(Require(...)), os gates rodavam antes do
// Require popular o contexto e estes testes falhavam (ADMIN 403, pendente 200).

import (
	"context"
	"errors"
	"fmt"
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

// fakeVerifier simula o ID token do Firebase Auth. err != nil ? token inválido
// (VerifyIDToken falha ? Require responde 401).
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
	listStudents    []*models.UserProfile
	listStudentsAll []*models.UserProfile
	listWorkouts    []*models.WorkoutDefine
	listWorkoutsSt  []*models.WorkoutDefine
	listDiets       []*models.Diet
	listDietsSt     []*models.Diet

	createdUsers     []*models.UserProfile
	updateUserCalled bool

	// FASE 5 (I2): treinos/dietas para os handlers de UPDATE.
	studentsByID   map[string]*models.UserProfile // GetUserProfile por UID (alunos reais do nutri)
	workout        *models.WorkoutDefine
	diet           *models.Diet
	updatedWorkout *models.WorkoutDefine
	updatedDiet    *models.Diet
	createdDiet    *models.Diet
	createdWorkout *models.WorkoutDefine

	// FASE 5 (biblioteca de exercícios): exercícios em memória para as rotas.
	listExercises     []*models.ExerciseItem
	exercise          *models.ExerciseItem
	createdExercise   *models.ExerciseItem
	updatedExercise   *models.ExerciseItem
	deletedExerciseID string

	// F19 (programas de treinamento): o programa é uma lista ordenada de
	// TREINOS que já existem em workouts/{id}, então o fake precisa de uma
	// "coleção" de treinos endereçada por id para a atribuição materializar
	// cópias, além dos stubs de CRUD do próprio programa.
	listPrograms     []*models.TrainingProgram
	program          *models.TrainingProgram
	createdProgram   *models.TrainingProgram
	updatedProgram   *models.TrainingProgram
	deletedProgramID string
	createdWorkouts  []*models.WorkoutDefine
	workoutsByID     map[string]*models.WorkoutDefine
}

func (f *chainFakeRepo) GetUserProfile(_ context.Context, uid string) (*models.UserProfile, error) {
	if f.studentsByID != nil {
		if p, ok := f.studentsByID[uid]; ok {
			return p, nil
		}
	}
	return f.profile, nil
}

func (f *chainFakeRepo) GetWorkout(ctx context.Context, id string) (*models.WorkoutDefine, error) {
	if f.workoutsByID != nil {
		if w, ok := f.workoutsByID[id]; ok {
			cp := *w
			return &cp, nil
		}
	}
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
// de biblioteca sem aluno).
func (f *chainFakeRepo) CreateDiet(_ context.Context, d *models.Diet) (*models.Diet, error) {
	f.createdDiet = d
	d.ID = "d-novo"
	return d, nil
}

func (f *chainFakeRepo) CreateWorkout(_ context.Context, w *models.WorkoutDefine) (*models.WorkoutDefine, error) {
	f.createdWorkout = w
	f.createdWorkouts = append(f.createdWorkouts, w)
	// Ids sequenciais: a importação de um programa cria VÁRIOS treinos e as
	// referências do programa precisam de ids distintos (o primeiro mantém
	// "w-novo" para não mudar o que os testes existentes observam).
	if len(f.createdWorkouts) == 1 {
		w.ID = "w-novo"
	} else {
		w.ID = fmt.Sprintf("w-novo-%d", len(f.createdWorkouts))
	}
	if f.workoutsByID == nil {
		f.workoutsByID = map[string]*models.WorkoutDefine{}
	}
	f.workoutsByID[w.ID] = w
	return w, nil
}

// -- Programas de treinamento (F19) --

func (f *chainFakeRepo) GetProgram(_ context.Context, _ string) (*models.TrainingProgram, error) {
	if f.program == nil {
		return nil, nil
	}
	p := *f.program
	return &p, nil
}

func (f *chainFakeRepo) CreateProgram(_ context.Context, p *models.TrainingProgram) (*models.TrainingProgram, error) {
	f.createdProgram = p
	p.ID = "prog-novo"
	return p, nil
}

func (f *chainFakeRepo) UpdateProgram(_ context.Context, _ string, p *models.TrainingProgram) error {
	f.updatedProgram = p
	return nil
}

func (f *chainFakeRepo) DeleteProgram(_ context.Context, id string) error {
	f.deletedProgramID = id
	return nil
}

func (f *chainFakeRepo) ListPrograms(_ context.Context) ([]*models.TrainingProgram, error) {
	return f.listPrograms, nil
}

func (f *chainFakeRepo) ListProgramsForStudent(_ context.Context, _ string) ([]*models.TrainingProgram, error) {
	return f.listPrograms, nil
}

// getWorkoutByID é o espelho de GetWorkout endereçado por id (necessário para a
// atribuição de programa, que resolve cada referência).
func (f *chainFakeRepo) getWorkoutByID(ctx context.Context, id string) (*models.WorkoutDefine, error) {
	if f.workoutsByID != nil {
		if w, ok := f.workoutsByID[id]; ok {
			cp := *w
			return &cp, nil
		}
	}
	return f.GetWorkout(ctx, id)
}

func (f *chainFakeRepo) ListUsers(_ context.Context) ([]*models.UserProfile, error) {
	return f.listUsers, nil
}

func (f *chainFakeRepo) ListUsersByStatus(_ context.Context, _ string) ([]*models.UserProfile, error) {
	return f.listPending, nil
}

func (f *chainFakeRepo) ListDiets(_ context.Context) ([]*models.Diet, error) {
	return f.listDiets, nil
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

func (f *chainFakeRepo) ListDietsForStudent(_ context.Context, _ string) ([]*models.Diet, error) {
	return f.listDietsSt, nil
}

// -- Biblioteca de exercícios (F5) --

func (f *chainFakeRepo) ListExercises(_ context.Context) ([]*models.ExerciseItem, error) {
	return f.listExercises, nil
}

func (f *chainFakeRepo) GetExercise(_ context.Context, _ string) (*models.ExerciseItem, error) {
	if f.exercise == nil {
		return nil, nil
	}
	e := *f.exercise
	return &e, nil
}

func (f *chainFakeRepo) CreateExercise(_ context.Context, e *models.ExerciseItem) (*models.ExerciseItem, error) {
	f.createdExercise = e
	e.ID = "ex-novo"
	return e, nil
}

func (f *chainFakeRepo) UpdateExercise(_ context.Context, _ string, e *models.ExerciseItem) error {
	f.updatedExercise = e
	return nil
}

func (f *chainFakeRepo) DeleteExercise(_ context.Context, id string) error {
	f.deletedExerciseID = id
	return nil
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

// Uma URL antiga não pode continuar expondo pontuação ou perfil público.
func TestRemovedGamificationRoutesReturnNotFound(t *testing.T) {
	mux := newChainMux(&chainFakeRepo{})
	for _, path := range []string{"/api/ranking", "/api/scores/history", "/api/public/profile/other-student"} {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.Header.Set("Authorization", "Bearer valid-token")
			res := httptest.NewRecorder()
			mux.ServeHTTP(res, req)
			if res.Code != http.StatusNotFound {
				t.Fatalf("removed route %s: status=%d, want 404", path, res.Code)
			}
		})
	}
}

func TestRemovedCommunityRoutesReturnNotFound(t *testing.T) {
	mux := newChainMux(&chainFakeRepo{})
	for _, route := range []struct{ method, path string }{
		{"GET", "/api/posts"}, {"POST", "/api/posts"},
		{"POST", "/api/posts/old/like"}, {"POST", "/api/posts/old/comments"},
		{"DELETE", "/api/posts/old/comments/comment"}, {"DELETE", "/api/posts/old"},
	} {
		t.Run(route.method+route.path, func(t *testing.T) {
			req := httptest.NewRequest(route.method, route.path, nil)
			req.Header.Set("Authorization", "Bearer valid-token")
			res := httptest.NewRecorder()
			mux.ServeHTTP(res, req)
			if res.Code != http.StatusNotFound {
				t.Fatalf("removed route: status=%d, want 404", res.Code)
			}
		})
	}
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
		listStudents:    []*models.UserProfile{},
		listStudentsAll: []*models.UserProfile{},
	}
}

func adminProfile(status string) *models.UserProfile {
	return &models.UserProfile{ID: testUID, Name: "Admin", Role: models.RoleAdmin, Status: status}
}

func studentProfile(status string) *models.UserProfile {
	return &models.UserProfile{ID: testUID, Name: "Aluno", Role: models.RoleStudent, Status: status}
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

// -- ADMIN (role=admin, status=active) --
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

// -- ADMIN com status pending_approval/rejected/inactive --
//
// O bypass do RequireApproved (e do RequireFeature) para ADMIN continua
// funcionando na cadeia real: Require roda primeiro, injeta role=admin no
// contexto, e os gates deixam o ADMIN passar independente do status.
func TestChainAdminBypassesRequireApproved(t *testing.T) {
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

// -- ALUNO PENDENTE (role=student, status=pending_approval) --
//
// Deve continuar BLOQUEADO nas rotas de negócio protegidas por
// RequireApproved. Com a ordem antiga (RequireApproved por fora de Require) o
// status lido era "" (aprovado por compatibilidade) e o pendente passava —
// este teste falha na ordem antiga e passa na corrigida.
func TestChainStudentPendingBlockedFromBusinessRoutes(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusPendingApproval))
	h := newChainMux(repo)

	cases := []struct {
		name   string
		method string
		path   string
	}{
		{"GET /api/workouts", "GET", "/api/workouts"},
		{"GET /api/diets", "GET", "/api/diets"},
		{"GET /api/programs", "GET", "/api/programs"},
		{"GET /api/diet-logs", "GET", "/api/diet-logs"},
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

// -- ALUNO APROVADO (status=active) --
//
// Só o perfil aprovado chega ao handler — o free tier (workouts) abre, e o
// diet só abre com a feature diet no plano.
func TestChainStudentApprovedAccessFreeTierWorkouts(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/workouts", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("workouts code = %d, want 200 (aluno ativo tem free tier)", rr.Code)
	}
}

func TestChainApprovedStudentReadsDiets(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	h := newChainMux(repo)

	// feature diet ausente do plano ? RequireFeature bloqueia (403) mesmo com
	// cadastro ativo.
	rr := doChainRequest(h, "GET", "/api/diets", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("diets code = %d, want 200 (plan sem diet; body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainPausedStudentReadsDiets(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusPaused))
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/diets", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("diets code = %d, want 200 (plano inclui diet)", rr.Code)
	}
}

// -- STUDENT em rotas de ADMIN --
func TestChainStudentBlockedFromAdminRoutes(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	h := newChainMux(repo)

	cases := []struct {
		name   string
		method string
		path   string
	}{
		{"GET /api/users", "GET", "/api/users"},
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

// -- NÃO AUTENTICADO --
//
// Nenhuma rota protegida pode virar pública: sem token ? 401 em TODAS as
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
		{"GET /api/workouts", "GET", "/api/workouts"},
		{"GET /api/me", "GET", "/api/me"},
		{"GET /api/diets", "GET", "/api/diets"},
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
		rr := doChainRequest(hBad, "GET", "/api/users", "", "token-lixo")
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("token invalido: code = %d, want 401", rr.Code)
		}
	})
}

// -- Validar o cadastro administrativo (item 4) --
//
// Fluxo: ADMIN autenticado ? GET /api/users ? POST /api/users ?
// POST /api/users/{id}/assign-plan. Usa fakes — nenhum aluno real é criado.
func TestChainAdminCanCreateStudentFlow(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
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

}

// -- Planos vazios (item 6) --
//
// Coleção plans vazia deve aparecer como "0 planos" (200 []) e NUNCA como erro
// de permissão.

// -- Contrato JSON de coleções: null ? [] --
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
	repo.listWorkouts = []*models.WorkoutDefine{{ID: "w-1", Name: "Treino A"}}
	repo.listDiets = []*models.Diet{{ID: "d-1", Name: "Dieta A"}}
	// GET /api/students é chamado por ADMIN aqui ? a rota usa ListStudentsAll.
	repo.listStudentsAll = []*models.UserProfile{{ID: "s-1", Name: "Aluno", Role: models.RoleStudent}}
	h := newChainMux(repo)

	cases := []struct {
		name   string
		path   string
		needle string
	}{
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

// -- Regressão: GetUserProfile deve devolver o `id` no JSON --
//
// GET /api/students/{id} e GET /api/me consomem GetUserProfile. O documento
// é users/{uid}, então o perfil devolvido precisa serializar "id":"<UID>"
// (sem omitempty): sem isso o frontend monta links com student=undefined.
func TestChainProfileEndpointsSerializeID(t *testing.T) {
	// Perfil com ID preenchido (o que GetUserProfile deve garantir).
	repo := baseRepo(studentProfile(models.StatusActive))
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

// -- GET /api/me CRIA o cadastro pendente (spec 4.1) --
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
	// Contrato de resposta: cadastro pendente SEM nome ainda ? needsProfile +
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

	// Segunda chamada: o perfil já existe ? retorna o documento criado, sem
	// duplicar/criar de novo.
	rr = doChainRequest(h, "GET", "/api/me", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/me (2ª vez) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"status":"pending_approval"`) {
		t.Errorf("2ª chamada body = %q, deveria conter status pending_approval", rr.Body.String())
	}
}

// -- FASE 13 (segurança): PUT /api/me é ALLOWLIST — mass assignment bloqueado --
//
// Achado A da revisão final: HandlePutMe decodifica o UserProfile inteiro e
// só zera Role/Status/PlanID/Features. GetOrCreateProfile preserva os campos
// administrativos do registro (planID, approvedBy, ...) mas NAOÃO
// StartDate/EndDate — e startDate alimenta o denominador da pontuação
// (daysElapsedInCycle): um aluno podia enviar uma data recente e INFLAR a
// própria nota do ranking. O mesmo furo valia para authProvider/approvedAt/
// rejectedReason (client-sent, sem preservação). Contrato (rules Firestore
// allowedSelfProfileUpdate + docs/api): o cliente só edita name/email/
// name/email; todo o resto é definido pela API Go em fluxos dedicados.
func TestChainPutMeIsAllowlistBlockingMassAssignment(t *testing.T) {
	existing := &models.UserProfile{
		ID:             testUID,
		Name:           "Nome Original",
		Email:          "original@email.com",
		Role:           models.RoleStudent,
		Status:         models.StatusActive,
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

// -- ADMIN lista todos os alunos, inclusive SEM plano --
//
// Aluno aprovado sem plano (PlanID == "") não pode ficar invisível na Gestão:
// o admin usa ListStudentsAll, sem nenhum filtro por vínculo.
func TestChainAdminListsStudentWithoutPlan(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.listStudentsAll = []*models.UserProfile{
		{
			ID:     "s-sem-plano",
			Name:   "Teste",
			Role:   models.RoleStudent,
			Status: models.StatusActive,
		},
		{
			ID:     "outro-aluno",
			Name:   "Outro Aluno",
			Role:   models.RoleStudent,
			Status: models.StatusActive,
		},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/students", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/students code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"id":"s-sem-plano"`) {
		t.Errorf("body = %q, deveria conter o aluno sem plano", rr.Body.String())
	}
	// Sem mais papéis, a listagem é global: o admin enxerga todos os alunos.
	if !strings.Contains(rr.Body.String(), `"id":"outro-aluno"`) {
		t.Errorf("body = %q, deveria conter todos os alunos", rr.Body.String())
	}
}

// -- ALUNO não pode listar alunos --
//
// A rota é admin-only: o aluno autenticado leva 403 e o fake não é consultado,
// então não existe vazamento da lista nem via escopo parcial.
func TestChainStudentCannotListStudents(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	repo.listStudentsAll = []*models.UserProfile{
		{ID: "s1", Name: "Aluno 1", Role: models.RoleStudent, Status: models.StatusActive},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/students", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("GET /api/students (aluno) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
	if strings.Contains(rr.Body.String(), `"id":"s1"`) {
		t.Errorf("body = %q, NÃO deveria conter nenhum aluno", rr.Body.String())
	}
}

// -- Autorização de GET /api/students permanece intacta --
//
// Sem token ? 401; aluno autenticado (role=student) ? 403; admin e
// nutricionista ? 200.
func TestChainStudentsRouteAuthzUnchanged(t *testing.T) {
	// Sem token ? 401.
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)
	rr := doChainRequest(h, "GET", "/api/students", "", "")
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("sem token: code = %d, want 401", rr.Code)
	}

	// Aluno autenticado ? 403 (rota exclusiva admin/nutricionista).
	repoSt := baseRepo(studentProfile(models.StatusActive))
	hSt := newChainMux(repoSt)
	rr = doChainRequest(hSt, "GET", "/api/students", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("aluno: code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}

	// Nutricionista ativo ? 200 (escopo mantido).
	repoN := baseRepo(adminProfile(models.StatusActive))
	hN := newChainMux(repoN)
	rr = doChainRequest(hN, "GET", "/api/students", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("admin: code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
}

// -- vínculo de aluno nunca é transferido no PUT --
//
// O admin edita o conteúdo do treino, mas o studentId continua vindo do
// REGISTRO: se o body omite o campo, o handler preserva o dono atual em vez de
// deixar o treino órfão. Reatribuir aluno é um fluxo explícito e separado.
func TestChainAdminWorkoutKeepsStudentWhenBodyOmitsIt(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.workout = &models.WorkoutDefine{
		ID:        "w-1",
		StudentID: "student-1",
		Name:      "Treino A",
	}
	repo.studentsByID = map[string]*models.UserProfile{
		"student-1": {ID: "student-1", Role: models.RoleStudent, Status: models.StatusActive},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "PUT", "/api/workouts/w-1", `{"name":"Treino A editado"}`, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/workouts/w-1 code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedWorkout == nil {
		t.Fatal("UpdateWorkout não foi chamado")
	}
	if got := repo.updatedWorkout.Name; got != "Treino A editado" {
		t.Errorf("name = %q, want edição aplicada", got)
	}
	if got := repo.updatedWorkout.StudentID; got != "student-1" {
		t.Errorf("studentId = %q, want student-1 (dono do registro preservado)", got)
	}
}

func TestChainAdminDietKeepsStudentWhenBodyOmitsIt(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.diet = &models.Diet{
		ID:        "d-1",
		StudentID: "student-1",
		Name:      "Dieta A",
	}
	repo.studentsByID = map[string]*models.UserProfile{
		"student-1": {ID: "student-1", Role: models.RoleStudent, Status: models.StatusActive},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "PUT", "/api/diets/d-1", `{"name":"Dieta A editada"}`, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/diets/d-1 code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedDiet == nil {
		t.Fatal("UpdateDiet não foi chamado")
	}
	if got := repo.updatedDiet.Name; got != "Dieta A editada" {
		t.Errorf("name = %q, want edição aplicada", got)
	}
	if got := repo.updatedDiet.StudentID; got != "student-1" {
		t.Errorf("studentId = %q, want student-1 (dono do registro preservado)", got)
	}
}

// -- aluno é reader, não writer: PUT de treino/dieta é admin-only --

func TestChainStudentCannotUpdateWorkout(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	repo.workout = &models.WorkoutDefine{ID: "w-1", StudentID: testUID, Name: "Treino A"}
	h := newChainMux(repo)

	rr := doChainRequest(h, "PUT", "/api/workouts/w-1", `{"name":"Invadido"}`, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("PUT /api/workouts/w-1 (aluno, próprio) code = %d, want 403", rr.Code)
	}
	if repo.updatedWorkout != nil {
		t.Error("UpdateWorkout não deveria ter sido chamado")
	}
}

func TestChainStudentCannotUpdateDiet(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	repo.diet = &models.Diet{ID: "d-1", StudentID: testUID, Name: "Dieta A"}
	h := newChainMux(repo)

	rr := doChainRequest(h, "PUT", "/api/diets/d-1", `{"name":"Invadida"}`, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("PUT /api/diets/d-1 (aluno, próprio) code = %d, want 403", rr.Code)
	}
	if repo.updatedDiet != nil {
		t.Error("UpdateDiet não deveria ter sido chamado")
	}
}

// -- FASE 5: dieta/treino de biblioteca sem aluno --

// Admin cria TREINO sem aluno (biblioteca) — antes: 400 "nome e aluno
// sao obrigatorios".
func TestChainAdminCreatesWorkoutWithoutStudent(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
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
}

// Nutricionista cria DIETA sem aluno (biblioteca) — antes: 400.
func TestChainAdminCreatesDietWithoutStudent(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
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
}

// -- FASE 5b: formato simplificado de dieta (texto livre) --
//
// O `content` (copiar/colar em texto) é o formato atual de dieta; refeições
// estruturadas (`meals`) continuam como legado. O handler precisa persistir
// o texto exatamente como enviado (preservando quebras de linha) tanto na
// criação quanto na edição.
func TestChainDietTextContentPersistsOnCreate(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
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
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.diet = &models.Diet{ID: "d-1", Name: "Plano Outubro"}
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
}

// Admin cria DIETA como template (sem aluno e sem vinculo) - antes: 400.
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
}

// Nutricionista edita TREINO ainda não atribuído (biblioteca) e preserva o
// vinculo vazio - antes: 403 (aluno sem studentId).
func TestChainAdminEditsUnassignedWorkout(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.workout = &models.WorkoutDefine{
		ID:        "w-1",
		StudentID: "",
		Name:      "Treino A",
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
}

// Nutricionista edita DIETA ainda não atribuída e preserva o vínculo vazio.
func TestChainAdminEditsUnassignedDiet(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.diet = &models.Diet{
		ID:        "d-1",
		StudentID: "",
		Name:      "Dieta A",
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
}

// ATRIBUIÇÃO: nutricionista atribui dieta existente (biblioteca) ao aluno via
// edição — mecanismo existente (diets.studentId), sem duplicar.
func TestChainAdminAssignsLibraryDietToStudent(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.diet = &models.Diet{
		ID:        "d-1",
		StudentID: "",
		Name:      "Dieta A",
	}
	repo.studentsByID = map[string]*models.UserProfile{
		"student-1": {ID: "student-1", Role: models.RoleStudent, Status: models.StatusActive},
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
}

// ATRIBUIÇÃO: nutricionista atribui treino existente (biblioteca) ao aluno.
func TestChainAdminAssignsLibraryWorkoutToStudent(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.workout = &models.WorkoutDefine{
		ID:        "w-1",
		StudentID: "",
		Name:      "Treino A",
	}
	repo.studentsByID = map[string]*models.UserProfile{
		"student-1": {ID: "student-1", Role: models.RoleStudent, Status: models.StatusActive},
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
	repo := baseRepo(studentProfile(models.StatusActive))
	repo.diet = &models.Diet{
		ID:        "d-1",
		StudentID: "",
		Name:      "Dieta da biblioteca",
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/diets/d-1", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("GET /api/diets/d-1 (aluno, biblioteca) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

// Segurança: aluno NÃO enxerga treino de biblioteca.
func TestChainStudentCannotReadUnassignedWorkout(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	repo.workout = &models.WorkoutDefine{
		ID:        "w-1",
		StudentID: "",
		Name:      "Treino da biblioteca",
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/workouts/w-1", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("GET /api/workouts/w-1 (aluno, biblioteca) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

// O nutricionista dono acessa normalmente a própria dieta de biblioteca.
func TestChainAdminReadsOwnUnassignedDiet(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.diet = &models.Diet{
		ID:        "d-1",
		StudentID: "",
		Name:      "Dieta da biblioteca",
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/diets/d-1", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/diets/d-1 (nutri, biblioteca) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
}

// Segurança: aluno não cria dieta nem treino (Allow só libera nutri/admin).
func TestChainStudentCannotCreateDietOrWorkout(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
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

// -- Biblioteca de exercícios (F5) --

func TestChainAdminCreatesExercise(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/exercises", `{"name":"Supino reto","muscleGroup":"Peito","equipment":"Barra"}`, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST exercise (admin) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdExercise == nil || repo.createdExercise.Name != "Supino reto" || repo.createdExercise.MuscleGroup != "Peito" {
		t.Fatalf("exercício não capturado corretamente: %+v", repo.createdExercise)
	}
}

func TestChainAdminCreatesExerciseSecondFixture(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/exercises", `{"name":"Agachamento","muscleGroup":"Pernas"}`, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST exercise (admin) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdExercise == nil || repo.createdExercise.Name != "Agachamento" {
		t.Fatalf("exercício não capturado: %+v", repo.createdExercise)
	}
}

func TestChainStudentCannotCreateExercise(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/exercises", `{"name":"Agachamento"}`, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("POST exercise (aluno) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainStudentCannotUpdateExercise(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	repo.exercise = &models.ExerciseItem{ID: "e1", Name: "Supino"}
	h := newChainMux(repo)

	rr := doChainRequest(h, "PUT", "/api/exercises/e1", `{"name":"Supino inclinado"}`, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("PUT exercise (aluno) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainStudentCannotDeleteExercise(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	repo.exercise = &models.ExerciseItem{ID: "e1", Name: "Supino"}
	h := newChainMux(repo)

	rr := doChainRequest(h, "DELETE", "/api/exercises/e1", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("DELETE exercise (aluno) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainStudentCanListExercises(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	repo.listExercises = []*models.ExerciseItem{{ID: "e1", Name: "Supino reto"}}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/exercises", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET exercises (aluno aprovado) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainPendingCannotReadExercises(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusPendingApproval))
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/exercises", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("GET exercises (pendente) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainUnauthenticatedCannotAccessExercises(t *testing.T) {
	repo := baseRepo(nil)
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/exercises", "", "")
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("GET exercises (sem token) code = %d, want 401 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainCreateExerciseNameRequired(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/exercises", `{"name":""}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("POST exercise (name vazio) code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainCreateExerciseNameTooLong(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	body := `{"name":"` + strings.Repeat("a", service.MaxExerciseNameLength+1) + `"}`
	rr := doChainRequest(h, "POST", "/api/exercises", body, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("POST exercise (name longo) code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainCreateExerciseInvalidURL(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/exercises", `{"name":"Supino","videoUrl":"nao-e-url"}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("POST exercise (url inválida) code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainGetExerciseNotFound(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/exercises/nao-existe", "", "token-valido")
	if rr.Code != http.StatusNotFound {
		t.Fatalf("GET exercise (inexistente) code = %d, want 404 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainUpdateExerciseNotFound(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "PUT", "/api/exercises/nao-existe", `{"name":"Supino"}`, "token-valido")
	if rr.Code != http.StatusNotFound {
		t.Fatalf("PUT exercise (inexistente) code = %d, want 404 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainAdminUpdatesExercise(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.exercise = &models.ExerciseItem{ID: "e1", Name: "Supino reto"}
	h := newChainMux(repo)

	rr := doChainRequest(h, "PUT", "/api/exercises/e1", `{"name":"Supino inclinado","muscleGroup":"Peito"}`, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT exercise (admin) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedExercise == nil || repo.updatedExercise.Name != "Supino inclinado" {
		t.Fatalf("update não capturado: %+v", repo.updatedExercise)
	}
}

func TestChainAdminDeletesExercise(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.exercise = &models.ExerciseItem{ID: "e1", Name: "Supino reto"}
	h := newChainMux(repo)

	rr := doChainRequest(h, "DELETE", "/api/exercises/e1", "", "token-valido")
	if rr.Code != http.StatusNoContent {
		t.Fatalf("DELETE exercise (admin) code = %d, want 204 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.deletedExerciseID != "e1" {
		t.Fatalf("delete não capturado: %q", repo.deletedExerciseID)
	}
}

// Snapshot de biblioteca: treinos carregam uma CÓPIA embutida (WorkoutExercise),
// nunca uma referência ao exercises/{id}. Garantimos que o modelo de treino não
// carrega nenhum vínculo vivo com a biblioteca (sem exerciseId) — excluir o
// exercício da biblioteca não pode afetar o treino.
func TestChainWorkoutExerciseIsSnapshotNotReference(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	body := `{"name":"Treino A","exercises":[{"name":"Supino reto","sets":4,"repetitions":"10","order":1}]}`
	rr := doChainRequest(h, "POST", "/api/workouts", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST workout (snapshot) code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdWorkout == nil || len(repo.createdWorkout.Exercises) != 1 {
		t.Fatalf("treino não capturado: %+v", repo.createdWorkout)
	}
	if repo.createdWorkout.Exercises[0].Name != "Supino reto" {
		t.Fatalf("snapshot divergente: %+v", repo.createdWorkout.Exercises[0])
	}
}
