package handlers

import (
	"encoding/json"
	"net/http"

	"treino-louise/backend/models"
	"treino-louise/backend/service"
)

// ── Biblioteca de exercícios (F5) ──
//
// Catálogo GLOBAL compartilhado. Leitura: usuário aprovado (RequireApproved).
// Escrita (create/update/delete): somente nutricionista/admin (Allow). O aluno
// consulta a biblioteca mas nunca a modifica. A coleção exercises/{id} é
// acessada somente via API Go (as regras do Firestore negam escrita a clientes).

// HandleListExercises devolve o catálogo global de exercícios (ordenado por nome).
func (h *Handlers) HandleListExercises(w http.ResponseWriter, r *http.Request) {
	exs, err := h.repo.ListExercises(r.Context())
	if err != nil {
		http.Error(w, "falha ao listar exercicios", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, exs)
}

// HandleGetExercise devolve um exercício da biblioteca.
func (h *Handlers) HandleGetExercise(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	e, err := h.repo.GetExercise(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler exercicio", http.StatusInternalServerError)
		return
	}
	if e == nil {
		http.Error(w, "exercicio nao encontrado", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, e)
}

// HandleCreateExercise cadastra um exercício na biblioteca (nutricionista/admin).
func (h *Handlers) HandleCreateExercise(w http.ResponseWriter, r *http.Request) {
	var e models.ExerciseItem
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	service.NormalizeExercise(&e)
	if err := service.ValidateExercise(&e); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	created, err := h.repo.CreateExercise(r.Context(), &e)
	if err != nil {
		http.Error(w, "falha ao criar exercicio", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

// HandleUpdateExercise edita um exercício da biblioteca. A alteração não afeta
// treinos existentes (snapshot copiado no momento da seleção).
func (h *Handlers) HandleUpdateExercise(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.repo.GetExercise(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler exercicio", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "exercicio nao encontrado", http.StatusNotFound)
		return
	}

	var e models.ExerciseItem
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	service.NormalizeExercise(&e)
	if err := service.ValidateExercise(&e); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.repo.UpdateExercise(r.Context(), id, &e); err != nil {
		http.Error(w, "falha ao atualizar exercicio", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// HandleDeleteExercise remove um exercício da biblioteca. Treinos existentes que
// copiaram o snapshot do exercício NÃO são afetados.
func (h *Handlers) HandleDeleteExercise(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.repo.GetExercise(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler exercicio", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "exercicio nao encontrado", http.StatusNotFound)
		return
	}
	if err := h.repo.DeleteExercise(r.Context(), id); err != nil {
		http.Error(w, "falha ao excluir exercicio", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
