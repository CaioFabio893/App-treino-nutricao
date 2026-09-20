# Design System — Treino & Nutrição V2

Status: Proposto na Fase 0 (aprovação pendente). Base: tokens reais da V1
(`frontend/app/base.css`), que o V2 **consolida** (não inventa do zero).
Dirigido pelo produto: app de treino/nutrição da Louise Lima, mobile-first.

## Princípios

1. **Mobile-first**: alvo = uso no celular (espelhamento na TV, PWA instalável,
   timers durante o treino). Maioria das interações é one-handed.
2. **Identidade "esportiva orgânica"**: verde profundo (saúde/terreno) sobre
   neutros claros — herança direta da paleta V1 que o público já reconhece.
3. **Acessibilidade (WCAG 2.2)**: cores com contraste AA no mínimo; alvo de
   toque ≥ 44×44px; zoom livre (V1 já garante — `layout.tsx` sem
   `maximum-scale`); foco visível em inputs/botões.
4. **Sem "UI slop"**: nada de gradientes neon genéricos, sombras pesadas ou
   fontes sans-serif de stock. Tipografia com caráter (Space Grotesk) + corpo
   Inter; micro-interações sutis (transições curtas, escala de toque).

## Tokens (V1 → V2 consolidados)

### Cor — paleta semântica

| Token | Valor (V1) | Uso |
|---|---|---|
| `--d-bg` (cream) | `#F1F5F3` | fundo de página |
| `--d-surface` | `#FFFFFF` | cards, modais, inputs |
| `--d-surface-2` (peach) | `#E7F0EB` | áreas destacadas, chips |
| `--d-border` | `#DCE6E0` | bordas de cards/inputs |
| `--d-text` | `#172420` | texto primário |
| `--d-muted` | `#63736C` | texto secundário |
| `--d-primary` (terra) | `#0B6B52` | CTA principal, links, status ativo |
| `--d-primary-dark` (deep) | `#083D30` | hover/press, gradientes do hero |
| `--d-primary-mid` (blush) | `#4B937B` | bordas de destaque, chevrons |
| `--d-primary-bright` | `#35C596` | acentos (progreso) |
| `--d-sidebar-bg` | `#0F1D19` | navegação lateral/área admin |
| `--d-sidebar-text` | `#A9BAB3` | texto da navegação |
| `--d-ok` | `#1F7A4D` (bg `#E3F3E9`) | sucesso, "feito/executado" |
| `--d-fail` | `#B3413A` (bg `#F8E9E7`) | erro, "pendente/falhou" |
| `--d-warn` | `#8A6D1C` (bg `#FDF3D8`) | parcial/aviso (dieta parcial) |

> V2 mantém os nomes `--d-*` (origem "dashboard") ou os renomeia para
> `--tn-*` (Treino&Nutrição) com compatibilidade por remapeamento — decisão de
> implementação (Fase 1), sem mudança visual.

### Tipografia

| Papel | Fonte | Pesos | Tamanhos-chave |
|---|---|---|---|
| Display/headers | **Space Grotesk** (`--d-head`, `var(--font-head)`) | 500–700 | 22–26px (títulos de página), 20px (modal), 18px (cards) |
| Corpo/UI | **Inter** (`--d-body`, `var(--font-body)`) | 400–700 | 14px (leitura), 12–13px (UI/meta), 9–10px (uppercase labels) |
| Números (stats/ranking) | Space Grotesk itálico | 700 | 26px stats, 18px nota do ranking |

Fontes **self-hosted** via `next/font` (V1 já faz: privacidade, offline PWA,
sem round-trip ao Google Fonts).

### Forma e profundidade

| Token | Valor |
|---|---|
| `--d-radius` | 10px (cards) |
| `--d-radius-sm` | 7px (inputs, chips, células) |
| Pílulas | 999px (buttons, badges, chips, tabs) |
| `--d-shadow` | `0 1px 2px rgba(16,24,21,.06), 0 1px 0 rgba(16,24,21,.04)` |
| Hover de card | `0 4px 20px rgba(11,107,82,0.13)` |
| Sombras "suspensas" | modais (bottom-sheet), toast, PWA banners |

