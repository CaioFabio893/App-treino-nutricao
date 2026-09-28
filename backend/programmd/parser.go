// Package programmd converte um programa de treino escrito em markdown na
// estrutura usada pelo projeto: programa -> treinos -> exercicios.
//
// Decisoes de modelagem (F19), documentadas aqui e em models.TrainingProgram:
//
//   - Um treino do programa NAO e uma entidade nova: e um models.WorkoutDefine
//     ja existente em workouts/{id}. Este pacote produz structs neutros e a
//     conversao para models fica em service.ConvertProgram.
//   - Blocos de Cardio ("Cardio Final", circuitos, AMRAP) nao sao exercicios de
//     musculacao: nao tem series, tem duracao/reps. Converter para Exercise
//     exigiria inventar series e descanso, entao o bloco e preservado VERBATIM
//     em Workout.Description. O dado nao se perde.
//   - Grupo muscular existe apenas no titulo do treino ("TREINO A - Pernas
//     (Quadriceps)"). Ele vai para Workout.Objective e NAO e distribuido por
//     exercicio, porque WorkoutExercise nao tem esse campo.
//   - Carga e descanso nao existem no material de origem: ficam vazios.
//   - DayOfWeek e derivado da tabela "Estrutura semanal" usando as mesmas
//     chaves de dia da semana ja usadas pelo projeto (lib/days.ts no frontend:
//     WEEK_DAY_KEY[new Date().getDay()], 0=domingo). Essa e uma CONVENCAO do
//     projeto, nao um dado do arquivo; a tabela completa tambem e preservada
//     verbatim em Program.Notes.
//
// O parser nunca inventa informacao. O que nao existe na fonte fica vazio e o
// que e ambiguo e registrado em Program.Warnings.
package programmd

import (
	"fmt"
	"strconv"
	"strings"
)

// weekDayKeys mapeia o numero de dia da tabela "Estrutura semanal" para as
// chaves ja usadas em lib/days.ts (frontend). Indice 0 e domingo, como em
// Date.getDay().
var weekDayKeys = []string{
	"", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
}

// Exercise e um exercicio de musculacao dentro de um treino.
type Exercise struct {
	Name        string
	Sets        int
	Repetitions string
	Notes       string
	Order       int
}

// Workout e um treino do programa (vira models.WorkoutDefine).
type Workout struct {
	Label       string // "A", "B", ...
	Name        string // "Treino A - Pernas (Quadriceps)"
	Objective   string // o foco declarado no titulo do treino
	Description string // blocos de Cardio e prosa, preservados verbatim
	DayOfWeek   string // "monday".."sunday", derivado da estrutura semanal
	Exercises   []Exercise
}

// Program e o programa de treino extraido do markdown.
type Program struct {
	Name        string
	Objective   string
	Description string
	Notes       string // secoes "##" que nao sao treino, verbatim (PRs, periodizacao, ...)
	Source      string // preenchido pelo chamador (ex.: nome do arquivo)
	Workouts    []Workout
	Warnings    []string
}

type sectionMode int

const (
	modePre sectionMode = iota // antes da primeira secao "##"
	modeWorkout                // corpo de um treino
	modeNotes                  // corpo de uma secao de programa (PRs, periodizacao, ...)
)

type weeklyRow struct {
	Day   int
	Label string
	Focus string
}

