package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
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

// ── CORS (hardening Fase 1) ──

const testOrigin = "https://app.treinolouise.com"

func varyHasOrigin(h http.Header) bool {
	for _, v := range h.Values("Vary") {
		for _, part := range strings.Split(v, ",") {
			if strings.TrimSpace(part) == "Origin" {
				return true
			}
		}
	}
	return false
}

func TestCORSReflectsAllowedOriginAndVaries(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	req := httptest.NewRequest("GET", "/api/me", nil)
	req.Header.Set("Origin", testOrigin)
	rr := httptest.NewRecorder()

	CORS(testOrigin)(ok).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200", rr.Code)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != testOrigin {
		t.Errorf("ACAO = %q, want %q (origem exata, nunca '*')", got, testOrigin)
	}
	if !varyHasOrigin(rr.Header()) {
		t.Errorf("Vary deveria incluir Origin, got %v", rr.Header().Values("Vary"))
	}
}

func TestCORSRejectsDisallowedOriginWithNoACAO(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	req := httptest.NewRequest("GET", "/api/me", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	rr := httptest.NewRecorder()

	CORS(testOrigin)(ok).ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("code = %d, want 403 para origem não permitida", rr.Code)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("origem negada não deveria ter ACAO, got %q", got)
	}
}

func TestCORSPassesThroughWithoutOrigin(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	req := httptest.NewRequest("GET", "/health", nil) // sem header Origin
	rr := httptest.NewRecorder()

	CORS(testOrigin)(ok).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("code = %d, want 200", rr.Code)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("sem Origin não deveria receber ACAO, got %q", got)
	}
}

func TestCORSPreflightAllowedOrigin(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	req := httptest.NewRequest(http.MethodOptions, "/api/me", nil)
	req.Header.Set("Origin", testOrigin)
	req.Header.Set("Access-Control-Request-Method", "PUT")
	rr := httptest.NewRecorder()

	CORS(testOrigin)(ok).ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Errorf("code = %d, want 204 (preflight)", rr.Code)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != testOrigin {
		t.Errorf("ACAO = %q, want %q", got, testOrigin)
	}
	if !varyHasOrigin(rr.Header()) {
		t.Errorf("preflight: Vary deveria incluir Origin")
	}
}

func TestCORSPreflightDisallowedOrigin(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	req := httptest.NewRequest(http.MethodOptions, "/api/me", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	rr := httptest.NewRecorder()

	CORS(testOrigin)(ok).ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("code = %d, want 403 (preflight de origem não permitida)", rr.Code)
	}
}

// Lista de origens separada por vírgula (formato compatível com a V1).
func TestCORSAllowsMultipleConfiguredOrigins(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	allowed := "https://app.treinolouise.com, http://localhost:3000"

	for _, origin := range []string{"https://app.treinolouise.com", "http://localhost:3000"} {
		req := httptest.NewRequest("GET", "/api/me", nil)
		req.Header.Set("Origin", origin)
		rr := httptest.NewRecorder()
		CORS(allowed)(ok).ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("origin %q: code = %d, want 200", origin, rr.Code)
		}
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != origin {
			t.Errorf("origin %q: ACAO = %q, want %q", origin, got, origin)
		}
	}
}

// ── Rate limit (hardening Fase 1) ──

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
}

func TestRateLimitAllowsWithinLimit(t *testing.T) {
	h := RateLimit(3, time.Minute)(okHandler())
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/api/x", nil)
		req.RemoteAddr = "203.0.113.7:1234"
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("request %d: code = %d, want 200 (dentro do limite)", i+1, rr.Code)
		}
	}
}

func TestRateLimitBlocksAfterLimitWithRetryAfter(t *testing.T) {
	h := RateLimit(3, time.Minute)(okHandler())
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/api/x", nil)
		req.RemoteAddr = "203.0.113.7:1234"
		h.ServeHTTP(httptest.NewRecorder(), req)
	}

	req := httptest.NewRequest("GET", "/api/x", nil)
	req.RemoteAddr = "203.0.113.7:1234"
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("code = %d, want 429 (limite excedido)", rr.Code)
	}
	if ra := rr.Header().Get("Retry-After"); ra == "" {
		t.Error("429 deveria incluir header Retry-After")
	} else if secs, err := strconv.Atoi(ra); err != nil || secs < 1 || secs > 60 {
		t.Errorf("Retry-After = %q, esperava segundos (1..60), err=%v", ra, err)
	}
}

func TestRateLimitDifferentIPsIndependent(t *testing.T) {
	h := RateLimit(2, time.Minute)(okHandler())
	for _, ip := range []string{"203.0.113.7:1234", "203.0.113.8:1234"} {
		for i := 0; i < 2; i++ {
			req := httptest.NewRequest("GET", "/api/x", nil)
			req.RemoteAddr = ip
			h.ServeHTTP(httptest.NewRecorder(), req)
		}
		// Terceira requisição deste IP: explodiu o próprio orçamento → 429.
		req := httptest.NewRequest("GET", "/api/x", nil)
		req.RemoteAddr = ip
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusTooManyRequests {
			t.Errorf("IP %s: code = %d, want 429 (orçamento independente)", ip, rr.Code)
		}
	}
}

// Coerência com a V1: atrás de proxy (Cloud Run), o IP usado é o primeiro
// elemento do X-Forwarded-For (não alteramos a política de confiança — só
// documentamos o risco residual no relatório de hardening).
func TestRateLimitKeysByFirstXForwardedForElement(t *testing.T) {
	h := RateLimit(1, time.Minute)(okHandler())

	// Dois clientes distintos no XFF, mesmo RemoteAddr → orçamentos independentes.
	for _, xff := range []string{"203.0.113.10", "203.0.113.11"} {
		req := httptest.NewRequest("GET", "/api/x", nil)
		req.RemoteAddr = "10.0.0.5:443"
		req.Header.Set("X-Forwarded-For", xff+", 10.0.0.1")
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("XFF %s: code = %d, want 200 (1ª requisição)", xff, rr.Code)
		}
	}

	// Mesmo cliente de novo → já estourou → 429.
	req := httptest.NewRequest("GET", "/api/x", nil)
	req.RemoteAddr = "10.0.0.5:443"
	req.Header.Set("X-Forwarded-For", "203.0.113.10, 10.0.0.1")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusTooManyRequests {
		t.Errorf("code = %d, want 429 para o mesmo cliente XFF", rr.Code)
	}
}

func TestRateLimitDisabledWhenZero(t *testing.T) {
	// Comportamento herdado da V1: limit <= 0 desativa o middleware.
	h := RateLimit(0, time.Minute)(okHandler())
	for i := 0; i < 100; i++ {
		req := httptest.NewRequest("GET", "/api/x", nil)
		req.RemoteAddr = "203.0.113.7:1234"
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("request %d: code = %d, want 200 (desativado)", i+1, rr.Code)
		}
	}
}