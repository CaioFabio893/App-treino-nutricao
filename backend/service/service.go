// Package service concentra as regras de negócio e casos de uso da API.
// Cada método opera sobre a interface repository.Repository — aqui não existe
// nenhum conhecimento de HTTP nem do Firestore.
package service

import "treino-louise/backend/repository"

// Service agrupa os casos de uso. É construído por injeção da dependência
// repository (a implementação concreta é decidida no main).
type Service struct {
	repo repository.Repository
}

// New cria um Service com o repositório dado.
func New(repo repository.Repository) *Service {
	return &Service{repo: repo}
}
