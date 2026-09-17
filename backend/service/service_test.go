package service

import (
	"math"
	"testing"
	"time"

	"treino-louise/backend/models"
)

func approx(a, b float64) bool {
	return math.Abs(a-b) < 1e-9
}

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

	// O ciclo (dia de abertura/fechamento) referenciado por este instante é o
	// Q3 (julho) tanto em Recife quanto em UTC — cobertura de borda.
	if c := cycleFor(local); c.ID != "2026-Q3" {
		t.Errorf("cycleFor(local) = %s, want 2026-Q3", c.ID)
	}
}

func TestCycleFor(t *testing.T) {
	tests := []struct {
		ymd       string
		wantID    string
		wantStart string
		wantEnd   string
	}{
		{"2026-01-15", "2026-Q1", "2026-01-01", "2026-04-01"},
		{"2026-03-31", "2026-Q1", "2026-01-01", "2026-04-01"},
		{"2026-04-01", "2026-Q2", "2026-04-01", "2026-07-01"},
		{"2026-08-20", "2026-Q3", "2026-07-01", "2026-10-01"},
		{"2026-10-05", "2026-Q4", "2026-10-01", "2027-01-01"},
		{"2027-01-01", "2027-Q1", "2027-01-01", "2027-04-01"},
	}
	for _, tt := range tests {
		tm, _ := parseDateYMD(tt.ymd)
		c := cycleFor(tm)
		if c.ID != tt.wantID {
			t.Errorf("cycleFor(%s).ID = %s, want %s", tt.ymd, c.ID, tt.wantID)
		}
		if got := c.Start.Format("2006-01-02"); got != tt.wantStart {
			t.Errorf("cycleFor(%s).Start = %s, want %s", tt.ymd, got, tt.wantStart)
		}
		if got := c.End.Format("2006-01-02"); got != tt.wantEnd {
			t.Errorf("cycleFor(%s).End = %s, want %s", tt.ymd, got, tt.wantEnd)
		}
	}
}

func TestDaysElapsedInCycle(t *testing.T) {
	start, _ := parseDateYMD("2026-07-01")
	today, _ := parseDateYMD("2026-07-10")

	// 10 dias decorridos (1..10 inclusive).
	if got := daysElapsedInCycle(start, "", today); got != 10 {
		t.Errorf("daysElapsed = %d, want 10", got)
	}

	// Aluno entrou no meio (05/07) → 6 dias.
	if got := daysElapsedInCycle(start, "2026-07-05", today); got != 6 {
		t.Errorf("daysElapsed with mid entry = %d, want 6", got)
	}

	// Aluno entrou antes do ciclo → usa o início do ciclo.
	if got := daysElapsedInCycle(start, "2026-05-01", today); got != 10 {
		t.Errorf("daysElapsed with early entry = %d, want 10", got)
	}

	// Nunca deve ser menor que 1.
	if got := daysElapsedInCycle(today, "", today); got != 1 {
		t.Errorf("daysElapsed same day = %d, want 1", got)
	}
}

func TestScoreFromPointsAndRaw(t *testing.T) {
	// Treino+dieta em todos os 10 dias: 10 × 1,0 → nota 10.
	days := map[string]models.DayPoints{}
	for i := 1; i <= 10; i++ {
		days[time.Date(2026, 7, i, 0, 0, 0, 0, time.Local).Format("2006-01-02")] = models.DayPoints{
			WorkoutDone: true,
			DietStatus:  models.DietFollowed,
		}
	}
	raw := computeRawPoints(days)
	if !approx(raw, 10.0) {
		t.Errorf("raw points = %v, want 10.0", raw)
	}
	if got := scoreFromPoints(raw, 10); got != 10.0 {
		t.Errorf("score = %v, want 10.0", got)
	}

	// Só treino em metade dos dias (5 dias): raw = 2,0 → 2/10*10 = 2,0.
	only := map[string]models.DayPoints{}
	for i := 1; i <= 5; i++ {
		only[time.Date(2026, 7, i, 0, 0, 0, 0, time.Local).Format("2006-01-02")] = models.DayPoints{
			WorkoutDone: true,
		}
	}
	raw = computeRawPoints(only)
	if !approx(raw, 2.0) {
		t.Errorf("raw points only workout = %v, want 2.0", raw)
	}
	if got := scoreFromPoints(raw, 10); got != 2.0 {
		t.Errorf("score = %v, want 2.0", got)
	}

	// Limite de 10: 12 dias perfeitos.
	over := map[string]models.DayPoints{}
	for i := 1; i <= 12; i++ {
		over[time.Date(2026, 7, i, 0, 0, 0, 0, time.Local).Format("2006-01-02")] = models.DayPoints{
			WorkoutDone: true,
			DietStatus:  models.DietFollowed,
		}
	}
	if got := scoreFromPoints(computeRawPoints(over), 12); got != 10.0 {
		t.Errorf("score capped = %v, want 10.0", got)
	}

	// Arredondamento de 1 casa.
	if got := scoreFromPoints(0.66, 1); got != 6.6 {
		t.Errorf("score round = %v, want 6.6", got)
	}
}

