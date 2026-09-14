---
name: requesting-code-review
description: "Use para auditoria e revisão de código após implementar seções, páginas ou funcionalidades em websites. Valida estética visual (Anti-UI Slop), responsividade mobile-first, SEO & Core Web Vitals, Clean Architecture no backend Go e acessibilidade WCAG."
---

# Revisão de Código & Auditoria Técnica (Criação de Sites)

Realiza revisão crítica, estética e padronizada das alterações antes de considerar qualquer página, seção ou endpoint do site como concluído ou mesclado.

---

## Pilares da Revisão

### 1. Estética Visual & Anti-UI Slop
- [ ] O layout transmite acabamento profissional e sofisticado, sem parecer um template genérico de IA?
- [ ] Os tokens de design definidos em `design-system` foram rigorosamente respeitados?
- [ ] Não há imagens com placeholders genéricos ou textos padrão esquecidos (Lorem Ipsum)?
- [ ] Os formulários e botões possuem feedback claro de estados (hover, active, loading spinner, mensagens de sucesso e erro)?

### 2. Responsividade Mobile-First
- [ ] O site é 100% funcional e legível em telas pequenas a partir de 320px de largura?
- [ ] Não há overflow horizontal (rolagem lateral indesejada) em nenhuma resolução?
- [ ] O menu mobile (hambúrguer/drawer) abre, navega e fecha de maneira fluida?
- [ ] Todos os elementos interativos possuem área de toque confortável para dedos no celular (mínimo 44x44px)?

### 3. SEO & Acessibilidade (WCAG AA)
- [ ] Há exatamente **um** `<h1>` na página, com hierarquia semântica correta (`<h2>` para seções, `<h3>` para cards)?
- [ ] As metatagas de SEO estão preenchidas: `title`, `description`, `canonical` e OpenGraph (`og:image`, `og:title`, `og:description`)?
- [ ] O contraste entre texto e fundo atende à norma WCAG AA (mínimo 4.5:1 para texto padrão e 3:1 para títulos grandes)?
- [ ] Todas as imagens possuem atributos `alt` descritivos e informativos?
- [ ] Todos os inputs de formulários possuem `<label>` associado ou `aria-label` explícito?

### 4. Backend Go & Segurança de APIs
- [ ] O padrão Clean Layered Architecture foi mantido (`handlers` -> `service` -> `repository`)?
- [ ] Formulários públicos implementam campo **Honeypot** ou mecanismo equivalente para barrar robôs de spam?
- [ ] As respostas de erro não vazam detalhes internos do servidor nem stack traces para o cliente final?
- [ ] Os retornos de erro no Go estão encapsulados com `fmt.Errorf("...: %w", err)`?
- [ ] Parâmetros de entrada são sanitizados antes de persistência ou envio de email?

### 5. Performance & Core Web Vitals
- [ ] As imagens utilizam o componente `next/image` com formatos otimizados (WebP/AVIF) e prioridade correta (`priority` apenas na imagem acima da dobra)?
- [ ] As fontes são carregadas via `next/font` para evitar Cumulative Layout Shift (CLS)?
- [ ] O bundle de JavaScript é leve e não carrega bibliotecas pesadas sem necessidade?

### 6. Cobertura de Testes & Build
- [ ] O comando de build (`npm run build`) compila sem nenhum erro de TypeScript ou ESLint?
- [ ] A suíte de testes unitários do frontend (`npm run test:run`) roda 100% verde?
- [ ] A suíte de testes do backend Go (`go test -v ./...`) roda 100% verde?

---

## Classificação de Problemas

- **CRÍTICO:** Layout quebrando com rolagem horizontal no mobile, formulário de contato com erro 500 sem feedback, falha de segurança ou build quebrando. **Bloqueia a aprovação imediatamente.**
- **IMPORTANTE:** Imagem sem atributo `alt`, contraste de cor insuficiente, falta de OpenGraph para compartilhamento em redes sociais ou falta de teste unitário. **Deve ser corrigido antes da finalização.**
- **MENOR:** Ajuste milimétrico de espaçamento, refatoração secundária de nomenclatura ou micro-otimização. Pode ser registrado no backlog para ajuste futuro.
