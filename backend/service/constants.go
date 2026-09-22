package service

// ── Configuração do ranking / ciclo de 3 meses ──
//
// A nota é sempre relativa ao CICLO ATUAL (trimestre civil: Jan–Mar, Abr–Jun,
// Jul–Set, Out–Dez). Todo mundo zera junto a cada ciclo; a nota final de cada
// ciclo fica guardada em scores_history/{uid}/{cicloId} antes de zerar.
//
// Recalibrar estes valores aqui é o ponto único de ajuste — é natural mudá-los
// depois de ver o uso real.

const (
	// CycleMonths tem a duração do ciclo em meses (trimestre).
	CycleMonths = 3

	// Pontuação bruta diária (por dia do ciclo):
	ScoreWorkout     = 0.4 // treino do dia concluído
	ScoreDiet        = 0.4 // dieta do dia seguida (nível dia, status "followed")
	ScoreDietPartial = 0.2 // dieta do dia marcada como "parcial"
	ScoreComboBonus  = 0.2 // bônus quando treino + dieta aconteceram no mesmo dia
	ScoreDayMax      = 1.0 // teto de pontos brutos por dia (0,4+0,4+0,2)

	// ScoreMax é o teto da nota exibida no ranking (0 a 10).
	ScoreMax = 10.0

	// RankingPublicTop é o tamanho do ranking público (top 20).
	RankingPublicTop = 20
)

// ── Limites de tamanho de entrada (texto controlado pelo usuário) ──
//
// O middleware MaxBody já limita o corpo inteiro de POST/PUT a 1 MiB; estes
// limites são POR CAMPO, para impedir abuso em textos que vão direto para o
// Firestore e aparecem no feed/UI. Medidos em runas (caracteres Unicode), não
// em bytes — assim o limite é justo para nomes com acento/emoji.
const (
	MaxPostText          = 500   // texto/legenda de post e comentário
	MaxCommentText       = 500   // comentário do feed
	MaxNameLength        = 120   // nome de usuário/treino/dieta/plano
	MaxBioLength         = 500   // bio do perfil
	MaxDescriptionLength = 2000  // descrição/objetivo de treino/dieta/plano
	MaxNoteLength        = 2000  // notas (exercício, refeição, log de dieta)
	MaxDietContentLength = 20000 // dieta em texto livre
	MaxRejectReason      = 500   // motivo de recusa de cadastro
)
