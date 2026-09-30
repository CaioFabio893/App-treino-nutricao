package repository

// Testes do contrato JSON de coleções: endpoints que listam registros devem
// serializar como `[]` quando vazios — nunca como `null`. O bug original era
// `var out []*T` (slice nil) → encoding/json produzia `null`, e o frontend
// quebrava ao chamar `.filter()`/`.length` em `null`.

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"treino-louise/backend/models"
)

// emptyIterator simula uma coleção sem documentos: a primeira chamada a Next
// devolve iterator.Done, exatamente como o iterador real do Firestore faz.
type emptyIterator struct{}

func (emptyIterator) Next() (*firestore.DocumentSnapshot, error) { return nil, iterator.Done }
func (emptyIterator) Stop()                                      {}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}
	return string(b)
}

// TestEnsureNonNilSliceSerializesAsArray prova a diferença que causava o bug:
// slice nil → `null`; slice normalizado → `[]`.
func TestEnsureNonNilSliceSerializesAsArray(t *testing.T) {
	// Pré-condição do bug: nil serializa como null.
	var nilSlice []*models.WorkoutDefine
	if got := mustJSON(t, nilSlice); got != "null" {
		t.Fatalf("pré-condição: slice nil serializou %q, want \"null\"", got)
	}

	got := ensureNonNilSlice(nilSlice)
	if got == nil {
		t.Fatal("ensureNonNilSlice(nil) devolveu nil")
	}
	if len(got) != 0 {
		t.Fatalf("len = %d, want 0", len(got))
	}
	if s := mustJSON(t, got); s != "[]" {
		t.Fatalf("JSON = %q, want []", s)
	}
}

// TestEnsureNonNilSliceNilToArrayAllTypes cobre cada tipo de coleção exposto
// pelos endpoints (planos, usuários/alunos, treinos, dietas, diet-logs).
func TestEnsureNonNilSliceNilToArrayAllTypes(t *testing.T) {
	var (
		plans    []*models.WorkoutDefine
		profiles []*models.UserProfile
		workouts []*models.WorkoutDefine
		diets    []*models.Diet
		logs     []*models.DietDailyLog
	)

	cases := []struct {
		name string
		got  any
	}{
		{"plans", ensureNonNilSlice(plans)},
		{"profiles", ensureNonNilSlice(profiles)},
		{"workouts", ensureNonNilSlice(workouts)},
		{"diets", ensureNonNilSlice(diets)},
		{"dietLogs", ensureNonNilSlice(logs)},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if s := mustJSON(t, c.got); s != "[]" {
				t.Errorf("JSON = %q, want [] (nunca null)", s)
			}
		})
	}
}

// TestEnsureNonNilSliceKeepsRecords garante que a normalização não descarta
// registros: coleções com conteúdo continuam arrays normais.
func TestEnsureNonNilSliceKeepsRecords(t *testing.T) {
	in := []*models.WorkoutDefine{{ID: "p1", Name: "Plano A"}}
	out := ensureNonNilSlice(in)
	if len(out) != 1 || out[0].ID != "p1" {
		t.Fatalf("ensureNonNilSlice preservou %d registros (want 1 com ID p1)", len(out))
	}
	s := mustJSON(t, out)
	if !strings.HasPrefix(s, "[") || !strings.Contains(s, `"id":"p1"`) {
		t.Fatalf("JSON = %q, want array contendo o registro", s)
	}
}

// TestEnsureNonNilSliceKeepsEmptyNonNil confirma que um slice vazio já
// inicializado permanece vazio e não-nil.
func TestEnsureNonNilSliceKeepsEmptyNonNil(t *testing.T) {
	out := ensureNonNilSlice([]*models.Diet{})
	if out == nil {
		t.Fatal("slice vazio não-nil virou nil")
	}
	if s := mustJSON(t, out); s != "[]" {
		t.Fatalf("JSON = %q, want []", s)
	}
}

// TestIterHelpersReturnEmptyArrayWhenCollectionEmpty exercita os coletores
// reais dos endpoints de alunos/usuários, treinos e dietas com uma coleção
// Firestore vazia, provando que devolvem `[]` (não-nil) e serializam `[]`.
func TestIterHelpersReturnEmptyArrayWhenCollectionEmpty(t *testing.T) {
	t.Run("profilesFromIter", func(t *testing.T) {
		out, err := profilesFromIter(emptyIterator{})
		if err != nil {
			t.Fatalf("err = %v", err)
		}
		if out == nil {
			t.Fatal("devolveu nil (serializaria null)")
		}
		if len(out) != 0 {
			t.Fatalf("len = %d, want 0", len(out))
		}
		if s := mustJSON(t, out); s != "[]" {
			t.Fatalf("JSON = %q, want []", s)
		}
	})

	t.Run("workoutsFromIter", func(t *testing.T) {
		out, err := workoutsFromIter(emptyIterator{})
		if err != nil {
			t.Fatalf("err = %v", err)
		}
		if out == nil {
			t.Fatal("devolveu nil (serializaria null)")
		}
		if s := mustJSON(t, out); s != "[]" {
			t.Fatalf("JSON = %q, want []", s)
		}
	})

	t.Run("dietsFromIter", func(t *testing.T) {
		out, err := dietsFromIter(emptyIterator{})
		if err != nil {
			t.Fatalf("err = %v", err)
		}
		if out == nil {
			t.Fatal("devolveu nil (serializaria null)")
		}
		if s := mustJSON(t, out); s != "[]" {
			t.Fatalf("JSON = %q, want []", s)
		}
	})

	// F19: a listagem de programas segue o mesmo contrato — [] e nunca null.
	t.Run("programsFromIter", func(t *testing.T) {
		out, err := programsFromIter(emptyIterator{})
		if err != nil {
			t.Fatalf("err = %v", err)
		}
		if out == nil {
			t.Fatal("devolveu nil (serializaria null)")
		}
		if s := mustJSON(t, out); s != "[]" {
			t.Fatalf("JSON = %q, want []", s)
		}
	})
}

