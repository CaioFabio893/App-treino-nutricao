package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ctxWithRole injeta uid+role no contexto (simula o withAuth).
func ctxWithRole(role Role, uid string) context.Context {
	ctx := context.Background()
	ctx = context.WithValue(ctx, uidKey, uid)
	ctx = context.WithValue(ctx, roleKey, role)
	return ctx
}

// newCtxRequest cria uma requisição GET com o contexto dado.
func newCtxRequest(ctx context.Context) *http.Request {
	r := httptest.NewRequest("GET", "/", nil)
	return r.WithContext(ctx)
}

func TestDocKey(t *testing.T) {
	if got := docKey(1, "ta"); got != "1_ta" {
		t.Errorf("docKey(1,ta) = %q, want 1_ta", got)
	}
	if got := docKey(12, "tb"); got != "12_tb" {
		t.Errorf("docKey(12,tb) = %q, want 12_tb", got)
	}
}

func TestNormalizeExercises(t *testing.T) {
	w := &WorkoutDefine{
		Exercises: []*WorkoutExercise{
			{Name: "A", Order: 99},
			{Name: "B", Order: 0},
			{Name: "C", Order: -5},
		},
	}
	normalizeExercises(w)
	for i, e := range w.Exercises {
		if e.Order != i+1 {
			t.Errorf("exercise %d order = %d, want %d", i, e.Order, i+1)
		}
	}
}

func TestNormalizeMeals(t *testing.T) {
	d := &Diet{
		Meals: []*Meal{
			{Name: "M1", Order: 10},
			{Name: "M2", Order: -1},
		},
	}
	normalizeMeals(d)
	for i, m := range d.Meals {
		if m.Order != i+1 {
			t.Errorf("meal %d order = %d, want %d", i, m.Order, i+1)
		}
	}
}

func TestParseWeekDay(t *testing.T) {
	// week 0 inválida
	r := httptest.NewRequest("GET", "/api/sessions/0/ta", nil)
	r.SetPathValue("week", "0")
	r.SetPathValue("day", "ta")
	if _, _, ok := parseWeekDay(r); ok {
		t.Error("week 0 should be invalid")
	}

	// semana 13 inválida
	r = httptest.NewRequest("GET", "/api/sessions/13/ta", nil)
	r.SetPathValue("week", "13")
	r.SetPathValue("day", "ta")
	if _, _, ok := parseWeekDay(r); ok {
		t.Error("week 13 should be invalid")
	}

	// válida
	r = httptest.NewRequest("GET", "/api/sessions/5/tb", nil)
	r.SetPathValue("week", "5")
	r.SetPathValue("day", "tb")
	week, day, ok := parseWeekDay(r)
	if !ok || week != 5 || day != "tb" {
		t.Errorf("parseWeekDay = %d/%s/%v, want 5/tb/true", week, day, ok)
	}

	// dia vazio inválido
	r = httptest.NewRequest("GET", "/api/sessions/5/", nil)
	r.SetPathValue("week", "5")
	r.SetPathValue("day", "")
	if _, _, ok := parseWeekDay(r); ok {
		t.Error("empty day should be invalid")
	}
}

func TestCanAccessResource(t *testing.T) {
	s := &Server{} // não usa Firestore nesses caminhos

	// Admin acessa tudo.
	r := newCtxRequest(ctxWithRole(RoleAdmin, "admin-uid"))
	if !s.canAccessResource(r, "student-1", "nutri-1") {
		t.Error("admin should access everything")
	}

	// Aluno só o próprio.
	r = newCtxRequest(ctxWithRole(RoleStudent, "student-1"))
	if !s.canAccessResource(r, "student-1", "nutri-1") {
		t.Error("student should access own resource")
	}
	if s.canAccessResource(r, "student-2", "nutri-1") {
		t.Error("student should NOT access another student's resource")
	}

	// Nutricionista só os próprios treinos.
	r = newCtxRequest(ctxWithRole(RoleNutritionist, "nutri-1"))
	if !s.canAccessResource(r, "student-1", "nutri-1") {
		t.Error("nutritionist should access own workouts")
	}
	if s.canAccessResource(r, "student-1", "nutri-2") {
		t.Error("nutritionist should NOT access another nutritionist's workout")
	}
}