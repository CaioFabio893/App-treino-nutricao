package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"treino-louise/backend/models"
	"treino-louise/backend/programmd"
)

// ── Programa de treinamento (F19) ──
//
// Um programa agrupa TREINOS que já existem em workouts/{id}. O programa guarda
// apenas referências ordenadas. Isso mantém UMA única implementação de treino
// (histórico, execução, impressão e a tela do aluno continuam apontando para
// workouts/{id}) e abre caminho para o que vier depois sem refatoração:
// reordenar treinos, editar/duplicar treinos, duplicar um programa e
// reutilizá-lo para outro aluno (materializando cópias dos treinos).

// NormalizeProgramWorkouts renumera a ordem dos treinos do programa, descarta
// referências vazias e remove workoutIds repetidos (mantém a primeira
// ocorrência) — um mesmo treino não pode ocupar duas posições do mesmo programa.
func NormalizeProgramWorkouts(p *models.TrainingProgram) {
	if p == nil {
		return
	}
	seen := make(map[string]bool, len(p.Workouts))
	out := make([]*models.ProgramWorkout, 0, len(p.Workouts))
	for _, w := range p.Workouts {
		if w == nil || strings.TrimSpace(w.WorkoutID) == "" {
			continue
		}
		if seen[w.WorkoutID] {
			continue
		}
		seen[w.WorkoutID] = true
		w.Order = len(out) + 1
		out = append(out, w)
	}
	p.Workouts = out
}

// ValidateProgram aplica os limites de tamanho por campo usados no resto do
// projeto. Mensagens em português, como nos demais handlers.
func ValidateProgram(p *models.TrainingProgram) error {
	if strings.TrimSpace(p.Name) == "" {
		return fmt.Errorf("nome obrigatorio")
	}
	if fieldTooLong(p.Name, MaxNameLength) {
		return fmt.Errorf("nome muito longo (max %d)", MaxNameLength)
	}
	if fieldTooLong(p.Description, MaxDescriptionLength) {
		return fmt.Errorf("descricao muito longa (max %d)", MaxDescriptionLength)
	}
	if fieldTooLong(p.Objective, MaxDescriptionLength) {
		return fmt.Errorf("objetivo muito longo (max %d)", MaxDescriptionLength)
	}
	if fieldTooLong(p.Notes, MaxDietContentLength) {
		return fmt.Errorf("notas muito longas (max %d)", MaxDietContentLength)
	}
	if fieldTooLong(p.Source, MaxNameLength) {
		return fmt.Errorf("origem muito longa (max %d)", MaxNameLength)
	}
	if len(p.Workouts) > MaxProgramWorkouts {
		return fmt.Errorf("programa tem mais de %d treinos", MaxProgramWorkouts)
	}
	return nil
}

// fieldTooLong compara o tamanho em runas com um limite (mesma semântica do
// tooLong dos handlers; runeLen conta caracteres Unicode).
func fieldTooLong(s string, max int) bool {
	return runeLen(s) > max
}

// ValidateProgramWorkoutOwnership confere que TODOS os treinos referenciados
// pelo programa existem e são do MESMO aluno do programa.
//
// Sem esta checagem o programa vira um canal de exfiltração entre alunos: o
// admin monta um programa apontando para `workouts/{id}` do aluno X e o
// `assign` materializa uma CÓPIA daquele treino (exercícios, nomes, videoUrl)
// para o aluno Y. HandleDuplicateWorkout já faz a checagem equivalente
// (canAccessResource); o caminho de programa precisa dela também.
//
// Não há escape para admin: como admin é o único que escreve, um escape
// tornaria a checagem inócua. Treino inexistente é 404
// (ErrProgramNotFoundWorkout) e treino de outro aluno é 403
// (ErrProgramWorkoutForbidden) — a resposta não revela a quem o id pertence.
func (s *Service) ValidateProgramWorkoutOwnership(ctx context.Context, p *models.TrainingProgram) error {
	if p == nil {
		return ErrProgramNotFound
	}
	for _, ref := range p.Workouts {
		if ref == nil || strings.TrimSpace(ref.WorkoutID) == "" {
			continue
		}
		w, err := s.repo.GetWorkout(ctx, ref.WorkoutID)
		if err != nil {
			return err
		}
		if w == nil {
			return ErrProgramNotFoundWorkout
		}
		if w.StudentID != p.StudentID {
			return ErrProgramWorkoutForbidden
		}
	}
	return nil
}

