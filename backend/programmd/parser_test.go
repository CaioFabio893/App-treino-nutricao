package programmd

import (
	"os"
	"strings"
	"testing"
)

// caminhoExemplo e o material de origem real fornecido pelo usuario. Os testes
// que dependem dele sao pulados (t.Skip) quando o arquivo nao esta na maquina,
// para o pacote continuar testavel no CI.
const caminhoExemplo = `C:/Users/caiof/OneDrive/Desktop/exemplo/treino.md`

func lerExemplo(t *testing.T) string {
	t.Helper()
	b, err := os.ReadFile(caminhoExemplo)
	if err != nil {
		t.Skipf("material de exemplo indisponivel (%v): pulando teste de arquivo real", err)
	}
	return string(b)
}

func treino(t *testing.T, p *Program, label string) Workout {
	t.Helper()
	for _, w := range p.Workouts {
		if w.Label == label {
			return w
		}
	}
	t.Fatalf("treino %q nao encontrado (labels: %v)", label, labels(p))
	return Workout{}
}

func labels(p *Program) []string {
	out := make([]string, 0, len(p.Workouts))
	for _, w := range p.Workouts {
		out = append(out, w.Label)
	}
	return out
}

func contarExercicios(p *Program) int {
	n := 0
	for _, w := range p.Workouts {
		n += len(w.Exercises)
	}
	return n
}

// ── arquivo real ───────────────────────────────────────────────────────────

func TestParseArquivoReal(t *testing.T) {
	p, err := Parse(lerExemplo(t))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	if p.Name != "Louise Lima (Ciclo 2)" {
		t.Errorf("Name = %q, want %q", p.Name, "Louise Lima (Ciclo 2)")
	}
	if !strings.Contains(p.Objective, "Hipertrofia de Inferiores") {
		t.Errorf("Objective nao preservou o foco: %q", p.Objective)
	}

	if len(p.Workouts) != 5 {
		t.Fatalf("len(Workouts) = %d, want 5 (labels %v)", len(p.Workouts), labels(p))
	}
	if got, want := strings.Join(labels(p), ","), "A,B,C,D,E"; got != want {
		t.Errorf("labels = %q, want %q (ordem original)", got, want)
	}

	if got := contarExercicios(p); got != 30 {
		t.Errorf("total de exercicios = %d, want 30", got)
	}
}

func TestParseArquivoRealExerciciosAmostra(t *testing.T) {
	p, err := Parse(lerExemplo(t))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	a := treino(t, p, "A")
	if a.Objective != "Pernas (Quadríceps)" {
		t.Errorf("treino A Objective = %q, want %q", a.Objective, "Pernas (Quadríceps)")
	}
	if a.Name != "Treino A - Pernas (Quadríceps)" {
		t.Errorf("treino A Name = %q", a.Name)
	}
	if len(a.Exercises) != 5 {
		t.Fatalf("treino A: %d exercicios, want 5", len(a.Exercises))
	}

	casos := []struct {
		idx        int
		nome       string
		sets       int
		repeticoes string
		notas      string
	}{
		{0, "Agachamento Livre com Barra", 4, "6-8", "Foco em força/carga"},
		{1, "Hack Squat", 4, "10", "Amplitude total"},
		{2, "Leg Press 45°", 4, "10-12", "Cadência controlada"},
		{3, "Cadeira Extensora", 3, "12", "Drop-set na última série"},
		{4, "Panturrilha Sentada", 4, "15", "Iso 3s no topo"},
	}
	for i, c := range casos {
		ex := a.Exercises[i]
		if ex.Name != c.nome || ex.Sets != c.sets || ex.Repetitions != c.repeticoes || ex.Notes != c.notas {
			t.Errorf("treino A ex.%d = {%q,%d,%q,%q}, want {%q,%d,%q,%q}",
				i+1, ex.Name, ex.Sets, ex.Repetitions, ex.Notes, c.nome, c.sets, c.repeticoes, c.notas)
		}
		if ex.Order != i+1 {
			t.Errorf("treino A ex.%d Order = %d, want %d", i+1, ex.Order, i+1)
		}
	}

	// B: primeiro exercicio tem observacao vazia na fonte -> Notes vazio.
	b := treino(t, p, "B")
	if b.Exercises[0].Name != "Puxada Alta Pronada" || b.Exercises[0].Sets != 4 || b.Exercises[0].Repetitions != "8-10" {
		t.Errorf("treino B ex.1 = %+v", b.Exercises[0])
	}
	if b.Exercises[0].Notes != "" {
		t.Errorf("treino B ex.1 Notes = %q, want vazio (observacao ausente na fonte)", b.Exercises[0].Notes)
	}

	// Contagem por treino, preservando o material.
	for _, c := range []struct {
		label string
		n     int
	}{{"A", 5}, {"B", 5}, {"C", 7}, {"D", 6}, {"E", 7}} {
		if got := len(treino(t, p, c.label).Exercises); got != c.n {
			t.Errorf("treino %s: %d exercicios, want %d", c.label, got, c.n)
		}
	}
}

