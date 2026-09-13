package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// canModerate devolve true se o usuário é nutricionista ou admin.
func canModerate(ctx context.Context) bool {
	r := roleFrom(ctx)
	return r == RoleNutritionist || r == RoleAdmin
}

// defaultPostText monta o texto padrão dos posts automáticos.
func defaultPostText(postType PostType) string {
	if postType == PostDiet {
		return "Seguiu a dieta hoje 🥗"
	}
	return "Concluiu o treino de hoje 💪"
}

// publishWorkoutPost cria (uma vez por dia) o post automático de treino
// concluído. Reaproveita o WorkoutHistoryEntry e a legenda opcional do aluno.
func (s *Server) publishWorkoutPost(ctx context.Context, h *WorkoutHistoryEntry, caption string) error {
	existing, err := s.findAutoPostToday(ctx, h.StudentID, PostWorkout)
	if err != nil {
		return err
	}
	if existing != nil {
		return nil // já publicou hoje — um post por dia
	}
	prof, err := s.getUserProfile(ctx, h.StudentID)
	if err != nil {
		return err
	}
	name, photo := h.StudentID, ""
	if prof != nil {
		if prof.Name != "" {
			name = prof.Name
		}
		photo = prof.PhotoURL
	}
	text := caption
	if strings.TrimSpace(text) == "" {
		text = defaultPostText(PostWorkout)
	}
	_, err = s.createPost(ctx, &Post{
		UserID:       h.StudentID,
		UserName:     name,
		UserPhotoURL: photo,
		Type:         PostWorkout,
		Text:         text,
		WorkoutID:    h.WorkoutID,
		WorkoutName:  h.WorkoutName,
		Date:         h.CompletedAt.Format("2006-01-02"),
		Likes:        map[string]bool{},
		Comments:     []*PostComment{},
		CreatedAt:    time.Now(),
	})
	return err
}

// publishDietPost cria o post automático de dieta seguida. Devolve o ID do
// post criado (ou "" se já existir um post de dieta hoje).
func (s *Server) publishDietPost(ctx context.Context, log *DietDailyLog) (string, error) {
	if log.PostID != "" {
		return log.PostID, nil
	}
	existing, err := s.findAutoPostToday(ctx, log.StudentID, PostDiet)
	if err != nil {
		return "", err
	}
	if existing != nil {
		return existing.ID, nil
	}
	prof, err := s.getUserProfile(ctx, log.StudentID)
	if err != nil {
		return "", err
	}
	name, photo := log.StudentID, ""
	if prof != nil {
		if prof.Name != "" {
			name = prof.Name
		}
		photo = prof.PhotoURL
	}
	text := log.Caption
	if strings.TrimSpace(text) == "" {
		text = defaultPostText(PostDiet)
	}
	created, err := s.createPost(ctx, &Post{
		UserID:       log.StudentID,
		UserName:     name,
		UserPhotoURL: photo,
		Type:         PostDiet,
		Text:         text,
		DietID:       log.DietID,
		DietName:     log.DietName,
		Date:         log.Date,
		Likes:        map[string]bool{},
		Comments:     []*PostComment{},
		CreatedAt:    time.Now(),
	})
	if err != nil {
		return "", err
	}
	return created.ID, nil
}

// ── Endpoints ──

