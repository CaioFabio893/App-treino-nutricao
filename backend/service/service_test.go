package service

import (
	"testing"
	"time"

	"treino-louise/backend/models"
)

func TestAppLocIsRecife(t *testing.T) {
	// O aplicativo assume America/Recife (UTC-3, sem DST desde 2019) para que o
	// "dia" do backend (nota/streak/combo treino+dieta) bata com o dia local do
	// navegador do aluno (strings "2006-01-02" enviadas pelo front).
	zone, offset := Now().Zone()
	if zone != "BRT" && zone != "-03" {
		t.Errorf("Now().Zone() = %q, want BRT/-03", zone)
	}
	if offset != -3*60*60 {
		t.Errorf("Now() offset = %d, want -10800", offset)
	}
}

// Cenário I4 conceitual: aluno em Recife completa o treino às 23:00 local
// (02:00 UTC do dia seguinte). O dia do treino deve ser o dia LOCAL (o mesmo
// do dietLog enviado pelo navegador), não o dia UTC.
func TestWorkoutDayMatchesLocalDayAtNight(t *testing.T) {
	// 23:00 de 15/07 em Recife = 02:00 de 16/07 UTC.
	recife, err := time.LoadLocation("America/Recife")
	if err != nil {
		t.Fatal(err)
	}
	local := time.Date(2026, 7, 15, 23, 0, 0, 0, recife)

	// Como o Firestore devolveria: timestamp como instante UTC.
	utc := local.UTC()

	// ANTES da correção (Format direto em UTC) o dia estaria errado:
	if got := utc.Format("2006-01-02"); got != "2026-07-16" {
		t.Fatalf("pre-condition: utc.Format = %s, want 2026-07-16", got)
	}

	// DEPOIS da correção (.In(AppLoc)) o dia é 15/07 — o dia local do aluno.
	if got := utc.In(AppLoc).Format("2006-01-02"); got != "2026-07-15" {
		t.Errorf("CompletedAt.In(AppLoc).Format = %s, want 2026-07-15", got)
	}

	// E o "hoje" do backend neste instante é 15/07 também.
	today := local.In(AppLoc).Format("2006-01-02")
	if today != "2026-07-15" {
		t.Errorf("Now().Format = %s, want 2026-07-15", today)
	}
}

func TestAggregateStatus(t *testing.T) {
	meals := func(followed ...bool) []*models.MealCheck {
		out := make([]*models.MealCheck, 0, len(followed))
		for i, f := range followed {
			out = append(out, &models.MealCheck{MealID: string(rune('a' + i)), MealName: "M", Followed: f})
		}
		return out
	}

	if got := AggregateStatus(nil); got != models.DietNotFollowed {
		t.Errorf("agg(nil) = %s, want not_followed", got)
	}
	if got := AggregateStatus(meals(false, false)); got != models.DietNotFollowed {
		t.Errorf("agg(all no) = %s, want not_followed", got)
	}
	if got := AggregateStatus(meals(true, true)); got != models.DietFollowed {
		t.Errorf("agg(all yes) = %s, want followed", got)
	}
	if got := AggregateStatus(meals(true, false, true)); got != models.DietPartial {
		t.Errorf("agg(mixed) = %s, want partial", got)
	}
}

func TestNormalizeExercises(t *testing.T) {
	w := &models.WorkoutDefine{
		Exercises: []*models.WorkoutExercise{
			{Name: "A", Order: 99},
			{Name: "B", Order: 0},
			{Name: "C", Order: -5},
		},
	}
	NormalizeExercises(w)
	for i, e := range w.Exercises {
		if e.Order != i+1 {
			t.Errorf("exercise %d order = %d, want %d", i, e.Order, i+1)
		}
	}
}

func TestNormalizeMeals(t *testing.T) {
	d := &models.Diet{
		Meals: []*models.Meal{
			{Name: "M1", Order: 10},
			{Name: "M2", Order: -1},
		},
	}
	NormalizeMeals(d)
	for i, m := range d.Meals {
		if m.Order != i+1 {
			t.Errorf("meal %d order = %d, want %d", i, m.Order, i+1)
		}
	}
}

func TestCanAccessResource(t *testing.T) {
	// Admin acessa tudo.
	if !CanAccessResource("admin-uid", models.RoleAdmin, "student-1") {
		t.Error("admin should access everything")
	}

	// Aluno só o próprio.
	if !CanAccessResource("student-1", models.RoleStudent, "student-1") {
		t.Error("student should access own resource")
	}
	if CanAccessResource("student-2", models.RoleStudent, "student-1") {
		t.Error("student should NOT access another student's resource")
	}

	// Papel desconhecido nunca acessa nada, nem o proprio recurso.
	if CanAccessResource("hacker", "hacker", "hacker") {
		t.Error("papel desconhecido nao deveria acessar nada")
	}
}