func TestParseArquivoRealCardioPreservadoEmDescription(t *testing.T) {
	p, err := Parse(lerExemplo(t))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	// B e D tem Cardio Final. Ele NAO vira exercicio: vai verbatim na descricao.
	for _, label := range []string{"B", "D"} {
		w := treino(t, p, label)
		if !strings.Contains(w.Description, "Cardio Final") {
			t.Errorf("treino %s: Description perdeu o bloco de Cardio: %q", label, w.Description)
		}
		if !strings.Contains(w.Description, "Opção 3") {
			t.Errorf("treino %s: Description perdeu a Opcao 3: %q", label, w.Description)
		}
		if !strings.Contains(w.Description, "AMRAP 12'") {
			t.Errorf("treino %s: Description perdeu o AMRAP: %q", label, w.Description)
		}
	}
	// A, C e E nao tem Cardio Final -> Description vazia, nao lixo.
	for _, label := range []string{"A", "C", "E"} {
		if d := treino(t, p, label).Description; d != "" {
			t.Errorf("treino %s: Description = %q, want vazia", label, d)
		}
	}
	// O cardio nao pode ter virado exercicio (ganho de 3 exercicios no total).
	if got := contarExercicios(p); got != 30 {
		t.Errorf("cardio virou exercicio? total = %d, want 30", got)
	}
}

func TestParseArquivoRealEstruturaSemanalPreencheDiaDaSemana(t *testing.T) {
	p, err := Parse(lerExemplo(t))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	// Dia 1..5 da tabela semanal = monday..friday (mesma convencao de lib/days.ts).
	for _, c := range []struct{ label, day string }{
		{"A", "monday"},
		{"B", "tuesday"},
		{"C", "wednesday"},
		{"D", "thursday"},
		{"E", "friday"},
	} {
		if got := treino(t, p, c.label).DayOfWeek; got != c.day {
			t.Errorf("treino %s DayOfWeek = %q, want %q", c.label, got, c.day)
		}
	}
}

func TestParseArquivoRealSecoesDeProgramaEmNotes(t *testing.T) {
	p, err := Parse(lerExemplo(t))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	for _, s := range []string{"## Estrutura semanal", "## PRs", "## Periodização"} {
		if !strings.Contains(p.Notes, s) {
			t.Errorf("Notes perdeu %q:\n%s", s, p.Notes)
		}
	}
	// PRs preservados verbatim.
	if !strings.Contains(p.Notes, "Agachamento Livre com Barra") {
		t.Errorf("Notes perdeu a lista de PRs:\n%s", p.Notes)
	}
	// Periodizacao preservada.
	if !strings.Contains(p.Notes, "Deload 70%") {
		t.Errorf("Notes perdeu a periodizacao:\n%s", p.Notes)
	}
	// Nenhum titulo de treino pode ter vazado para Notes.
	if strings.Contains(p.Notes, "## TREINO") {
		t.Errorf("Notes contem secao de treino:\n%s", p.Notes)
	}
}

