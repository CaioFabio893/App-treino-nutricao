package main

// Testes de INTEGRAÇÃO da cadeia real de rotas (F19 — Programa de Treinamento).
//
// Um programa é uma lista ORDENADA de TREINOS que já existem em workouts/{id}.
// Estes testes cobrem: a matriz de permissão (leitura por papel, escrita restrita
// a nutricionista/admin), a imutabilidade do vínculo (regra nº 2 do CLAUDE.md),
// a importação de markdown (que cria os treinos + o programa num único passo) e
// a atribuição a um aluno (que materializa cópias dos treinos).

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"treino-louise/backend/models"
)

// mdExemplo é um recorte do material de referência real, o suficiente para
// provar que a importação cria 1 programa, N treinos e os exercícios na ordem.
const mdExemplo = `# Programa de Treino — Louise Lima (Ciclo 2)

**Foco: Hipertrofia de Inferiores**

## TREINO A — Pernas (Quadríceps)

| # | Exercício | Séries | Reps | Observação |
|---|---|---:|---:|---|
| 1 | Agachamento Livre com Barra | 4 | 6-8 | Foco em força/carga |
| 2 | Hack Squat | 4 | 10 | Amplitude total |

## TREINO B — Costas/Bíceps

| # | Exercício | Séries | Reps | Observação |
|---|---|---:|---:|---|
| 1 | Puxada Alta Pronad | 4 | 8-10 |  |
| 2 | Remada Curvada com Barra | 4 | 10 |  |

## PRs

- Agachamento Livre com Barra
`

func decodeProgram(t *testing.T, rr *httptest.ResponseRecorder) *models.TrainingProgram {
	t.Helper()
	var p models.TrainingProgram
	if err := json.Unmarshal(rr.Body.Bytes(), &p); err != nil {
		t.Fatalf("decodar resposta: %v (body: %s)", err, rr.Body.String())
	}
	return &p
}

func decodePrograms(t *testing.T, rr *httptest.ResponseRecorder) []*models.TrainingProgram {
	t.Helper()
	var ps []*models.TrainingProgram
	if err := json.Unmarshal(rr.Body.Bytes(), &ps); err != nil {
		t.Fatalf("decodar lista: %v (body: %s)", err, rr.Body.String())
	}
	return ps
}

// ── escrita: quem pode ─────────────────────────────────────────────────────

func TestChainNutritionistCreatesProgramLibrary(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs", `{"name":"Hipertrofia — Iniciante"}`, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST /api/programs code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdProgram == nil {
		t.Fatal("CreateProgram não foi chamado")
	}
	if got := repo.createdProgram.StudentID; got != "" {
		t.Errorf("studentId = %q, want \"\" (programa de biblioteca)", got)
	}
	if got := repo.createdProgram.NutritionistID; got != testUID {
		t.Errorf("nutritionistId = %q, want %q", got, testUID)
	}
}

func TestChainStudentCannotCreateProgram(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive, nil))
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs", `{"name":"Plano"}`, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("POST /api/programs (aluno) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdProgram != nil {
		t.Error("CreateProgram não deveria ter sido chamado")
	}
}

func TestChainPendingUserCannotAccessPrograms(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusPendingApproval))
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/programs", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("GET /api/programs (pendente) code = %d, want 403", rr.Code)
	}
}

