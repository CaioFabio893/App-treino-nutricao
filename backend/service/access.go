package service

import (
	"context"

	"treino-louise/backend/models"
)

// CanAccessStudent verifica se o usuário logado pode acessar o recurso do
// aluno. Admin vê tudo; nutricionista só os próprios alunos; aluno só a si
// mesmo.
func (s *Service) CanAccessStudent(ctx context.Context, uid string, role models.Role, studentID string) (bool, error) {
	if role == models.RoleAdmin {
		return true, nil
	}
	if role == models.RoleStudent {
		return uid == studentID, nil
	}
	// Nutricionista: ver se studentID é aluno dele.
	if role == models.RoleNutritionist {
		prof, err := s.repo.GetUserProfile(ctx, studentID)
		if err != nil {
			return false, err
		}
		return prof != nil && prof.NutritionistID == uid, nil
	}
	return false, nil
}

// CanAccessResource verifica se o usuário logado (uid/role) pode acessar um
// recurso vinculado a studentID/nutritionistID. Função pura (sem I/O).
func CanAccessResource(uid string, role models.Role, studentID, nutritionistID string) bool {
	if role == models.RoleAdmin {
		return true
	}
	if role == models.RoleStudent {
		return uid == studentID
	}
	if role == models.RoleNutritionist {
		return uid == nutritionistID
	}
	return false
}
