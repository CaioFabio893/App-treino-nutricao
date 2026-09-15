package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRecoverConvertsPanicTo500(t *testing.T) {
	panicHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/panic", nil)
	Recover(panicHandler).ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("code = %d, want 500", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "erro interno") {
		t.Errorf("body = %q, want JSON error", rr.Body.String())
	}
}

func TestRecoverPassesThrough(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "ok")
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/health", nil)
	Recover(ok).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK || rr.Body.String() != "ok" {
		t.Errorf("got %d %q, want 200 ok", rr.Code, rr.Body.String())
	}
}

func TestMaxBodyRejectsOversizedBody(t *testing.T) {
	decode := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var v struct {
			A string `json:"a"`
		}
		if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
			http.Error(w, "JSON invalido", http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusOK)
	})
	body := strings.Repeat("x", maxBodyBytes+1)
	req := httptest.NewRequest("PUT", "/api/x", strings.NewReader(body))
	rr := httptest.NewRecorder()
	MaxBody(decode).ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("code = %d, want 400 (body too large)", rr.Code)
	}
}

func TestMaxBodyAllowsNormal(t *testing.T) {
	decode := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var v struct {
			A string `json:"a"`
		}
		if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
			http.Error(w, "JSON invalido", http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest("PUT", "/api/x", strings.NewReader(`{"a":"ok"}`))
	rr := httptest.NewRecorder()
	MaxBody(decode).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("code = %d, want 200", rr.Code)
	}
}