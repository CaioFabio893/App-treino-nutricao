package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWriteJSON(t *testing.T) {
	// Serialização válida: 200 + corpo JSON.
	rr := httptest.NewRecorder()
	writeJSON(rr, http.StatusOK, map[string]string{"status": "ok"})
	if rr.Code != http.StatusOK {
		t.Errorf("code = %d, want 200", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), `"status":"ok"`) {
		t.Errorf("body = %q, want JSON ok", rr.Body.String())
	}

	// Serialização inválida (channel não serializa): 500 sem status duplicado.
	rr = httptest.NewRecorder()
	writeJSON(rr, http.StatusOK, make(chan int))
	if rr.Code != http.StatusInternalServerError {
		t.Errorf("code = %d, want 500", rr.Code)
	}
}

func TestTooLong(t *testing.T) {
	cases := []struct {
		name string
		s    string
		max  int
		want bool
	}{
		{"vazio aceito", "", 5, false},
		{"exatamente no limite", "abcde", 5, false},
		{"acima do limite", "abcdef", 5, true},
		{"unicode conta runas (não bytes)", "café", 4, false},
		{"emoji conta 1 runa", "👋👋👋", 3, false},
		{"emoji acima do limite", "👋👋👋👋", 3, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := tooLong(c.s, c.max); got != c.want {
				t.Errorf("tooLong(%q, %d) = %v, want %v", c.s, c.max, got, c.want)
			}
		})
	}
}
