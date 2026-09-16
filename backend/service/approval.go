package service

import (
	"context"
	"time"

	"treino-louise/backend/models"
)

// ApproveUser aprova um cadastro pendente: define papel (student|nutritionist),
// ativa o perfil (status=active), grava quem/quando aprovou e, para aluno com
// plano, snapshota as features do plano no perfil.
func (s *Service) ApproveUser(ctx context.Context, adminUID, targetID string, role models.Role, planID, nutritionistID string) error {
	if role != models.RoleStudent && role != models.RoleNutritionist {
		return ErrInvalidRole
	}

	prof, err := s.repo.GetUserProfile(ctx, targetID)
	if err != nil {
		return err
	}
	if prof == nil {
		return ErrUserNotFound
	}

	prof.Role = role
	prof.Status = models.StatusActive
	prof.ApprovedBy = adminUID
	prof.ApprovedAt = time.Now()
	prof.RejectedReason = ""

	if role == models.RoleStudent {
		if nutritionistID != "" {
			prof.NutritionistID = nutritionistID
		}
		if planID != "" {
			plan, err := s.repo.GetPlan(ctx, planID)
			if err != nil {
				return err
			}
			if plan == nil {
				return ErrPlanNotFound
			}
			if !plan.Active {
				return ErrPlanInactive
			}
			prof.PlanID = plan.ID
			prof.Features = plan.Features
		} else {
			// Aluno aprovado sem plano: sem entitlements além do free tier (workouts).
			prof.PlanID = ""
			prof.Features = nil
		}
	} else {
		// Nutricionista não tem plano nem vínculo com nutricionista.
		prof.PlanID = ""
		prof.Features = nil
		prof.NutritionistID = ""
	}

	return s.repo.PutUserProfile(ctx, targetID, prof)
}

// RejectUser recusa um cadastro: marca status=rejected com o motivo.
// A exclusão da conta do Firebase Auth (se decidida) é responsabilidade do
// handler — aqui só registra o estado no Firestore para auditoria.
func (s *Service) RejectUser(ctx context.Context, targetID, reason string) error {
	prof, err := s.repo.GetUserProfile(ctx, targetID)
	if err != nil {
		return err
	}
	if prof == nil {
		return ErrUserNotFound
	}
	prof.Status = models.StatusRejected
	prof.RejectedReason = reason
	return s.repo.PutUserProfile(ctx, targetID, prof)
}

// AssignPlan atribui/reatribui um plano a um aluno já existente, snapshotando
// as features do plano no perfil (o admin reatribui sempre que quiser).
func (s *Service) AssignPlan(ctx context.Context, targetID, planID string) error {
	if planID == "" {
		return ErrInvalidPlanID
	}
	plan, err := s.repo.GetPlan(ctx, planID)
	if err != nil {
		return err
	}
	if plan == nil {
		return ErrPlanNotFound
	}
	if !plan.Active {
		return ErrPlanInactive
	}

	prof, err := s.repo.GetUserProfile(ctx, targetID)
	if err != nil {
		return err
	}
	if prof == nil {
		return ErrUserNotFound
	}
	prof.PlanID = plan.ID
	prof.Features = plan.Features
	return s.repo.PutUserProfile(ctx, targetID, prof)
}