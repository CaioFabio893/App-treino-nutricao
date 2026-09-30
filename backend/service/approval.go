package service

import (
	"context"

	"treino-louise/backend/models"
)

// ApproveUser aprova um cadastro pendente: confirma o papel de aluno, ativa o
// perfil (status=active) e grava quem/quando aprovou.
//
// Aprovação só concede RoleStudent. O papel de admin não é concedido por esta
// via (evita escalada de privilégio a partir de um cadastro pendente); admin é
// definido na criação/edição do usuário pelo admin.
func (s *Service) ApproveUser(ctx context.Context, adminUID, targetID string, role models.Role) error {
	if role != models.RoleStudent {
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
	prof.ApprovedAt = Now()
	prof.RejectedReason = ""

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
