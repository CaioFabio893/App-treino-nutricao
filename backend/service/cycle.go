package service

import (
	"fmt"
	"math"
	"time"

	"treino-louise/backend/models"
)

// startOfDay normaliza um time.Time para 00:00 (horário local).
func startOfDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

// cycleFor devolve o ciclo (trimestre civil) que contém t.
func cycleFor(t time.Time) models.Cycle {
	y := t.Year()
	q := (int(t.Month())-1)/CycleMonths + 1
	startM := time.Month((q-1)*CycleMonths + 1)
	start := time.Date(y, startM, 1, 0, 0, 0, 0, t.Location())
	end := time.Date(y, startM+time.Month(CycleMonths), 1, 0, 0, 0, 0, t.Location())
	return models.Cycle{
		ID:    fmt.Sprintf("%d-Q%d", y, q),
		Start: start,
		End:   end,
	}
}

// CurrentCycle devolve o ciclo atual (trimestre civil corrente).
func CurrentCycle() models.Cycle {
	return cycleFor(time.Now())
}

// parseDateYMD converte "2006-01-02" em time.Time (horário local). Retorna a
// flag ok = false se a string for vazia ou inválida.
func parseDateYMD(s string) (time.Time, bool) {
	if s == "" {
		return time.Time{}, false
	}
	t, err := time.ParseInLocation("2006-01-02", s, time.Local)
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}

// daysElapsedInCycle devolve quantos dias já passaram no ciclo para o aluno,
// contando do início do ciclo (ou da data de início do aluno, o que for
// posterior) até hoje, ambos inclusivos. Nunca retorna menos que 1 — assim
// quem acabou de entrar não é punido por um divisor zerado.
func daysElapsedInCycle(cycleStart time.Time, userStart string, today time.Time) int {
	start := cycleStart
	if us, ok := parseDateYMD(userStart); ok && us.After(start) {
		start = startOfDay(us)
	}
	if today.Before(start) {
		start = today
	}
	days := int(today.Sub(start).Hours()/24) + 1
	if days < 1 {
		days = 1
	}
	return days
}

// round1 arredonda para 1 casa decimal (método de arredondamento usual).
func round1(v float64) float64 {
	return math.Round(v*10) / 10
}

// scoreFromPoints calcula a nota de 0 a 10 a partir dos pontos brutos do
// ciclo e dos dias já passados. Limitada a ScoreMax.
func scoreFromPoints(raw float64, days int) float64 {
	if days < 1 {
		days = 1
	}
	s := raw / float64(days) * 10
	if s > ScoreMax {
		s = ScoreMax
	}
	return round1(s)
}

// computeRawPoints soma os pontos brutos do ciclo a partir do mapa de dias.
// Rules:
//   - 0,4 por dia com treino concluído;
//   - 0,4 por dia com dieta "followed" (0,2 se "partial");
//   - +0,2 bônus se treino E dieta "followed" aconteceram no mesmo dia.
func computeRawPoints(days map[string]models.DayPoints) float64 {
	var raw float64
	for _, d := range days {
		if d.WorkoutDone {
			raw += ScoreWorkout
		}
		switch d.DietStatus {
		case models.DietFollowed:
			raw += ScoreDiet
		case models.DietPartial:
			raw += ScoreDietPartial
		}
		if d.WorkoutDone && d.DietStatus == models.DietFollowed {
			raw += ScoreComboBonus
		}
	}
	return raw
}

// cycleScoreFromData resume a nota (0–10) do ciclo atual de um aluno usando os
// dados de origem (histórico de treinos + logs de dieta) — sem estado parcial.
func cycleScoreFromData(cycle models.Cycle, userStart string, today time.Time, workoutDays []string, dietDays map[string]models.DietLogStatus) (raw float64, daysDone int, score float64, denom int) {
	days := map[string]models.DayPoints{}
	for _, d := range workoutDays {
		x := days[d]
		x.WorkoutDone = true
		days[d] = x
	}
	for d, st := range dietDays {
		x := days[d]
		x.DietStatus = st
		days[d] = x
	}
	raw = computeRawPoints(days)
	denom = daysElapsedInCycle(cycle.Start, userStart, today)
	score = scoreFromPoints(raw, denom)
	return raw, len(days), score, denom
}
