package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	firebase "firebase.google.com/go/v4"
	firebaseAuth "firebase.google.com/go/v4/auth"

	"cloud.google.com/go/firestore"

	"treino-louise/backend/handlers"
	"treino-louise/backend/middleware"
	"treino-louise/backend/models"
	"treino-louise/backend/repository"
	"treino-louise/backend/service"
)

func main() {
	ctx := context.Background()

	// Usa Application Default Credentials:
	//  - no Cloud Run, as credenciais vêm automaticamente do metadata server;
	//  - localmente, use GOOGLE_APPLICATION_CREDENTIALS apontando pro service account JSON.
	app, err := firebase.NewApp(ctx, nil)
	if err != nil {
		log.Fatalf("firebase.NewApp: %v", err)
	}

	var firestoreClient *firestore.Client
	firestoreClient, err = app.Firestore(ctx)
	if err != nil {
		log.Fatalf("app.Firestore: %v", err)
	}

	var authClient *firebaseAuth.Client
	authClient, err = app.Auth(ctx)
	if err != nil {
		log.Fatalf("app.Auth: %v", err)
	}

	// Injeção de dependências (camadas: repository → service → handlers/auth).
	db := repository.New(firestoreClient)
	svc := service.New(db)
	h := handlers.New(svc, db, authClient)
	a := middleware.NewAuth(authClient, db)

	mux := http.NewServeMux()
	registerRoutes(mux, h, a)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// ── Cadeia de hardening (hardening.md) ──
	// Externamente: CORS → SecurityHeaders → RateLimit → mux.
	// CORS: em produção, defina ALLOWED_ORIGIN com o domínio exato do frontend
	// (ex.: "https://app.treinolouise.com"). Default "*" para desenvolvimento.
	allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "*"
	}

	// Rate limit por IP/minuto. RATE_LIMIT=0 (ou ausente) desativa.
	rateLimit := 0
	if v := os.Getenv("RATE_LIMIT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			rateLimit = n
		}
	}

	var handler http.Handler = mux
	handler = middleware.SecurityHeaders(handler)
	handler = middleware.CORS(allowedOrigin)(handler)
	handler = middleware.RateLimit(rateLimit, time.Minute)(handler)
	handler = middleware.MaxBody(handler)
	// Recover é o mais externo: cobre qualquer panic abaixo (middlewares, auth,
	// handlers, service, repository) sem derrubar o processo.
	handler = middleware.Recover(handler)

	httpSrv := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("API ouvindo em :%s", port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe: %v", err)
		}
	}()

	// Encerramento gracioso (SIGTERM é o que o Cloud Run envia).
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Encerrando...")
	shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Shutdown: %v", err)
	}
	if err := firestoreClient.Close(); err != nil {
		log.Printf("Firestore close: %v", err)
	}
}

