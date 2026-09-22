// Command e2eseed popula os Emuladores locais (Firestore + Auth) com dados
// determinísticos para os testes E2E de Playwright (Fase 3).
//
// Segurança: este programa se recusa a rodar sem as variáveis de ambiente dos
// emuladores (FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST) — nunca
// apontar para um projeto real de produção.
//
// Uso (com emuladores de pé e porta 8081 livre):
//
//	$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
//	$env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
//	$env:GCLOUD_PROJECT="treino-louise"
//	go run ./cmd/e2eseed
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"

	"treino-louise/backend/models"
	"treino-louise/backend/repository"
	"treino-louise/backend/service"
)

// ── Identidades determinísticas dos testes E2E ──────────────────────────────
const (
	adminEmail       = "e2e.admin@teste.local"
	nutritionistEmail = "e2e.nutri@teste.local"
	studentAEmail    = "e2e.aluno@teste.local"  // plano Completo
	studentBEmail    = "e2e.aluno2@teste.local" // plano Essencial (sem dieta/comunidade)
	studentCEmail    = "e2e.aluno3@teste.local" // plano só Treinos (sem ranking)
	pendingEmail     = "e2e.pendente@teste.local"
	rejectedEmail    = "e2e.recusado@teste.local"
	password         = "e2e-senha-123"
)

var weekdayKeys = map[time.Weekday]string{
	time.Sunday: "sunday", time.Monday: "monday", time.Tuesday: "tuesday",
	time.Wednesday: "wednesday", time.Thursday: "thursday", time.Friday: "friday",
	time.Saturday: "saturday",
}

func main() {
	if err := run(); err != nil {
		log.Fatalf("e2eseed: %v", err)
	}
	log.Println("e2eseed: OK — dados de teste prontos.")
}

