package main

// Receitas globais (kind=recipe, studentId vazio): leitura liberada para todo
// perfil aprovado, sem furar o isolamento da dieta pessoal nem a escrita
// admin-only. A regra vive em handlers.canReadDiet.

import (
	"net/http"
	"strings"
	"testing"

	"treino-louise/backend/models"
)

func TestChainStudentReadsGlobalRecipe(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	repo.diet = &models.Diet{ID: "r-1", StudentID: "", Kind: "recipe", Name: "Coxinha da Lou"}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/diets/r-1", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET receita global code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"recipe"`) {
		t.Errorf("resposta nao contem kind recipe: %s", rr.Body.String())
	}
}

func TestChainStudentCannotReadAnotherStudentDiet(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	repo.diet = &models.Diet{ID: "d-9", StudentID: "outro-aluno", Name: "Dieta de outro"}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/diets/d-9", "", "token-valido")
	if rr.Code != http.StatusNotFound {
		t.Fatalf("GET dieta alheia code = %d, want 404 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainPendingStudentCannotReadGlobalRecipe(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusPendingApproval))
	repo.diet = &models.Diet{ID: "r-1", StudentID: "", Kind: "recipe", Name: "Coxinha da Lou"}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/diets/r-1", "", "token-valido")
	if rr.Code != http.StatusForbidden {
		t.Fatalf("GET receita (pendente) code = %d, want 403 (body: %s)", rr.Code, rr.Body.String())
	}
}

func TestChainStudentCannotWriteGlobalRecipe(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	h := newChainMux(repo)

	for _, c := range []struct {
		name, method, path, body string
	}{
		{"PUT", "PUT", "/api/diets/r-1", `{"name":"invadida"}`},
		{"DELETE", "DELETE", "/api/diets/r-1", ""},
	} {
		t.Run(c.name, func(t *testing.T) {
			rr := doChainRequest(h, c.method, c.path, c.body, "token-valido")
			if rr.Code != http.StatusForbidden {
				t.Fatalf("%s receita (aluno) code = %d, want 403 (body: %s)", c.method, rr.Code, rr.Body.String())
			}
		})
	}
}

// A listagem do aluno vem do repository (que junta as receitas globais); o
// handler apenas repassa. Este teste garante que a receita não é filtrada fora.
func TestChainStudentListDietsIncludesRecipes(t *testing.T) {
	repo := baseRepo(studentProfile(models.StatusActive))
	repo.listDietsSt = []*models.Diet{
		{ID: "d-1", StudentID: testUID, Name: "Minha dieta"},
		{ID: "r-1", StudentID: "", Kind: "recipe", Name: "Coxinha da Lou"},
	}
	h := newChainMux(repo)

	rr := doChainRequest(h, "GET", "/api/diets", "", "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/diets code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	body := rr.Body.String()
	if !strings.Contains(body, `"r-1"`) || !strings.Contains(body, `"d-1"`) {
		t.Errorf("lista deveria conter dieta propria e receita global: %s", body)
	}
}