// ConvertProgram traduz o resultado do parser (programmd) para a estrutura do
// projeto. Devolve o programa SEM referências resolvidas (Workouts vazio) e os
// treinos na ordem original — quem grava resolve os IDs depois de criá-los.
//
// Esta é a única ponte entre o markdown e os models: a tela (endpoint de
// importação) e o CLI usam o MESMO caminho, para não divergirem.
func ConvertProgram(p *programmd.Program, source string) (*models.TrainingProgram, []*models.WorkoutDefine) {
	if p == nil {
		return nil, nil
	}
	program := &models.TrainingProgram{
		Name:        strings.TrimSpace(p.Name),
		Description: strings.TrimSpace(p.Description),
		Objective:   strings.TrimSpace(p.Objective),
		Notes:       strings.TrimSpace(p.Notes),
		Source:      strings.TrimSpace(source),
	}
	if program.Source == "" {
		program.Source = strings.TrimSpace(p.Source)
	}

	workouts := make([]*models.WorkoutDefine, 0, len(p.Workouts))
	for i := range p.Workouts {
		w := p.Workouts[i]
		wd := &models.WorkoutDefine{
			Name:        strings.TrimSpace(w.Name),
			Description: strings.TrimSpace(w.Description),
			Objective:   strings.TrimSpace(w.Objective),
			DayOfWeek:   strings.TrimSpace(w.DayOfWeek),
			Exercises:   make([]*models.WorkoutExercise, 0, len(w.Exercises)),
		}
		for _, e := range w.Exercises {
			wd.Exercises = append(wd.Exercises, &models.WorkoutExercise{
				// Name/Repetitions/Notes vêm VERBATIM da fonte. Sets pode ser 0
				// quando a tabela não trazia o número — o que não existe na
				// fonte não é inventado aqui (carga e descanso ficam vazios).
				Name:        strings.TrimSpace(e.Name),
				Sets:        e.Sets,
				Repetitions: strings.TrimSpace(e.Repetitions),
				Notes:       strings.TrimSpace(e.Notes),
				Order:       e.Order,
			})
		}
		// Renumera pela ordem original do documento, sem perder a informação
		// da coluna "#" quando ela existir.
		NormalizeExercises(wd)
		workouts = append(workouts, wd)
	}
	return program, workouts
}

// ImportResult é o desfecho de uma importação de programa.
type ImportResult struct {
	Program  *models.TrainingProgram
	Workouts []*models.WorkoutDefine
	Warnings []string
}

// CreateProgramFromImport é o caminho ÚNICO de importação (endpoint e CLI):
// parseia o markdown, grava os treinos e grava o programa com as referências
// resolvidas para os IDs criados.
//
// A referência de cada treino carrega o snapshot de Label/Name/DayOfWeek da
// fonte, para a listagem do programa continuar legível mesmo que o treino seja
// renomeado depois. A propriedade (StudentID) fica a cargo de quem chama, que já
// validou permissões.
func (s *Service) CreateProgramFromImport(ctx context.Context, markdown, source, name, studentID string) (*ImportResult, error) {
	parsed, err := programmd.Parse(markdown)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(name) != "" {
		// Nome explícito do chamador tem precedência sobre o extraído do H1,
		// mas o original continua preservado em Description.
		if parsed.Description == "" {
			parsed.Description = parsed.Name
		}
		parsed.Name = strings.TrimSpace(name)
	}

	program, workouts := ConvertProgram(parsed, source)
	program.StudentID = studentID
	if err := ValidateProgram(program); err != nil {
		return nil, err
	}

	refs := make([]*models.ProgramWorkout, 0, len(workouts))
	for i, wd := range workouts {
		// Os treinos nascem com o mesmo StudentID do programa, para que a
		// checagem de ownership por aluno (ValidateProgramWorkoutOwnership)
		// feche e o aluno não receba 403 ao abrir o próprio programa.
		wd.StudentID = studentID
		created, err := s.repo.CreateWorkout(ctx, wd)
		if err != nil {
			return nil, fmt.Errorf("falha ao criar treino %q: %w", wd.Name, err)
		}
		refs = append(refs, &models.ProgramWorkout{
			WorkoutID: created.ID,
			Order:     i + 1,
			Label:     parsed.Workouts[i].Label,
			Name:      created.Name,
			DayOfWeek: created.DayOfWeek,
		})
	}
	program.Workouts = refs
	NormalizeProgramWorkouts(program)

	saved, err := s.repo.CreateProgram(ctx, program)
	if err != nil {
		return nil, err
	}
	return &ImportResult{Program: saved, Workouts: workouts, Warnings: parsed.Warnings}, nil
}

// DuplicateWorkoutForStudent copia um treino para outro aluno, zerando ID e
// timestamps e copiando os exercícios sem ID. É a mesma semântica de
// HandleDuplicateWorkout, extraída para ser reusada pela atribuição de programa.
func DuplicateWorkoutForStudent(src *models.WorkoutDefine, studentID, newName string) *models.WorkoutDefine {
	dup := *src
	dup.ID = ""
	dup.StudentID = studentID
	if newName != "" {
		dup.Name = newName
	}
	dup.CreatedAt = time.Time{}
	dup.UpdatedAt = time.Time{}
	exs := make([]*models.WorkoutExercise, 0, len(src.Exercises))
	for _, e := range src.Exercises {
		if e == nil {
			continue
		}
		c := *e
		c.ID = ""
		exs = append(exs, &c)
	}
	dup.Exercises = exs
	return &dup
}

