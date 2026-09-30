package main

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"treino-louise/backend/models"
)

type acceptanceRepo struct {
	*chainFakeRepo
	profiles map[string]*models.UserProfile
	workouts map[string]*models.WorkoutDefine
	diets    map[string]*models.Diet
	programs map[string]*models.TrainingProgram
}

func (r *acceptanceRepo) GetUserProfile(_ context.Context, id string) (*models.UserProfile, error) {
	return r.profiles[id], nil
}
func (r *acceptanceRepo) GetWorkout(_ context.Context, id string) (*models.WorkoutDefine, error) {
	return r.workouts[id], nil
}
func (r *acceptanceRepo) GetDiet(_ context.Context, id string) (*models.Diet, error) {
	return r.diets[id], nil
}
func (r *acceptanceRepo) GetProgram(_ context.Context, id string) (*models.TrainingProgram, error) {
	return r.programs[id], nil
}
func acceptanceFixture(status string, role models.Role) *acceptanceRepo {
	return &acceptanceRepo{
		chainFakeRepo: baseRepo(nil),
		profiles:      map[string]*models.UserProfile{"a": {ID: "a", Role: role, Status: status}, "b": {ID: "b", Role: models.RoleStudent, Status: models.StatusActive}},
		workouts:      map[string]*models.WorkoutDefine{"wa": {ID: "wa", StudentID: "a", Name: "A"}, "wb": {ID: "wb", StudentID: "b", Name: "B"}},
		diets:         map[string]*models.Diet{"da": {ID: "da", StudentID: "a", Name: "A"}, "db": {ID: "db", StudentID: "b", Name: "B"}},
		programs:      map[string]*models.TrainingProgram{"pa": {ID: "pa", StudentID: "a", Name: "A"}, "pb": {ID: "pb", StudentID: "b", Name: "B"}},
	}
}
func (r *acceptanceRepo) ListWorkoutsForStudent(_ context.Context, uid string) ([]*models.WorkoutDefine, error) {
	out := []*models.WorkoutDefine{}
	for _, w := range r.workouts {
		if w.StudentID == uid {
			out = append(out, w)
		}
	}
	return out, nil
}
func (r *acceptanceRepo) ListDietsForStudent(_ context.Context, uid string) ([]*models.Diet, error) {
	out := []*models.Diet{}
	for _, d := range r.diets {
		if d.StudentID == uid {
			out = append(out, d)
		}
	}
	return out, nil
}
func (r *acceptanceRepo) ListProgramsForStudent(_ context.Context, uid string) ([]*models.TrainingProgram, error) {
	out := []*models.TrainingProgram{}
	for _, p := range r.programs {
		if p.StudentID == uid {
			out = append(out, p)
		}
	}
	return out, nil
}

