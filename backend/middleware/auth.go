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

const (
	uidKey       contextKey = "uid"
	roleKey      contextKey = "role"
	statusKey    contextKey = "status"
	featuresKey  contextKey = "features"
	providerKey  contextKey = "authProvider"
)

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
// Também carrega o perfil (role/status/features/provider) do usuário no
// contexto, caso exista.
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

		// Carrega o perfil do usuário. Se NÃO existir, o acesso é tratado como
		// pendente de aprovação (status pending_approval) — nenhuma rota de
		// negócio libera acesso até o admin aprovar. Perfis antigos sem campo
		// status (status "") seguem liberados (IsApproved aceita "").
		profile, err := a.repo.GetUserProfile(r.Context(), verified.UID)
		if err != nil {
			http.Error(w, `{"error":"falha ao carregar perfil"}`, http.StatusInternalServerError)
			return
		}

		status := models.StatusPendingApproval
		var role models.Role
		var features []models.Feature
		provider := ""
		if profile != nil {
			status = profile.Status
			role = profile.Role
			features = profile.Features
			provider = profile.AuthProvider
		}
		// O provider também pode vir da claim do token Firebase (cadastro novo
		// que ainda não tem perfil).
		if provider == "" && verified.Firebase.SignInProvider != "" {
			provider = verified.Firebase.SignInProvider
		}

		ctx = context.WithValue(ctx, roleKey, role)
		ctx = context.WithValue(ctx, statusKey, status)
		ctx = context.WithValue(ctx, featuresKey, features)
		ctx = context.WithValue(ctx, providerKey, provider)

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

// RequireApproved bloqueia usuários cujo cadastro ainda não foi aprovado
// (status pending_approval/rejected) e usuários sem perfil. Envolve todas as
// rotas de negócio — só GET/PUT /api/me ficam liberadas para pendentes.
func (a *Auth) RequireApproved(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !IsApproved(r.Context()) {
			http.Error(w, `{"error":"cadastro pendente de aprovacao"}`, http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

// RequireFeature bloqueia alunos cujo plano não inclui a feature dada. Admin e
// nutricionista sempre passam (gerenciam o conteúdo, não são limitados por plano).
func (a *Auth) RequireFeature(f models.Feature) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			role := RoleFrom(r.Context())
			if role == models.RoleAdmin || role == models.RoleNutritionist {
				next(w, r)
				return
			}
			features, _ := r.Context().Value(featuresKey).([]models.Feature)
			for _, ft := range features {
				if ft == f {
					next(w, r)
					return
				}
			}
			http.Error(w, `{"error":"recurso nao incluido no seu plano"}`, http.StatusForbidden)
		}
	}
}

// IsApproved devolve true quando o usuário pode acessar rotas de negócio.
// "" cobre perfis antigos (migrados sem status explícito) — não quebra
// usuários já ativos hoje.
func IsApproved(ctx context.Context) bool {
	status, _ := ctx.Value(statusKey).(string)
	return status == "" || status == models.StatusActive || status == models.StatusPaused
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

// FeaturesFrom devolve as features snapshotadas no perfil do usuário.
func FeaturesFrom(ctx context.Context) []models.Feature {
	features, _ := ctx.Value(featuresKey).([]models.Feature)
	return features
}

// AuthProviderFrom devolve o provedor de login ("password" | "google.com").
func AuthProviderFrom(ctx context.Context) string {
	provider, _ := ctx.Value(providerKey).(string)
	return provider
}