package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"treino-louise/backend/middleware"
	"treino-louise/backend/models"
	"treino-louise/backend/repository"
	"treino-louise/backend/service"
)

// errForbidden distingue "sem permissão" dentro de um mutate de UpdatePostTx
// (que devolve o erro para abortar a transação).
var errForbidden = errors.New("sem permissao")

// canModerate devolve true se o usuário é nutricionista ou admin.
func canModerate(r *http.Request) bool {
	rl := middleware.RoleFrom(r.Context())
	return rl == models.RoleNutritionist || rl == models.RoleAdmin
}

// HandleCreatePost cria um post manual ou referenciando treino/dieta.
func (h *Handlers) HandleCreatePost(w http.ResponseWriter, r *http.Request) {
	var req models.CreatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	uid := middleware.UIDFrom(r.Context())
	if strings.TrimSpace(req.Text) == "" && req.WorkoutID == "" && req.DietID == "" {
		http.Error(w, "post precisa de texto ou referência a treino/dieta", http.StatusBadRequest)
		return
	}
	if req.Date == "" {
		req.Date = service.Now().Format("2006-01-02")
	}

	post := &models.Post{
		UserID:   uid,
		Type:     models.PostText,
		Text:     req.Text,
		Date:     req.Date,
		Likes:    map[string]bool{},
		Comments: []*models.PostComment{},
	}

	// Referência a treino concluído.
	if req.WorkoutID != "" {
		wk, err := h.repo.GetWorkout(r.Context(), req.WorkoutID)
		if err != nil {
			http.Error(w, "falha ao ler treino", http.StatusInternalServerError)
			return
		}
		if wk == nil {
			http.Error(w, "treino nao encontrado", http.StatusNotFound)
			return
		}
		if !canAccessResource(r, wk.StudentID, wk.NutritionistID) {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
		post.UserID = wk.StudentID
		post.Type = models.PostWorkout
		post.WorkoutID = wk.ID
		post.WorkoutName = wk.Name
	}
	// Referência a dieta.
	if req.DietID != "" {
		d, err := h.repo.GetDiet(r.Context(), req.DietID)
		if err != nil {
			http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
			return
		}
		if d == nil {
			http.Error(w, "dieta nao encontrada", http.StatusNotFound)
			return
		}
		if !canAccessResource(r, d.StudentID, d.NutritionistID) {
			http.Error(w, "sem permissao", http.StatusForbidden)
			return
		}
		post.UserID = d.StudentID
		post.Type = models.PostDiet
		post.DietID = d.ID
		post.DietName = d.Name
	}

	// Preenche nome/foto do autor do post.
	prof, err := h.repo.GetUserProfile(r.Context(), post.UserID)
	if err == nil && prof != nil {
		post.UserName = prof.Name
		post.UserPhotoURL = prof.PhotoURL
	}
	if post.UserName == "" {
		post.UserName = post.UserID
	}
	post.CreatedAt = service.Now()

	created, err := h.repo.CreatePost(r.Context(), post)
	if err != nil {
		http.Error(w, "falha ao criar post", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, created)
}

// HandleListPosts devolve o feed global paginado (mais recentes primeiro).
// Query: limit (padrão 20, máx 50) e cursor (da página anterior).
func (h *Handlers) HandleListPosts(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	cursor := r.URL.Query().Get("cursor")

	posts, next, err := h.repo.ListPosts(r.Context(), limit, cursor)
	if err != nil {
		http.Error(w, "falha ao listar posts", http.StatusInternalServerError)
		return
	}
	// Filtra posts removidos por moderação.
	visible := make([]*models.Post, 0, len(posts))
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

// HandleToggleLike curte/descurte um post do feed. A leitura-modificação-escrita
// acontece DENTRO de uma transação (UpdatePostTx): duas curtidas concorrentes
// não se sobrescrevem mais (item 3.5).
func (h *Handlers) HandleToggleLike(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	uid := middleware.UIDFrom(r.Context())

	liked := false
	likeCount := 0
	err := h.repo.UpdatePostTx(r.Context(), id, func(post *models.Post) error {
		if post == nil || post.Deleted {
			return repository.ErrPostNotFound
		}
		if post.Likes[uid] {
			delete(post.Likes, uid)
		} else {
			post.Likes[uid] = true
			liked = true
		}
		post.LikeCount = len(post.Likes)
		likeCount = post.LikeCount
		return nil
	})
	if errors.Is(err, repository.ErrPostNotFound) {
		http.Error(w, "post nao encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "falha ao curtir", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"liked": liked, "likeCount": likeCount})
}

// HandleAddComment adiciona um comentário a um post. O append acontece dentro
// de UpdatePostTx: comentários concorrentes não se perdem (item 3.5).
func (h *Handlers) HandleAddComment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	uid := middleware.UIDFrom(r.Context())

	var req models.CommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		http.Error(w, "comentario vazio", http.StatusBadRequest)
		return
	}

	prof, err := h.repo.GetUserProfile(r.Context(), uid)
	name, photo := uid, ""
	if err == nil && prof != nil {
		if prof.Name != "" {
			name = prof.Name
		}
		photo = prof.PhotoURL
	}
	comment := &models.PostComment{
		ID:           fmt.Sprintf("c%d", service.Now().UnixNano()),
		UserID:       uid,
		UserName:     name,
		UserPhotoURL: photo,
		Text:         req.Text,
		CreatedAt:    service.Now(),
	}

	err = h.repo.UpdatePostTx(r.Context(), id, func(post *models.Post) error {
		if post == nil || post.Deleted {
			return repository.ErrPostNotFound
		}
		post.Comments = append(post.Comments, comment)
		return nil
	})
	if errors.Is(err, repository.ErrPostNotFound) {
		http.Error(w, "post nao encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "falha ao comentar", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, comment)
}

// HandleDeleteComment apaga um comentário: o autor remove de vez; moderador
// (nutricionista/admin) remove qualquer um com soft delete auditado. Tudo
// dentro de UpdatePostTx para não perder comentários concorrentes.
func (h *Handlers) HandleDeleteComment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	cid := r.PathValue("cid")
	uid := middleware.UIDFrom(r.Context())

	err := h.repo.UpdatePostTx(r.Context(), id, func(post *models.Post) error {
		if post == nil || post.Deleted {
			return repository.ErrPostNotFound
		}
		found := false
		kept := make([]*models.PostComment, 0, len(post.Comments))
		for _, c := range post.Comments {
			if c.ID == cid {
				if c.Deleted {
					return repository.ErrCommentNotFound
				}
				found = true
				if uid == c.UserID {
					continue // autor: remoção real
				}
				if !canModerate(r) {
					return errForbidden
				}
				// Moderador: soft delete com auditoria.
				c.Deleted = true
				c.ModeratedBy = uid
				c.ModeratedAt = service.Now()
				kept = append(kept, c)
				continue
			}
			kept = append(kept, c)
		}
		if !found {
			return repository.ErrCommentNotFound
		}
		post.Comments = kept
		return nil
	})
	switch {
	case errors.Is(err, repository.ErrPostNotFound), errors.Is(err, repository.ErrCommentNotFound):
		http.Error(w, "comentario nao encontrado", http.StatusNotFound)
	case errors.Is(err, errForbidden):
		http.Error(w, "sem permissao", http.StatusForbidden)
	case err != nil:
		http.Error(w, "falha ao apagar comentario", http.StatusInternalServerError)
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

// HandleDeletePost apaga um post: o autor remove de vez; o moderador faz soft
// delete (dentro de UpdatePostTx) com registro de quem moderou e quando.
func (h *Handlers) HandleDeletePost(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	uid := middleware.UIDFrom(r.Context())

	post, err := h.repo.GetPost(r.Context(), id)
	if err != nil {
		http.Error(w, "falha ao ler post", http.StatusInternalServerError)
		return
	}
	if post == nil || post.Deleted {
		http.Error(w, "post nao encontrado", http.StatusNotFound)
		return
	}
	if uid == post.UserID {
		if err := h.repo.DeletePost(r.Context(), id); err != nil {
			http.Error(w, "falha ao apagar post", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if !canModerate(r) {
		http.Error(w, "sem permissao", http.StatusForbidden)
		return
	}
	err = h.repo.UpdatePostTx(r.Context(), id, func(p *models.Post) error {
		p.Deleted = true
		p.ModeratedBy = uid
		p.ModeratedAt = service.Now()
		return nil
	})
	if errors.Is(err, repository.ErrPostNotFound) {
		http.Error(w, "post nao encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "falha ao moderar post", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