func TestChainCreateProgramRequiresName(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs", `{"name":"  "}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainCreateProgramRejectsTooLongName(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs", `{"name":"`+strings.Repeat("x", 500)+`"}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, want 400", rr.Code)
	}
}

// ── leitura ────────────────────────────────────────────────────────────────

func TestChainListProgramsScopedByRole(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.listPrograms = []*models.TrainingProgram{{ID: "p-1", Name: "Louise Lima (Ciclo 2)"}}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/programs", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/programs code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	ps := decodePrograms(t, rr)
	if len(ps) != 1 || ps[0].Name != "Louise Lima (Ciclo 2)" {
		t.Errorf("lista = %+v", ps)
	}
}

func TestChainListProgramsEmptySerializesAsArray(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.listPrograms = []*models.TrainingProgram{}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/programs", "", "token-valido")
	if got := strings.TrimSpace(rr.Body.String()); got != "[]" {
		t.Errorf("body = %q, want [] (nunca null)", got)
	}
}

func TestChainStudentCannotReadOtherStudentProgram(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive, nil))
	repo.program = &models.TrainingProgram{
		ID: "p-1", Name: "Ciclo 2", StudentID: "outro-aluno", NutritionistID: "nutri",
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/programs/p-1", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainNutritionistCannotReadOtherNutritionistProgram(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.program = &models.TrainingProgram{ID: "p-1", Name: "Ciclo 2", NutritionistID: "outro-nutri"}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/programs/p-1", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code = %d, want 403", rr.Code)
	}
}

func TestChainGetProgramNotFound(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.program = nil
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/programs/nao-existe", "", "token-valido")
	if rr.Code != http.StatusNotFound {
		t.Fatalf("code = %d, want 404", rr.Code)
	}
}

// ── vínculo imutável (regra nº 2) ──────────────────────────────────────────

func TestChainNutritionistCannotTransferProgramOwnership(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.program = &models.TrainingProgram{ID: "p-1", Name: "Ciclo 2", NutritionistID: testUID}
	h := newChainMux(repo)

	body := `{"name":"Ciclo 2","nutritionistId":"outro-nutri"}`
	rr := doChainRequest(h, "PUT", "/api/programs/p-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedProgram == nil {
		t.Fatal("UpdateProgram não foi chamado")
	}
	if got := repo.updatedProgram.NutritionistID; got != testUID {
		t.Errorf("nutritionistId gravado = %q, want %q (vínculo do registro, nunca o do body)", got, testUID)
	}
}

func TestChainNutritionistCannotUpdateOtherNutritionistProgram(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.program = &models.TrainingProgram{ID: "p-1", Name: "Ciclo 2", NutritionistID: "outro-nutri"}
	h := newChainMux(repo)

	rr := doChainRequest(h, "PUT", "/api/programs/p-1", `{"name":"Renomeado"}`, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code = %d, want 403", rr.Code)
	}
	if repo.updatedProgram != nil {
		t.Error("UpdateProgram não deveria ter sido chamado")
	}
}

// ── importação de markdown ─────────────────────────────────────────────────

func TestChainImportProgramCreatesWorkoutsAndProgram(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	h := newChainMux(repo)

	body := `{"markdown":` + mustJSON(mdExemplo) + `,"source":"treino.md"}`
	rr := doChainRequest(h, "POST", "/api/programs/import", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST /api/programs/import code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}

	// 2 treinos criados, na ordem original.
	if got := len(repo.createdWorkouts); got != 2 {
		t.Fatalf("treinos criados = %d, want 2", got)
	}
	if got := repo.createdWorkouts[0].Name; got != "Treino A - Pernas (Quadríceps)" {
		t.Errorf("treino 1 = %q, want %q", got, "Treino A - Pernas (Quadríceps)")
	}
	if got := repo.createdWorkouts[0].DayOfWeek; got != "" {
		t.Errorf("treino 1 dayOfWeek = %q, want \"\" (material sem estrutura semanal)", got)
	}
	// Exercícios na ordem, com séries/reps/observação preservados.
	ex := repo.createdWorkouts[0].Exercises
	if len(ex) != 2 {
		t.Fatalf("treino A com %d exercícios, want 2", len(ex))
	}
	if ex[0].Name != "Agachamento Livre com Barra" || ex[0].Sets != 4 || ex[0].Repetitions != "6-8" || ex[0].Notes != "Foco em força/carga" {
		t.Errorf("exercício 1 = %+v", ex[0])
	}
	if ex[1].Order != 2 {
		t.Errorf("exercício 2 order = %d, want 2", ex[1].Order)
	}
	// Carga/descanso não existem na fonte: ficam vazios (nada inventado).
	if ex[0].Weight != "" || ex[0].RestSeconds != 0 {
		t.Errorf("carga/descanso inventados: %+v", ex[0])
	}

	// Programa criado com as referências resolvidas, na ordem.
	if repo.createdProgram == nil {
		t.Fatal("CreateProgram não foi chamado")
	}
	if repo.createdProgram.Name != "Louise Lima (Ciclo 2)" {
		t.Errorf("nome do programa = %q, want %q", repo.createdProgram.Name, "Louise Lima (Ciclo 2)")
	}
	if got := len(repo.createdProgram.Workouts); got != 2 {
		t.Fatalf("referências = %d, want 2", got)
	}
	if repo.createdProgram.Workouts[0].Label != "A" || repo.createdProgram.Workouts[1].Label != "B" {
		t.Errorf("labels = %q/%q, want A/B", repo.createdProgram.Workouts[0].Label, repo.createdProgram.Workouts[1].Label)
	}
	if repo.createdProgram.Workouts[0].WorkoutID != "w-novo" || repo.createdProgram.Workouts[1].WorkoutID != "w-novo-2" {
		t.Errorf("workoutIds = %q/%q, want w-novo/w-novo-2", repo.createdProgram.Workouts[0].WorkoutID, repo.createdProgram.Workouts[1].WorkoutID)
	}
	// PRs preservados nas notas do programa.
	if !strings.Contains(repo.createdProgram.Notes, "## PRs") {
		t.Errorf("notes = %q, quer ver ## PRs", repo.createdProgram.Notes)
	}
	if got := repo.createdProgram.Source; got != "treino.md" {
		t.Errorf("source = %q, want treino.md", got)
	}
}

func TestChainImportProgramRejectsEmptyMarkdown(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs/import", `{"markdown":"   "}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdProgram != nil {
		t.Error("nada deveria ter sido criado")
	}
}

