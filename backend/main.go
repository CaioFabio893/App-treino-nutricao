package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
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

	// ── Hardening de produção (config.go) ──
	// CORS + rate limit derivados do ambiente com fail-fast: em produção
	// (GO_ENV=production) ALLOWED_ORIGIN é OBRIGATÓRIO e nunca "*"; rate limit
	// nunca fica desativado (default 120/min/IP em produção, 600 em dev/teste).
	// Erro de configuração derruba o boot — sem fallback permissivo.
	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		log.Fatalf("configuracao invalida: %v", err)
	}

	var handler http.Handler = mux
	handler = middleware.SecurityHeaders(handler)
	handler = middleware.CORS(cfg.allowedOrigin)(handler)
	handler = middleware.RateLimit(cfg.rateLimit, cfg.rateWindow)(handler)
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
//	carrega users/{uid}     ← role/status são injetados no contexto
//	      ↓
//	Allow / RequireApproved   ← gates leem o contexto populado
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

	// ── Perfil do usuário logado (livre para pendentes: é aqui que o cadastro começa) ──
	mux.HandleFunc("GET /api/me", a.Require(h.HandleGetMe))
	mux.HandleFunc("PUT /api/me", a.Require(h.HandlePutMe))

	// ── Usuários (admin) ──
	mux.HandleFunc("GET /api/users", a.Require(a.Allow(models.RoleAdmin)(h.HandleListUsers)))
	mux.HandleFunc("POST /api/users", a.Require(a.Allow(models.RoleAdmin)(h.HandleCreateUser)))
	mux.HandleFunc("GET /api/users/{id}", a.Require(a.Allow(models.RoleAdmin)(h.HandleGetUser)))
	mux.HandleFunc("PUT /api/users/{id}", a.Require(a.Allow(models.RoleAdmin)(h.HandleUpdateUser)))
	mux.HandleFunc("DELETE /api/users/{id}", a.Require(a.Allow(models.RoleAdmin)(h.HandleDeleteUser)))

	// ── Aprovação de cadastro (admin) ──
	mux.HandleFunc("GET /api/users/pending", a.Require(a.Allow(models.RoleAdmin)(h.HandleListPendingUsers)))
	mux.HandleFunc("POST /api/users/{id}/approve", a.Require(a.Allow(models.RoleAdmin)(h.HandleApproveUser)))
	mux.HandleFunc("POST /api/users/{id}/reject", a.Require(a.Allow(models.RoleAdmin)(h.HandleRejectUser)))

	// ── Alunos ──
	mux.HandleFunc("GET /api/students", a.Require(a.Allow(models.RoleAdmin)(h.HandleListMyStudents)))
	mux.HandleFunc("GET /api/students/{id}", a.Require(a.RequireApproved(h.HandleGetStudent)))
	mux.HandleFunc("PUT /api/students/{id}", a.Require(a.Allow(models.RoleAdmin)(h.HandleUpdateStudent)))

	// ── Treinos (free tier — só exige cadastro aprovado) ──
	// Endpoint aposentado: responde 404 em vez de 405 por conflito com a rota de leitura.
	mux.HandleFunc("POST /api/workouts/complete", http.NotFound)
	mux.HandleFunc("GET /api/workouts", a.Require(a.RequireApproved(h.HandleListWorkouts)))
	mux.HandleFunc("POST /api/workouts", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleCreateWorkout))))
	mux.HandleFunc("GET /api/workouts/{id}", a.Require(a.RequireApproved(h.HandleGetWorkout)))
	mux.HandleFunc("PUT /api/workouts/{id}", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleUpdateWorkout))))
	mux.HandleFunc("DELETE /api/workouts/{id}", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleDeleteWorkout))))
	mux.HandleFunc("POST /api/workouts/{id}/duplicate", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleDuplicateWorkout))))

	// ── Programas de treinamento (F19 — free tier, como treinos) ──
	//
	// O programa é uma lista ORDENADA de treinos que já existem em
	// workouts/{id}; ele não duplica o conteúdo do treino. Por isso as rotas
	// abaixo não criam entity nova: a navegação programa -> treino -> exercício
	// reutiliza GET /api/workouts/{id}.
	//
	// "import" é literal e "duplicate" fica sob {id}: no ServeMux do Go 1.22+
	// o padrão literal tem precedência, então POST /api/programs/import nunca
	// colide com POST /api/programs/{id}/duplicate.
	mux.HandleFunc("GET /api/programs", a.Require(a.RequireApproved(h.HandleListPrograms)))
	mux.HandleFunc("POST /api/programs", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleCreateProgram))))
	mux.HandleFunc("POST /api/programs/import", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleImportProgram))))
	mux.HandleFunc("GET /api/programs/{id}", a.Require(a.RequireApproved(h.HandleGetProgram)))
	mux.HandleFunc("PUT /api/programs/{id}", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleUpdateProgram))))
	mux.HandleFunc("DELETE /api/programs/{id}", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleDeleteProgram))))
	mux.HandleFunc("POST /api/programs/{id}/assign", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleAssignProgram))))
	mux.HandleFunc("POST /api/programs/{id}/duplicate", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleDuplicateProgram))))

	// ── Biblioteca de exercícios (catálogo global) ──
	// Leitura: usuário aprovado (aluno consulta; nunca escreve). Escrita:
	// somente admin — sempre via API Go (rules negam SDK cliente).
	mux.HandleFunc("GET /api/exercises", a.Require(a.RequireApproved(h.HandleListExercises)))
	mux.HandleFunc("GET /api/exercises/{id}", a.Require(a.RequireApproved(h.HandleGetExercise)))
	mux.HandleFunc("POST /api/exercises", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleCreateExercise))))
	mux.HandleFunc("PUT /api/exercises/{id}", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleUpdateExercise))))
	mux.HandleFunc("DELETE /api/exercises/{id}", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleDeleteExercise))))

	// ── Dietas (feature diet) ──
	mux.HandleFunc("GET /api/diets", a.Require(a.RequireApproved(h.HandleListDiets)))
	mux.HandleFunc("POST /api/diets", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleCreateDiet))))
	mux.HandleFunc("GET /api/diets/{id}", a.Require(a.RequireApproved(h.HandleGetDiet)))
	mux.HandleFunc("PUT /api/diets/{id}", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleUpdateDiet))))
	mux.HandleFunc("DELETE /api/diets/{id}", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleDeleteDiet))))
	mux.HandleFunc("POST /api/diets/{id}/duplicate", a.Require(a.Allow(models.RoleAdmin)(a.RequireApproved(h.HandleDuplicateDiet))))

}
