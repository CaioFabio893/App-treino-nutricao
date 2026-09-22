package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"treino-louise/backend/models"
	"treino-louise/backend/repository"
)

// ── Achado 4 (pre-f13): perfil público não expõe dados sensíveis ──
//
// GET /api/public/profile/{id} devolve um PublicProfile (DTO mínimo), nunca o
// UserProfile completo. O fake devolve um perfil COMPLETO (com email, status,
// provider, vínculo, plano, features e histórico de aprovação preenchidos) e o
// teste garante que nenhum desses campos aparece na serialização pública.

type publicProfileRepo struct {
	repository.Repository
	prof *models.UserProfile
}

func (r *publicProfileRepo) GetUserProfile(_ context.Context, _ string) (*models.UserProfile, error) {
	return r.prof, nil
}

func (r *publicProfileRepo) ListHistoryForStudent(_ context.Context, _ string) ([]*models.WorkoutHistoryEntry, error) {
	return nil, nil
}

func (r *publicProfileRepo) ListDietLogsForStudent(_ context.Context, _, _, _ string) ([]*models.DietDailyLog, error) {
	return nil, nil
}

func (r *publicProfileRepo) GetScoreRecord(_ context.Context, _ string) (*models.ScoreRecord, error) {
	return nil, nil
}

func TestGetPublicProfileDoesNotExposeSensitiveFields(t *testing.T) {
	prof := &models.UserProfile{
		ID:             "u1",
		Name:           "Ana",
		Email:          "ana@secreto.com",
		PhotoURL:       "foto.png",
		Bio:            "bio pública",
		Role:           models.RoleStudent,
		Status:         models.StatusActive,
		AuthProvider:   "google.com",
		NutritionistID: "nutri-1",
		PlanID:         "plano-1",
		Features:       []models.Feature{models.FeatureDiet, models.FeatureRanking},
		ApprovedBy:     "admin-1",
		RejectedReason: "não",
		StartDate:      "2026-01-01",
		EndDate:        "2026-04-01",
	}
	svc := New(&publicProfileRepo{prof: prof})

	out, err := svc.GetPublicProfile(context.Background(), "u1")
	if err != nil {
		t.Fatalf("GetPublicProfile: %v", err)
	}
	if out == nil {
		t.Fatal("GetPublicProfile devolveu nil")
	}

	b, err := json.Marshal(out)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	body := string(b)

	// Nenhum campo sensível/interno pode vazar na serialização pública.
	for _, forbidden := range []string{
		"email", "status", "authProvider", "nutritionistID",
		"planID", "features", "approvedBy", "approvedAt", "rejectedReason",
		"startDate", "endDate", "createdAt",
	} {
		if strings.Contains(body, forbidden) {
			t.Errorf("perfil público vaza %q: %s", forbidden, body)
		}
	}

	// Campos públicos esperados estão presentes e corretos.
	if out.ID != "u1" || out.Name != "Ana" || out.PhotoURL != "foto.png" ||
		out.Bio != "bio pública" || out.Role != models.RoleStudent {
		t.Errorf("campos públicos errados: %+v", out)
	}
}
