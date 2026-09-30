package service

import (
	"treino-louise/backend/models"
)

// CanAccessResource verifica se o usuário logado (uid/role) pode acessar um
// recurso vinculado a studentID. Admin vê tudo; aluno só o próprio recurso.
// Função pura (sem I/O).
func CanAccessResource(uid string, role models.Role, studentID string) bool {
	if role == models.RoleAdmin {
		return true
	}
	return role == models.RoleStudent && uid == studentID
}
