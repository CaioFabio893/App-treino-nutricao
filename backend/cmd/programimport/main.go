// Command programimport importa um programa de treino escrito em markdown para
// o Firestore, criando os TREINOS e o PROGRAMA (F19).
//
// Ele usa exatamente o mesmo caminho de importação do endpoint
// POST /api/programs/import (service.CreateProgramFromImport) — a UI e o CLI não
// podem divergir na forma de interpretar o arquivo.
//
// O comando aceita -dry-run, que APENAS mostra o que seria criado (nome do
// programa, nº de treinos, nº de exercícios e as ambiguidades preservadas),
// sem escrever nada. É o jeito seguro de conferir a leitura antes de gravar.
//
// Segurança: igual ao cmd/e2eseed, só roda contra os Emuladores locais — sem
// FIRESTORE_EMULATOR_HOST o programa se recusa a executar, para nunca apontar
// para produção por engano.
//
// Uso:
//
//	$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
//	$env:GCLOUD_PROJECT="treino-louise"
//	go run ./cmd/programimport -file "C:/Users/caiof/OneDrive/Desktop/exemplo/treino.md" -dry-run
//	go run ./cmd/programimport -file "C:/Users/caiof/OneDrive/Desktop/exemplo/treino.md" [-student <uid>]
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	firebase "firebase.google.com/go/v4"

	"treino-louise/backend/programmd"
	"treino-louise/backend/repository"
	"treino-louise/backend/service"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("programimport: %v", err)
	}
}

func run() error {
	var (
		file          = flag.String("file", "", "caminho do arquivo .md com o programa de treino (obrigatorio)")
		student       = flag.String("student", "", "uid do aluno (opcional): ja atribui o programa")
		name          = flag.String("name", "", "nome do programa (opcional; padrao: extraido do markdown)")
		source        = flag.String("source", "", "origem a gravar (opcional; padrao: nome do arquivo)")
		dryRun        = flag.Bool("dry-run", false, "apenas mostra o que seria criado, sem gravar")
		allowProd     = flag.Bool("allow-production", false, "nao usar; este comando e restrito a emuladores")
	)
	flag.Parse()
	_ = allowProd

	if strings.TrimSpace(*file) == "" {
		return errors.New("informe -file com o caminho do .md")
	}
	b, err := os.ReadFile(*file)
	if err != nil {
		return fmt.Errorf("ler %s: %w", *file, err)
	}
	markdown := string(b)
	if strings.TrimSpace(*source) == "" {
		*source = filepath.Base(*file)
	}

	// -dry-run não precisa de Firebase: mostra a leitura do arquivo e sai.
	if *dryRun {
		return describe(markdown, *source, *name)
	}

	// Guarda anti-producao: sem emulador local, nao grava.
	if os.Getenv("FIRESTORE_EMULATOR_HOST") == "" {
		return errors.New("recusando: defina FIRESTORE_EMULATOR_HOST (a importacao roda apenas contra emulador local; em producao use POST /api/programs/import)")
	}
	projectID := os.Getenv("GCLOUD_PROJECT")
	if projectID == "" {
		projectID = os.Getenv("GOOGLE_CLOUD_PROJECT")
	}
	if projectID == "" {
		return errors.New("defina GCLOUD_PROJECT ou GOOGLE_CLOUD_PROJECT")
	}

	ctx := context.Background()
	app, err := firebase.NewApp(ctx, nil)
	if err != nil {
		return fmt.Errorf("firebase.NewApp: %w", err)
	}
	fs, err := app.Firestore(ctx)
	if err != nil {
		return fmt.Errorf("firestore client: %w", err)
	}
	defer fs.Close()

	svc := service.New(repository.New(fs))
	result, err := svc.CreateProgramFromImport(ctx, markdown, *source, *name, *student)
	if err != nil {
		return err
	}

	total := 0
	for _, w := range result.Workouts {
		total += len(w.Exercises)
	}
	log.Printf("programa criado: %q (id=%s)", result.Program.Name, result.Program.ID)
	log.Printf("origem: %s", result.Program.Source)
	log.Printf("treinos: %d | exercicios: %d", len(result.Program.Workouts), total)
	for _, warning := range result.Warnings {
		log.Printf("aviso: %s", warning)
	}
	return nil
}

// describe imprime a leitura do arquivo sem gravar nada.
func describe(markdown, source, name string) error {
	parsed, err := programmd.Parse(markdown)
	if err != nil {
		return err
	}
	if strings.TrimSpace(name) != "" {
		parsed.Name = name
	}

	total := 0
	for _, w := range parsed.Workouts {
		total += len(w.Exercises)
	}
	fmt.Printf("dry-run: nada foi gravado\n")
	fmt.Printf("origem:   %s\n", source)
	fmt.Printf("programa: %s\n", parsed.Name)
	fmt.Printf("foco:     %s\n", orNone(parsed.Objective))
	fmt.Printf("treinos:  %d\n", len(parsed.Workouts))
	fmt.Printf("exercicios: %d\n", total)
	for _, w := range parsed.Workouts {
		cardio := ""
		if w.Description != "" {
			cardio = " (+ cardio preservado na descricao)"
		}
		day := w.DayOfWeek
		if day == "" {
			day = "sem dia"
		}
		fmt.Printf("  - %s | %d exercicios | dia=%s%s\n", w.Name, len(w.Exercises), day, cardio)
	}
	if parsed.Notes != "" {
		fmt.Printf("notas do programa (preservadas): %d linhas\n", len(strings.Split(parsed.Notes, "\n")))
	}
	if len(parsed.Warnings) == 0 {
		fmt.Printf("avisos: nenhum\n")
	} else {
		fmt.Printf("avisos (%d):\n", len(parsed.Warnings))
		for _, warning := range parsed.Warnings {
			fmt.Printf("  - %s\n", warning)
		}
	}
	return nil
}

func orNone(s string) string {
	if strings.TrimSpace(s) == "" {
		return "(vazio)"
	}
	return s
}