// handleCreatePost cria um post manual ou referenciando treino/dieta.
func (s *Server) handleCreatePost(w http.ResponseWriter, r *http.Request) {
	var req CreatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	uid := uidFrom(r.Context())
	if strings.TrimSpace(req.Text) == "" && req.WorkoutID == "" && req.DietID == "" {
		http.Error(w, "post precisa de texto ou referência a treino/dieta", http.StatusBadRequest)
		return
	}
	if req.Date == "" {
		req.Date = time.Now().Format("2006-01-02")
	}

	post := &Post{
		UserID:   uid,
		Type:     PostText,
		Text:     req.Text,
		Date:     req.Date,
		Likes:    map[string]bool{},
		Comments: []*PostComment{},
	}

	// Referência a treino concluído.
	if req.WorkoutID != "" {
		wk, err := s.getWorkout(r.Context(), req.WorkoutID)
		if err != nil {
			http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
			return
		}
		if wk == nil {
			http.Error(w, "treino nao encontrado", http.StatusNotFound)
			return
		}
		if !s.canAccessResource(r, wk.StudentID, wk.NutritionistID) {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
		post.UserID = wk.StudentID
		post.Type = PostWorkout
		post.WorkoutID = wk.ID
		post.WorkoutName = wk.Name
	}
	// Referência a dieta.
	if req.DietID != "" {
		d, err := s.getDiet(r.Context(), req.DietID)
		if err != nil {
			http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
			return
		}
		if d == nil {
			http.Error(w, "dieta nao encontrada", http.StatusNotFound)
			return
		}
		if !s.canAccessResource(r, d.StudentID, d.NutritionistID) {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
		post.UserID = d.StudentID
		post.Type = PostDiet
		post.DietID = d.ID
		post.DietName = d.Name
	}

	// Preenche nome/foto do autor do post.
	prof, err := s.getUserProfile(r.Context(), post.UserID)
	if err == nil && prof != nil {
		post.UserName = prof.Name
		post.UserPhotoURL = prof.PhotoURL
	}
	if post.UserName == "" {
		post.UserName = post.UserID
	}
	post.CreatedAt = time.Now()

	created, err := s.createPost(r.Context(), post)
	if err != nil {
		http.Error(w, "falha ao criar post", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

// handleListPosts devolve o feed global paginado (mais recentes primeiro).
// Query: limit (padrão 20, máx 50) e cursor (da página anterior).
func (s *Server) handleListPosts(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	cursor := r.URL.Query().Get("cursor")

	posts, next, err := s.listPosts(r.Context(), limit, cursor)
	if err != nil {
		http.Error(w, "falha ao listar posts", http.StatusInternalServerError)
		return
	}
	// Filtra posts removidos por moderação.
	visible := make([]*Post, 0, len(posts))
	for _, p := range posts {
		if p.Deleted {
			continue
		}
		visible = append(visible, p)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"posts": visible,
		"next":  next,
	})
}

// handleToggleLike curte/descurte um post do feed.
func (s *Server) handleToggleLike(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	uid := uidFrom(r.Context())

	post, err := s.getPost(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler post", http.StatusInternalServerError)
		return
	}
	if post == nil || post.Deleted {
		http.Error(w, "post nao encontrado", http.StatusNotFound)
		return
	}

	liked := false
	if post.Likes[uid] {
		delete(post.Likes, uid)
	} else {
		post.Likes[uid] = true
		liked = true
	}
	post.LikeCount = len(post.Likes)
	if err := s.updatePost(r.Context(), id, post); err != nil {
		http.Error(w, "falha ao curtir", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"liked": liked, "likeCount": post.LikeCount})
}

// handleAddComment adiciona um comentário a um post.
func (s *Server) handleAddComment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	uid := uidFrom(r.Context())

	var req CommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		http.Error(w, "comentario vazio", http.StatusBadRequest)
		return
	}

	post, err := s.getPost(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler post", http.StatusInternalServerError)
		return
	}
	if post == nil || post.Deleted {
		http.Error(w, "post nao encontrado", http.StatusNotFound)
		return
	}

	prof, err := s.getUserProfile(r.Context(), uid)
	name, photo := uid, ""
	if err == nil && prof != nil {
		if prof.Name != "" {
			name = prof.Name
		}
		photo = prof.PhotoURL
	}
	comment := &PostComment{
		ID:           fmt.Sprintf("c%d", time.Now().UnixNano()),
		UserID:       uid,
		UserName:     name,
		UserPhotoURL: photo,
		Text:         req.Text,
		CreatedAt:    time.Now(),
	}
	post.Comments = append(post.Comments, comment)
	if err := s.updatePost(r.Context(), id, post); err != nil {
		http.Error(w, "falha ao comentar", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, comment)
}

// handleDeleteComment apaga um comentário: o autor remove de vez; moderador
// (nutricionista/admin) remove qualquer um com soft delete auditado.
func (s *Server) handleDeleteComment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	cid := r.PathValue("cid")
	uid := uidFrom(r.Context())

	post, err := s.getPost(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler post", http.StatusInternalServerError)
		return
	}
	if post == nil || post.Deleted {
		http.Error(w, "post nao encontrado", http.StatusNotFound)
		return
	}

	found := false
	kept := make([]*PostComment, 0, len(post.Comments))
	for _, c := range post.Comments {
		if c.ID == cid {
			if c.Deleted {
				http.Error(w, "comentario nao encontrado", http.StatusNotFound)
				return
			}
			found = true
			if uid == c.UserID {
				continue // autor: remoção real
			}
			if !canModerate(r.Context()) {
				http.Error(w, "sem permissao", http.StatusForbidden)
				return
			}
			// Moderador: soft delete com auditoria.
			c.Deleted = true
			c.ModeratedBy = uid
			c.ModeratedAt = time.Now()
			kept = append(kept, c)
			continue
		}
		kept = append(kept, c)
	}
	if !found {
		http.Error(w, "comentario nao encontrado", http.StatusNotFound)
		return
	}
	post.Comments = kept
	if err := s.updatePost(r.Context(), id, post); err != nil {
		http.Error(w, "falha ao apagar comentario", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleDeletePost apaga um post: o autor remove de vez; o moderador faz soft
// delete com registro de quem moderou e quando.
func (s *Server) handleDeletePost(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	uid := uidFrom(r.Context())

	post, err := s.getPost(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler post", http.StatusInternalServerError)
		return
	}
	if post == nil || post.Deleted {
		http.Error(w, "post nao encontrado", http.StatusNotFound)
		return
	}

	if uid == post.UserID {
		if err := s.deletePost(r.Context(), id); err != nil {
			http.Error(w, "falha ao apagar post", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if !canModerate(r.Context()) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	post.Deleted = true
	post.ModeratedBy = uid
	post.ModeratedAt = time.Now()
	if err := s.updatePost(r.Context(), id, post); err != nil {
		http.Error(w, "falha ao moderar post", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}