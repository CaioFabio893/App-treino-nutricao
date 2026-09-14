---
name: design-system
description: "Arquitetura de tokens de design e especificações de componentes visuais para Criação de Sites Modernos. Define padrões estéticos de alto impacto (Anti-UI Slop), tipografia com Google Fonts, paletas semânticas, micro-interações e componentes de conversão."
---

# Design System - Criação de Sites Modernos (Alta Estética & Performance)

Diretrizes estéticas e arquitetura de componentes visuais para sites profissionais, landing pages e portais de alta conversão, projetados para encantar o visitante à primeira vista e transmitir autoridade técnica.

---

## 1. Arquitetura de Tokens de 3 Camadas

```
1. Primitivos (Cores base, escalas numéricas, espaçamentos e raios de borda)
       │
2. Semânticos (Tokens funcionais: background, surface, text-primary, accent, border)
       │
3. Componentes (Navbar, Hero Banner, Cards de Serviços, FAQ, Formulário de Lead, Footer)
```

### Tokens Semânticos Recomendados

| Papel | Variável CSS / Tailwind | Exemplo Dark Moderno | Exemplo Light Elegante | Aplicação |
|---|---|---|---|---|
| **Canvas Background** | `--bg-canvas` | `#09090B` (zinc-950) | `#FAFAFA` (zinc-50) | Fundo principal de todas as páginas |
| **Surface / Card** | `--surface-card` | `#121215` (zinc-900/90) | `#FFFFFF` (white) | Cards de serviço, containers elevados |
| **Surface Hover** | `--surface-hover` | `#1C1C22` (zinc-800/80) | `#F4F4F5` (zinc-100) | Feedback ao passar o mouse em cards/linhas |
| **Borda Sutil** | `--border-subtle` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | Linhas de divisão e contorno de cards |
| **Acento Primário** | `--accent-primary` | `#3B82F6` / `#6366F1` | `#2563EB` / `#4F46E5` | Botões de CTA principal, badges, links |
| **Acento Hover** | `--accent-hover` | `#1D4ED8` / `#4338CA` | `#1E40AF` / `#3730A3` | Estado hover de botões e destaques |
| **Texto Primário** | `--text-primary` | `#F4F4F5` (zinc-100) | `#09090B` (zinc-950) | Títulos H1, H2 e textos de destaque |
| **Texto Secundário** | `--text-muted` | `#A1A1AA` (zinc-400) | `#71717A` (zinc-500) | Parágrafos de apoio, legendas e metadados |
| **Sucesso** | `--color-success` | `#10B981` (emerald-500) | `#059669` (emerald-600) | Feedback de envio de formulário com sucesso |
| **Erro** | `--color-danger` | `#EF4444` (red-500) | `#DC2626` (red-600) | Validações e erros de campo |

---

## 2. Tipografia e Hierarquia de Sites

1. **Combinação de Fontes (Google Fonts):**
   - **Títulos / Display:** Fontes modernas com personalidade (ex: *Inter*, *Plus Jakarta Sans*, *Outfit*, *Space Grotesk* ou *Cabinet Grotesk*).
   - **Corpo de Texto (Body):** Máxima legibilidade (ex: *Inter*, *Geist Sans* ou *Roboto*).
2. **Escalonamento Fluido:**
   - **H1 (Hero):** 2.5rem a 4.5rem (bold ou extrabold), tracking justo (`tracking-tight`), balanceamento de texto (`text-wrap: balance`).
   - **H2 (Seções):** 2rem a 3rem (semibold/bold), acompanhado de um overline/badge temático.
   - **H3 (Cards):** 1.25rem a 1.5rem (semibold).
   - **Body (Parágrafos):** 1rem a 1.125rem com altura de linha confortável (`leading-relaxed`).

---

## 3. Padrão de Componentes Essenciais

### Header / Navbar de Alto Impacto
- Fixa no topo com efeito de vidro (`backdrop-blur-md bg-background/80`).
- Transição sutil de borda ao scroll (`border-b border-border/50`).
- Menu mobile com drawer suave ou dropdown responsivo animado.

### Hero Section
- Fundo com profundidade (efeito de gradiente radial sutil ou glow moderno).
- Badge no topo (ex: *"Novo: Conheça nossos serviços"* ou selo de avaliação).
- Título claro e objetivo com proposta de valor irrecusável.
- Botão CTA Primário (com destaque e micro-interação de hover) + Botão CTA Secundário (estilo outline ou ghost).
- Prova social embutida (ex: avaliações com 5 estrelas ou logos parceiros).

### Bento Grid & Cards de Recursos
- Organização assimétrica ou modular que quebra a monotonia de listas comuns.
- Bordas finas com realce no hover (`hover:border-accent/40 transition-all duration-300`).
- Ícones vetoriais modernos (Lucide Icons) dentro de containers com fundo translúcido suave.

### FAQ Sanfonado (Accordion)
- Expansão suave com transição de altura e rotação de ícone (seta ou sinal de mais).
- Foco em legibilidade e espaçamento entre perguntas.

### Formulário de Contato / Captura de Leads
- Campos com estados visuais evidentes (normal, foco com anel suave, erro com mensagem clara abaixo do input).
- Botão de envio com estado de carregamento (*loading spinner*) e bloqueio contra cliques duplos.
- Mensagem de sucesso amigável e expansiva após o envio.

---

## 4. Diretrizes Anti-UI Slop & Usabilidade

1. **Nunca use layouts genéricos ou sem acabamento:** Adicione detalhes de acabamento premium (sombras suaves multicamadas, bordas finas com opacidade, micro-transições de 200ms).
2. **Sem placeholders vazios:** Utilize imagens reais de alta resolução (otimizadas em WebP/AVIF via `next/image`) ou ilustrações vetorizadas coerentes com o nicho.
3. **Contraste e Acessibilidade (WCAG AA):** Garanta que todo texto tenha contraste mínimo de 4.5:1 em relação ao seu fundo.
4. **Mobile-First Inegociável:** Todo componente deve ser desenhado para funcionar perfeitamente em telas pequenas (a partir de 320px), com áreas de clique mínimas de 44x44px.