// ── robustez ───────────────────────────────────────────────────────────────

func TestParseEntradasInvalidas(t *testing.T) {
	casos := []struct {
		nome string
		md   string
	}{
		{"vazio", ""},
		{"somente espacos", "   \n\n\t\n"},
		{"sem secao de treino", "# Programa de Treino - X\n\ntexto solto\n"},
		{"apenas H1", "# So um titulo\n"},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if p, err := Parse(c.md); err == nil {
				t.Fatalf("Parse(%q) = %+v, want erro", c.nome, p)
			}
		})
	}
}

const mdSintetico = `# Programa de Treino — Ciclo Teste

**Foco: Força**

## TREINO 1 — Perna

| # | Exercício | Séries | Reps | Observação |
|---|---|---:|---:|---|
| 1 | Agachamento | 4 | 6-8 | força |
| 2 | Cadeira | x | 12 | |

## TREINO 2 - Costa

| 1 | Puxada | 3 | 10 |
| 2 | Remada | 3 | 8 |

## PRs

- Agachamento

## Estrutura semanal

| Dia | Treino | Foco |
|---|---|---|
| 1 | 1 | Perna |
| 3 | 2 | Costa |
`

func TestParseMarkdownSintetico(t *testing.T) {
	p, err := Parse(mdSintetico)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if p.Name != "Ciclo Teste" {
		t.Errorf("Name = %q, want %q", p.Name, "Ciclo Teste")
	}
	if p.Objective != "Força" {
		t.Errorf("Objective = %q, want %q", p.Objective, "Força")
	}
	if len(p.Workouts) != 2 {
		t.Fatalf("len(Workouts) = %d, want 2", len(p.Workouts))
	}

	// Separador unicode (—) e ascii (-) produzem o mesmo formato canonico.
	if p.Workouts[0].Name != "Treino 1 - Perna" {
		t.Errorf("treino 1 Name = %q", p.Workouts[0].Name)
	}
	if p.Workouts[1].Name != "Treino 2 - Costa" {
		t.Errorf("treino 2 Name = %q", p.Workouts[1].Name)
	}

	// Series nao numericas viram 0 e geram aviso, sem abortar.
	if got := p.Workouts[0].Exercises[1].Sets; got != 0 {
		t.Errorf("sets nao numericos = %d, want 0", got)
	}
	if len(p.Warnings) == 0 {
		t.Error("esperava aviso sobre series nao numericas")
	}
	// Cabecalho nao virou exercicio.
	if got := len(p.Workouts[0].Exercises); got != 2 {
		t.Errorf("treino 1: %d exercicios, want 2", got)
	}
	// Tabela sem cabecalho funciona igual.
	if got := len(p.Workouts[1].Exercises); got != 2 {
		t.Errorf("treino 2: %d exercicios, want 2", got)
	}
	if p.Workouts[1].Exercises[0].Name != "Puxada" || p.Workouts[1].Exercises[0].Order != 1 {
		t.Errorf("treino 2 ex.1 = %+v", p.Workouts[1].Exercises[0])
	}
	// DayOfWeek vem da estrutura semanal; dia sem linha correspondente fica vazio.
	if p.Workouts[0].DayOfWeek != "monday" {
		t.Errorf("treino 1 DayOfWeek = %q, want monday", p.Workouts[0].DayOfWeek)
	}
	if p.Workouts[1].DayOfWeek != "wednesday" {
		t.Errorf("treino 2 DayOfWeek = %q, want wednesday", p.Workouts[1].DayOfWeek)
	}
	// Secoes de programa preservadas; treino nao.
	if !strings.Contains(p.Notes, "## PRs") || !strings.Contains(p.Notes, "## Estrutura semanal") {
		t.Errorf("Notes = %q", p.Notes)
	}
	if strings.Contains(p.Notes, "TREINO") {
		t.Errorf("Notes vazou secao de treino: %q", p.Notes)
	}
}

