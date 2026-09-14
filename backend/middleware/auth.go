// Package middleware contém a cadeia HTTP que envolve a API: autenticação
// (JWT do Firebase), autorização por papel, CORS, headers de segurança e
// rate limiting. Não conhece regras de negócio.
package middleware

import (
	"context"
	"net/http"
	"strings"

	firebaseAuth "firebase.google.com/go/v4/auth"

	"treino-louise/backend/models"
	"treino-louise/backend/repository"
)

type contextKey string

const uidKey contextKey = "uid"
const roleKey contextKey = "role"

// Auth valida o token do Firebase Auth e injeta uid+role no contexto.
type Auth struct {
	auth *firebaseAuth.Client
	repo repository.Repository
}

// NewAuth cria o middleware de autenticação.
func NewAuth(auth *firebaseAuth.Client, repo repository.Repository) *Auth {
	return &Auth{auth: auth, repo: repo}
}

// Require exige um ID token válido do Firebase Auth no header Authorization.
// O frontend manda "Authorization: Bearer <idToken>" em todas as chamadas.
// Também carrega o perfil (role) do usuário no contexto, caso exista.
func (a *Auth) Require(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw := r.Header.Get("Authorization")
		token := strings.TrimPrefix(raw, "Bearer ")
		if token == "" || token == raw {
			http.Error(w, `{"error":"token ausente"}`, http.StatusUnauthorized)
			return
		}

		verified, err := a.auth.VerifyIDToken(r.Context(), token)
		if err != nil {
			http.Error(w, `{"error":"token invalido"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), uidKey, verified.UID)

		// Carrega o perfil (role) do usuário — se não existir, usa "student".
		profile, err := a.repo.GetUserProfile(r.Context(), verified.UID)
		if err != nil {
			http.Error(w, `{"error":"falha ao carregar perfil"}`, http.StatusInternalServerError)
			return
		}
		role := models.RoleStudent
		if profile != nil && profile.Role != "" {
			role = profile.Role
		}
		ctx = context.WithValue(ctx, roleKey, role)

		next(w, r.WithContext(ctx))
	}
}

// Allow restringe o endpoint a determinados papéis.
func (a *Auth) Allow(roles ...models.Role) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			current := RoleFrom(r.Context())
			for _, rl := range roles {
				if current == rl {
					next(w, r)
					return
				}
			}
			http.Error(w, `{"error":"sem permissao"}`, http.StatusForbidden)
		}
	}
}

// UIDFrom devolve o UID do usuário autenticado (definido pelo Require).
func UIDFrom(ctx context.Context) string {
	uid, _ := ctx.Value(uidKey).(string)
	return uid
}

// RoleFrom devolve o role do usuário autenticado.
func RoleFrom(ctx context.Context) models.Role {
	role, _ := ctx.Value(roleKey).(models.Role)
	if role == "" {
		return models.RoleStudent
	}
	return role
}
