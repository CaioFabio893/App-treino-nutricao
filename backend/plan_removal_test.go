package main

import (
	"net/http"
	"testing"

	"treino-louise/backend/models"
)

func TestApprovedStudentsReadDietsWithoutPlan(t *testing.T) {
	for _, status := range []string{models.StatusActive, models.StatusPaused} {
		t.Run(status, func(t *testing.T) {
			repo := baseRepo(&models.UserProfile{ID: testUID, Role: models.RoleStudent, Status: status})
			res := doChainRequest(newChainMux(repo), "GET", "/api/diets", "", "valid-token")
			if res.Code != http.StatusOK {
				t.Fatalf("approved student without plan: status=%d, want 200", res.Code)
			}
		})
	}
}

func TestRemovedPlanRoutesReturnNotFound(t *testing.T) {
	mux := newChainMux(baseRepo(adminProfile(models.StatusActive)))
	for _, route := range []struct{ method, path string }{
		{"GET", "/api/plans"}, {"POST", "/api/plans"},
		{"PUT", "/api/plans/legacy"}, {"DELETE", "/api/plans/legacy"},
		{"POST", "/api/users/legacy/assign-plan"},
	} {
		res := doChainRequest(mux, route.method, route.path, "{}", "valid-token")
		if res.Code != http.StatusNotFound {
			t.Fatalf("%s %s: status=%d, want 404", route.method, route.path, res.Code)
		}
	}
}
