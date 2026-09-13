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
	mux.HandleFunc("GET /api/sessions/{week}/{day}", srv.withAuth(srv.handleGetSession))
	mux.HandleFunc("PUT /api/sessions/{week}/{day}", srv.withAuth(srv.handlePutSession))
	mux.HandleFunc("GET /api/prs", srv.withAuth(srv.handleGetPRs))
	mux.HandleFunc("PUT /api/prs", srv.withAuth(srv.handlePutPRs))
	mux.HandleFunc("GET /api/state", srv.withAuth(srv.handleGetState))
	mux.HandleFunc("PUT /api/state", srv.withAuth(srv.handlePutState))

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