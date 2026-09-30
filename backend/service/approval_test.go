package service

import (
	"context"
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
	if updated.Name != "Maria Nova" {
		t.Errorf("nome não atualizado: %q", updated.Name)
	}
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
