package service

import (
	"time"

	_ "time/tzdata" // garante a base de fusos mesmo na imagem distroless do Cloud Run
)

// AppLoc é o fuso horário oficial do aplicativo: America/Recife (Brasil -03,
// sem horário de verão desde 2019). Todas as datas de "hoje"/"dia do aluno"
// são calculadas neste fuso — assim o dia do treino concluído no backend bate
// com o dia do navegador do aluno (dietLogs/post.date são strings locais).
var AppLoc = loadAppLoc()

func loadAppLoc() *time.Location {
	if loc, err := time.LoadLocation("America/Recife"); err == nil {
		return loc
	}
	// Fallback determinístico: BRT fixo em -03:00 (nunca deve acontecer com a
	// base embutida, mas mantém o comportamento correto se algo falhar).
	return time.FixedZone("BRT", -3*60*60)
}

// Now devolve o instante atual no fuso do aplicativo.
func Now() time.Time { return time.Now().In(AppLoc) }