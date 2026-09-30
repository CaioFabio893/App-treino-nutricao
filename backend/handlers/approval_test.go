package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"treino-louise/backend/models"
	"treino-louise/backend/repository"
	"treino-louise/backend/service"
)

// approvalFakeRepo é um repositório mínimo para os handlers de aprovação/planos.
type approvalFakeRepo struct {
	repository.Repository

	listPending    func(ctx context.Context) ([]*models.UserProfile, error)
	getUserProfile func(ctx context.Context, uid string) (*models.UserProfile, error)
	putUserProfile func(ctx context.Context, uid string, p *models.UserProfile) error
	countWithPlan  func(ctx context.Context, planID string) (int, error)
	deletePlan     func(ctx context.Context, id string) error
}

func (f *approvalFakeRepo) ListUsersByStatus(ctx context.Context, _ string) ([]*models.UserProfile, error) {
	return f.listPending(ctx)
}
func (f *approvalFakeRepo) GetUserProfile(ctx context.Context, uid string) (*models.UserProfile, error) {
	return f.getUserProfile(ctx, uid)
}
func (f *approvalFakeRepo) PutUserProfile(ctx context.Context, uid string, p *models.UserProfile) error {
	return f.putUserProfile(ctx, uid, p)
}

func newApprovalHandler(repo repository.Repository) *Handlers {
	return &Handlers{svc: service.New(repo), repo: repo, auth: nil}
}

func TestHandleListPendingUsers(t *testing.T) {
	repo := &approvalFakeRepo{
		listPending: func(_ context.Context) ([]*models.UserProfile, error) {
			return []*models.UserProfile{
				{ID: "u1", Name: "Maria", Status: models.StatusPendingApproval},
			}, nil
		},
	}
	h := newApprovalHandler(repo)
	rr := httptest.NewRecorder()
	h.HandleListPendingUsers(rr, httptest.NewRequest("GET", "/api/users/pending", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200", rr.Code)
	}
	if body := rr.Body.String(); !strings.Contains(body, "Maria") {
		t.Errorf("body = %q, want Maria", body)
	}
}

func TestHandleRejectUser(t *testing.T) {
	repo := &approvalFakeRepo{
		getUserProfile: func(_ context.Context, _ string) (*models.UserProfile, error) {
			return &models.UserProfile{ID: "u1", Status: models.StatusPendingApproval}, nil
		},
		putUserProfile: func(_ context.Context, _ string, p *models.UserProfile) error { return nil },
	}
	h := newApprovalHandler(repo)
	rr := httptest.NewRecorder()
	r := httptest.NewRequest("POST", "/api/users/u1/reject", strings.NewReader(`{"reason":"sem identificacao"}`))
	r.SetPathValue("id", "u1")
	h.HandleRejectUser(rr, r)
	if rr.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200 (erro? %s)", rr.Code, rr.Body.String())
	}
}
