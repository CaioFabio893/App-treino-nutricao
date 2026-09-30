package service

// ── Limites de tamanho de entrada (texto controlado pelo usuário) ──
//
// O middleware MaxBody já limita o corpo inteiro de POST/PUT a 1 MiB; estes
// limites são POR CAMPO, para impedir abuso em textos que vão direto para o
// Firestore e aparecem no feed/UI. Medidos em runas (caracteres Unicode), não
// em bytes — assim o limite é justo para nomes com acento/emoji.
const (
	MaxNameLength        = 120   // nome de usuário/treino/dieta/plano
	MaxDescriptionLength = 2000  // descrição/objetivo de treino/dieta/plano
	MaxNoteLength        = 2000  // notas (exercício, refeição, log de dieta)
	MaxDietContentLength = 20000 // dieta em texto livre
	MaxRejectReason      = 500   // motivo de recusa de cadastro

	// ── Biblioteca de exercícios (F5) ──
	// Nome/descrição reutilizam os limites de treino/dieta por coerência; os
	// campos específicos da biblioteca ganham limites próprios (resíduo F13 #2:
	// limite granular por campo, em vez de depender só do teto global MaxBody).
	MaxExerciseNameLength        = MaxNameLength        // 120
	MaxExerciseDescriptionLength = MaxDescriptionLength // 2000
	MaxMuscleGroupLength         = 80                   // grupo muscular
	MaxEquipmentLength           = 80                   // equipamento
	MaxVideoURLLength            = 500                  // URL de vídeo

	// ── Programas de treinamento (F19) ──
	// Notas do programa recebem o mesmo teto da dieta em texto livre, porque é
	// onde entra o material preservado da fonte (PRs, periodização, estrutura
	// semanal) quando o programa vem de um arquivo importado.
	MaxNotesLength     = MaxDietContentLength // 20000
	MaxProgramWorkouts = 60                   // treinos por programa
)
