package service

import (
	"context"
	"os"
	"strings"
	"testing"

	"treino-louise/backend/models"
	"treino-louise/backend/programmd"
	"treino-louise/backend/repository"
)

// caminhoExemplo é o material de origem real. Testes que dependem dele são
// pulados quando o arquivo não está na máquina.
const caminhoExemplo = `C:/Users/caiof/OneDrive/Desktop/exemplo/treino.md`

// ── NormalizeProgramWorkouts ───────────────────────────────────────────────

func TestNormalizeProgramWorkouts(t *testing.T) {
	p := &models.TrainingProgram{Workouts: []*models.ProgramWorkout{
		{WorkoutID: "w3"},
		nil,
		{WorkoutID: ""}, // referência vazia some
		{WorkoutID: "w1"},
		{WorkoutID: "w3"}, // duplicado some (mantém a primeira ocorrência)
	}}
	NormalizeProgramWorkouts(p)

	if len(p.Workouts) != 2 {
		t.Fatalf("len = %d, want 2 (vazio e duplicado removidos)", len(p.Workouts))
	}
	if p.Workouts[0].WorkoutID != "w3" || p.Workouts[0].Order != 1 {
		t.Errorf("[0] = %+v, want w3 com order 1", p.Workouts[0])
	}
	if p.Workouts[1].WorkoutID != "w1" || p.Workouts[1].Order != 2 {
		t.Errorf("[1] = %+v, want w1 com order 2", p.Workouts[1])
	}
}

func TestNormalizeProgramWorkoutsNilIsSafe(t *testing.T) {
	NormalizeProgramWorkouts(nil) // não pode entrar em pânico
}

// ── ValidateProgram ────────────────────────────────────────────────────────

func TestValidateProgram(t *testing.T) {
	if err := ValidateProgram(&models.TrainingProgram{Name: "   "}); err == nil {
		t.Error("nome vazio deveria falhar")
	}
	if err := ValidateProgram(&models.TrainingProgram{Name: strings.Repeat("x", MaxNameLength+1)}); err == nil {
		t.Error("nome longo demais deveria falhar")
	}
	if err := ValidateProgram(&models.TrainingProgram{Name: "Ciclo 2", Notes: strings.Repeat("y", MaxNotesLength+1)}); err == nil {
		t.Error("notas longas demais deveriam falhar")
	}
	if err := ValidateProgram(&models.TrainingProgram{Name: "Ciclo 2"}); err != nil {
		t.Errorf("programa válido rejeitado: %v", err)
	}
}

func TestValidateProgramRejectsTooManyWorkouts(t *testing.T) {
	p := &models.TrainingProgram{Name: "Ciclo 2"}
	for i := 0; i <= MaxProgramWorkouts; i++ {
		p.Workouts = append(p.Workouts, &models.ProgramWorkout{WorkoutID: "w"})
	}
	if err := ValidateProgram(p); err == nil {
		t.Errorf("programa com %d treinos deveria falhar", len(p.Workouts))
	}
}

// ── ConvertProgram ─────────────────────────────────────────────────────────

func TestConvertProgramFromRealFile(t *testing.T) {
	b, err := os.ReadFile(caminhoExemplo)
	if err != nil {
		t.Skipf("material de exemplo indisponivel (%v)", err)
	}
	parsed, err := programmd.Parse(string(b))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	program, workouts := ConvertProgram(parsed, "treino.md")

	if program.Name != "Louise Lima (Ciclo 2)" {
		t.Errorf("Name = %q", program.Name)
	}
	if program.Source != "treino.md" {
		t.Errorf("Source = %q, want treino.md", program.Source)
	}
	if len(workouts) != 5 {
		t.Fatalf("treinos = %d, want 5", len(workouts))
	}

	total := 0
	for _, w := range workouts {
		total += len(w.Exercises)
	}
	if total != 30 {
		t.Errorf("exercicios = %d, want 30", total)
	}

	// Referências resolvidas ficam de fora do ConvertProgram (quem grava resolve).
	if len(program.Workouts) != 0 {
		t.Errorf("ConvertProgram nao deve resolver referencias: %+v", program.Workouts)
	}

	// Exercícios renumerados 1..N preservando a ordem da fonte.
	a := workouts[0]
	for i, e := range a.Exercises {
		if e.Order != i+1 {
			t.Errorf("treino A ex.%d order = %d, want %d", i+1, e.Order, i+1)
		}
	}
	if a.Exercises[0].Name != "Agachamento Livre com Barra" || a.Exercises[0].Sets != 4 || a.Exercises[0].Repetitions != "6-8" {
		t.Errorf("treino A ex.1 = %+v", a.Exercises[0])
	}
	// O que a fonte não traz continua vazio.
	if a.Exercises[0].Weight != "" || a.Exercises[0].RestSeconds != 0 || a.Exercises[0].VideoURL != "" {
		t.Errorf("carga/descanso/vdeo inventados: %+v", a.Exercises[0])
	}
	// Cardio preservado na descrição do treino, não vira exercício.
	if !strings.Contains(workouts[1].Description, "Cardio Final") {
		t.Errorf("treino B perdeu o cardio: %q", workouts[1].Description)
	}
}

