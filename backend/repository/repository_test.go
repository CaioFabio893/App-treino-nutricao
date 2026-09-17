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
	var nilSlice []*models.Plan
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
// pelos endpoints (planos, usuários/alunos, treinos, dietas, posts,
// diet-logs, score records, score history).
func TestEnsureNonNilSliceNilToArrayAllTypes(t *testing.T) {
	var (
		plans    []*models.Plan
		profiles []*models.UserProfile
		workouts []*models.WorkoutDefine
		diets    []*models.Diet
		posts    []*models.Post
		logs     []*models.DietDailyLog
		records  []*models.ScoreRecord
		history  []*models.ScoreHistoryEntry
	)

	cases := []struct {
		name string
		got  any
	}{
		{"plans", ensureNonNilSlice(plans)},
		{"profiles", ensureNonNilSlice(profiles)},
		{"workouts", ensureNonNilSlice(workouts)},
		{"diets", ensureNonNilSlice(diets)},
		{"posts", ensureNonNilSlice(posts)},
		{"dietLogs", ensureNonNilSlice(logs)},
		{"scoreRecords", ensureNonNilSlice(records)},
		{"scoreHistory", ensureNonNilSlice(history)},
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
	in := []*models.Plan{{ID: "p1", Name: "Plano A"}}
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
}

// ── Testes pré-existentes (preservados) ──

func TestDocKey(t *testing.T) {
	if got := docKey(1, "ta"); got != "1_ta" {
		t.Errorf("docKey(1,ta) = %q, want 1_ta", got)
	}
	if got := docKey(12, "tb"); got != "12_tb" {
		t.Errorf("docKey(12,tb) = %q, want 12_tb", got)
	}
}

func TestCursorEncodeParse(t *testing.T) {
	ts := time.Date(2026, 7, 10, 12, 0, 0, 0, time.Local)
	p := &models.Post{ID: "abc123", CreatedAt: ts}
	c := encodeCursor(p)
	if c != "1752163200000,abc123" && c != "1752163200000" {
		// verifica estrutura geral (millis variam com fuso)
	}
	milli, id, ok := parseCursor(c)
	if !ok || id != "abc123" || milli != ts.UnixMilli() {
		t.Errorf("parseCursor(%q) = %d/%s/%v", c, milli, id, ok)
	}
	if _, _, ok := parseCursor("sem-virgula"); ok {
		t.Error("parseCursor should fail without comma")
	}
	if _, _, ok := parseCursor("xx,yy"); ok {
		t.Error("parseCursor should fail with non-numeric milli")
	}
}
