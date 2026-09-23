package service

import (
	"errors"
	"net/url"
	"strings"
	"unicode/utf8"

	"treino-louise/backend/models"
)

// ── Biblioteca de exercícios (F5) — validação/normalização ──
//
// A biblioteca é um catálogo GLOBAL (sem ownerId). As regras de validação
// (limites por campo + URL) vivem aqui para não vazar regra de negócio no
// handler; a autorização (quem pode escrever) permanece na camada HTTP.

// Erros de validação do exercício, mapeados para 400 pelos handlers.
var (
	// ErrExerciseNameRequired indica nome vazio.
	ErrExerciseNameRequired = errors.New("nome do exercicio obrigatorio")
	// ErrExerciseNameTooLong indica nome acima do limite.
	ErrExerciseNameTooLong = errors.New("nome do exercicio muito longo")
	// ErrExerciseFieldTooLong indica descrição/grupo/equipamento/URL acima do limite.
	ErrExerciseFieldTooLong = errors.New("campo do exercicio muito longo")
	// ErrExerciseInvalidURL indica URL de vídeo fora do formato http(s).
	ErrExerciseInvalidURL = errors.New("url de video invalida (use http ou https)")
)

// NormalizeExercise aplica trim nos campos de texto do exercício.
func NormalizeExercise(ex *models.ExerciseItem) {
	ex.Name = strings.TrimSpace(ex.Name)
	ex.Description = strings.TrimSpace(ex.Description)
	ex.MuscleGroup = strings.TrimSpace(ex.MuscleGroup)
	ex.Equipment = strings.TrimSpace(ex.Equipment)
	ex.VideoURL = strings.TrimSpace(ex.VideoURL)
}

// ValidateExercise valida os limites por campo e a URL (quando presente).
// Presume que NormalizeExercise já foi aplicado (name sem espaços).
func ValidateExercise(ex *models.ExerciseItem) error {
	if ex.Name == "" {
		return ErrExerciseNameRequired
	}
	if runeLen(ex.Name) > MaxExerciseNameLength {
		return ErrExerciseNameTooLong
	}
	if runeLen(ex.Description) > MaxExerciseDescriptionLength ||
		runeLen(ex.MuscleGroup) > MaxMuscleGroupLength ||
		runeLen(ex.Equipment) > MaxEquipmentLength {
		return ErrExerciseFieldTooLong
	}
	if runeLen(ex.VideoURL) > MaxVideoURLLength {
		return ErrExerciseFieldTooLong
	}
	if ex.VideoURL != "" && !validHTTPURL(ex.VideoURL) {
		return ErrExerciseInvalidURL
	}
	return nil
}

// runeLen conta caracteres Unicode (runas) — limite justo para acentos/emoji,
// consistente com o tooLong dos handlers.
func runeLen(s string) int {
	return utf8.RuneCountInString(s)
}

// validHTTPURL devolve true apenas para URLs absolutas http/https com host.
func validHTTPURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	return (u.Scheme == "http" || u.Scheme == "https") && u.Host != ""
}
