package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"treino-louise/backend/models"
)

func TestApproveUserWithoutPlan(t *testing.T) {
	created := time.Date(2026, 1, 1, 0, 0, 0, 0, AppLoc)
	var saved *models.UserProfile
	repo := &fakeRepo{
		getUserProfile: func(context.Context, string) (*models.UserProfile, error) {
			return &models.UserProfile{ID: "student", Status: models.StatusPendingApproval, CreatedAt: created}, nil
		},
		putUserProfile: func(_ context.Context, _ string, p *models.UserProfile) error { saved = p; return nil },
	}
	svc := New(repo)
	if err := svc.ApproveUser(context.Background(), "admin", "student", models.RoleStudent); err != nil {
		t.Fatal(err)
	}
	if saved == nil || saved.Role != models.RoleStudent || saved.Status != models.StatusActive || saved.ApprovedBy != "admin" || saved.ApprovedAt.IsZero() || !saved.CreatedAt.Equal(created) {
		t.Fatalf("invalid approval: %+v", saved)
	}
	for _, role := range []models.Role{models.RoleAdmin, "nutritionist", "", "unknown"} {
		saved = nil
		if err := svc.ApproveUser(context.Background(), "admin", "student", role); !errors.Is(err, ErrInvalidRole) {
			t.Fatalf("role %q: %v, want invalid role", role, err)
		}
		if saved != nil {
			t.Fatal("invalid approval wrote profile")
		}
	}
}

func TestApproveUserMissingProfileWithoutPlan(t *testing.T) {
	if err := New(&fakeRepo{}).ApproveUser(context.Background(), "admin", "missing", models.RoleStudent); !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("got %v, want missing user", err)
	}
}
