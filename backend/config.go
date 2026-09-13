package main

import (
	"fmt"
	"math"
	"time"
)

// ── Configuração do ranking / ciclo de 3 meses ──
//
// A nota é sempre relativa ao CICLO ATUAL (trimestre civil: Jan–Mar, Abr–Jun,
// Jul–Set, Out–Dez). Todo mundo zera junto a cada ciclo; a nota final de cada
// ciclo fica guardada em scores_history/{uid}/{cicloId} antes de zerar.
//
// Recalibrar estes valores aqui é o ponto único de ajuste — é natural mudá-los
// depois de ver o uso real.

const (
	// CicloMes tem a duração do ciclo em meses (trimestre).
	CycleMonths = 3

	// Pontuação bruta diária (por dia do ciclo):
	ScoreWorkout     = 0.4  // treino do dia concluído
	ScoreDiet        = 0.4  // dieta do dia seguida (nível dia, status "followed")
	ScoreDietPartial = 0.2  // dieta do dia marcada como "parcial"
	ScoreComboBonus  = 0.2  // bônus quando treino + dieta aconteceram no mesmo dia
	ScoreDayMax      = 1.0  // teto de pontos brutos por dia (0,4+0,4+0,2)

	// ScoreMax é o teto da nota exibida no ranking (0 a 10).
	ScoreMax = 10.0

	// RankingPublicTop é o tamanho do ranking público (top 20).
	RankingPublicTop = 20
)

// Cycle é um ciclo de pontuação (trimestre civil) com seus limites.
type Cycle struct {
	ID    string    // ex.: "2026-Q3"
	Start time.Time // primeiro dia do ciclo (inclusive)
	End   time.Time // primeiro dia do ciclo seguinte (exclusivo)
}

// startOfDay normaliza um time.Time para 00:00 (horário local).
func startOfDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

// cycleFor devolve o ciclo (trimestre civil) que contém t.
func cycleFor(t time.Time) Cycle {
	y := t.Year()
	q := (int(t.Month())-1)/CycleMonths + 1
	startM := time.Month((q-1)*CycleMonths + 1)
	start := time.Date(y, startM, 1, 0, 0, 0, 0, t.Location())
	end := time.Date(y, startM+time.Month(CycleMonths), 1, 0, 0, 0, 0, t.Location())
	return Cycle{
		ID:    fmt.Sprintf("%d-Q%d", y, q),
		Start: start,
		End:   end,
	}
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

// DayPoints agrega o que aconteceu em um dia do ciclo para pontuação.
type DayPoints struct {
	WorkoutDone bool
	DietStatus  DietLogStatus
}

// computeRawPoints soma os pontos brutos do ciclo a partir do mapa de dias.
// Rules:
//   - 0,4 por dia com treino concluído;
//   - 0,4 por dia com dieta "followed" (0,2 se "partial");
//   - +0,2 bônus se treino E dieta "followed" aconteceram no mesmo dia.
func computeRawPoints(days map[string]DayPoints) float64 {
	var raw float64
	for _, d := range days {
		if d.WorkoutDone {
			raw += ScoreWorkout
		}
		switch d.DietStatus {
		case DietFollowed:
			raw += ScoreDiet
		case DietPartial:
			raw += ScoreDietPartial
		}
		if d.WorkoutDone && d.DietStatus == DietFollowed {
			raw += ScoreComboBonus
		}
	}
	return raw
}

// countWorkoutDays resume a nota (0–10) do ciclo atual de um aluno usando os
// dados de origem (histórico de treinos + logs de dieta) — sem estado parcial.
func cycleScoreFromData(cycle Cycle, userStart string, today time.Time, workoutDays []string, dietDays map[string]DietLogStatus) (raw float64, daysDone int, score float64, denom int) {
	days := map[string]DayPoints{}
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