// Parse converte o markdown de um programa de treino.
//
// Retorna erro apenas quando nao ha nada a importar (entrada vazia ou nenhuma
// secao de treino). Entrada malformada nao aborta: o parser degrada para o
// melhor esforco possivel e registra a ambiguidade em Program.Warnings.
func Parse(markdown string) (*Program, error) {
	lines := splitLines(markdown)
	if len(lines) == 0 {
		return nil, fmt.Errorf("markdown vazio: nenhum programa de treino para importar")
	}

	p := &Program{}
	mode := modePre
	var (
		notes   []string
		pre     []string
		weekly  []weeklyRow
		current *Workout
		block   []string
	)

	// flush fecha a secao corrente: se for um treino, extrai exercicios e texto;
	// em qualquer caso, tenta ler a tabela de estrutura semanal (a secao
	// "Estrutura semanal" e uma secao de notas, nao de treino).
	flush := func() {
		if len(block) > 0 {
			if rows, ok := parseWeeklyTable(block); ok {
				weekly = append(weekly, rows...)
			}
		}
		if current == nil {
			block = nil
			return
		}
		parseWorkoutBlock(current, block, p)
		p.Workouts = append(p.Workouts, *current)
		current = nil
		block = nil
	}

	for _, raw := range lines {
		line := strings.TrimRight(raw, " \t")
		trimmed := strings.TrimSpace(line)

		switch {
		case strings.HasPrefix(trimmed, "# "):
			flush()
			mode = modePre
			if p.Name == "" {
				name, full := programNameFromTitle(strings.TrimSpace(trimmed[2:]))
				p.Name = name
				// O H1 completo so vira descricao quando o nome foi encurtado e
				// nao ha outra prosa antes da primeira secao.
				if name != full {
					pre = append(pre, full)
				}
			}

		case strings.HasPrefix(trimmed, "## "):
			flush()
			title := strings.TrimSpace(trimmed[3:])
			if label, focus, ok := parseWorkoutHeading(title); ok {
				w := Workout{Label: label, Objective: focus}
				w.Name = workoutCanonicalName(label, focus)
				current = &w
				mode = modeWorkout
				continue
			}
			// Secao de programa (Estrutura semanal, PRs, Periodizacao, ...).
			mode = modeNotes
			notes = append(notes, line)

		case mode == modeWorkout:
			block = append(block, line)

		case mode == modeNotes:
			notes = append(notes, line)
			block = append(block, line)

		default: // modePre: guarda a prosa de cabeçalho (linha de Foco etc.)
			if trimmed == "" || isHorizontalRule(trimmed) {
				continue
			}
			if foco, ok := extractFoco(trimmed); ok {
				if p.Objective == "" {
					p.Objective = foco
					continue
				}
			}
			pre = append(pre, line)
		}
	}
	flush()

	if len(p.Workouts) == 0 {
		return nil, fmt.Errorf("nenhum treino encontrado: o markdown precisa de ao menos uma secao \"## TREINO ...\"")
	}

	resolveDayOfWeek(p, weekly)
	p.Notes = cleanBlock(notes)
	p.Description = cleanBlock(pre)
	return p, nil
}

// ── workout ────────────────────────────────────────────────────────────────

// parseWorkoutBlock extrai os exercicios (tabelas) e o texto remanescente
// (blocos de Cardio) do corpo de uma secao de treino.
func parseWorkoutBlock(w *Workout, block []string, p *Program) {
	var desc []string
	order := 0
	sawTable := false

	for _, line := range block {
		trimmed := strings.TrimSpace(line)
		if isHorizontalRule(trimmed) {
			continue
		}
		if strings.HasPrefix(trimmed, "|") {
			sawTable = true
			if ex, ok := parseExerciseRow(trimmed, &order, p); ok {
				w.Exercises = append(w.Exercises, ex)
			}
			continue
		}
		desc = append(desc, line)
	}

	// Treino sem tabela: o corpo inteiro (menos linhas em branco) e texto.
	if !sawTable {
		for _, l := range desc {
			if strings.TrimSpace(l) != "" {
				p.Warnings = append(p.Warnings,
					fmt.Sprintf("treino %q: conteudo sem tabela de exercicios preservado em Description", w.Label))
				break
			}
		}
	}
	w.Description = cleanBlock(desc)
}

