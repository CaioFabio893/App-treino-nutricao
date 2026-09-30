package service

import "time"

// startOfDay devolve t no início do seu dia local (00:00:00), preservando o
// fuso de t.
//
// Vivia em cycle.go (ciclo de pontuação), removido na F1 da refatoração
// "simplificação". Continua em uso pelo serviço social (feed de posts), que
// não é gamificação — por isso foi realocado para cá em vez de sumir.
func startOfDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}