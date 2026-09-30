package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"treino-louise/backend/middleware"
	"treino-louise/backend/models"
	"treino-louise/backend/service"
)

// ── Programas de treinamento (F19) ──
//
// Um programa é uma lista ordenada de TREINOS que já existem em workouts/{id}.
// Nenhum treino é duplicado aqui: a tela de programa navega
// programa -> treinos -> exercícios usando os documentos de treino existentes.
//
// Autorização (mesma matriz dos treinos, ver docs/security/plans.md):
//   - leitura: aluno (só os atribuídos a ele), nutricionista (os próprios), admin (todos);
//   - escrita: admin, com RequireApproved (workouts é free tier,
//     sem RequireFeature);
//   - ownership: nutricionista NUNCA assume o programa de outro.

// HandleListPrograms lista os programas visíveis para o papel do chamador.
func (h *Handlers) HandleListPrograms(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UIDFrom(r.Context())
	role := middleware.RoleFrom(r.Context())
	var programs []*models.TrainingProgram
	var err error
	switch role {
	case models.RoleAdmin:
		programs, err = h.repo.ListPrograms(r.Context())
	default: // student
		programs, err = h.repo.ListProgramsForStudent(r.Context(), uid)
	}
	if err != nil {
		http.Error(w, "falha ao listar programas", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, programs)
}

// HandleGetProgram devolve um programa com a lista ordenada de treinos.
func (h *Handlers) HandleGetProgram(w http.ResponseWriter, r *http.Request) {
	p, ok := h.loadProgram(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, p)
}

// HandleCreateProgram cria um programa. O programa pode nascer como biblioteca
// (studentId vazio) e ser atribuído depois via POST /api/programs/{id}/assign.
func (h *Handlers) HandleCreateProgram(w http.ResponseWriter, r *http.Request) {
	var program models.TrainingProgram
	if err := json.NewDecoder(r.Body).Decode(&program); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if middleware.RoleFrom(r.Context()) != models.RoleAdmin {
		http.Error(w, "sem permissao para criar programa", http.StatusForbidden)
		return
	}

	if err := service.ValidateProgram(&program); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	service.NormalizeProgramWorkouts(&program)
	// O programa só REFERENCIA treinos existentes: conferir a posse de cada um
	// impede montar um programa sobre o treino de outro aluno.
	if err := h.svc.ValidateProgramWorkoutOwnership(r.Context(), &program); err != nil {
		if errors.Is(err, service.ErrProgramNotFoundWorkout) {
			http.Error(w, "treino do programa nao encontrado", http.StatusNotFound)
			return
		}
		if errors.Is(err, service.ErrProgramWorkoutForbidden) {
			http.Error(w, "treino do programa pertence a outro aluno", http.StatusForbidden)
			return
		}
		http.Error(w, "falha ao validar treinos do programa", http.StatusInternalServerError)
		return
	}
	created, err := h.repo.CreateProgram(r.Context(), &program)
	if err != nil {
		http.Error(w, "falha ao criar programa", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

// HandleUpdateProgram atualiza metadados e a ORDEM/lista de treinos do programa.
// Não cria nem apaga treinos: os exercícios continuam sendo editados na tela de
// treinos (PUT /api/workouts/{id}), que é a fonte única do conteúdo.
func (h *Handlers) HandleUpdateProgram(w http.ResponseWriter, r *http.Request) {
	existing, ok := h.loadProgram(w, r)
	if !ok {
		return
	}

	var program models.TrainingProgram
	if err := json.NewDecoder(r.Body).Decode(&program); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	// Vínculos são IMUTÁVEIS por body (regra nº 2 do projeto): o Body define
	// apenas o CONTEÚDO do programa (metadados + ordem dos treinos).
	//
	// - StudentID: reatribuição só existe via POST /assign, que MATERIALIZA as
	//   cópias dos treinos e recusa (409) trocar de aluno. Se o PUT aceitasse o
	//   studentId do body, daria para apontar o programa para outro aluno sem
	//   materializar nada: o novo aluno cairia em 403 nos treinos referenciados
	//   e o anterior perderia o acesso ao programa dele.
	program.StudentID = existing.StudentID
	if program.ID == "" {
		program.ID = existing.ID
	}
	if program.Source == "" {
		program.Source = existing.Source
	}

	if err := service.ValidateProgram(&program); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	service.NormalizeProgramWorkouts(&program)
	if err := h.svc.ValidateProgramWorkoutOwnership(r.Context(), &program); err != nil {
		if errors.Is(err, service.ErrProgramNotFoundWorkout) {
			http.Error(w, "treino do programa nao encontrado", http.StatusNotFound)
			return
		}
		if errors.Is(err, service.ErrProgramWorkoutForbidden) {
			http.Error(w, "treino do programa pertence a outro aluno", http.StatusForbidden)
			return
		}
		http.Error(w, "falha ao validar treinos do programa", http.StatusInternalServerError)
		return
	}
	if err := h.repo.UpdateProgram(r.Context(), existing.ID, &program); err != nil {
		http.Error(w, "falha ao atualizar programa", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// HandleDeleteProgram apaga o programa. NÃO apaga os treinos: eles podem estar
// compartilhados com outros programas ou já atribuídos a alunos, e destruir
// trabalho do usuário sem confirmação é proibido.
func (h *Handlers) HandleDeleteProgram(w http.ResponseWriter, r *http.Request) {
	existing, ok := h.loadProgram(w, r)
	if !ok {
		return
	}
	if err := h.repo.DeleteProgram(r.Context(), existing.ID); err != nil {
		http.Error(w, "falha ao excluir programa", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// HandleAssignProgram materializa o programa para um aluno: cria uma cópia de
// cada treino com studentId do aluno e aponta as referências para as cópias.
// Reatribuição para outro aluno é recusada com 409 (ver service.AssignProgram).
func (h *Handlers) HandleAssignProgram(w http.ResponseWriter, r *http.Request) {
	existing, ok := h.loadProgram(w, r)
	if !ok {
		return
	}

	var req models.AssignProgramRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.StudentID) == "" {
		http.Error(w, "aluno obrigatorio", http.StatusBadRequest)
		return
	}
	// Só o admin atribui (a rota exige RoleAdmin); o aluno é o dono dos treinos
	// materializados, conferido por AssignProgram/ValidateProgramWorkoutOwnership.
	if middleware.RoleFrom(r.Context()) != models.RoleAdmin {
		http.Error(w, "sem permissao para atribuir programa", http.StatusForbidden)
		return
	}

	updated, err := h.svc.AssignProgram(r.Context(), existing, req.StudentID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrProgramAlreadyAssigned):
			http.Error(w, "programa ja atribuido a outro aluno", http.StatusConflict)
		case errors.Is(err, service.ErrProgramNotFoundWorkout):
			http.Error(w, "treino do programa nao encontrado", http.StatusNotFound)
		case errors.Is(err, service.ErrProgramWorkoutForbidden):
			http.Error(w, "treino do programa pertence a outro aluno", http.StatusForbidden)
		default:
			http.Error(w, "falha ao atribuir programa", http.StatusInternalServerError)
		}
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// HandleDuplicateProgram clona o programa (novos treinos de biblioteca + novo
// programa), para adaptar um modelo base sem mexer no original.
func (h *Handlers) HandleDuplicateProgram(w http.ResponseWriter, r *http.Request) {
	existing, ok := h.loadProgram(w, r)
	if !ok {
		return
	}
	var req models.DuplicateRequest
	if r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "JSON invalido", http.StatusBadRequest)
			return
		}
	}
	clone, err := h.svc.DuplicateProgram(r.Context(), existing, req.NewName)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrProgramNotFoundWorkout):
			http.Error(w, "treino do programa nao encontrado", http.StatusNotFound)
		case errors.Is(err, service.ErrProgramWorkoutForbidden):
			http.Error(w, "treino do programa pertence a outro aluno", http.StatusForbidden)
		default:
			http.Error(w, "falha ao duplicar programa", http.StatusInternalServerError)
		}
		return
	}
	writeJSON(w, http.StatusOK, clone)
}

// HandleImportProgram importa um programa de treino escrito em markdown: o
// backend parseia (programmd), cria os TREINOS e cria o PROGRAMA com as
// referências resolvidas. É o caminho que evita digitar exercício por exercício.
//
// Ambiguidades da fonte são preservadas (blocos de cardio vão para a descrição do
// treino, PRs/periodização/estrutura semanal vão para as notas do programa) e
// registradas como aviso no log — nada é inventado.
func (h *Handlers) HandleImportProgram(w http.ResponseWriter, r *http.Request) {
	var req models.ImportProgramRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Markdown) == "" {
		http.Error(w, "conteudo do programa obrigatorio", http.StatusBadRequest)
		return
	}

	if middleware.RoleFrom(r.Context()) != models.RoleAdmin {
		http.Error(w, "sem permissao para importar programa", http.StatusForbidden)
		return
	}

	// Sem vinculo de nutricionista: o programa nasce de biblioteca ou já atribuído
	// ao aluno informado no body (studentId).
	result, err := h.svc.CreateProgramFromImport(r.Context(), req.Markdown, req.Source, req.Name, req.StudentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	for _, warning := range result.Warnings {
		log.Printf("importacao de programa: %s", warning)
	}
	writeJSON(w, http.StatusOK, result.Program)
}

// loadProgram lê o programa do path e valida a permissão de acesso,
// escrevendo a resposta de erro e devolvendo ok=false quando falha.
func (h *Handlers) loadProgram(w http.ResponseWriter, r *http.Request) (*models.TrainingProgram, bool) {
	id := r.PathValue("id")
	program, err := h.repo.GetProgram(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler programa", http.StatusInternalServerError)
		return nil, false
	}
	if program == nil {
		http.Error(w, "programa nao encontrado", http.StatusNotFound)
		return nil, false
	}
	if !canAccessResource(r, program.StudentID) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return nil, false
	}
	return program, true
}
