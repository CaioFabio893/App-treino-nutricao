package main

// Metadados de execução do Treino Feminino: modalidade (gym/home), circuito
// AMRAP e, por exercício, fase/duração/dispensa de cronômetro/vídeos
// complementares. Aqui exercitamos a cadeia real (main.go) para provar que o
// handler valida e encaminha ao repository exatamente o que o editor envia.

import (
	"net/http"
	"testing"

	"treino-louise/backend/models"
)

// Admin cria um treino com todos os campos de execução: o handler deve
// preservá-los intactos até o repository (sem lossy mapping no caminho).
func TestChainCreateWorkoutPersistsExecutionMetadata(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	h := newChainMux(repo)

	body := `{"name":"Treino Feminino A","modality":"gym","circuitSeconds":900,"exercises":[
		{"name":"Agachamento","sets":4,"repetitions":"6-8","order":1,"phase":"main","videoUrl":"https://www.youtube.com/watch?v=aaa","videoUrls":["https://www.youtube.com/watch?v=bbb","https://www.youtube.com/watch?v=ccc"]},
		{"name":"Esteira Inclinada","sets":1,"repetitions":"20min","order":2,"phase":"cardio","durationSeconds":1200,"timerExcluded":true}
	]}`
	rr := doChainRequest(h, "POST", "/api/workouts", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("POST /api/workouts code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	w := repo.createdWorkout
	if w == nil {
		t.Fatal("CreateWorkout não foi chamado")
	}
	if w.Modality != "gym" || w.CircuitSeconds != 900 {
		t.Errorf("metadata do treino = {modality:%q circuitSeconds:%d}, want gym/900", w.Modality, w.CircuitSeconds)
	}
	if len(w.Exercises) != 2 {
		t.Fatalf("exercícios = %d, want 2", len(w.Exercises))
	}
	mainEx := w.Exercises[0]
	if mainEx.Phase != "main" {
		t.Errorf("phase = %q, want main", mainEx.Phase)
	}
	if len(mainEx.VideoURLs) != 2 || mainEx.VideoURLs[0] != "https://www.youtube.com/watch?v=bbb" || mainEx.VideoURLs[1] != "https://www.youtube.com/watch?v=ccc" {
		t.Errorf("videoUrls = %v, want os dois links complementares", mainEx.VideoURLs)
	}
	if mainEx.VideoURL != "https://www.youtube.com/watch?v=aaa" {
		t.Errorf("videoUrl = %q, want o link principal", mainEx.VideoURL)
	}
	cardio := w.Exercises[1]
	if cardio.Phase != "cardio" || !cardio.TimerExcluded || cardio.DurationSeconds != 1200 {
		t.Errorf("cardio = {phase:%q duration:%d timerExcluded:%v}, want cardio/1200/true", cardio.Phase, cardio.DurationSeconds, cardio.TimerExcluded)
	}
}

// Payloads inválidos não podem chegar ao repository.
func TestChainCreateWorkoutRejectsInvalidExecutionMetadata(t *testing.T) {
	cases := []struct{ name, body string }{
		{"modalidade desconhecida", `{"name":"X","modality":"pool","exercises":[]}`},
		{"circuito negativo", `{"name":"X","circuitSeconds":-1,"exercises":[]}`},
		{"circuito acima do teto", `{"name":"X","circuitSeconds":3601,"exercises":[]}`},
		{"fase desconhecida", `{"name":"X","exercises":[{"name":"A","phase":"yoga"}]}`},
		{"duração acima do teto", `{"name":"X","exercises":[{"name":"A","durationSeconds":3601}]}`},
		{"duração negativa", `{"name":"X","exercises":[{"name":"A","durationSeconds":-5}]}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			repo := baseRepo(adminProfile(models.StatusActive))
			h := newChainMux(repo)

			rr := doChainRequest(h, "POST", "/api/workouts", c.body, "token-valido")
			if rr.Code != http.StatusBadRequest {
				t.Fatalf("code = %d, want 400 (body: %s)", rr.Code, rr.Body.String())
			}
			if repo.createdWorkout != nil {
				t.Error("CreateWorkout não deveria ser chamado para payload inválido")
			}
		})
	}
}

// Editor antigo (que não conhece modalidade/circuito) não pode apagar a
// prescrição: o update preserva os campos que vieram vazios.
func TestChainUpdateWorkoutPreservesExecutionMetadataWhenEditorOmits(t *testing.T) {
	repo := baseRepo(adminProfile(models.StatusActive))
	repo.workout = &models.WorkoutDefine{
		ID:             "w-1",
		Name:           "Treino A",
		Modality:       "home",
		CircuitSeconds: 1200,
		Exercises:      []*models.WorkoutExercise{{Name: "Polichinelo", Phase: "warmup", Order: 1}},
	}
	h := newChainMux(repo)

	body := `{"name":"Treino A editado","exercises":[{"name":"Polichinelo","sets":1,"repetitions":"1min","order":1}]}`
	rr := doChainRequest(h, "PUT", "/api/workouts/w-1", body, "token-valido")
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/workouts/w-1 code = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if repo.updatedWorkout == nil {
		t.Fatal("UpdateWorkout não foi chamado")
	}
	if repo.updatedWorkout.Modality != "home" || repo.updatedWorkout.CircuitSeconds != 1200 {
		t.Errorf("metadata preservada = {modality:%q circuitSeconds:%d}, want home/1200", repo.updatedWorkout.Modality, repo.updatedWorkout.CircuitSeconds)
	}
}