func TestChainImportProgramWithoutWorkoutSectionFails(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	h := newChainMux(repo)

	body := `{"markdown":"# Programa de Treino — Vazio\n\nso texto\n"}`
	rr := doChainRequest(h, "POST", "/api/programs/import", body, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainStudentCannotImportProgram(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive, nil))
	h := newChainMux(repo)

	body := `{"markdown":` + mustJSON(mdExemplo) + `}`
	rr := doChainRequest(h, "POST", "/api/programs/import", body, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code = %d, want 403", rr.Code)
	}
	if len(repo.createdWorkouts) != 0 {
		t.Error("nenhum treino deveria ter sido criado")
	}
}

// ── atribuição a aluno ─────────────────────────────────────────────────────

func TestChainAssignProgramMaterializesWorkoutsForStudent(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.studentsByID = map[string]*models.UserProfile{
		"aluno-1": {ID: "aluno-1", Role: models.RoleStudent, NutritionistID: testUID, Status: models.StatusActive},
	}
	repo.workout = &models.WorkoutDefine{
		ID: "w-1", Name: "Treino A", NutritionistID: testUID,
		Exercises: []*models.WorkoutExercise{{ID: "ex-1", Name: "Agachamento", Sets: 4, Order: 1}},
	}
	repo.program = &models.TrainingProgram{
		ID: "p-1", Name: "Ciclo 2", NutritionistID: testUID,
		Workouts: []*models.ProgramWorkout{{WorkoutID: "w-1", Order: 1, Label: "A"}},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs/p-1/assign", `{"studentId":"aluno-1"}`, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedProgram == nil {
		t.Fatal("UpdateProgram não foi chamado")
	}
	if got := repo.updatedProgram.StudentID; got != "aluno-1" {
		t.Errorf("studentId = %q, want aluno-1", got)
	}
	// Uma cópia do treino foi criada para o aluno.
	if got := len(repo.createdWorkouts); got != 1 {
		t.Fatalf("cópias criadas = %d, want 1", got)
	}
	copied := repo.createdWorkouts[0]
	if copied.StudentID != "aluno-1" {
		t.Errorf("cópia studentId = %q, want aluno-1", copied.StudentID)
	}
	if copied.Name != "Treino A" {
		t.Errorf("cópia preserva o nome do original = %q", copied.Name)
	}
	if len(copied.Exercises) != 1 || copied.Exercises[0].ID != "" {
		t.Errorf("exercícios copiados sem id: %+v", copied.Exercises)
	}
}

func TestChainAssignProgramRequiresStudent(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.program = &models.TrainingProgram{ID: "p-1", NutritionistID: testUID}
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs/p-1/assign", `{"studentId":""}`, "token-valido")
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, want 400", rr.Code)
	}
}

func TestChainAssignProgramToOtherNutritionistStudentForbidden(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.studentsByID = map[string]*models.UserProfile{
		"aluno-outro": {ID: "aluno-outro", Role: models.RoleStudent, NutritionistID: "outro-nutri", Status: models.StatusActive},
	}
	repo.program = &models.TrainingProgram{ID: "p-1", NutritionistID: testUID}
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs/p-1/assign", `{"studentId":"aluno-outro"}`, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainReassignProgramToAnotherStudentConflicts(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.studentsByID = map[string]*models.UserProfile{
		"aluno-2": {ID: "aluno-2", Role: models.RoleStudent, NutritionistID: testUID, Status: models.StatusActive},
	}
	repo.program = &models.TrainingProgram{
		ID: "p-1", Name: "Ciclo 2", NutritionistID: testUID, StudentID: "aluno-1",
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs/p-1/assign", `{"studentId":"aluno-2"}`, "token-valido")
	if rr.Code != http.StatusConflict {
		t.Fatalf("code = %d, want 409 (body: %s)", rr.Code, rr.Body.String())
	}
	if len(repo.createdWorkouts) != 0 {
		t.Error("reatribuição recusada não pode criar cópias de treino")
	}
}

