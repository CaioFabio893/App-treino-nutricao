package handlers

import (
	"bytes"
	"context"
	"image/png"
	"io"
	"net/http"
	"regexp"
	"strconv"

	"cloud.google.com/go/storage"
	"treino-louise/backend/models"
)

var documentIDPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)

func validDietDocument(d *models.DietDocument) bool {
	return d == nil || (documentIDPattern.MatchString(d.ID) && d.PageCount >= 1 && d.PageCount <= 100)
}

// DietPageStore reads private PNG pages; implementations must never return signed URLs.
type DietPageStore interface {
	ReadPage(context.Context, string, int) ([]byte, error)
}

func (h *Handlers) SetDietPageStore(store DietPageStore) { h.pages = store }

type CloudDietPageStore struct {
	Client *storage.Client
	Bucket string
}

func (s *CloudDietPageStore) ReadPage(ctx context.Context, id string, page int) ([]byte, error) {
	r, err := s.Client.Bucket(s.Bucket).Object("diet-documents/" + id + "/" + strconv.Itoa(page) + ".png").NewReader(ctx)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	// Bound memory and refuse truncated/oversized objects before sending any bytes.
	const maxPageBytes = 16 << 20
	b, err := io.ReadAll(io.LimitReader(r, maxPageBytes+1))
	if err != nil {
		return nil, err
	}
	if len(b) > maxPageBytes {
		return nil, io.ErrShortBuffer
	}
	return b, nil
}

func (h *Handlers) HandleDietPage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store, max-age=0")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Add("Vary", "Authorization")
	d, err := h.repo.GetDiet(r.Context(), r.PathValue("id"))
	if err != nil {
		http.Error(w, "falha ao ler dieta", http.StatusInternalServerError)
		return
	}
	if d == nil || !canReadDiet(r, d) || d.Document == nil || !validDietDocument(d.Document) {
		http.Error(w, "pagina nao encontrada", http.StatusNotFound)
		return
	}
	page, err := strconv.Atoi(r.PathValue("page"))
	if err != nil || strconv.Itoa(page) != r.PathValue("page") || page < 1 || page > d.Document.PageCount {
		http.Error(w, "pagina nao encontrada", http.StatusNotFound)
		return
	}
	if h.pages == nil {
		http.Error(w, "documento temporariamente indisponivel", http.StatusServiceUnavailable)
		return
	}
	b, err := h.pages.ReadPage(r.Context(), d.Document.ID, page)
	if err != nil || len(b) < 8 || string(b[:8]) != "\x89PNG\r\n\x1a\n" {
		http.Error(w, "documento temporariamente indisponivel", http.StatusServiceUnavailable)
		return
	}
	b, err = validatePage(b)
	if err != nil {
		http.Error(w, "documento temporariamente indisponivel", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Disposition", "inline")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(b)
}

// validatePage keeps the original rendered pixels, without a watermark.
func validatePage(b []byte) ([]byte, error) {
	if len(b) > 16<<20 {
		return nil, io.ErrShortBuffer
	}
	cfg, err := png.DecodeConfig(bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	if cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 2500 || cfg.Height > 2500 || int64(cfg.Width)*int64(cfg.Height) > 4_000_000 {
		return nil, io.ErrShortBuffer
	}
	if _, err := png.Decode(bytes.NewReader(b)); err != nil {
		return nil, err
	}
	return b, nil
}
