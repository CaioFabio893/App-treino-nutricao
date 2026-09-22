package service

import (
	"context"

	"treino-louise/backend/models"
)

// GetOrCreateProfile atualiza o perfil existente (preservando role, status e
// vínculos administrativos) ou cria um novo quando o usuário ainda não tem
// perfil. Perfis novos entram como `pending_approval` com role vazio — quem
// decide papel/plano é o admin (fluxo de aprovação, spec SB-001).
func (s *Service) GetOrCreateProfile(ctx context.Context, uid string, p *models.UserProfile) error {
	existing, err := s.repo.GetUserProfile(ctx, uid)
	if err != nil {
		return err
	}
	if existing != nil {
		// Campos sensíveis vêm apenas do admin — preserva os do registro.
		p.Role = existing.Role
		p.Status = existing.Status
		p.PlanID = existing.PlanID
		p.Features = existing.Features
		p.NutritionistID = existing.NutritionistID
		p.ApprovedBy = existing.ApprovedBy
		p.ApprovedAt = existing.ApprovedAt
		p.RejectedReason = existing.RejectedReason
		p.CreatedAt = existing.CreatedAt
		// StartDate/EndDate também são definidos por fluxos administrativos
		// (update de aluno / aprovação), nunca pelo próprio via /me — se o
		// body os trouxer (ou vier zerado), o registro manda. Corrige a F13:
		// antes, PUT /api/me escrevia startDate direto, e como startDate
		// alimenta o denominador da pontuação (daysElapsedInCycle), o aluno
		// podia inflar a própria nota do ranking.
		p.StartDate = existing.StartDate
		p.EndDate = existing.EndDate
		return s.repo.PutUserProfile(ctx, uid, p)
	}
	// Cria novo perfil como pendente de aprovação — nunca vira aluno ativo
	// sozinho. Sem role = aluno por padrão.
	p.Role = ""
	p.Status = models.StatusPendingApproval
	return s.repo.CreateUser(ctx, uid, p)
}
