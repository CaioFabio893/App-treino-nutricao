package main

import (
	"encoding/json"
	"net/http"
	"strconv"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, "erro ao serializar resposta", http.StatusInternalServerError)
	}
}

// withCORS libera o frontend (hospedado em outro domínio) de chamar a API.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ── Sessions ──

func parseWeekDay(r *http.Request) (int, string, bool) {
	week, err := strconv.Atoi(r.PathValue("week"))
	if err != nil || week < 1 || week > 12 {
		return 0, "", false
	}
	day := r.PathValue("day")
	if day == "" {
		return 0, "", false
	}
	return week, day, true
}

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	week, day, ok := parseWeekDay(r)
	if !ok {
		http.Error(w, "week/day invalido", http.StatusBadRequest)
		return
	}

	sess, err := s.getSession(r.Context(), uidFrom(r.Context()), week, day)
	if err != nil {
		http.Error(w, "falha ao ler sessao", http.StatusInternalServerError)
		return
	}
	if sess == nil {
		writeJSON(w, http.StatusOK, map[string]any{"week": week, "day": day, "exercise": nil})
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (s *Server) handlePutSession(w http.ResponseWriter, r *http.Request) {
	week, day, ok := parseWeekDay(r)
	if !ok {
		http.Error(w, "week/day invalido", http.StatusBadRequest)
		return
	}

	var sess Session
	if err := json.NewDecoder(r.Body).Decode(&sess); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	sess.Week = week
	if sess.Day == "" {
		sess.Day = day
	}

	if err := s.putSession(r.Context(), uidFrom(r.Context()), &sess); err != nil {
		http.Error(w, "falha ao salvar sessao", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── PRs ──

func (s *Server) handleGetPRs(w http.ResponseWriter, r *http.Request) {
	p, err := s.getPRs(r.Context(), uidFrom(r.Context()))
	if err != nil {
		http.Error(w, "falha ao ler PRs", http.StatusInternalServerError)
		return
	}
	if p == nil {
		writeJSON(w, http.StatusOK, map[string]any{"a": 0, "b": 0, "c": 0})
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handlePutPRs(w http.ResponseWriter, r *http.Request) {
	var p PR
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if err := s.putPRs(r.Context(), uidFrom(r.Context()), &p); err != nil {
		http.Error(w, "falha ao salvar PRs", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── State ──

func (s *Server) handleGetState(w http.ResponseWriter, r *http.Request) {
	st, err := s.getState(r.Context(), uidFrom(r.Context()))
	if err != nil {
		http.Error(w, "falha ao ler estado", http.StatusInternalServerError)
		return
	}
	if st == nil {
		writeJSON(w, http.StatusOK, map[string]any{"week": 1, "day": 0})
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) handlePutState(w http.ResponseWriter, r *http.Request) {
	var st AppState
	if err := json.NewDecoder(r.Body).Decode(&st); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	if err := s.putState(r.Context(), uidFrom(r.Context()), &st); err != nil {
		http.Error(w, "falha ao salvar estado", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}