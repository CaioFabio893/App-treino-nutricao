package middleware

import (
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ── CORS ──

// CORS libera somente as origens exatas configuradas (ALLOWED_ORIGIN — lista
// separada por vírgula). Não suporta "*": o carregamento de configuração
// (config.go, no boot) já rejeita wildcard. Regras:
//   - origem permitida ⇒ Access-Control-Allow-Origin reflete a origem + Vary: Origin;
//   - origem não permitida ⇒ 403 sem Access-Control-Allow-Origin (requests reais
//     e preflights são bloqueados no middleware, antes do handler);
//   - requisição sem header Origin (curl, healthcheck, same-origin) ⇒ passa.
func CORS(allowedOrigins string) func(http.Handler) http.Handler {
	origins := map[string]bool{}
	for _, o := range strings.Split(allowedOrigins, ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins[o] = true
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}
			// Vary sinaliza aos caches que a resposta depende do Origin
			// (inclusive para origens negadas).
			w.Header().Add("Vary", "Origin")
			if !origins[origin] {
				http.Error(w, `{"error":"origem nao permitida"}`, http.StatusForbidden)
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
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

func (l *rateLimiter) allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	e, ok := l.visits[key]
	if !ok || now.After(e.resetAt) {
		l.visits[key] = &rateEntry{count: 1, resetAt: now.Add(l.window)}
		return true, 0
	}
	if e.count >= l.limit {
		return false, e.resetAt.Sub(now)
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
	return true, 0
}

// RateLimit limita requisições por IP dentro de uma janela. limit <= 0
// desativa (uso local, jamais em produção — o boot rejeita RATE_LIMIT=0 com
// GO_ENV=production). Em Cloud Run o IP real vem no header X-Forwarded-For
// (primeiro elemento — política herdada da V1; risco residual documentado em
// docs/reports/phase-01-hardening.md). Respostas 429 incluem Retry-After em
// segundos (quando o cliente pode tentar de novo).
func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	if limit <= 0 || window <= 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	rl := newRateLimiter(limit, window)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ok, retryIn := rl.allow(clientIP(r))
			if !ok {
				wait := int(retryIn.Seconds())
				if retryIn%time.Second != 0 {
					wait++
				}
				if wait < 1 {
					wait = 1
				}
				w.Header().Set("Retry-After", strconv.Itoa(wait))
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

// ── Recovery ──

// Recover impede que um panic em um handler derrube o processo inteiro
// (por padrão, um panic em handler mata o servidor). Converte em 500 e
// registra no log apenas o essencial: valor do panic, método e caminho —
// sem token, sem corpo e sem dados pessoais.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic no handler: %v (method=%s path=%s)", rec, r.Method, r.URL.Path)
				http.Error(w, `{"error":"erro interno"}`, http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// ── Limite de corpo ──

// maxBodyBytes limita o corpo de POST/PUT para evitar payloads gigantes.
// 1 MiB é suficiente para este app (não há upload de arquivos).
const maxBodyBytes = 1 << 20

// MaxBody aplica http.MaxBytesReader em POST/PUT: corpos maiores falham no
// decode de JSON e o handler devolve 400, em vez de alocar memória ilimitada.
func MaxBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost || r.Method == http.MethodPut {
			r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		}
		next.ServeHTTP(w, r)
	})
}