// parseExerciseRow converte uma linha de tabela em Exercise.
// A coluna "#" precisa ser numerica: e o que distingue dado de cabecalho.
func parseExerciseRow(line string, order *int, p *Program) (Exercise, bool) {
	cells, ok := splitCells(line)
	if !ok {
		p.Warnings = append(p.Warnings, fmt.Sprintf("linha de tabela ignorada (formato inesperado): %q", truncate(line, 80)))
		return Exercise{}, false
	}
	if len(cells) < 2 || isSeparatorRow(cells) {
		return Exercise{}, false
	}
	if _, err := strconv.Atoi(strings.TrimSpace(cells[0])); err != nil {
		// Cabecalho ou linha sem indice: nao e exercicio.
		return Exercise{}, false
	}

	*order = *order + 1
	ex := Exercise{Order: *order}
	ex.Name = strings.TrimSpace(cells[1])
	if ex.Name == "" {
		p.Warnings = append(p.Warnings, fmt.Sprintf("linha de tabela ignorada (exercicio sem nome): %q", truncate(line, 80)))
		return Exercise{}, false
	}
	if len(cells) > 2 {
		raw := strings.TrimSpace(cells[2])
		if raw != "" {
			n, err := strconv.Atoi(raw)
			if err != nil {
				p.Warnings = append(p.Warnings,
					fmt.Sprintf("exercicio %q: series %q nao e numerico, gravado como 0", ex.Name, raw))
			} else {
				ex.Sets = n
			}
		}
	}
	if len(cells) > 3 {
		ex.Repetitions = strings.TrimSpace(cells[3])
	}
	if len(cells) > 4 {
		// Observacao vazia na fonte => campo vazio (nao string vazia como dado).
		ex.Notes = strings.TrimSpace(cells[4])
	}
	return ex, true
}

// parseWorkoutHeading reconhece "TREINO A - Pernas (Quadriceps)" e variantes.
func parseWorkoutHeading(title string) (label, focus string, ok bool) {
	lower := strings.ToLower(title)
	const kw = "treino"
	if !strings.HasPrefix(lower, kw) {
		return "", "", false
	}
	rest := strings.TrimSpace(title[len(kw):])
	rest = strings.TrimLeft(rest, " \t:")
	if rest == "" {
		return "", "", false
	}
	// O rotulo e o primeiro token: letras, digitos, ponto ou parenteses.
	i := 0
	for i < len(rest) {
		c := rest[i]
		isAlnum := c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' || c >= '0' && c <= '9'
		if isAlnum || c == '.' || c == ')' {
			i++
			continue
		}
		break
	}
	if i == 0 {
		return "", "", false
	}
	label = strings.TrimSpace(rest[:i])
	focus = strings.TrimSpace(rest[i:])
	focus = strings.Trim(focus, " \t:-–—")
	return label, focus, true
}

func workoutCanonicalName(label, focus string) string {
	if focus == "" {
		return "Treino " + label
	}
	return "Treino " + label + " - " + focus
}

// ── estrutura semanal ──────────────────────────────────────────────────────

// parseWeeklyTable extrai a tabela "| Dia | Treino | Foco |" de um bloco.
func parseWeeklyTable(block []string) ([]weeklyRow, bool) {
	var rows []weeklyRow
	headerSeen := false
	for _, line := range block {
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "|") {
			continue
		}
		cells, ok := splitCells(trimmed)
		if !ok || len(cells) < 2 || isSeparatorRow(cells) {
			continue
		}
		if !headerSeen {
			// So aceita como tabela semanal se o cabecalho for reconhecivel.
			if strings.EqualFold(strings.TrimSpace(cells[0]), "dia") || strings.EqualFold(strings.TrimSpace(cells[1]), "treino") {
				headerSeen = true
			}
			continue
		}
		day, err := strconv.Atoi(strings.TrimSpace(cells[0]))
		if err != nil {
			continue
		}
		row := weeklyRow{Day: day, Label: strings.TrimSpace(cells[1])}
		if len(cells) > 2 {
			row.Focus = strings.TrimSpace(cells[2])
		}
		rows = append(rows, row)
	}
	return rows, headerSeen && len(rows) > 0
}