func TestParsePreservaAcentosEOrdem(t *testing.T) {
	md := "## TREINO A — Perna (Quadríceps)\n\n" +
		"| # | Exercício | Séries | Reps | Observação |\n|---|---|---:|---:|---|\n" +
		"| 1 | Agachamento Búlgaro | 4 | 8-10 | Cada perna |\n" +
		"| 2 | Elevação Pélvica | 4 | 10-12 | Iso 2s no topo |\n" +
		"| 3 | Stiff Romeno com Barra | 4 | 8-10 | Descida lenta |\n"
	p, err := Parse(md)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	got := []string{}
	for _, e := range p.Workouts[0].Exercises {
		got = append(got, e.Name)
	}
	want := []string{"Agachamento Búlgaro", "Elevação Pélvica", "Stiff Romeno com Barra"}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("ex.%d = %q, want %q (ordem/nome original)", i+1, got[i], want[i])
		}
	}
}

func TestParseSecaoDesconhecidaPreservadaEmNotes(t *testing.T) {
	md := "## TREINO A\n\n| 1 | Agachamento | 4 | 8 |\n\n## Aquecimento\n\ntexto\n"
	p, err := Parse(md)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if !strings.Contains(p.Notes, "## Aquecimento") {
		t.Errorf("Notes = %q, quer ver ## Aquecimento", p.Notes)
	}
}

func TestParseTreinoSemFoco(t *testing.T) {
	md := "## TREINO A\n\n| 1 | Agachamento | 4 | 8 |\n"
	p, err := Parse(md)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if p.Workouts[0].Name != "Treino A" {
		t.Errorf("Name = %q, want %q", p.Workouts[0].Name, "Treino A")
	}
}

func TestParseTreinoSemTabelaPreservaTexto(t *testing.T) {
	md := "## TREINO A\n\nFazer 3 voltas na esteira.\n"
	p, err := Parse(md)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if p.Workouts[0].Description != "Fazer 3 voltas na esteira." {
		t.Errorf("Description = %q", p.Workouts[0].Description)
	}
	if len(p.Warnings) == 0 {
		t.Error("esperava aviso de treino sem tabela")
	}
}

func TestParseNaoConsideraTreinoComPalavraNoMeio(t *testing.T) {
	md := "## Estrutura semanal\n\n| Dia | Treino | Foco |\n|---|---|---|\n| 1 | A | Perna |\n"
	if p, err := Parse(md); err == nil {
		t.Fatalf("Parse = %+v, want erro (nenhum treino)", p)
	}
}

func TestParseConflitoDeFocoViraAvisoNaoSobrescreve(t *testing.T) {
	md := "## TREINO A — Perna (Quadríceps)\n\n| 1 | Agachamento | 4 | 8 |\n\n" +
		"## Estrutura semanal\n\n| Dia | Treino | Foco |\n|---|---|---|\n| 1 | A | Perna — outro texto |\n"
	p, err := Parse(md)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if p.Workouts[0].Objective != "Perna (Quadríceps)" {
		t.Errorf("Objective = %q, want o do titulo preservado", p.Workouts[0].Objective)
	}
	if len(p.Warnings) == 0 {
		t.Error("esperava aviso de conflito de foco")
	}
}

func TestSplitCellsIgnoraCelulasVazias(t *testing.T) {
	cells, ok := splitCells("| 1 |  | 4 | 8 |  |")
	if !ok || len(cells) != 5 {
		t.Fatalf("splitCells = %v, %v", cells, ok)
	}
	if cells[1] != "" || cells[4] != "" {
		t.Errorf("celulas vazias nao foram limpas: %q", cells)
	}
}

func TestIsSeparatorRow(t *testing.T) {
	if !isSeparatorRow([]string{"---", "---:", ":---:"}) {
		t.Error("linha de separador nao reconhecida")
	}
	if isSeparatorRow([]string{"1", "Agachamento"}) {
		t.Error("linha de dados reconhecida como separador")
	}
}