// AssignProgram materializa o programa para um aluno: cria uma cópia de cada
// treino do programa com StudentID = aluno e aponta as referências do programa
// para as cópias. É o que permite reutilizar o mesmo programa para vários alunos
// sem que a edicao de um afete o outro.
//
// Reatribuição para outro aluno é RECUSADA (ErrProgramAlreadyAssigned): trocar de
// aluno exigiria apagar os treinos já materializados do aluno anterior, e
// apagar trabalho do usuário sem confirmação destrói dado.
func (s *Service) AssignProgram(ctx context.Context, p *models.TrainingProgram, studentID string) (*models.TrainingProgram, error) {
	if p == nil {
		return nil, ErrProgramNotFound
	}
	if strings.TrimSpace(studentID) == "" {
		return nil, fmt.Errorf("aluno obrigatorio")
	}
	if p.StudentID != "" && p.StudentID != studentID {
		return nil, ErrProgramAlreadyAssigned
	}
	if p.StudentID == studentID {
		// Já é deste aluno: idempotente, nada a materializar.
		return p, nil
	}

	refs := make([]*models.ProgramWorkout, 0, len(p.Workouts))
	for _, ref := range p.Workouts {
		if ref == nil || ref.WorkoutID == "" {
			continue
		}
		src, err := s.repo.GetWorkout(ctx, ref.WorkoutID)
		if err != nil {
			return nil, err
		}
		if src == nil {
			return nil, ErrProgramNotFoundWorkout
		}
		// Ownership do TREINO, não só do programa: sem esta linha o programa
		// materializaria uma cópia do treino de OUTRO aluno (exercícios, nomes,
		// videoUrl) — exfiltração.
		if src.StudentID != p.StudentID {
			return nil, ErrProgramWorkoutForbidden
		}
		created, err := s.repo.CreateWorkout(ctx, DuplicateWorkoutForStudent(src, studentID, ""))
		if err != nil {
			return nil, err
		}
		refs = append(refs, &models.ProgramWorkout{
			WorkoutID: created.ID,
			Order:     len(refs) + 1,
			Label:     ref.Label,
			Name:      created.Name,
			DayOfWeek: created.DayOfWeek,
		})
	}

	p.StudentID = studentID
	p.Workouts = refs
	NormalizeProgramWorkouts(p)
	updated := *p
	updated.UpdatedAt = Now()
	if err := s.repo.UpdateProgram(ctx, p.ID, &updated); err != nil {
		return nil, err
	}
	saved, err := s.repo.GetProgram(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	if saved == nil {
		return &updated, nil
	}
	return saved, nil
}

// DuplicateProgram clona um programa inteiro: novos treinos (sem aluno) e um
// novo programa apontando para eles. Serve para adaptar um modelo base sem
// mexer no original.
func (s *Service) DuplicateProgram(ctx context.Context, p *models.TrainingProgram, newName string) (*models.TrainingProgram, error) {
	if p == nil {
		return nil, ErrProgramNotFound
	}
	name := strings.TrimSpace(newName)
	if name == "" {
		name = p.Name + " (copia)"
	}
	if fieldTooLong(name, MaxNameLength) {
		return nil, fmt.Errorf("nome muito longo (max %d)", MaxNameLength)
	}

	clone := *p
	clone.ID = ""
	clone.StudentID = ""
	clone.Name = name
	clone.CreatedAt = time.Time{}
	clone.UpdatedAt = time.Time{}

	refs := make([]*models.ProgramWorkout, 0, len(p.Workouts))
	for _, ref := range p.Workouts {
		if ref == nil || ref.WorkoutID == "" {
			continue
		}
		src, err := s.repo.GetWorkout(ctx, ref.WorkoutID)
		if err != nil {
			return nil, err
		}
		if src == nil {
			return nil, ErrProgramNotFoundWorkout
		}
		// Mesmo ownership do AssignProgram: duplicar também materializa o
		// conteúdo do treino, então não pode ser canal para copiar o treino de
		// outro aluno.
		if src.StudentID != p.StudentID {
			return nil, ErrProgramWorkoutForbidden
		}
		// O clone é de biblioteca: mesmo conteúdo, sem aluno e sem vínculo alterado.
		created, err := s.repo.CreateWorkout(ctx, DuplicateWorkoutForStudent(src, "", ""))
		if err != nil {
			return nil, err
		}
		refs = append(refs, &models.ProgramWorkout{
			WorkoutID: created.ID,
			Order:     len(refs) + 1,
			Label:     ref.Label,
			Name:      created.Name,
			DayOfWeek: created.DayOfWeek,
		})
	}
	clone.Workouts = refs
	NormalizeProgramWorkouts(&clone)
	return s.repo.CreateProgram(ctx, &clone)
}
