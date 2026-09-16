package service

import "errors"

// Erros de domínio do fluxo de aprovação/planos. Os handlers mapeiam cada um
// para o status HTTP/mensagem adequada.
var (
	// ErrInvalidRole indica papel fora de {student, nutritionist} na aprovação.
	ErrInvalidRole = errors.New("papel invalido")
	// ErrUserNotFound indica que o perfil do usuário não existe.
	ErrUserNotFound = errors.New("usuario nao encontrado")
	// ErrPlanNotFound indica que o plano informado não existe.
	ErrPlanNotFound = errors.New("plano nao encontrado")
	// ErrPlanInactive indica que o plano está desativado (não atribuível).
	ErrPlanInactive = errors.New("plano inativo")
	// ErrInvalidPlanID indica planID vazio/inválido na atribuição.
	ErrInvalidPlanID = errors.New("planID obrigatorio")
	// ErrPlanInUse é usado quando um plano em uso não pode ser excluído —
	// o handler trata como 409 com a contagem de alunos.
	ErrPlanInUse = errors.New("plano em uso por alunos")
)