func TestConvertProgramNilIsSafe(t *testing.T) {
	program, workouts := ConvertProgram(nil, "x.md")
	if program != nil || workouts != nil {
		t.Errorf("ConvertProgram(nil) = %v, %v; want nil, nil", program, workouts)
	}
}

func TestCreateProgramFromImportNilParsedIsSafe(t *testing.T) {
	s := New(&programFakeRepo{})
	if _, err := s.CreateProgramFromImport(context.Background(), "", "x.md", "", ""); err == nil {
		t.Error("markdown vazio deveria falhar")
	}
}

// TestCreateProgramFromImportOwnsTheWorkouts é uma regressão: os treinos
// criados pela importação precisam nascer com o StudentID informado. Sem ele o
// programa importado fica órfão e o aluno alvo leva 403 ao abri-lo.
func TestCreateProgramFromImportOwnsTheWorkouts(t *testing.T) {
	repo := &programFakeRepo{}
	s := New(repo)

	res, err := s.CreateProgramFromImport(
		context.Background(),
		"# Programa — Teste\n\n**Foco: Hipertrofia**\n\n## TREINO A — Pernas\n\n| # | Exercício | Séries | Reps | Observação |\n|---|---|---:|---:|---|\n| 1 | Agachamento | 4 | 6-8 | |\n",
		"treino.md", "", "",
	)
	if err != nil {
		t.Fatalf("CreateProgramFromImport: %v", err)
	}
	if len(repo.created) != 1 {
		t.Fatalf("treinos criados = %d, want 1", len(repo.created))
	}
	w := repo.created[0]
	if w.StudentID != "" {
		t.Errorf("StudentID = %q, want vazio (programa de biblioteca)", w.StudentID)
	}
	if w.ID == "" {
		t.Error("treino criado sem ID")
	}
	// A referência do programa aponta para o treino criado.
	if len(res.Program.Workouts) != 1 || res.Program.Workouts[0].WorkoutID != w.ID {
		t.Errorf("referência não resolveu: %+v", res.Program.Workouts)
	}
}

func TestCreateProgramFromImportAssignsStudentToWorkouts(t *testing.T) {
	repo := &programFakeRepo{}
	s := New(repo)

	_, err := s.CreateProgramFromImport(
		context.Background(),
		"# Programa — Teste\n\n## TREINO A — Pernas\n\n| # | Exercício | Séries | Reps | Observação |\n|---|---|---:|---:|---|\n| 1 | Agachamento | 4 | 6-8 | |\n",
		"treino.md", "", "aluno-9",
	)
	if err != nil {
		t.Fatalf("CreateProgramFromImport: %v", err)
	}
	if got := repo.created[0].StudentID; got != "aluno-9" {
		t.Errorf("StudentID = %q, want aluno-9", got)
	}
}

// ── DuplicateWorkoutForStudent ─────────────────────────────────────────────

