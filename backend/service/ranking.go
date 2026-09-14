package service

import (
	"sort"

	"treino-louise/backend/models"
)

// BuildRanking monta a lista ordenada de alunos com nota. students é a lista
// de alunos considerados (globais para o top público; filtrados por nutricionista
// para o ranking completo). scores é o snapshot de scores/{uid} (mapa uid→rec).
func BuildRanking(students []*models.UserProfile, scores map[string]*models.ScoreRecord) []*models.RankingEntry {
	entries := make([]*models.RankingEntry, 0, len(students))
	for _, st := range students {
		sc := scores[st.ID]
		score := 0.0
		if sc != nil {
			score = sc.Score
		}
		entries = append(entries, &models.RankingEntry{
			StudentID: st.ID,
			Name:      st.Name,
			PhotoURL:  st.PhotoURL,
			Score:     score,
		})
	}
	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].Score != entries[j].Score {
			return entries[i].Score > entries[j].Score
		}
		return entries[i].Name < entries[j].Name
	})
	for i, e := range entries {
		e.Rank = i + 1
	}
	return entries
}

// TopSlice devolve os primeiros n itens de u.
func TopSlice(u []*models.RankingEntry, n int) []*models.RankingEntry {
	if n > len(u) {
		n = len(u)
	}
	return u[:n]
}
