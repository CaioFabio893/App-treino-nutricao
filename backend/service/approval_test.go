package service

import (
	"context"
	"errors"
	"testing"

	"treino-louise/backend/models"
	"treino-louise/backend/repository"
)

// fakeRepo implementa só os métodos usados pelo fluxo de aprovação/planos,
// embutindo a interface completa (chamadas não implementadas dão panic — os
// testes só exercitam os métodos definidos abaixo).
type fakeRepo struct {
	repository.Repository

	getUserProfile func(ctx context.Context, uid string) (*models.UserProfile, error)
	createUser     func(ctx context.Context, uid string, p *models.UserProfile) error
	putUserProfile func(ctx context.Context, uid string, p *models.UserProfile) error
	getPlan        func(ctx context.Context, id string) (*models.Plan, error)
}

func (f *fakeRepo) GetUserProfile(ctx context.Context, uid string) (*models.UserProfile, error) {
	if f.getUserProfile == nil {
		return nil, nil
	}
	return f.getUserProfile(ctx, uid)
}

func (f *fakeRepo) CreateUser(ctx context.Context, uid string, p *models.UserProfile) error {
	if f.createUser == nil {
		return nil
	}
	return f.createUser(ctx, uid, p)
}

func (f *fakeRepo) PutUserProfile(ctx context.Context, uid string, p *models.UserProfile) error {
	if f.putUserProfile == nil {
		return nil
	}
	return f.putUserProfile(ctx, uid, p)
}

func (f *fakeRepo) GetPlan(ctx context.Context, id string) (*models.Plan, error) {
	if f.getPlan == nil {
		return nil, nil
	}
	return f.getPlan(ctx, id)
}

func TestGetOrCreateProfile_Pending(t *testing.T) {
	// Perfil novo → cria como pending_approval e role vazio.
	var created *models.UserProfile
	repo := &fakeRepo{
		createUser: func(_ context.Context, _ string, p *models.UserProfile) error {
			created = p
			return nil
		},
	}
	svc := New(repo)

	sent := &models.UserProfile{Name: "Maria", Email: "maria@email.com", Role: models.RoleStudent, Status: models.StatusActive}
	if err := svc.GetOrCreateProfile(context.Background(), "u1", sent); err != nil {
		t.Fatalf("GetOrCreateProfile: %v", err)
	}
	if created == nil {
		t.Fatal("perfil novo não foi criado")
	}
	if created.Role != "" {
		t.Errorf("role = %q, want vazio", created.Role)
	}
	if created.Status != models.StatusPendingApproval {
		t.Errorf("status = %q, want %q", created.Status, models.StatusPendingApproval)
	}

	// Perfil existente → preserva role/status administrativos (cliente não manda).
	var updated *models.UserProfile
	repo.putUserProfile = func(_ context.Context, _ string, p *models.UserProfile) error {
		updated = p
		return nil
	}
	repo.getUserProfile = func(_ context.Context, _ string) (*models.UserProfile, error) {
		return &models.UserProfile{
			ID: "u1", Name: "Maria", Role: models.RoleStudent, Status: models.StatusActive,
			PlanID: "p1", Features: []models.Feature{models.FeatureWorkouts},
		}, nil
	}
	svc = New(repo)
	attempt := &models.UserProfile{Name: "Maria Nova", Role: models.RoleAdmin, Status: models.StatusRejected}
	if err := svc.GetOrCreateProfile(context.Background(), "u1", attempt); err != nil {
		t.Fatalf("GetOrCreateProfile: %v", err)
	}
	if updated.Role != models.RoleStudent {
		t.Errorf("role = %q, preservou %q", updated.Role, models.RoleStudent)
	}
	if updated.Status != models.StatusActive {
		t.Errorf("status = %q, preservou active", updated.Status)
	}
	if updated.PlanID != "p1" || len(updated.Features) != 1 {
		t.Errorf("plano não preservado: %+v", updated)
	}
	if updated.Name != "Maria Nova" {
		t.Errorf("nome não atualizado: %q", updated.Name)
	}
}