func TestDuplicateWorkoutForStudent(t *testing.T) {
	src := &models.WorkoutDefine{
		ID: "w-1", Name: "Treino A", StudentID: "",
		Exercises: []*models.WorkoutExercise{{ID: "ex-1", Name: "Agachamento", Order: 1}},
	}
	dup := DuplicateWorkoutForStudent(src, "aluno-1", "")

	if dup.ID != "" {
		t.Errorf("ID = %q, want vazio", dup.ID)
	}
	if dup.StudentID != "aluno-1" {
		t.Errorf("StudentID = %q, want aluno-1", dup.StudentID)
	}
	if dup.Name != "Treino A" {
		t.Errorf("Name = %q, want o nome original", dup.Name)
	}
	if !dup.CreatedAt.IsZero() || !dup.UpdatedAt.IsZero() {
		t.Error("timestamps devem ser zerados na cópia")
	}
	if len(dup.Exercises) != 1 || dup.Exercises[0].ID != "" {
		t.Errorf("exercícios devem ser copiados sem ID: %+v", dup.Exercises)
	}
	// A cópia não pode compartilhar ponteiro com o original.
	if dup.Exercises[0] == src.Exercises[0] {
		t.Error("exercício copiado compartilha ponteiro com o original")
	}
}

func TestDuplicateWorkoutForStudentCustomName(t *testing.T) {
	src := &models.WorkoutDefine{ID: "w-1", Name: "Treino A"}
	if got := DuplicateWorkoutForStudent(src, "aluno-1", "Treino A (ajustado)").Name; got != "Treino A (ajustado)" {
		t.Errorf("Name = %q", got)
	}
}

// ── AssignProgram ──────────────────────────────────────────────────────────

// programFakeRepo é o mínimo do Repository que o AssignProgram usa: ler o
// programa, ler/criar treinos e gravar o programa.
type programFakeRepo struct {
	repository.Repository
	program  *models.TrainingProgram
	workouts map[string]*models.WorkoutDefine
	created  []*models.WorkoutDefine
	saved    *models.TrainingProgram
	nextID   int
}

func (r *programFakeRepo) GetProgram(_ context.Context, _ string) (*models.TrainingProgram, error) {
	if r.program == nil {
		return nil, nil
	}
	cp := *r.program
	return &cp, nil
}

func (r *programFakeRepo) GetWorkout(_ context.Context, id string) (*models.WorkoutDefine, error) {
	if w, ok := r.workouts[id]; ok {
		cp := *w
		return &cp, nil
	}
	return nil, nil
}

func (r *programFakeRepo) CreateWorkout(_ context.Context, w *models.WorkoutDefine) (*models.WorkoutDefine, error) {
	r.nextID++
	w.ID = "copia-" + string(rune('0'+r.nextID))
	r.created = append(r.created, w)
	if r.workouts == nil {
		r.workouts = map[string]*models.WorkoutDefine{}
	}
	r.workouts[w.ID] = w
	return w, nil
}

func (r *programFakeRepo) UpdateProgram(_ context.Context, _ string, p *models.TrainingProgram) error {
	cp := *p
	r.saved = &cp
	r.program = &cp
	return nil
}

func (r *programFakeRepo) CreateProgram(_ context.Context, p *models.TrainingProgram) (*models.TrainingProgram, error) {
	cp := *p
	cp.ID = "prog-novo"
	r.saved = &cp
	return &cp, nil
}

func novoRepoPrograma() *programFakeRepo {
	return &programFakeRepo{
		program: &models.TrainingProgram{
			ID: "p-1", Name: "Ciclo 2",
			Workouts: []*models.ProgramWorkout{
				{WorkoutID: "w-1", Order: 1, Label: "A", Name: "Treino A"},
				{WorkoutID: "w-2", Order: 2, Label: "B", Name: "Treino B"},
			},
		},
		workouts: map[string]*models.WorkoutDefine{
			"w-1": {ID: "w-1", Name: "Treino A", DayOfWeek: "monday",
				Exercises: []*models.WorkoutExercise{{Name: "Agachamento", Sets: 4, Repetitions: "6-8", Order: 1}}},
			"w-2": {ID: "w-2", Name: "Treino B", DayOfWeek: "tuesday",
				Exercises: []*models.WorkoutExercise{{Name: "Puxada", Sets: 4, Repetitions: "8-10", Order: 1}}},
		},
	}
}

