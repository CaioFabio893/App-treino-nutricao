package handlers

import (
	"net/http/httptest"
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
