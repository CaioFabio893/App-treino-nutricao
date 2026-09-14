package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ── CORS ──

// CORS libera o frontend (hospedado em outro domínio) de chamar a API.
// allowedOrigins aceita "*" (ecoa a origem — comportamento local) ou uma lista
// de origens separadas por vírgula. Em produção, use a variável de ambiente
// ALLOWED_ORIGIN com o domínio exato do frontend.
func CORS(allowedOrigins string) func(http.Handler) http.Handler {
	allowAll := allowedOrigins == "" || allowedOrigins == "*"
	origins := map[string]bool{}
	if !allowAll {
		for _, o := range strings.Split(allowedOrigins, ",") {
			if o = strings.TrimSpace(o); o != "" {
				origins[o] = true
			}
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			allow := "*"
			if !allowAll {
				allow = ""
				if origins[r.Header.Get("Origin")] {
					allow = r.Header.Get("Origin")
				}
			}
			if allow != "" {
				w.Header().Set("Access-Control-Allow-Origin", allow)
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ── Headers de segurança ──

// SecurityHeaders aplica os headers básicos de hardening (hardening.md):
// nosniff, nega iframe, referrer estrito, permissões mínimas. Respostas de API
// não são cacheadas (dados sensíveis).
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		if strings.HasPrefix(r.URL.Path, "/api") {
			w.Header().Set("Cache-Control", "no-store")
		}
		next.ServeHTTP(w, r)
	})
}

// ── Rate limit ──

type rateEntry struct {
	count   int
	resetAt time.Time
}

type rateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	visits map[string]*rateEntry
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{limit: limit, window: window, visits: map[string]*rateEntry{}}
}

func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	e, ok := l.visits[key]
	if !ok || now.After(e.resetAt) {
		l.visits[key] = &rateEntry{count: 1, resetAt: now.Add(l.window)}
		return true
	}
	if e.count >= l.limit {
		return false
	}
	e.count++
	// Purga simples de memória quando a tabela cresce demais.
	if len(l.visits) > 4096 {
		for k, v := range l.visits {
			if now.After(v.resetAt) {
				delete(l.visits, k)
			}
		}
	}
	return true
}

// RateLimit limita requisições por IP dentro de uma janela. limit <= 0
// desativa. Em Cloud Run o IP real vem no header X-Forwarded-For.
func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	if limit <= 0 || window <= 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	rl := newRateLimiter(limit, window)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !rl.allow(clientIP(r)) {
				http.Error(w, `{"error":"muitas requisicoes"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// clientIP extrai o IP do cliente, preferindo X-Forwarded-For (proxy).
func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		if i := strings.IndexByte(fwd, ','); i >= 0 {
			return strings.TrimSpace(fwd[:i])
		}
		return strings.TrimSpace(fwd)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
