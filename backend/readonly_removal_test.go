package main

import (
	"net/http"
	"testing"
	"treino-louise/backend/models"
)

func TestRetiredStudentWriteRoutesAreUnavailable(t *testing.T) {
	mux := newChainMux(baseRepo(studentProfile(models.StatusActive)))
	for _, r := range []struct{ method, path string }{
		{"POST", "/api/workouts/complete"}, {"GET", "/api/workout-history"},
		{"GET", "/api/diet-logs"}, {"PUT", "/api/diet-logs"},
	} {
		res := doChainRequest(mux, r.method, r.path, "{}", "valid-token")
		if res.Code != http.StatusNotFound {
			t.Errorf("%s %s = %d, want 404", r.method, r.path, res.Code)
		}
	}
}