// ── Registro de rotas + composição da cadeia de autenticação/autorização ──
//
// ORDEM OBRIGATÓRIA (causa raiz do 403 em produção — ver diagnóstico):
//
//	Firebase ID Token
//	      ↓
//	Require                 ← SEMPRE o middleware mais externo (roda primeiro)
//	      ↓
//	carrega users/{uid}     ← role/status/features são injetados no contexto
//	      ↓
//	Allow / RequireApproved / RequireFeature   ← gates leem o contexto populado
//	      ↓
//	handler
//
// O http.ServeMux executa o wrapper mais externo primeiro. Então, nas
// composições abaixo, `a.Require(...)` fica SEMPRE por fora dos gates. A forma
// errada `Allow(...)(Require(...))` faz o gate rodar ANTES do Require
// popular o contexto — RoleFrom() devolve "student" e o status lido é ""
// (aprovado por compatibilidade), quebrando a autorização (403 até para
// ADMIN, e pendentes passando em rotas de negócio).
//
// registerRoutes é separado de main() para que os testes de integração
// (main_test.go) exercitem exatamente esta composição real, sem Firebase.
func registerRoutes(mux *http.ServeMux, h *handlers.Handlers, a *middleware.Auth) {
	mux.HandleFunc("GET /health", h.HandleHealth)

	// ── Modo original (preservado) — exige cadastro aprovado ──
	mux.HandleFunc("GET /api/sessions/{week}/{day}", a.Require(a.RequireApproved(h.HandleGetSession)))
	mux.HandleFunc("PUT /api/sessions/{week}/{day}", a.Require(a.RequireApproved(h.HandlePutSession)))
	mux.HandleFunc("GET /api/prs", a.Require(a.RequireApproved(h.HandleGetPRs)))
	mux.HandleFunc("PUT /api/prs", a.Require(a.RequireApproved(h.HandlePutPRs)))
	mux.HandleFunc("GET /api/state", a.Require(a.RequireApproved(h.HandleGetState)))
	mux.HandleFunc("PUT /api/state", a.Require(a.RequireApproved(h.HandlePutState)))

	// ── Perfil do usuário logado (livre para pendentes: é aqui que o cadastro começa) ──
	mux.HandleFunc("GET /api/me", a.Require(h.HandleGetMe))
	mux.HandleFunc("PUT /api/me", a.Require(h.HandlePutMe))

	// ── Usuários (admin) ──
	mux.HandleFunc("GET /api/users", a.Require(a.Allow(models.RoleAdmin)(h.HandleListUsers)))
	mux.HandleFunc("POST /api/users", a.Require(a.Allow(models.RoleAdmin)(h.HandleCreateUser)))
	mux.HandleFunc("GET /api/users/{id}", a.Require(a.Allow(models.RoleAdmin)(h.HandleGetUser)))
	mux.HandleFunc("PUT /api/users/{id}", a.Require(a.Allow(models.RoleAdmin)(h.HandleUpdateUser)))
	mux.HandleFunc("DELETE /api/users/{id}", a.Require(a.Allow(models.RoleAdmin)(h.HandleDeleteUser)))

	// ── Aprovação de cadastro + atribuição de plano (admin) ──
	mux.HandleFunc("GET /api/users/pending", a.Require(a.Allow(models.RoleAdmin)(h.HandleListPendingUsers)))
	mux.HandleFunc("POST /api/users/{id}/approve", a.Require(a.Allow(models.RoleAdmin)(h.HandleApproveUser)))
	mux.HandleFunc("POST /api/users/{id}/reject", a.Require(a.Allow(models.RoleAdmin)(h.HandleRejectUser)))
	mux.HandleFunc("POST /api/users/{id}/assign-plan", a.Require(a.Allow(models.RoleAdmin)(h.HandleAssignPlan)))

	// ── Planos (features) — CRUD admin ──
	mux.HandleFunc("GET /api/plans", a.Require(a.Allow(models.RoleAdmin)(h.HandleListPlans)))
	mux.HandleFunc("POST /api/plans", a.Require(a.Allow(models.RoleAdmin)(h.HandleCreatePlan)))
	mux.HandleFunc("PUT /api/plans/{id}", a.Require(a.Allow(models.RoleAdmin)(h.HandleUpdatePlan)))
	mux.HandleFunc("DELETE /api/plans/{id}", a.Require(a.Allow(models.RoleAdmin)(h.HandleDeletePlan)))

	// ── Alunos ──
	mux.HandleFunc("GET /api/students", a.Require(a.Allow(models.RoleNutritionist, models.RoleAdmin)(h.HandleListMyStudents)))
	mux.HandleFunc("GET /api/students/{id}", a.Require(h.HandleGetStudent))
	mux.HandleFunc("PUT /api/students/{id}", a.Require(a.Allow(models.RoleNutritionist, models.RoleAdmin)(h.HandleUpdateStudent)))

	// ── Treinos (free tier — só exige cadastro aprovado) ──
	mux.HandleFunc("GET /api/workouts", a.Require(a.RequireApproved(h.HandleListWorkouts)))
	mux.HandleFunc("POST /api/workouts", a.Require(a.Allow(models.RoleNutritionist, models.RoleAdmin)(a.RequireApproved(h.HandleCreateWorkout))))
	mux.HandleFunc("GET /api/workouts/{id}", a.Require(a.RequireApproved(h.HandleGetWorkout)))
	mux.HandleFunc("PUT /api/workouts/{id}", a.Require(a.Allow(models.RoleNutritionist, models.RoleAdmin)(a.RequireApproved(h.HandleUpdateWorkout))))
	mux.HandleFunc("DELETE /api/workouts/{id}", a.Require(a.Allow(models.RoleNutritionist, models.RoleAdmin)(a.RequireApproved(h.HandleDeleteWorkout))))
	mux.HandleFunc("POST /api/workouts/{id}/duplicate", a.Require(a.Allow(models.RoleNutritionist, models.RoleAdmin)(a.RequireApproved(h.HandleDuplicateWorkout))))

	// ── Dietas (feature diet) ──
	mux.HandleFunc("GET /api/diets", a.Require(a.RequireFeature(models.FeatureDiet)(a.RequireApproved(h.HandleListDiets))))
	mux.HandleFunc("POST /api/diets", a.Require(a.Allow(models.RoleNutritionist, models.RoleAdmin)(a.RequireApproved(h.HandleCreateDiet))))
	mux.HandleFunc("GET /api/diets/{id}", a.Require(a.RequireFeature(models.FeatureDiet)(a.RequireApproved(h.HandleGetDiet))))
	mux.HandleFunc("PUT /api/diets/{id}", a.Require(a.Allow(models.RoleNutritionist, models.RoleAdmin)(a.RequireApproved(h.HandleUpdateDiet))))
	mux.HandleFunc("DELETE /api/diets/{id}", a.Require(a.Allow(models.RoleNutritionist, models.RoleAdmin)(a.RequireApproved(h.HandleDeleteDiet))))
	mux.HandleFunc("POST /api/diets/{id}/duplicate", a.Require(a.Allow(models.RoleNutritionist, models.RoleAdmin)(a.RequireApproved(h.HandleDuplicateDiet))))

	// ── Histórico (free tier) ──
	mux.HandleFunc("GET /api/workout-history", a.Require(a.RequireApproved(h.HandleListHistory)))
	mux.HandleFunc("POST /api/workouts/complete", a.Require(a.RequireApproved(h.HandleCompleteWorkout)))

	// ── Rede social (feature community) ──
	mux.HandleFunc("POST /api/posts", a.Require(a.RequireFeature(models.FeatureCommunity)(a.RequireApproved(h.HandleCreatePost))))
	mux.HandleFunc("GET /api/posts", a.Require(a.RequireFeature(models.FeatureCommunity)(a.RequireApproved(h.HandleListPosts))))
	mux.HandleFunc("POST /api/posts/{id}/like", a.Require(a.RequireFeature(models.FeatureCommunity)(a.RequireApproved(h.HandleToggleLike))))
	mux.HandleFunc("POST /api/posts/{id}/comments", a.Require(a.RequireFeature(models.FeatureCommunity)(a.RequireApproved(h.HandleAddComment))))
	mux.HandleFunc("DELETE /api/posts/{id}/comments/{cid}", a.Require(a.RequireFeature(models.FeatureCommunity)(a.RequireApproved(h.HandleDeleteComment))))
	mux.HandleFunc("DELETE /api/posts/{id}", a.Require(a.RequireFeature(models.FeatureCommunity)(a.RequireApproved(h.HandleDeletePost))))

	// ── Dieta diária (dia + refeição) — feature diet ──
	mux.HandleFunc("GET /api/diet-logs", a.Require(a.RequireFeature(models.FeatureDiet)(a.RequireApproved(h.HandleListDietLogs))))
	mux.HandleFunc("PUT /api/diet-logs", a.Require(a.RequireFeature(models.FeatureDiet)(a.RequireApproved(h.HandleUpsertDietLog))))

	// ── Ranking / pontuação / perfil público (feature ranking) ──
	mux.HandleFunc("GET /api/ranking", a.Require(a.RequireFeature(models.FeatureRanking)(a.RequireApproved(h.HandleGetRanking))))
	mux.HandleFunc("GET /api/scores/history", a.Require(a.RequireFeature(models.FeatureRanking)(a.RequireApproved(h.HandleGetScoreHistory))))
	mux.HandleFunc("GET /api/public/profile/{id}", a.Require(a.RequireFeature(models.FeatureRanking)(a.RequireApproved(h.HandleGetPublicProfile))))
}
