package main

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const uidKey contextKey = "uid"

// withAuth exige um ID token válido do Firebase Auth no header Authorization.
// O frontend manda "Authorization: Bearer <idToken>" em todas as chamadas.
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
		next(w, r.WithContext(ctx))
	}
}

// uidFrom devolve o UID do usuário autenticado (definido pelo withAuth).
func uidFrom(ctx context.Context) string {
	uid, _ := ctx.Value(uidKey).(string)
	return uid
}