package main

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"treino-louise/backend/handlers"
	"treino-louise/backend/middleware"
	"treino-louise/backend/models"
)

type fakePageStore struct {
	data  []byte
	err   error
	calls int
}

func (s *fakePageStore) ReadPage(_ context.Context, _ string, _ int) ([]byte, error) {
	s.calls++
	return s.data, s.err
}

func TestDietPagesAuthorizationAndPrivateResponse(t *testing.T) {
	white := image.NewRGBA(image.Rect(0, 0, 500, 500))
	for y := 0; y < 500; y++ {
		for x := 0; x < 500; x++ {
			white.Set(x, y, color.White)
		}
	}
	var original bytes.Buffer
	if err := png.Encode(&original, white); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, uid, status, page string
		token                   bool
		diet                    bool
		storeErr                bool
		want                    int
		calls                   int
	}{
		{"own", testUID, models.StatusActive, "1", true, true, false, 200, 1},
		{"foreign", "other", models.StatusActive, "1", true, true, false, 404, 0},
		{"no token", testUID, models.StatusActive, "1", false, true, false, 401, 0},
		{"pending", testUID, models.StatusPendingApproval, "1", true, true, false, 403, 0},
		{"missing", testUID, models.StatusActive, "1", true, false, false, 404, 0},
		{"zero", testUID, models.StatusActive, "0", true, true, false, 404, 0},
		{"bounds", testUID, models.StatusActive, "3", true, true, false, 404, 0},
		{"noncanonical", testUID, models.StatusActive, "01", true, true, false, 404, 0},
		{"storage error", testUID, models.StatusActive, "1", true, true, true, 503, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &chainFakeRepo{profile: &models.UserProfile{Role: models.RoleStudent, Status: tc.status}}
			if tc.diet {
				repo.diet = &models.Diet{StudentID: testUID, Document: &models.DietDocument{ID: strings.Repeat("a", 32), PageCount: 2}}
			}
			store := &fakePageStore{data: original.Bytes()}
			if tc.storeErr {
				store.err = errors.New("private bucket secret error")
			}
			h := handlers.New(nil, repo, nil)
			h.SetDietPageStore(store)
			mux := http.NewServeMux()
			registerRoutes(mux, h, middleware.NewAuth(&fakeVerifier{uid: tc.uid}, repo))
			r := httptest.NewRequest("GET", "/api/diets/diet/pages/"+tc.page, nil)
			if tc.token {
				r.Header.Set("Authorization", "Bearer test")
			}
			r.Header.Set("Range", "bytes=0-8")
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, r)
			if w.Code != tc.want || store.calls != tc.calls {
				t.Fatalf("status=%d calls=%d", w.Code, store.calls)
			}
			if strings.Contains(w.Body.String(), "secret error") {
				t.Fatal("storage error leaked")
			}
			if tc.want == 200 {
				if w.Header().Get("Cache-Control") != "private, no-store, max-age=0" || w.Header().Get("Vary") != "Authorization" || w.Header().Get("X-Content-Type-Options") != "nosniff" {
					t.Fatal("private headers missing")
				}
				decoded, err := png.Decode(bytes.NewReader(w.Body.Bytes()))
				if err != nil {
					t.Fatal(err)
				}
				if decoded.Bounds() != white.Bounds() || !bytes.Equal(original.Bytes(), w.Body.Bytes()) {
					t.Fatal("original page appearance was modified")
				}
			}
		})
	}
}

func TestDietDocumentValidationAndImmutableUpdate(t *testing.T) {
	for _, document := range []string{`{"id":"../secret","pageCount":2}`, `{"id":"` + strings.Repeat("a", 32) + `","pageCount":0}`, `{"id":"` + strings.Repeat("a", 32) + `","pageCount":101}`} {
		repo := &chainFakeRepo{profile: &models.UserProfile{Role: models.RoleAdmin, Status: models.StatusActive}}
		w := httptest.NewRecorder()
		r := httptest.NewRequest("POST", "/api/diets", strings.NewReader(`{"name":"Dieta","document":`+document+`}`))
		r.Header.Set("Authorization", "Bearer test")
		newChainMux(repo).ServeHTTP(w, r)
		if w.Code != 400 {
			t.Fatalf("invalid metadata accepted: %d", w.Code)
		}
	}
	doc := &models.DietDocument{ID: strings.Repeat("a", 32), PageCount: 2}
	for _, tc := range []struct {
		body string
		want int
	}{
		{`{"name":"Renamed"}`, 200},
		{`{"name":"Renamed","document":{"id":"` + strings.Repeat("b", 32) + `","pageCount":2}}`, 400},
	} {
		repo := &chainFakeRepo{profile: &models.UserProfile{Role: models.RoleAdmin, Status: models.StatusActive}, diet: &models.Diet{Document: doc}}
		r := httptest.NewRequest("PUT", "/api/diets/diet", strings.NewReader(tc.body))
		r.Header.Set("Authorization", "Bearer test")
		w := httptest.NewRecorder()
		newChainMux(repo).ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Fatalf("status=%d", w.Code)
		}
		if tc.want == 200 && (repo.updatedDiet.Document == nil || *repo.updatedDiet.Document != *doc) {
			t.Fatal("document lost")
		}
	}
}

func TestDuplicateDietPreservesPrivateDocumentReference(t *testing.T) {
	doc := &models.DietDocument{ID: strings.Repeat("a", 32), PageCount: 2}
	repo := &chainFakeRepo{profile: &models.UserProfile{Role: models.RoleAdmin, Status: models.StatusActive}, diet: &models.Diet{Name: "PDF", Document: doc}}
	r := httptest.NewRequest("POST", "/api/diets/diet/duplicate", strings.NewReader(`{"newStudentId":"assigned-student"}`))
	r.Header.Set("Authorization", "Bearer test")
	w := httptest.NewRecorder()
	newChainMux(repo).ServeHTTP(w, r)
	if w.Code != 200 || repo.createdDiet == nil || repo.createdDiet.Document == nil || *repo.createdDiet.Document != *doc || repo.createdDiet.StudentID != "assigned-student" {
		t.Fatalf("document assignment not preserved: status=%d", w.Code)
	}
}
