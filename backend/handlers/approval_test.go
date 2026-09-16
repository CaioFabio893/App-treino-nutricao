package handlers

import (
	"context"
	"encoding/json"
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
func (f *approvalFakeRepo) CountStudentsWithPlan(ctx context.Context, planID string) (int, error) {
	return f.countWithPlan(ctx, planID)
}
func (f *approvalFakeRepo) DeletePlan(ctx context.Context, id string) error {
	return f.deletePlan(ctx, id)
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

func TestHandleDeletePlanInUse(t *testing.T) {
	deleted := false
	repo := &approvalFakeRepo{
		countWithPlan: func(_ context.Context, _ string) (int, error) { return 3, nil },
		deletePlan:    func(_ context.Context, _ string) error { deleted = true; return nil },
	}
	h := newApprovalHandler(repo)
	rr := httptest.NewRecorder()
	r := httptest.NewRequest("DELETE", "/api/plans/plano-x", nil)
	r.SetPathValue("id", "plano-x")
	h.HandleDeletePlan(rr, r)
	if rr.Code != http.StatusConflict {
		t.Fatalf("code = %d, want 409", rr.Code)
	}
	if deleted {
		t.Error("plano em uso não deveria ser deletado")
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if resp["count"] != float64(3) {
		t.Errorf("count = %v, want 3", resp["count"])
	}
}

func TestHandleDeletePlanOK(t *testing.T) {
	deleted := false
	repo := &approvalFakeRepo{
		countWithPlan: func(_ context.Context, _ string) (int, error) { return 0, nil },
		deletePlan:    func(_ context.Context, _ string) error { deleted = true; return nil },
	}
	h := newApprovalHandler(repo)
	rr := httptest.NewRecorder()
	r := httptest.NewRequest("DELETE", "/api/plans/plano-livre", nil)
	r.SetPathValue("id", "plano-livre")
	h.HandleDeletePlan(rr, r)
	if rr.Code != http.StatusOK || !deleted {
		t.Errorf("code = %d, deleted = %v; want 200/true", rr.Code, deleted)
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