func run() error {
	ctx := context.Background()

	// Guarda anti-produção: só roda contra os emuladores locais.
	fsHost := os.Getenv("FIRESTORE_EMULATOR_HOST")
	authHost := os.Getenv("FIREBASE_AUTH_EMULATOR_HOST")
	if fsHost == "" || authHost == "" {
		return errors.New("recusando: defina FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST (seed roda apenas contra emuladores locais)")
	}
	projectID := os.Getenv("GCLOUD_PROJECT")
	if projectID == "" {
		projectID = os.Getenv("GOOGLE_CLOUD_PROJECT")
	}
	if projectID == "" {
		return errors.New("defina GCLOUD_PROJECT ou GOOGLE_CLOUD_PROJECT")
	}
	log.Printf("e2eseed: emuladores firestore=%s auth=%s projeto=%s", fsHost, authHost, projectID)

	app, err := firebase.NewApp(ctx, nil)
	if err != nil {
		return fmt.Errorf("firebase.NewApp: %w", err)
	}
	fs, err := app.Firestore(ctx)
	if err != nil {
		return fmt.Errorf("firestore client: %w", err)
	}
	defer fs.Close()
	authClient, err := app.Auth(ctx)
	if err != nil {
		return fmt.Errorf("auth client: %w", err)
	}

	repo := repository.New(fs)
	svc := service.New(repo)

	// ── Usuários no Auth Emulator ──
	uid := map[string]string{}
	users := []struct {
		key, email, name string
	}{
		{"admin", adminEmail, "Admin E2E"},
		{"nutritionist", nutritionistEmail, "Nutri E2E"},
		{"studentA", studentAEmail, "Ana Aluna"},
		{"studentB", studentBEmail, "Bruno Aluno"},
		{"studentC", studentCEmail, "Carla Aluna"},
		{"pending", pendingEmail, "Pendente E2E"},
		{"rejected", rejectedEmail, "Recusado E2E"},
	}
	for _, u := range users {
		id, err := ensureUser(ctx, authClient, u.email, u.name)
		if err != nil {
			return fmt.Errorf("usuario %s: %w", u.email, err)
		}
		uid[u.key] = id
		log.Printf("  auth %-14s %-28s %s", u.key, u.email, id)
	}

	// ── Planos (features determinísticas) ──
	plans := map[string]*models.Plan{}
	planDefs := []struct {
		key, name, desc string
		features        []models.Feature
	}{
		{"completo", "Completo E2E", "Treino + dieta + comunidade + ranking",
			[]models.Feature{models.FeatureWorkouts, models.FeatureDiet, models.FeatureCommunity, models.FeatureRanking}},
		{"essencial", "Essencial E2E", "Treino + ranking",
			[]models.Feature{models.FeatureWorkouts, models.FeatureRanking}},
		{"treinos", "Só Treinos E2E", "Somente treinos (tier gratuito)",
			[]models.Feature{models.FeatureWorkouts}},
	}
	for _, p := range planDefs {
		plan, err := repo.CreatePlan(ctx, &models.Plan{
			Name: p.name, Description: p.desc, Features: p.features, Active: true,
		})
		if err != nil {
			return fmt.Errorf("plano %s: %w", p.key, err)
		}
		plans[p.key] = plan
		log.Printf("  plan %-10s %-20s %s", p.key, p.name, plan.ID)
	}

	// ── Perfis (users/{uid}) — escrita equivalente à Admin SDK ──
	now := service.Now()
	cycle := service.CurrentCycle()
	startDate := cycle.Start.Format("2006-01-02")
	endDate := cycle.End.AddDate(0, 0, -1).Format("2006-01-02")
	type profileSeed struct {
		key             string
		role            models.Role
		status          string
		planKey         string
		nutritionistUID string
		start, end      string
	}
	profiles := []profileSeed{
		{"admin", models.RoleAdmin, models.StatusActive, "", "", "", ""},
		{"nutritionist", models.RoleNutritionist, models.StatusActive, "", "", "", ""},
		{"studentA", models.RoleStudent, models.StatusActive, "completo", uid["nutritionist"], startDate, endDate},
		{"studentB", models.RoleStudent, models.StatusActive, "essencial", uid["nutritionist"], startDate, endDate},
		{"studentC", models.RoleStudent, models.StatusActive, "treinos", uid["nutritionist"], startDate, endDate},
		{"pending", "", models.StatusPendingApproval, "", "", "", ""},
		{"rejected", "", models.StatusRejected, "", "", "", ""},
	}
	emailOf := map[string]string{
		"admin": adminEmail, "nutritionist": nutritionistEmail,
		"studentA": studentAEmail, "studentB": studentBEmail, "studentC": studentCEmail,
		"pending": pendingEmail, "rejected": rejectedEmail,
	}
	for _, p := range profiles {
		prof := &models.UserProfile{
			Name:            userNames[p.key],
			Email:           emailOf[p.key],
			Role:            p.role,
			Status:          p.status,
			AuthProvider:    "password",
			NutritionistID:  p.nutritionistUID,
			StartDate:       p.start,
			EndDate:         p.end,
			CreatedAt:       now,
		}
		if p.planKey != "" {
			prof.PlanID = plans[p.planKey].ID
			prof.Features = plans[p.planKey].Features
			prof.ApprovedBy = uid["admin"]
			prof.ApprovedAt = now
		}
		if p.key == "rejected" {
			prof.RejectedReason = "Documento divergente (verificação E2E)"
		}
		if err := repo.PutUserProfile(ctx, uid[p.key], prof); err != nil {
			return fmt.Errorf("perfil %s: %w", p.key, err)
		}
		log.Printf("  prof %-12s %-16s %s plan=%s", p.key, p.status, uid[p.key], prof.PlanID)
	}

	// ── Treinos dos alunos ──
	todayKey := weekdayKeys[now.Weekday()]
	yesterdayKey := weekdayKeys[now.AddDate(0, 0, -1).Weekday()]

	workoutA, err := repo.CreateWorkout(ctx, &models.WorkoutDefine{
		StudentID: uid["studentA"], NutritionistID: uid["nutritionist"],
		Name: "Treino de Hoje E2E", DayOfWeek: todayKey, Objective: "Hipertrofia",
		Description: "Treino principal do cenário E2E",
		Exercises: []*models.WorkoutExercise{
			{Name: "Agachamento", Sets: 2, Repetitions: "10", Weight: "40 kg", RestSeconds: 60, Order: 1},
			{Name: "Supino reto", Sets: 2, Repetitions: "10", Weight: "30 kg", RestSeconds: 60, Order: 2},
		},
	})
	if err != nil {
		return fmt.Errorf("treino A hoje: %w", err)
	}
	workoutA2, err := repo.CreateWorkout(ctx, &models.WorkoutDefine{
		StudentID: uid["studentA"], NutritionistID: uid["nutritionist"],
		Name: "Treino Secundário E2E", DayOfWeek: yesterdayKey, Objective: "Condicionamento",
		Exercises: []*models.WorkoutExercise{
			{Name: "Remada curvada", Sets: 2, Repetitions: "12", Weight: "20 kg", RestSeconds: 45, Order: 1},
		},
	})
	if err != nil {
		return fmt.Errorf("treino A 2: %w", err)
	}
	workoutB, err := repo.CreateWorkout(ctx, &models.WorkoutDefine{
		StudentID: uid["studentB"], NutritionistID: uid["nutritionist"],
		Name: "Treino Básico E2E", DayOfWeek: todayKey,
		Exercises: []*models.WorkoutExercise{
			{Name: "Puxada alta", Sets: 2, Repetitions: "10", Weight: "25 kg", RestSeconds: 60, Order: 1},
		},
	})
	if err != nil {
		return fmt.Errorf("treino B: %w", err)
	}
	if _, err := repo.CreateWorkout(ctx, &models.WorkoutDefine{
		StudentID: uid["studentC"], NutritionistID: uid["nutritionist"],
		Name: "Treino Livre E2E", DayOfWeek: todayKey,
		Exercises: []*models.WorkoutExercise{
			{Name: "Esteira", Sets: 1, Repetitions: "20 min", RestSeconds: 0, Order: 1},
		},
	}); err != nil {
		return fmt.Errorf("treino C: %w", err)
	}
	log.Printf("  treinos: A=%s A2=%s B=%s", workoutA.ID, workoutA2.ID, workoutB.ID)

	// ── Dieta do aluno A ──
	if _, err := repo.CreateDiet(ctx, &models.Diet{
		StudentID: uid["studentA"], NutritionistID: uid["nutritionist"],
		Name: "Plano Alimentar E2E", Description: "Plano de teste (background)",
		StartDate: startDate, EndDate: endDate,
		Content: "CAFÉ DA MANHÃ (07:00)\n• 2 ovos cozidos\n• 1 banana\n\nALMOÇO (12:30)\n• 150g de arroz integral\n• 200g de frango grelhado",
	}); err != nil {
		return fmt.Errorf("dieta A: %w", err)
	}

	// ── Logs de dieta (determinam pontuação) ──
	todayStr := now.Format("2006-01-02")
	yesterdayStr := now.AddDate(0, 0, -1).Format("2006-01-02")
	mkLog := func(studentKey, date string, status models.DietLogStatus) {
		if err := repo.PutDietLog(ctx, &models.DietDailyLog{
			StudentID: uid[studentKey], NutritionistID: uid["nutritionist"],
			DietName: "Plano Alimentar E2E", Date: date, Status: status,
		}); err != nil {
			log.Fatalf("dietLog %s %s: %v", studentKey, date, err)
		}
		log.Printf("  dietLog %-10s %s %s", studentKey, date, status)
	}
	mkLog("studentA", todayStr, models.DietFollowed)
	mkLog("studentA", yesterdayStr, models.DietFollowed)
	mkLog("studentB", yesterdayStr, models.DietPartial)

	// ── Histórico de treinos (determinam pontuação + feed/timeline) ──
	at := func(daysAgo int, hour int) time.Time {
		d := now.AddDate(0, 0, -daysAgo)
		return time.Date(d.Year(), d.Month(), d.Day(), hour, 0, 0, 0, service.AppLoc)
	}
	mkHistory := func(studentKey string, w *models.WorkoutDefine, daysAgo int) {
		if _, err := repo.CreateHistoryEntry(ctx, &models.WorkoutHistoryEntry{
			StudentID: uid[studentKey], WorkoutID: w.ID, WorkoutName: w.Name,
			NutritionistID: uid["nutritionist"], CompletedAt: at(daysAgo, 7),
			Duration: 45, ExercisesCompleted: len(w.Exercises), TotalExercises: len(w.Exercises),
			Exercises: []models.HistoryExercise{
				{Name: w.Exercises[0].Name, Order: 1, Sets: []models.HistorySet{{Weight: "40", Reps: "10", Done: true}}},
			},
		}); err != nil {
			log.Fatalf("history %s: %v", studentKey, err)
		}
		log.Printf("  history %-10s %s %dd atrás", studentKey, w.Name, daysAgo)
	}
	mkHistory("studentA", workoutA, 0)
	mkHistory("studentA", workoutA2, 1)
	mkHistory("studentB", workoutB, 1)

	// ── Pontuação do ciclo (salva o snapshot lido pelo ranking) ──
	for _, s := range []struct{ key, start string }{
		{"studentA", startDate}, {"studentB", startDate}, {"studentC", startDate},
	} {
		if err := svc.RecomputeScore(ctx, uid[s.key], s.start); err != nil {
			return fmt.Errorf("recompute %s: %w", s.key, err)
		}
		rec, err := repo.GetScoreRecord(ctx, uid[s.key])
		if err != nil {
			return fmt.Errorf("score %s: %w", s.key, err)
		}
		if rec == nil || rec.Score <= 0 {
			if s.key == "studentA" {
				return fmt.Errorf("score de %s deveria ser > 0 (tem história+dieta no ciclo), got=%+v", s.key, rec)
			}
		}
		log.Printf("  score %-10s %.1f (ciclo %s)", s.key, rec.Score, rec.CycleID)
	}

	// Validação cruzada: aluno A deve pontuar mais que B (garante ranking estável).
	sa, _ := repo.GetScoreRecord(ctx, uid["studentA"])
	sb, _ := repo.GetScoreRecord(ctx, uid["studentB"])
	if sa.Score <= sb.Score {
		return fmt.Errorf("esperava score A > B para ranking determinístico: A=%.2f B=%.2f", sa.Score, sb.Score)
	}

	fmt.Printf(`
e2eseed: seed concluído
  admin        %-26s %s
  nutritionist %-26s %s
  studentA     %-26s %s  (plano Completo, score %.1f)
  studentB     %-26s %s  (plano Essencial, score %.1f)
  studentC     %-26s %s  (plano só Treinos)
  pending      %-26s %s
  rejected     %-26s %s
  senha comum:  %s
`, adminEmail, uid["admin"], nutritionistEmail, uid["nutritionist"],
		studentAEmail, uid["studentA"], sa.Score,
		studentBEmail, uid["studentB"], sb.Score,
		studentCEmail, uid["studentC"],
		pendingEmail, uid["pending"], rejectedEmail, uid["rejected"], password)
	return nil
}

var userNames = map[string]string{
	"admin": "Admin E2E", "nutritionist": "Nutri E2E",
	"studentA": "Ana Aluna", "studentB": "Bruno Aluno", "studentC": "Carla Aluna",
	"pending": "Pendente E2E", "rejected": "Recusado E2E",
}

// ensureUser cria o usuário no Auth Emulator (ou reutiliza o existente e
// reaplica a senha), devolvendo o UID.
func ensureUser(ctx context.Context, ac *auth.Client, email, name string) (string, error) {
	u, err := ac.GetUserByEmail(ctx, email)
	if err == nil {
		_, err = ac.UpdateUser(ctx, u.UID,
			(&auth.UserToUpdate{}).Password(password).DisplayName(name))
		if err != nil {
			return "", err
		}
		return u.UID, nil
	}
	created, err := ac.CreateUser(ctx,
		(&auth.UserToCreate{}).Email(email).Password(password).DisplayName(name))
	if err != nil {
		return "", err
	}
	return created.UID, nil
}