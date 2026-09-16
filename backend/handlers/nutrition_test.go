package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"treino-louise/backend/models"
	"treino-louise/backend/repository"
)

// nutritionFakeRepo guarda o perfil enviado ao PutUserProfile para os testes
// de preservação dos campos administrativos.
type nutritionFakeRepo struct {
	repository.Repository

	existing *models.UserProfile
	written  *models.UserProfile
}

func (f *nutritionFakeRepo) GetUserProfile(_ context.Context, _ string) (*models.UserProfile, error) {
	return f.existing, nil
}

func (f *nutritionFakeRepo) PutUserProfile(_ context.Context, _ string, p *models.UserProfile) error {
	f.written = p
	return nil
}

// richProfile devolve um perfil com todos os campos administrativos preenchidos
// (o cenário que o SB-001 passou a gravar e que nunca pode ser apagado por uma
// edição comum).
func richProfile() *models.UserProfile {
	return &models.UserProfile{
		ID:             "student-1",
		Name:           "João da Silva",
		Email:          "joao@email.com",
		Role:           models.RoleStudent,
		NutritionistID: "nutri-1",
		Status:         models.StatusActive,
		PlanID:         "plano-completo",
		Features:       []models.Feature{models.FeatureWorkouts, models.FeatureDiet, models.FeatureCommunity, models.FeatureRanking},
		AuthProvider:   "password",
		ApprovedBy:     "admin-1",
		ApprovedAt:     time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
		StartDate:      "2026-01-15",
		EndDate:        "2026-12-31",
		CreatedAt:      time.Date(2025, 12, 1, 9, 0, 0, 0, time.UTC),
	}
}

// TestMergeStudentEditsPreservesAdminFields simula a edição normal de aluno
// (name, photoURL, bio, status, startDate, endDate) sobre um perfil rico e
// confirma que planID, features, authProvider, approvedBy, approvedAt e
// rejectedReason permanecem intactos — além de role, vínculo, email e createdAt.
func TestMergeStudentEditsPreservesAdminFields(t *testing.T) {
	existing := richProfile()
	edits := &models.UserProfile{
		Name:      "João Editado",
		PhotoURL:  "https://foto.nova/avatar.png",
		Bio:       "Nova bio",
		Status:    models.StatusPaused,
		StartDate: "2026-02-01",
		EndDate:   "2026-06-30",
	}

	merged := mergeStudentEdits(existing, edits)

	// Campos administrativos preservados.
	if merged.PlanID != "plano-completo" {
		t.Errorf("PlanID = %q, want plano-completo", merged.PlanID)
	}
	if len(merged.Features) != 4 || merged.Features[1] != models.FeatureDiet {
		t.Errorf("Features = %v, want as 4 preservadas", merged.Features)
	}
	if merged.AuthProvider != "password" {
		t.Errorf("AuthProvider = %q, want password", merged.AuthProvider)
	}
	if merged.ApprovedBy != "admin-1" {
		t.Errorf("ApprovedBy = %q, want admin-1", merged.ApprovedBy)
	}
	if merged.ApprovedAt.IsZero() || !merged.ApprovedAt.Equal(existing.ApprovedAt) {
		t.Errorf("ApprovedAt = %v, want preservado", merged.ApprovedAt)
	}
	if merged.RejectedReason != "" {
		t.Errorf("RejectedReason = %q, want preservado (vazio)", merged.RejectedReason)
	}
	// Role/vínculo/email/criado também preservados.
	if merged.Role != models.RoleStudent || merged.NutritionistID != "nutri-1" {
		t.Errorf("Role/NutritionistID = %q/%q, want student/nutri-1", merged.Role, merged.NutritionistID)
	}
	if merged.Email != "joao@email.com" {
		t.Errorf("Email = %q, want joao@email.com", merged.Email)
	}
	if merged.CreatedAt.IsZero() || !merged.CreatedAt.Equal(existing.CreatedAt) {
		t.Errorf("CreatedAt não preservado")
	}
	// Campos editáveis atualizados.
	if merged.Name != "João Editado" || merged.PhotoURL != "https://foto.nova/avatar.png" ||
		merged.Bio != "Nova bio" || merged.Status != models.StatusPaused ||
		merged.StartDate != "2026-02-01" || merged.EndDate != "2026-06-30" {
		t.Errorf("campos editáveis = %+v, want editado", merged)
	}
}

// TestPreserveAdminFields cobre o mesmo contrato para o HandleUpdateUser: uma
// edição comum de usuário não pode zerar plano/features/aprovação.
func TestPreserveAdminFields(t *testing.T) {
	existing := richProfile()
	p := &models.UserProfile{Name: "João", Status: models.StatusInactive}

	preserveAdminFields(existing, p)

	if p.PlanID != "plano-completo" {
		t.Errorf("PlanID = %q, want plano-completo", p.PlanID)
	}
	if len(p.Features) != 4 {
		t.Errorf("Features = %v, want preservadas", p.Features)
	}
	if p.AuthProvider != "password" || p.ApprovedBy != "admin-1" ||
		p.ApprovedAt.IsZero() || p.RejectedReason != "" {
		t.Errorf("dados de aprovação não preservados: %+v", p)
	}
}

// TestHandleUpdateUserPreservesAdminFields executa o handler completo do UPDATE
// de usuário (painel admin) sobre o fake e confere o que é gravado: os campos
// editáveis do form (nome, papel, status, vínculo) são aplicados, mas planID,
// features e o histórico de aprovação vêm do registro existente.
func TestHandleUpdateUserPreservesAdminFields(t *testing.T) {
	repo := &nutritionFakeRepo{existing: richProfile()}
	h := newApprovalHandler(repo)

	body := `{"name":"João Editado","email":"joao@email.com","role":"nutritionist","status":"active","nutritionistID":"nutri-1"}`
	rr := httptest.NewRecorder()
	r := httptest.NewRequest("PUT", "/api/users/student-1", strings.NewReader(body))
	r.SetPathValue("id", "student-1")
	h.HandleUpdateUser(rr, r)

	if rr.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200; body = %s", rr.Code, rr.Body.String())
	}
	if repo.written == nil {
		t.Fatal("PutUserProfile não foi chamado")
	}
	w := repo.written
	if w.PlanID != "plano-completo" {
		t.Errorf("PlanID = %q, want plano-completo preservado", w.PlanID)
	}
	if len(w.Features) != 4 {
		t.Errorf("Features = %v, want preservadas", w.Features)
	}
	if w.AuthProvider != "password" || w.ApprovedBy != "admin-1" || w.ApprovedAt.IsZero() {
		t.Errorf("dados de aprovação não preservados: %+v", w)
	}
	if w.Role != models.RoleNutritionist || w.Status != models.StatusActive {
		t.Errorf("Role/Status = %q/%q, want nutritionist/active (editáveis pelo admin)", w.Role, w.Status)
	}
	if w.Name != "João Editado" {
		t.Errorf("Name = %q, want João Editado", w.Name)
	}

	// O JSON de resposta continua válido para o frontend.
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("resposta inválida: %v", err)
	}
}