func TestCycleScoreFromData(t *testing.T) {
	cycle := cycleFor(time.Date(2026, 7, 10, 0, 0, 0, 0, time.Local))
	raw, done, score, denom := cycleScoreFromData(
		cycle,
		"2026-07-01",
		time.Date(2026, 7, 10, 0, 0, 0, 0, time.Local),
		[]string{"2026-07-01", "2026-07-02"},
		map[string]models.DietLogStatus{"2026-07-01": models.DietFollowed},
	)
	// raw = 0,4 (d1 treino) + 0,4 (d1 dieta) + 0,2 (combo) + 0,4 (d2 treino) = 1,4
	if !approx(raw, 1.4) {
		t.Errorf("raw = %v, want 1.4", raw)
	}
	if done != 2 {
		t.Errorf("daysCompleted = %d, want 2", done)
	}
	if denom != 10 {
		t.Errorf("denom = %d, want 10", denom)
	}
	if score != round1(1.4/10*10) {
		t.Errorf("score = %v, want %v", score, round1(1.4/10*10))
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

func TestBuildRanking(t *testing.T) {
	students := []*models.UserProfile{
		{ID: "s1", Name: "Ana"},
		{ID: "s2", Name: "Bia"},
		{ID: "s3", Name: "Cacá"},
	}
	scores := map[string]*models.ScoreRecord{
		"s2": {StudentID: "s2", Score: 8.5},
		"s3": {StudentID: "s3", Score: 9.0},
		// s1 sem score → 0
	}
	entries := BuildRanking(students, scores)
	if len(entries) != 3 {
		t.Fatalf("len = %d, want 3", len(entries))
	}
	if entries[0].StudentID != "s3" || entries[0].Rank != 1 || entries[0].Score != 9.0 {
		t.Errorf("rank1 = %+v, want s3/1/9.0", entries[0])
	}
	if entries[1].StudentID != "s2" || entries[1].Rank != 2 {
		t.Errorf("rank2 = %+v, want s2/2", entries[1])
	}
	if entries[2].StudentID != "s1" || entries[2].Rank != 3 || entries[2].Score != 0 {
		t.Errorf("rank3 = %+v, want s1/3/0", entries[2])
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
	if !CanAccessResource("admin-uid", models.RoleAdmin, "student-1", "nutri-1") {
		t.Error("admin should access everything")
	}

	// Aluno só o próprio.
	if !CanAccessResource("student-1", models.RoleStudent, "student-1", "nutri-1") {
		t.Error("student should access own resource")
	}
	if CanAccessResource("student-2", models.RoleStudent, "student-1", "nutri-1") {
		t.Error("student should NOT access another student's resource")
	}

	// Nutricionista só os próprios treinos.
	if !CanAccessResource("nutri-1", models.RoleNutritionist, "student-1", "nutri-1") {
		t.Error("nutritionist should access own workouts")
	}
	if CanAccessResource("nutri-2", models.RoleNutritionist, "student-1", "nutri-1") {
		t.Error("nutritionist should NOT access another nutritionist's workout")
	}
}
