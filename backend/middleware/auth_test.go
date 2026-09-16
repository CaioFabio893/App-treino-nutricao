package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"treino-louise/backend/models"
)

func TestIsApproved(t *testing.T) {
	tests := []struct {
		name   string
		status string
		want   bool
	}{
		{"legado sem status", "", true},
		{"ativo", models.StatusActive, true},
		{"pausado", models.StatusPaused, true},
		{"pendente", models.StatusPendingApproval, false},
		{"rejeitado", models.StatusRejected, false},
		{"inativo", models.StatusInactive, false},
	}
	for _, tt := range tests {
		ctx := context.WithValue(context.Background(), statusKey, tt.status)
		if got := IsApproved(ctx); got != tt.want {
			t.Errorf("IsApproved(%q) = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestRequireApproved(t *testing.T) {
	a := &Auth{}
	called := false
	h := a.RequireApproved(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	// Pendente → 403 e handler não roda.
	rr := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/api/workouts", nil)
	r = r.WithContext(context.WithValue(r.Context(), statusKey, models.StatusPendingApproval))
	h(rr, r)
	if rr.Code != http.StatusForbidden {
		t.Errorf("pending code = %d, want 403", rr.Code)
	}
	if called {
		t.Error("pending user should not reach handler")
	}

	// Rejeitado → 403.
	rr = httptest.NewRecorder()
	r = httptest.NewRequest("GET", "/api/workouts", nil)
	r = r.WithContext(context.WithValue(r.Context(), statusKey, models.StatusRejected))
	h(rr, r)
	if rr.Code != http.StatusForbidden {
		t.Errorf("rejected code = %d, want 403", rr.Code)
	}

	// Ativo → 200.
	called = false
	rr = httptest.NewRecorder()
	r = httptest.NewRequest("GET", "/api/workouts", nil)
	r = r.WithContext(context.WithValue(r.Context(), statusKey, models.StatusActive))
	h(rr, r)
	if rr.Code != http.StatusOK || !called {
		t.Errorf("active code = %d, called = %v; want 200/true", rr.Code, called)
	}
}

// TestRequireApprovedAdminBypass prova que ADMIN autenticado sempre passa pelo
// RequireApproved — independente do status — enquanto usuários comuns seguem
// obedecendo às regras de status.
func TestRequireApprovedAdminBypass(t *testing.T) {
	a := &Auth{}
	tests := []struct {
		name       string
		role       models.Role
		status     string
		wantCode   int
		wantCalled bool
	}{
		{"admin + pending_approval permitido", models.RoleAdmin, models.StatusPendingApproval, http.StatusOK, true},
		{"admin + rejected permitido", models.RoleAdmin, models.StatusRejected, http.StatusOK, true},
		{"admin + inactive permitido", models.RoleAdmin, models.StatusInactive, http.StatusOK, true},
		{"admin + active permitido", models.RoleAdmin, models.StatusActive, http.StatusOK, true},
		{"comum + pending_approval bloqueado", models.RoleStudent, models.StatusPendingApproval, http.StatusForbidden, false},
		{"comum + rejected bloqueado", models.RoleStudent, models.StatusRejected, http.StatusForbidden, false},
		{"comum + active permitido", models.RoleStudent, models.StatusActive, http.StatusOK, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			called := false
			h := a.RequireApproved(func(w http.ResponseWriter, r *http.Request) {
				called = true
				w.WriteHeader(http.StatusOK)
			})
			rr := httptest.NewRecorder()
			r := httptest.NewRequest("GET", "/api/workouts", nil)
			ctx := context.WithValue(r.Context(), roleKey, tt.role)
			ctx = context.WithValue(ctx, statusKey, tt.status)
			h(rr, r.WithContext(ctx))
			if rr.Code != tt.wantCode {
				t.Errorf("%s: code = %d, want %d", tt.name, rr.Code, tt.wantCode)
			}
			if called != tt.wantCalled {
				t.Errorf("%s: called = %v, want %v", tt.name, called, tt.wantCalled)
			}
		})
	}
}

func TestRequireFeature(t *testing.T) {
	a := &Auth{}
	hit := func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }
	h := a.RequireFeature(models.FeatureDiet)(hit)

	// Aluno sem diet acessando dietas → 403.
	r := httptest.NewRequest("GET", "/api/diets", nil)
	ctx := context.WithValue(r.Context(), roleKey, models.RoleStudent)
	ctx = context.WithValue(ctx, featuresKey, []models.Feature{models.FeatureWorkouts})
	rr := httptest.NewRecorder()
	h(rr, r.WithContext(ctx))
	if rr.Code != http.StatusForbidden {
		t.Errorf("sem diet code = %d, want 403", rr.Code)
	}

	// Aluno com diet → 200.
	r = httptest.NewRequest("GET", "/api/diets", nil)
	ctx = context.WithValue(r.Context(), roleKey, models.RoleStudent)
	ctx = context.WithValue(ctx, featuresKey, []models.Feature{models.FeatureWorkouts, models.FeatureDiet})
	rr = httptest.NewRecorder()
	h(rr, r.WithContext(ctx))
	if rr.Code != http.StatusOK {
		t.Errorf("com diet code = %d, want 200", rr.Code)
	}

	// Nutricionista (mesmo sem features) → 200.
	r = httptest.NewRequest("GET", "/api/diets", nil)
	ctx = context.WithValue(r.Context(), roleKey, models.RoleNutritionist)
	rr = httptest.NewRecorder()
	h(rr, r.WithContext(ctx))
	if rr.Code != http.StatusOK {
		t.Errorf("nutritionist code = %d, want 200", rr.Code)
	}

	// Admin → 200.
	r = httptest.NewRequest("GET", "/api/diets", nil)
	ctx = context.WithValue(r.Context(), roleKey, models.RoleAdmin)
	rr = httptest.NewRecorder()
	h(rr, r.WithContext(ctx))
	if rr.Code != http.StatusOK {
		t.Errorf("admin code = %d, want 200", rr.Code)
	}
}

func TestRoleFrom(t *testing.T) {
	if got := RoleFrom(context.Background()); got != models.RoleStudent {
		t.Errorf("RoleFrom(default) = %q, want student", got)
	}
	ctx := context.WithValue(context.Background(), roleKey, models.RoleAdmin)
	if got := RoleFrom(ctx); got != models.RoleAdmin {
		t.Errorf("RoleFrom(admin) = %q, want admin", got)
	}
}