// TestUserProfileDataPreservesCreatedAt — FASE 4 (I1): a escrita de users/{uid}
// nunca pode sobrescrever `createdAt` de um perfil existente. Se o perfil tiver
// CreatedAt preenchido, o mapa de escrita deve conter ESSE valor; só perfil novo
// (CreatedAt zero) usa ServerTimestamp.
func TestUserProfileDataPreservesCreatedAt(t *testing.T) {
	past := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	p := &models.UserProfile{ID: "u1", Name: "Ana", CreatedAt: past}

	m := userProfileData(p)
	createdAt, ok := m["createdAt"]
	if !ok {
		t.Fatal("mapa sem chave createdAt")
	}
	tv, ok := createdAt.(time.Time)
	if !ok {
		t.Fatalf("createdAt = %T (%v), want time.Time preservado (atualização de perfil)", createdAt, createdAt)
	}
	if !tv.Equal(past) {
		t.Errorf("createdAt = %v, want %v (data de criação preservada)", tv, past)
	}
}

func TestUserProfileDataDoesNotWriteRetiredFields(t *testing.T) {
	m := userProfileData(&models.UserProfile{ID: "u1", Name: "Ana", Role: models.RoleStudent, Status: models.StatusActive})
	for _, field := range []string{"planID", "features", "startDate", "endDate", "photoURL", "bio"} {
		if _, exists := m[field]; exists {
			t.Errorf("retired field %s must not be written", field)
		}
	}
}

func TestUserProfileDataUsesServerTimestampOnCreate(t *testing.T) {
	// Pré-condição: create novo (CreatedAt zero) deve usar o sentinela
	// firestore.ServerTimestamp (o servidor preenche), nunca um valor fixo.
	fresh := &models.UserProfile{ID: "u2", Name: "Bia"}
	m := userProfileData(fresh)
	createdAt, ok := m["createdAt"]
	if !ok {
		t.Fatal("mapa sem chave createdAt")
	}
	if got := createdAt; got != firestore.ServerTimestamp {
		t.Errorf("createdAt = %v, want firestore.ServerTimestamp (perfil novo)", got)
	}
}

// ── Dieta diária: dietLogData (item 3.3) ──
//
// PutDietLog regravava createdAt com firestore.ServerTimestamp a CADA save,
// perdendo a data real de criação (achado A1 do relatório). Depois da
// correção, createdAt é preservado quando o log já tem data (spell do
// userProfileData) e só usa ServerTimestamp em log novo (CreatedAt zero).

func TestDietLogDataPreservesCreatedAt(t *testing.T) {
	past := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	log := &models.DietDailyLog{StudentID: "s1", Date: "2026-07-01", CreatedAt: past}

	m := dietLogData(log)
	createdAt, ok := m["createdAt"]
	if !ok {
		t.Fatal("mapa sem chave createdAt")
	}
	tv, ok := createdAt.(time.Time)
	if !ok {
		t.Fatalf("createdAt = %T (%v), want time.Time preservado (atualização de log existente)", createdAt, createdAt)
	}
	if !tv.Equal(past) {
		t.Errorf("createdAt = %v, want %v (data de criação preservada)", tv, past)
	}
}

func TestDietLogDataUsesServerTimestampOnCreate(t *testing.T) {
	// Log novo (CreatedAt zero) deve usar o sentinela do Firestore, nunca um
	// valor fixo — o servidor preenche a data real de criação.
	fresh := &models.DietDailyLog{StudentID: "s2", Date: "2026-07-02"}
	m := dietLogData(fresh)
	createdAt, ok := m["createdAt"]
	if !ok {
		t.Fatal("mapa sem chave createdAt")
	}
	if got := createdAt; got != firestore.ServerTimestamp {
		t.Errorf("createdAt = %v, want firestore.ServerTimestamp (log novo)", got)
	}
}

// TestDietLogDataKeepsOtherFields garante que a extração do mapa não perde
// campos de negócio do log (status, refeições, donos).
func TestDietLogDataKeepsOtherFields(t *testing.T) {
	log := &models.DietDailyLog{
		StudentID:  "s1",
		DietID:     "d1",
		DietName:   "Dieta A",
		Date:       "2026-07-01",
		Status:     models.DietPartial,
		MealChecks: []*models.MealCheck{{MealID: "m1", Followed: true}},
		Note:       "nota",
		CreatedAt:  time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC),
	}
	m := dietLogData(log)
	if m["studentId"] != "s1" {
		t.Errorf("dono errado: studentId=%v", m["studentId"])
	}
	if m["dietId"] != "d1" || m["dietName"] != "Dieta A" {
		t.Errorf("vínculo de dieta errado: %v / %v", m["dietId"], m["dietName"])
	}
	if m["date"] != "2026-07-01" {
		t.Errorf("date = %v", m["date"])
	}
	if m["status"] != string(models.DietPartial) {
		t.Errorf("status = %v, want %v", m["status"], string(models.DietPartial))
	}
	if _, ok := m["mealChecks"]; !ok {
		t.Error("mapa sem mealChecks")
	}
	if m["note"] != "nota" {
		t.Errorf("note errada: %v", m["note"])
	}
}
