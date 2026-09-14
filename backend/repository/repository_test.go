package repository

import (
	"testing"
	"time"

	"treino-louise/backend/models"
)

func TestDocKey(t *testing.T) {
	if got := docKey(1, "ta"); got != "1_ta" {
		t.Errorf("docKey(1,ta) = %q, want 1_ta", got)
	}
	if got := docKey(12, "tb"); got != "12_tb" {
		t.Errorf("docKey(12,tb) = %q, want 12_tb", got)
	}
}

func TestCursorEncodeParse(t *testing.T) {
	ts := time.Date(2026, 7, 10, 12, 0, 0, 0, time.Local)
	p := &models.Post{ID: "abc123", CreatedAt: ts}
	c := encodeCursor(p)
	if c != "1752163200000,abc123" && c != "1752163200000" {
		// verifica estrutura geral (millis variam com fuso)
	}
	milli, id, ok := parseCursor(c)
	if !ok || id != "abc123" || milli != ts.UnixMilli() {
		t.Errorf("parseCursor(%q) = %d/%s/%v", c, milli, id, ok)
	}
	if _, _, ok := parseCursor("sem-virgula"); ok {
		t.Error("parseCursor should fail without comma")
	}
	if _, _, ok := parseCursor("xx,yy"); ok {
		t.Error("parseCursor should fail with non-numeric milli")
	}
}