func TestApproveUser(t *testing.T) {
	plan := &models.Plan{
		ID: "plano-completo", Name: "Completo", Active: true,
		Features: []models.Feature{models.FeatureWorkouts, models.FeatureDiet, models.FeatureCommunity},
	}

	t.Run("aprova aluno com plano", func(t *testing.T) {
		var updated *models.UserProfile
		repo := &fakeRepo{
			getUserProfile: func(_ context.Context, _ string) (*models.UserProfile, error) {
				return &models.UserProfile{ID: "u1", Status: models.StatusPendingApproval}, nil
			},
			putUserProfile: func(_ context.Context, _ string, p *models.UserProfile) error {
				updated = p
				return nil
			},
			getPlan: func(_ context.Context, id string) (*models.Plan, error) {
				if id != "plano-completo" {
					return nil, nil
				}
				return plan, nil
			},
		}
		svc := New(repo)
		err := svc.ApproveUser(context.Background(), "admin-1", "u1", models.RoleStudent, "plano-completo", "nutri-1")
		if err != nil {
			t.Fatalf("ApproveUser: %v", err)
		}
		if updated.Role != models.RoleStudent || updated.Status != models.StatusActive {
			t.Errorf("role/status = %q/%q, want student/active", updated.Role, updated.Status)
		}
		if updated.PlanID != "plano-completo" {
			t.Errorf("planID = %q, want plano-completo", updated.PlanID)
		}
		if len(updated.Features) != 3 {
			t.Errorf("features = %v, want 3 itens", updated.Features)
		}
		if updated.ApprovedBy != "admin-1" || updated.ApprovedAt.IsZero() {
			t.Errorf("approvedBy/approvedAt não preenchidos: %+v", updated)
		}
		if updated.NutritionistID != "nutri-1" {
			t.Errorf("nutritionistID = %q, want nutri-1", updated.NutritionistID)
		}
	})

	t.Run("aprova nutricionista (sem plano/vínculo)", func(t *testing.T) {
		var updated *models.UserProfile
		repo := &fakeRepo{
			getUserProfile: func(_ context.Context, _ string) (*models.UserProfile, error) {
				return &models.UserProfile{ID: "u2", Status: models.StatusPendingApproval, NutritionistID: "antigo"}, nil
			},
			putUserProfile: func(_ context.Context, _ string, p *models.UserProfile) error {
				updated = p
				return nil
			},
		}
		svc := New(repo)
		err := svc.ApproveUser(context.Background(), "admin-1", "u2", models.RoleNutritionist, "", "")
		if err != nil {
			t.Fatalf("ApproveUser: %v", err)
		}
		if updated.PlanID != "" || updated.NutritionistID != "" || len(updated.Features) != 0 {
			t.Errorf("nutricionista não deveria ter plano/vínculo: %+v", updated)
		}
	})

	t.Run("papel invalido", func(t *testing.T) {
		repo := &fakeRepo{}
		svc := New(repo)
		if err := svc.ApproveUser(context.Background(), "admin-1", "u3", "hacker", "", ""); !errors.Is(err, ErrInvalidRole) {
			t.Errorf("err = %v, want ErrInvalidRole", err)
		}
	})

	t.Run("plano inexistente", func(t *testing.T) {
		repo := &fakeRepo{
			getUserProfile: func(_ context.Context, _ string) (*models.UserProfile, error) {
				return &models.UserProfile{ID: "u4", Status: models.StatusPendingApproval}, nil
			},
		}
		svc := New(repo)
		err := svc.ApproveUser(context.Background(), "admin-1", "u4", models.RoleStudent, "nao-existe", "")
		if !errors.Is(err, ErrPlanNotFound) {
			t.Errorf("err = %v, want ErrPlanNotFound", err)
		}
	})

	t.Run("plano inativo", func(t *testing.T) {
		repo := &fakeRepo{
			getUserProfile: func(_ context.Context, _ string) (*models.UserProfile, error) {
				return &models.UserProfile{ID: "u5", Status: models.StatusPendingApproval}, nil
			},
			getPlan: func(_ context.Context, _ string) (*models.Plan, error) {
				return &models.Plan{ID: "p-desativado", Active: false}, nil
			},
		}
		svc := New(repo)
		err := svc.ApproveUser(context.Background(), "admin-1", "u5", models.RoleStudent, "p-desativado", "")
		if !errors.Is(err, ErrPlanInactive) {
			t.Errorf("err = %v, want ErrPlanInactive", err)
		}
	})
}

func TestRejectUser(t *testing.T) {
	var updated *models.UserProfile
	repo := &fakeRepo{
		getUserProfile: func(_ context.Context, _ string) (*models.UserProfile, error) {
			return &models.UserProfile{ID: "u1", Status: models.StatusPendingApproval}, nil
		},
		putUserProfile: func(_ context.Context, _ string, p *models.UserProfile) error {
			updated = p
			return nil
		},
	}
	svc := New(repo)
	if err := svc.RejectUser(context.Background(), "u1", "email nao reconhecido"); err != nil {
		t.Fatalf("RejectUser: %v", err)
	}
	if updated.Status != models.StatusRejected {
		t.Errorf("status = %q, want rejected", updated.Status)
	}
	if updated.RejectedReason != "email nao reconhecido" {
		t.Errorf("rejectedReason = %q", updated.RejectedReason)
	}
}

func TestAssignPlan(t *testing.T) {
	plan := &models.Plan{
		ID: "basico", Name: "Básico", Active: true,
		Features: []models.Feature{models.FeatureWorkouts},
	}

	t.Run("atribui plano e snapshota features", func(t *testing.T) {
		var updated *models.UserProfile
		repo := &fakeRepo{
			getPlan: func(_ context.Context, _ string) (*models.Plan, error) { return plan, nil },
			getUserProfile: func(_ context.Context, _ string) (*models.UserProfile, error) {
				return &models.UserProfile{ID: "u1", Status: models.StatusActive, PlanID: "antigo"}, nil
			},
			putUserProfile: func(_ context.Context, _ string, p *models.UserProfile) error {
				updated = p
				return nil
			},
		}
		svc := New(repo)
		if err := svc.AssignPlan(context.Background(), "u1", "basico"); err != nil {
			t.Fatalf("AssignPlan: %v", err)
		}
		if updated.PlanID != "basico" || len(updated.Features) != 1 || updated.Features[0] != models.FeatureWorkouts {
			t.Errorf("plano não aplicado: %+v", updated)
		}
	})

	t.Run("planID vazio", func(t *testing.T) {
		svc := New(&fakeRepo{})
		if err := svc.AssignPlan(context.Background(), "u1", ""); !errors.Is(err, ErrInvalidPlanID) {
			t.Errorf("err = %v, want ErrInvalidPlanID", err)
		}
	})

	t.Run("plano inativo", func(t *testing.T) {
		repo := &fakeRepo{
			getPlan: func(_ context.Context, _ string) (*models.Plan, error) {
				return &models.Plan{ID: "p", Active: false}, nil
			},
		}
		svc := New(repo)
		if err := svc.AssignPlan(context.Background(), "u1", "p"); !errors.Is(err, ErrPlanInactive) {
			t.Errorf("err = %v, want ErrPlanInactive", err)
		}
	})
}