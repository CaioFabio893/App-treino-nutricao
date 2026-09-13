package main

import "time"

// Set representa os dados de uma série de um exercício.
// W e R são ponteiros: ausentes = campo não preenchido.
type Set struct {
	W *float64 `json:"w,omitempty"`
	R *float64 `json:"r,omitempty"`
	C string   `json:"c,omitempty"` // "", "ok" ou "fail"
}

// Exercise representa os dados salvos de um exercício em um treino.
type Exercise struct {
	Sets []Set  `json:"sets,omitempty"`
	Note string `json:"note,omitempty"`
}

// Session é o registro completo de um dia de treino em uma semana.
type Session struct {
	Week      int        `json:"week"`
	Day       string     `json:"day"`
	Exercise  []Exercise `json:"exercise,omitempty"`
	UpdatedAt time.Time  `json:"updatedAt,omitempty"`
}

// PR guarda os recordes pessoais dos 3 exercícios principais.
type PR struct {
	A float64 `json:"a"`
	B float64 `json:"b"`
	C float64 `json:"c"`
}

// AppState guarda a semana e o dia em que o usuário parou.
type AppState struct {
	Week int `json:"week"`
	Day  int `json:"day"`
}