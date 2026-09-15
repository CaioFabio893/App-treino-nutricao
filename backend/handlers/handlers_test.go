package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestParseWeekDay(t *testing.T) {
	// week 0 inválida
	r := httptest.NewRequest("GET", "/api/sessions/0/ta", nil)
	r.SetPathValue("week", "0")
	r.SetPathValue("day", "ta")
	if _, _, ok := parseWeekDay(r); ok {
		t.Error("week 0 should be invalid")
	}

	// semana 13 inválida
	r = httptest.NewRequest("GET", "/api/sessions/13/ta", nil)
	r.SetPathValue("week", "13")
	r.SetPathValue("day", "ta")
	if _, _, ok := parseWeekDay(r); ok {
		t.Error("week 13 should be invalid")
	}

	// válida
	r = httptest.NewRequest("GET", "/api/sessions/5/tb", nil)
	r.SetPathValue("week", "5")
	r.SetPathValue("day", "tb")
	week, day, ok := parseWeekDay(r)
	if !ok || week != 5 || day != "tb" {
		t.Errorf("parseWeekDay = %d/%s/%v, want 5/tb/true", week, day, ok)
	}

	// dia vazio inválido
	r = httptest.NewRequest("GET", "/api/sessions/5/", nil)
	r.SetPathValue("week", "5")
	r.SetPathValue("day", "")
	if _, _, ok := parseWeekDay(r); ok {
		t.Error("empty day should be invalid")
	}
}

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