// resolveDayOfWeek aplica a estrutura semanal aos treinos, sem sobrescrever
// informacao original em conflito: o conflito vira aviso.
func resolveDayOfWeek(p *Program, rows []weeklyRow) {
	if len(rows) == 0 {
		return
	}
	byLabel := make(map[string]weeklyRow, len(rows))
	for _, r := range rows {
		if l := normalizeLabel(r.Label); l != "" {
			byLabel[l] = r
		}
	}
	for i := range p.Workouts {
		w := &p.Workouts[i]
		row, ok := byLabel[normalizeLabel(w.Label)]
		if !ok {
			p.Warnings = append(p.Warnings,
				fmt.Sprintf("treino %q: sem linha na estrutura semanal, dayOfWeek vazio", w.Label))
			continue
		}
		if row.Day >= 1 && row.Day < len(weekDayKeys) {
			w.DayOfWeek = weekDayKeys[row.Day]
		}
		if row.Focus != "" && w.Objective != "" && row.Focus != w.Objective {
			p.Warnings = append(p.Warnings,
				fmt.Sprintf("treino %q: foco do titulo (%q) difere do foco da estrutura semanal (%q); mantido o do titulo, tabela preservada em Notes",
					w.Label, w.Objective, row.Focus))
		}
	}
}

func normalizeLabel(s string) string {
	return strings.ToUpper(strings.TrimSpace(s))
}

// ── helpers ────────────────────────────────────────────────────────────────

func splitLines(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	return strings.Split(s, "\n")
}

func isHorizontalRule(trimmed string) bool {
	if len(trimmed) < 3 {
		return false
	}
	c := trimmed[0]
	if c != '-' && c != '*' && c != '_' {
		return false
	}
	for i := 0; i < len(trimmed); i++ {
		if trimmed[i] != c {
			return false
		}
	}
	return true
}

// splitCells quebra "| a | b |" em celulas. A primeira coluna e o indice "#".
func splitCells(line string) ([]string, bool) {
	s := strings.TrimSpace(line)
	if !strings.HasPrefix(s, "|") {
		return nil, false
	}
	s = strings.TrimPrefix(s, "|")
	if strings.HasSuffix(s, "|") {
		s = strings.TrimSuffix(s, "|")
	}
	parts := strings.Split(s, "|")
	cells := make([]string, 0, len(parts))
	for _, c := range parts {
		cells = append(cells, strings.TrimSpace(c))
	}
	return cells, true
}

func isSeparatorRow(cells []string) bool {
	for _, c := range cells {
		if c == "" {
			return false
		}
		trimmed := strings.Trim(c, ":")
		if len(trimmed) < 2 {
			return false
		}
		for i := 0; i < len(trimmed); i++ {
			if trimmed[i] != '-' {
				return false
			}
		}
	}
	return true
}

// programNameFromTitle encurta o H1 quando ele traz o prefixo generico
// "Programa de Treino - ".
func programNameFromTitle(h1 string) (name, full string) {
	full = strings.TrimSpace(h1)
	s := full
	lower := strings.ToLower(s)
	for _, prefix := range []string{
		"programa de treino",
		"programa de treinamento",
		"programa",
	} {
		if !strings.HasPrefix(lower, prefix) {
			continue
		}
		rest := s[len(prefix):]
		rest = strings.TrimLeft(rest, " \t:")
		rest = strings.TrimLeft(rest, "–—-")
		rest = strings.TrimLeft(rest, " \t")
		if rest != "" {
			s = rest
		}
		break
	}
	return strings.TrimSpace(s), full
}

// extractFoco reconhece a linha "**Foco: ...**" (com ou sem negrito).
func extractFoco(trimmed string) (string, bool) {
	s := strings.TrimSpace(strings.Trim(trimmed, "*"))
	const key = "foco:"
	if len(s) < len(key) || !strings.EqualFold(s[:len(key)], key) {
		return "", false
	}
	return strings.TrimSpace(s[len(key):]), true
}

// cleanBlock remove linhas em branco nas pontas e colapsa sequencias de linhas
// em branco, preservando o conteudo de cada linha.
func cleanBlock(lines []string) string {
	out := make([]string, 0, len(lines))
	blank := 0
	for _, l := range lines {
		if strings.TrimSpace(l) == "" {
			blank++
			continue
		}
		if blank > 0 && len(out) > 0 {
			out = append(out, "")
		}
		blank = 0
		out = append(out, strings.TrimRight(l, " \t"))
	}
	return strings.Join(out, "\n")
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "..."
}
