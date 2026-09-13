package main

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const uidKey contextKey = "uid"
const roleKey contextKey = "role"

// withAuth exige um ID token válido do Firebase Auth no header Authorization.
// O frontend manda "Authorization: Bearer <idToken>" em todas as chamadas.
// Também carrega o perfil (role) do usuário no contexto, caso exista.
func (s *Server) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw := r.Header.Get("Authorization")
		token := strings.TrimPrefix(raw, "Bearer ")
		if token == "" || token == raw {
			http.Error(w, `{"error":"token ausente"}`, http.StatusUnauthorized)
			return
		}

		verified, err := s.auth.VerifyIDToken(r.Context(), token)
		if err != nil {
			http.Error(w, `{"error":"token invalido"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), uidKey, verified.UID)

		// Carrega o perfil (role) do usuário — se não existir, usa "student".
		profile, err := s.getUserProfile(r.Context(), verified.UID)
		if err != nil {
			http.Error(w, `{"error":"falha ao carregar perfil"}`, http.StatusInternalServerError)
			return
		}
		role := RoleStudent
		if profile != nil && profile.Role != "" {
			role = profile.Role
		}
		ctx = context.WithValue(ctx, roleKey, role)

		next(w, r.WithContext(ctx))
	}
}

// withRole restringe o endpoint a determinados papéis.
func (s *Server) withRole(roles ...Role) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			current := roleFrom(r.Context())
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

// uidFrom devolve o UID do usuário autenticado (definido pelo withAuth).
func uidFrom(ctx context.Context) string {
	uid, _ := ctx.Value(uidKey).(string)
	return uid
}

// roleFrom devolve o role do usuário autenticado.
func roleFrom(ctx context.Context) Role {
	role, _ := ctx.Value(roleKey).(Role)
	if role == "" {
		return RoleStudent
	}
	return role
}