### Espaçamento / grid

- Base 4px; ritmo comum de 8/10/12/14/16px.
- Largura útil de conteúdo: **max 720px** (`--content-max`), centralizada.
- Bottom sheets de modal: `border-radius: 24px` no topo, ancorados ao rodapé.

## Componentes (especificação resumida)

| Componente | Especificação |
|---|---|
| Botão primário `.btn-p` | Pílula, fundo `--d-primary`, texto branco, sombra verde, `border-radius: 24px`, altura ≥ 44px |
| Botão secundário `.btn-s` | Pílula outline, fundo `--d-bg`, texto muted |
| Botão small `.btn-sm` | Pílula rasa, 20px radius, `.acc/.danger/.full` variantes |
| Card `.nut-card` / `.ex-card` | branco, borda 1.5px `--d-border`, radius 10px, sombra sutil |
| Chip `.chip` | pílula com bordo, `.done` verde suave |
| Badge `.badge` | status: `.active` verde, `.paused` âmbar, `.inactive` vermelho |
| Tab `.tab` | uppercase 10px, sublinhado ativo verde, `letter-spacing: 1px` |
| Input `.frm-row input` | fundo `--d-bg`, borda 1.5px, focus borda verde |
| Modal `.modal-box` | bottom-sheet, 24px topo, `slideup .25s`, backdrop blur |
| Toast `#toast` | pílula verde escuro, mensagem curta, animação 0.3s |
| Avatar `.avatar` | círculo 46px, iniciais em Space Grotesk no fundo peach |
| Lista de ranking `.rank-row` | row card, `me` destacado com borda verde + fundo peach |
| Feed `.post-card` | card com `post-acts` (like pílula), comentários aninhados |
| Calendário `.cal-month` | grid 7 col, células `done/planned/today`, marca de dieta |

## Estados e feedback

- **Empty states**: ícone circular em peach + título serif + mensagem + CTA
  (V1 já tem `.empty-state` — V2 padroniza para todos os módulos).
- **Loading**: spinner inline + label uppercase (`.spin-wrap`).
- **Erros**: caixa `#FCF2F0`/`#93392B` local a cada ação (`.load-error`,
  `.post-act-err`) — nunca erro global silencioso.
- **Erro de rede**: mesmo idioma visual, com "tentar de novo".

## Micro-interações

- Transições de 0.15–0.25s em cores/bordas (nunca acima de 0.4s).
- Acordeão de exercício (chevron gira 180°), barra de progresso animada 0.4s.
- Timer: display grande em Space Grotesk; barra linear de `--d-primary-bright`
  (ok) ou vermelha (tempo esgotado).
- Botão de instalação PWA flutua (desapega 2px no hover).

## Densidade e layout

- Header compacto (36px logo + label uppercase 9px).
- Navegação mobile: bottom nav / área admin flutuante center-bottom
  (`.admin-areas` painel escuro translúcido).
- PWA: `safe-area-inset-*` respeitado (notch/gesture bar).
- Impressão: `.print-card` limpo (bordas removidas) — treinos/dietas
  imprimíveis (já existe na V1 e é usado pelo nutricionista).

## Governança do design system

- Fontes de verdade: este doc + `docs/design/` no repo; tokens aplicados
  primeiro em `base.css`; páginas consomem tokens via `var(--d-*)`.
- Toda tela nova deve cobrir: **default, empty, loading, error** states.
- V2: auditar contraste AA (verde `#0B6B52` sobre branco ≈ 5.2:1 — ok);
  confirmar `#63736C` muted (pode precisar de `#4F5F58` para texto pequeno).
- Testes de a11y/visual entram no pipeline de testes (Playwright + axe).

## Referências visuais

V1 mantém screenshots em `docs/screenshots/*.png` (dashboard do aluno,
treinos, dietas, painel do nutricionista). O V2 **não redesenha do zero**:
consolida e profissionaliza os padrões já aprovados pelo dono do projeto,
garantindo continuidade visual para os alunos existentes.