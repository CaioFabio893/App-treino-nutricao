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

	// ── Programa de treinamento (F19) ──

	// ErrProgramNotFound indica que o programa informado não existe.
	ErrProgramNotFound = errors.New("programa nao encontrado")
	// ErrProgramAlreadyAssigned indica tentativa de reatribuir um programa que
	// já tem aluno — o handler trata como 409. Trocar de aluno exigiria apagar
	// os treinos já materializados do aluno anterior, e apagar trabalho do
	// usuário sem confirmação destrói dado.
	ErrProgramAlreadyAssigned = errors.New("programa ja atribuido a outro aluno")
	// ErrProgramNotFoundWorkout indica que um treino referenciado pelo programa
	// não existe mais no banco.
	ErrProgramNotFoundWorkout = errors.New("treino do programa nao encontrado")
	// ErrProgramWorkoutForbidden indica que um treino referenciado pelo programa
	// pertence a OUTRA nutricionista. Sem esta checagem, a materialização de
	// cópias no assign transformaria o programa em exfiltração: a nutricionista A
	// montaria um programa apontando para o treino da B e o assign criaria uma
	// cópia do conteúdo alheio (exercícios, nomes, videoUrl) para o aluno dela.
	ErrProgramWorkoutForbidden = errors.New("treino do programa pertence a outra nutricionista")
)