func TestAssignProgramMaterializesCopies(t *testing.T) {
	repo := novoRepoPrograma()
	s := New(repo)

	got, err := s.AssignProgram(context.Background(), repo.program, "aluno-1")
	if err != nil {
		t.Fatalf("AssignProgram: %v", err)
	}
	if got.StudentID != "aluno-1" {
		t.Errorf("StudentID = %q, want aluno-1", got.StudentID)
	}
	if len(repo.created) != 2 {
		t.Fatalf("cópias criadas = %d, want 2", len(repo.created))
	}
	for _, c := range repo.created {
		if c.StudentID != "aluno-1" {
			t.Errorf("cópia sem aluno: %+v", c)
		}
		if c.ID == "w-1" || c.ID == "w-2" {
			t.Errorf("cópia reutilizou o id do original: %s", c.ID)
		}
	}
	// As referências do programa passam a apontar para as cópias, na ordem.
	if len(got.Workouts) != 2 {
		t.Fatalf("referências = %d, want 2", len(got.Workouts))
	}
	if got.Workouts[0].WorkoutID != "copia-1" || got.Workouts[1].WorkoutID != "copia-2" {
		t.Errorf("referências = %q/%q, want copia-1/copia-2", got.Workouts[0].WorkoutID, got.Workouts[1].WorkoutID)
	}
	// O snapshot do rótulo/dia é preservado na referência.
	if got.Workouts[0].Label != "A" || got.Workouts[0].DayOfWeek != "monday" {
		t.Errorf("referência 0 = %+v", got.Workouts[0])
	}
	if repo.saved == nil {
		t.Error("UpdateProgram não foi chamado")
	}
}

func TestAssignProgramToSameStudentIsIdempotent(t *testing.T) {
	repo := novoRepoPrograma()
	repo.program.StudentID = "aluno-1"
	s := New(repo)

	if _, err := s.AssignProgram(context.Background(), repo.program, "aluno-1"); err != nil {
		t.Fatalf("AssignProgram: %v", err)
	}
	if len(repo.created) != 0 {
		t.Errorf("reatribuir ao mesmo aluno criou %d cópias, want 0", len(repo.created))
	}
}

func TestAssignProgramRejectsOtherStudent(t *testing.T) {
	repo := novoRepoPrograma()
	repo.program.StudentID = "aluno-1"
	s := New(repo)

	_, err := s.AssignProgram(context.Background(), repo.program, "aluno-2")
	if err == nil || !strings.Contains(err.Error(), "ja atribuido") {
		t.Fatalf("err = %v, want ErrProgramAlreadyAssigned", err)
	}
	if len(repo.created) != 0 {
		t.Error("recusa não pode criar cópias")
	}
}

func TestAssignProgramRequiresStudent(t *testing.T) {
	repo := novoRepoPrograma()
	s := New(repo)

	if _, err := s.AssignProgram(context.Background(), repo.program, ""); err == nil {
		t.Error("aluno vazio deveria falhar")
	}
}

func TestAssignProgramFailsWhenWorkoutMissing(t *testing.T) {
	repo := novoRepoPrograma()
	delete(repo.workouts, "w-1")
	s := New(repo)

	if _, err := s.AssignProgram(context.Background(), repo.program, "aluno-1"); err == nil {
		t.Fatal("treino ausente deveria falhar em vez de criar programa pela metade")
	}
}

// ── DuplicateProgram ───────────────────────────────────────────────────────

func TestDuplicateProgram(t *testing.T) {
	repo := novoRepoPrograma()
	s := New(repo)

	clone, err := s.DuplicateProgram(context.Background(), repo.program, "")
	if err != nil {
		t.Fatalf("DuplicateProgram: %v", err)
	}
	if clone.Name != "Ciclo 2 (copia)" {
		t.Errorf("Name = %q, want %q", clone.Name, "Ciclo 2 (copia)")
	}
	// O clone é de biblioteca: sem aluno.
	if clone.StudentID != "" {
		t.Errorf("clone StudentID = %q, want vazio", clone.StudentID)
	}
	if len(clone.Workouts) != 2 {
		t.Errorf("referências = %d, want 2", len(clone.Workouts))
	}
	if clone.ID == "p-1" {
		t.Error("clone não pode reaproveitar o id do original")
	}
}

func TestDuplicateProgramCustomName(t *testing.T) {
	repo := novoRepoPrograma()
	s := New(repo)

	clone, err := s.DuplicateProgram(context.Background(), repo.program, "Hipertrofia — Intermediário")
	if err != nil {
		t.Fatalf("DuplicateProgram: %v", err)
	}
	if clone.Name != "Hipertrofia — Intermediário" {
		t.Errorf("Name = %q", clone.Name)
	}
}