// ── ownership dos TREINOS referenciados (auditoria de segurança) ───────────
//
// O programa só guarda REFERÊNCIAS a `workouts/{id}`. Se nada conferir a posse
// desses treinos, a nutricionista A consegue montar um programa apontando para o
// treino da nutricionista B e, no assign, materializar uma CÓPIA do treino
// alheio (exercícios, nomes, videoUrl) para o aluno dela — exfiltração de
// conteúdo que ela não é dona. HandleDuplicateWorkout já faz essa checagem
// (canAccessResource); o caminho de programa também precisa.

// Preparo: programa de biblioteca do chamador apontando para w-alheio.
func repoWithForeignWorkout() *chainFakeRepo {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.studentsByID = map[string]*models.UserProfile{
		"aluno-1": {ID: "aluno-1", Role: models.RoleStudent, NutritionistID: testUID, Status: models.StatusActive},
	}
	repo.workoutsByID = map[string]*models.WorkoutDefine{
		"w-alheio": {ID: "w-alheio", Name: "Treino da outra", NutritionistID: "outro-nutri", StudentID: "aluno-dela"},
	}
	repo.program = &models.TrainingProgram{
		ID: "p-1", Name: "Ciclo 2", NutritionistID: testUID,
		Workouts: []*models.ProgramWorkout{{WorkoutID: "w-alheio", Order: 1, Label: "A"}},
	}
	return repo
}

