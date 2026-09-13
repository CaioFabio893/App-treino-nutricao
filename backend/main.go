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
)

// Server agrupa os clientes do Firebase usados pela API.
type Server struct {
	fs   *firestore.Client
	auth *firebaseAuth.Client
}

func main() {
	ctx := context.Background()

	// Usa Application Default Credentials:
	//  - no Cloud Run, as credenciais vêm automaticamente do metadata server;
	//  - localmente, use GOOGLE_APPLICATION_CREDENTIALS apontando pro service account JSON.
	app, err := firebase.NewApp(ctx, nil)
	if err != nil {
		log.Fatalf("firebase.NewApp: %v", err)
	}

	firestoreClient, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalf("app.Firestore: %v", err)
	}

	authClient, err := app.Auth(ctx)
	if err != nil {
		log.Fatalf("app.Auth: %v", err)
	}

	srv := &Server{fs: firestoreClient, auth: authClient}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", srv.handleHealth)

	// ── Modo original (preservado) ──
	mux.HandleFunc("GET /api/sessions/{week}/{day}", srv.withAuth(srv.handleGetSession))
	mux.HandleFunc("PUT /api/sessions/{week}/{day}", srv.withAuth(srv.handlePutSession))
	mux.HandleFunc("GET /api/prs", srv.withAuth(srv.handleGetPRs))
	mux.HandleFunc("PUT /api/prs", srv.withAuth(srv.handlePutPRs))
	mux.HandleFunc("GET /api/state", srv.withAuth(srv.handleGetState))
	mux.HandleFunc("PUT /api/state", srv.withAuth(srv.handlePutState))

	// ── Perfil do usuário logado ──
	mux.HandleFunc("GET /api/me", srv.withAuth(srv.handleGetMe))
	mux.HandleFunc("PUT /api/me", srv.withAuth(srv.handlePutMe))

	// ── Usuários (admin) ──
	admin := srv.withAuth(srv.handleListUsers)
	mux.HandleFunc("GET /api/users", srv.withRole(RoleAdmin)(admin))
	mux.HandleFunc("POST /api/users", srv.withRole(RoleAdmin)(srv.withAuth(srv.handleCreateUser)))
	mux.HandleFunc("GET /api/users/{id}", srv.withRole(RoleAdmin)(srv.withAuth(srv.handleGetUser)))
	mux.HandleFunc("PUT /api/users/{id}", srv.withRole(RoleAdmin)(srv.withAuth(srv.handleUpdateUser)))
	mux.HandleFunc("DELETE /api/users/{id}", srv.withRole(RoleAdmin)(srv.withAuth(srv.handleDeleteUser)))

	// ── Alunos ──
	mux.HandleFunc("GET /api/students", srv.withRole(RoleNutritionist, RoleAdmin)(srv.withAuth(srv.handleListMyStudents)))
	mux.HandleFunc("GET /api/students/{id}", srv.withAuth(srv.handleGetStudent))
	mux.HandleFunc("PUT /api/students/{id}", srv.withRole(RoleNutritionist, RoleAdmin)(srv.withAuth(srv.handleUpdateStudent)))

	// ── Treinos ──
	mux.HandleFunc("GET /api/workouts", srv.withAuth(srv.handleListWorkouts))
	mux.HandleFunc("POST /api/workouts", srv.withRole(RoleNutritionist, RoleAdmin)(srv.withAuth(srv.handleCreateWorkout)))
	mux.HandleFunc("GET /api/workouts/{id}", srv.withAuth(srv.handleGetWorkout))
	mux.HandleFunc("PUT /api/workouts/{id}", srv.withRole(RoleNutritionist, RoleAdmin)(srv.withAuth(srv.handleUpdateWorkout)))
	mux.HandleFunc("DELETE /api/workouts/{id}", srv.withRole(RoleNutritionist, RoleAdmin)(srv.withAuth(srv.handleDeleteWorkout)))
	mux.HandleFunc("POST /api/workouts/{id}/duplicate", srv.withRole(RoleNutritionist, RoleAdmin)(srv.withAuth(srv.handleDuplicateWorkout)))

	// ── Dietas ──
	mux.HandleFunc("GET /api/diets", srv.withAuth(srv.handleListDiets))
	mux.HandleFunc("POST /api/diets", srv.withRole(RoleNutritionist, RoleAdmin)(srv.withAuth(srv.handleCreateDiet)))
	mux.HandleFunc("GET /api/diets/{id}", srv.withAuth(srv.handleGetDiet))
	mux.HandleFunc("PUT /api/diets/{id}", srv.withRole(RoleNutritionist, RoleAdmin)(srv.withAuth(srv.handleUpdateDiet)))
	mux.HandleFunc("DELETE /api/diets/{id}", srv.withRole(RoleNutritionist, RoleAdmin)(srv.withAuth(srv.handleDeleteDiet)))
	mux.HandleFunc("POST /api/diets/{id}/duplicate", srv.withRole(RoleNutritionist, RoleAdmin)(srv.withAuth(srv.handleDuplicateDiet)))

	// ── Histórico ──
	mux.HandleFunc("GET /api/workout-history", srv.withAuth(srv.handleListHistory))
	mux.HandleFunc("POST /api/workouts/complete", srv.withAuth(srv.handleCompleteWorkout))

	// ── Rede social (feed global) ──
	mux.HandleFunc("POST /api/posts", srv.withAuth(srv.handleCreatePost))
	mux.HandleFunc("GET /api/posts", srv.withAuth(srv.handleListPosts))
	mux.HandleFunc("POST /api/posts/{id}/like", srv.withAuth(srv.handleToggleLike))
	mux.HandleFunc("POST /api/posts/{id}/comments", srv.withAuth(srv.handleAddComment))
	mux.HandleFunc("DELETE /api/posts/{id}/comments/{cid}", srv.withAuth(srv.handleDeleteComment))
	mux.HandleFunc("DELETE /api/posts/{id}", srv.withAuth(srv.handleDeletePost))

	// ── Dieta diária (dia + refeição) ──
	mux.HandleFunc("GET /api/diet-logs", srv.withAuth(srv.handleListDietLogs))
	mux.HandleFunc("PUT /api/diet-logs", srv.withAuth(srv.handleUpsertDietLog))

	// ── Ranking / pontuação / perfil público ──
	mux.HandleFunc("GET /api/ranking", srv.withAuth(srv.handleGetRanking))
	mux.HandleFunc("GET /api/scores/history", srv.withAuth(srv.handleGetScoreHistory))
	mux.HandleFunc("GET /api/public/profile/{id}", srv.withAuth(srv.handleGetPublicProfile))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	httpSrv := &http.Server{
		Addr:              ":" + port,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 10 * time.Second,
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