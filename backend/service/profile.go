package service

import (
	"context"

	"treino-louise/backend/models"
)

// GetOrCreateProfile atualiza o perfil existente (preservando role e vínculo)
// ou cria um novo quando o usuário ainda não tem perfil.
func (s *Service) GetOrCreateProfile(ctx context.Context, uid string, p *models.UserProfile) error {
	existing, err := s.repo.GetUserProfile(ctx, uid)
	if err != nil {
		return err
	}
	if existing != nil {
		// Mantém role atual — mais seguro.
		p.Role = existing.Role
		if p.NutritionistID == "" && existing.NutritionistID != "" {
			p.NutritionistID = existing.NutritionistID
		}
		p.CreatedAt = existing.CreatedAt
		return s.repo.PutUserProfile(ctx, uid, p)
	}
	// Cria novo perfil. Sem role = student por padrão.
	if p.Role == "" {
		p.Role = models.RoleStudent
	}
	return s.repo.CreateUser(ctx, uid, p)
}