func TestChainCreateProgramRejectsForeignWorkout(t *testing.T) {
	repo := repoWithForeignWorkout()
	h := newChainMux(repo)

	body := `{"name":"Plagio","workouts":[{"workoutId":"w-alheio","order":1}]}`
	rr := doChainRequest(h, "POST", "/api/programs", body, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.createdProgram != nil {
		t.Error("CreateProgram não deveria ter sido chamado")
	}
}

func TestChainUpdateProgramRejectsForeignWorkout(t *testing.T) {
	repo := repoWithForeignWorkout()
	h := newChainMux(repo)

	body := `{"name":"Plagio","workouts":[{"workoutId":"w-alheio","order":1}]}`
	rr := doChainRequest(h, "PUT", "/api/programs/p-1", body, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedProgram != nil {
		t.Error("UpdateProgram não deveria ter sido chamado")
	}
}

// O caso que importa: o programa é da chamadora, mas o TREINO referenciado é de
// outra. O assign materializa cópias — sem a checagem, vira exfiltração.
func TestChainAssignProgramRejectsForeignWorkout(t *testing.T) {
	repo := repoWithForeignWorkout()
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs/p-1/assign", `{"studentId":"aluno-1"}`, "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
	if len(repo.createdWorkouts) != 0 {
		t.Error("assign recusado não pode materializar cópia de treino alheio")
	}
}

// Referenciar um treino INEXISTENTE é 404, não 403: a resposta não deve revelar
// se o id existe e pertence a outro nutricionista.
func TestChainAssignProgramMissingWorkoutIs404(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.studentsByID = map[string]*models.UserProfile{
		"aluno-1": {ID: "aluno-1", Role: models.RoleStudent, NutritionistID: testUID, Status: models.StatusActive},
	}
	repo.workoutsByID = map[string]*models.WorkoutDefine{}
	repo.program = &models.TrainingProgram{
		ID: "p-1", Name: "Ciclo 2", NutritionistID: testUID,
		Workouts: []*models.ProgramWorkout{{WorkoutID: "w-nao-existe", Order: 1}},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs/p-1/assign", `{"studentId":"aluno-1"}`, "token-valido")
	if rr.Code != http.StatusNotFound {
		t.Fatalf("code = %d, want 404 (body: %s)", rr.Code, rr.Body.String())
	}
}

// Referenciar o PRÓPRIO treino continua funcionando — a checagem não pode
// quebrar o caminho feliz.
func TestChainAssignProgramAcceptsOwnWorkout(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.studentsByID = map[string]*models.UserProfile{
		"aluno-1": {ID: "aluno-1", Role: models.RoleStudent, NutritionistID: testUID, Status: models.StatusActive},
	}
	repo.workoutsByID = map[string]*models.WorkoutDefine{
		"w-meu": {ID: "w-meu", Name: "Treino A", NutritionistID: testUID},
	}
	repo.program = &models.TrainingProgram{
		ID: "p-1", Name: "Ciclo 2", NutritionistID: testUID,
		Workouts: []*models.ProgramWorkout{{WorkoutID: "w-meu", Order: 1, Label: "A"}},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "POST", "/api/programs/p-1/assign", `{"studentId":"aluno-1"}`, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if len(repo.createdWorkouts) != 1 {
		t.Fatalf("cópias materializadas = %d, want 1", len(repo.createdWorkouts))
	}
	if got := repo.createdWorkouts[0].StudentID; got != "aluno-1" {
		t.Errorf("cópia studentId = %q, want aluno-1", got)
	}
}

// ── studentId imutável via PUT ──────────────────────────────────────────────
//
// Reatribuição só existe via POST /assign, que materializa as cópias dos treinos
// e recusa (409) trocar de aluno. Se o PUT aceitasse studentId do body, daria
// para apontar o programa para outro aluno SEM materializar os treinos: o novo
// aluno cairia em 403 nos treinos referenciados e o anterior perderia o acesso.

func TestChainUpdateProgramCannotReassignStudent(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.studentsByID = map[string]*models.UserProfile{
		"aluno-1": {ID: "aluno-1", Role: models.RoleStudent, NutritionistID: testUID, Status: models.StatusActive},
		"aluno-2": {ID: "aluno-2", Role: models.RoleStudent, NutritionistID: testUID, Status: models.StatusActive},
	}
	repo.workoutsByID = map[string]*models.WorkoutDefine{
		"w-1": {ID: "w-1", Name: "Treino A", NutritionistID: testUID, StudentID: "aluno-1"},
	}
	repo.program = &models.TrainingProgram{
		ID: "p-1", Name: "Ciclo 2", NutritionistID: testUID, StudentID: "aluno-1",
		Workouts: []*models.ProgramWorkout{{WorkoutID: "w-1", Order: 1}},
	}
	h := newChainMux(repo)

	body := `{"name":"Ciclo 2","studentId":"aluno-2"}`
	rr := doChainRequest(h, "PUT", "/api/programs/p-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedProgram == nil {
		t.Fatal("UpdateProgram não foi chamado")
	}
	if got := repo.updatedProgram.StudentID; got != "aluno-1" {
		t.Errorf("studentId gravado = %q, want %q (reatribuição só via POST /assign)", got, "aluno-1")
	}
}

// ── exclusão ───────────────────────────────────────────────────────────────

func TestChainDeleteProgramKeepsWorkouts(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	repo.program = &models.TrainingProgram{ID: "p-1", NutritionistID: testUID}
	h := newChainMux(repo)

	rr := doChainRequest(h, "DELETE", "/api/programs/p-1", "", "token-valido")
	if rr.Code != http.StatusNoContent {
		t.Fatalf("code = %d, want 204 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.deletedProgramID != "p-1" {
		t.Errorf("DeleteProgram com id = %q, want p-1", repo.deletedProgramID)
	}
	// Apagar o programa não pode apagar os treinos: podem estar em outro
	// programa ou já atribuídos a um aluno.
	for _, w := range repo.createdWorkouts {
		if w.ID == "p-1" {
			t.Error("treino foi apagado junto com o programa")
		}
	}
}

// ── rota literal vs {id} ───────────────────────────────────────────────────

// POST /api/programs/import (literal) não pode ser capturada por
// POST /api/programs/{id}/... — o ServeMux do Go 1.22+ prefere o literal.
func TestChainImportRouteIsNotCapturedByIDPattern(t *testing.T) {
	repo := baseRepo(nutritionistProfile(models.StatusActive))
	h := newChainMux(repo)

	body := `{"markdown":` + mustJSON(mdExemplo) + `}`
	rr := doChainRequest(h, "POST", "/api/programs/import", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200 — a rota literal precisa vencer o padrão {id}", rr.Code)
	}
	if repo.createdProgram == nil {
		t.Error("CreateProgram não foi chamado (rota import capturada como id)")
	}
}

// mustJSON serializa uma string como literal JSON para montar bodies de teste.
func mustJSON(s string) string {
	b, err := json.Marshal(s)
	if err != nil {
		panic(err)
	}
	return string(b)
}