func TestAcceptanceOwnForeignAndMissingResources(t *testing.T) {
	for _, status := range []string{models.StatusActive, models.StatusPaused, ""} {
		t.Run(status, func(t *testing.T) {
			mux := newChainMuxWithVerifier(acceptanceFixture(status, models.RoleStudent), &fakeVerifier{uid: "a"})
			for _, resource := range []struct{ base, own, foreign string }{{"workouts", "wa", "wb"}, {"diets", "da", "db"}, {"programs", "pa", "pb"}, {"students", "a", "b"}} {
				for _, c := range []struct {
					id   string
					want int
				}{{resource.own, 200}, {resource.foreign, 404}, {"missing", 404}} {
					res := doChainRequest(mux, "GET", "/api/"+resource.base+"/"+c.id, "", "valid-token")
					if res.Code != c.want {
						t.Errorf("%s/%s status %q = %d, want %d", resource.base, c.id, status, res.Code, c.want)
					}
				}
			}
			for _, path := range []string{"workouts", "diets", "programs"} {
				res := doChainRequest(mux, "GET", "/api/"+path, "", "valid-token")
				if res.Code != 200 {
					t.Fatalf("list %s: %d", path, res.Code)
				}
				var rows []struct {
					StudentID string `json:"studentId"`
				}
				if err := json.Unmarshal(res.Body.Bytes(), &rows); err != nil {
					t.Fatal(err)
				}
				if len(rows) != 1 || rows[0].StudentID != "a" {
					t.Errorf("%s leaks or omits owned data: %s", path, res.Body.String())
				}
			}
		})
	}
}
func TestAcceptanceBlockedStatusesCannotReadBusiness(t *testing.T) {
	for _, status := range []string{models.StatusPendingApproval, models.StatusRejected, models.StatusInactive, "unknown"} {
		t.Run(status, func(t *testing.T) {
			mux := newChainMuxWithVerifier(acceptanceFixture(status, models.RoleStudent), &fakeVerifier{uid: "a"})
			for _, path := range []string{"/api/workouts", "/api/workouts/wa", "/api/diets", "/api/diets/da", "/api/programs", "/api/programs/pa", "/api/students/a"} {
				res := doChainRequest(mux, "GET", path, "", "valid-token")
				if res.Code != 403 {
					t.Errorf("%s = %d want 403", path, res.Code)
				}
			}
			if res := doChainRequest(mux, "GET", "/api/me", "", "valid-token"); res.Code != 200 {
				t.Errorf("profile must remain accessible: %d", res.Code)
			}
		})
	}
}
func TestAcceptanceStudentCannotMutateBusiness(t *testing.T) {
	for _, status := range []string{models.StatusActive, models.StatusPaused} {
		t.Run(status, func(t *testing.T) {
			mux := newChainMuxWithVerifier(acceptanceFixture(status, models.RoleStudent), &fakeVerifier{uid: "a"})
			for _, r := range []struct{ method, path string }{
				{"POST", "/api/workouts"}, {"PUT", "/api/workouts/wa"}, {"DELETE", "/api/workouts/wa"}, {"POST", "/api/workouts/wa/duplicate"},
				{"POST", "/api/diets"}, {"PUT", "/api/diets/da"}, {"DELETE", "/api/diets/da"}, {"POST", "/api/diets/da/duplicate"},
				{"POST", "/api/programs"}, {"PUT", "/api/programs/pa"}, {"DELETE", "/api/programs/pa"}, {"POST", "/api/programs/import"}, {"POST", "/api/programs/pa/assign"}, {"POST", "/api/programs/pa/duplicate"},
				{"POST", "/api/exercises"}, {"PUT", "/api/exercises/e"}, {"DELETE", "/api/exercises/e"}, {"PUT", "/api/students/a"},
				{"POST", "/api/users"}, {"PUT", "/api/users/a"}, {"DELETE", "/api/users/a"}, {"POST", "/api/users/a/approve"}, {"POST", "/api/users/a/reject"},
			} {
				res := doChainRequest(mux, r.method, r.path, "{}", "valid-token")
				if res.Code != 403 {
					t.Errorf("%s %s=%d want403", r.method, r.path, res.Code)
				}
			}
			res := doChainRequest(mux, "PUT", "/api/me", `{"name":"Novo nome"}`, "valid-token")
			if res.Code != 200 {
				t.Errorf("self profile update must remain: %d", res.Code)
			}
		})
	}
}
func TestAcceptanceUnknownRoleCannotReadBusiness(t *testing.T) {
	mux := newChainMuxWithVerifier(acceptanceFixture(models.StatusActive, "nutritionist"), &fakeVerifier{uid: "a"})
	for _, path := range []string{"/api/workouts", "/api/diets", "/api/programs", "/api/exercises", "/api/students/a"} {
		if res := doChainRequest(mux, "GET", path, "", "valid-token"); res.Code != http.StatusForbidden {
			t.Errorf("%s=%d want403", path, res.Code)
		}
	}
}
func TestAcceptanceAnonymousCannotReadBusiness(t *testing.T) {
	mux := newChainMuxWithVerifier(acceptanceFixture(models.StatusActive, models.RoleStudent), &fakeVerifier{uid: "a"})
	for _, path := range []string{"/api/workouts/wa", "/api/diets/da", "/api/programs/pa", "/api/students/a"} {
		if res := doChainRequest(mux, "GET", path, "", ""); res.Code != 401 {
			t.Errorf("%s=%d want401", path, res.Code)
		}
	}
}
