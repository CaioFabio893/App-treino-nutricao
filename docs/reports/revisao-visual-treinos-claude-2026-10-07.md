# Revisão visual dos treinos — Claude e OpenCode

O dono pediu mais hierarquia e legibilidade no treino, diferenciação entre botões e informação, menos aparência quadrada e maior destaque no Check-in Diário. Depois pediu interromper a conferência e deixar testes com OpenCode, além de exportar apenas a parte visual para Claude.

Alterações locais, ainda não publicadas: WorkoutPlayer com CSS reescrito, superfícies distintas, prescrição separada dos campos editáveis, vídeo destacado, séries em duas colunas no celular, resultado com texto/cor, observações recolhíveis e histórico separado. StudentProgramsPage/ProgramDetail têm apresentação específica para treino; novo WorkoutPrescription substitui a tabela larga na visão do aluno. StudentLayout/student.css destacam Check-in Diário em âmbar, com ícone e Responder agora, em toda a área do aluno. Service worker v5 aguarda publicação.

Referências: https://www.hevyapp.com/features/track-workouts/ e https://www.strong.app/.

Uma prévia ilustrativa foi aberta antes de o dono pedir encerrar a conferência. Nenhum teste automatizado, typecheck, lint, build do app ou deploy foi executado nesta revisão. O servidor da prévia foi encerrado. Não presumir validação funcional ou aceite visual.

Pasta entregue: C:/Users/caiof/OneDrive/Desktop/Visual-Treino-Louise-para-Claude/. Contém ZIP, instrução ao Claude, arquivo único com seis folhas de estilo e 56 recortes JSX de apresentação, além de captura ilustrativa do check-in/topo do treino. Não é um projeto executável; exclui imports, definições de lógica, backend, credenciais e manipuladores de eventos. A instrução pede ao Claude devolver um prompt específico de implementação para melhorar a experiência visual.

Próximo passo: incorporar a orientação do Claude conforme pedido do dono. Testes, revisão funcional e publicação ficam com OpenCode. Conferir conservação dos registros locais, seletores/textos alterados, carga/repetições, resultado, notas, timers, vídeos, modalidade e responsividade. Persistência e APIs não foram redesenhadas.

Preservar alterações preexistentes em opencode.json e .opencode/. Nenhum commit ou push. O cache local .vite foi criado apenas pela prévia e não deve ser versionado.

## Direção visual do Claude aplicada no código

O dono enviou o prompt de implementação e autorizou aplicar as mudanças. Nesta etapa não foram executados testes, build, lint, typecheck, navegador ou deploy. Não houve commit/push.

Implementação:
- Um bloco de tokens --t-* na .stu-shell; cascata dos seletores do aluno consolidada, incluindo check-in/topbar/conteúdo/navegação. Regras compartilhadas/admin preexistentes preservadas.
- Check-in âmbar, ícone circular, chamada Responder agora com 52px no celular e cartão integralmente clicável, primeiro item do main, mesmo formulário.
- Cabeçalhos claros em Meus treinos/programa; faixa escura verde apenas no player, e Meus recordes como rótulo do botão de PRs.
- Player sem contêiner extra no celular, seletor A/B/C em grade até quatro treinos e faixa com scroll-snap a partir de cinco. Letra destacada; registro tem ponto e sublinhado.
- Modal de semana como painel inferior com alça e quatro colunas de chips, mantendo estado e handlers existentes.
- Modalidade segmentada e compacta após seleção, somente no ramo readOnly; apresentação administrativa mantida.
- Prescrição com quatro informações; ausência marcada com travessão e rótulo acessível no player. Consulta completa reaproveita o componente de prescrição existente, estilizado pelo módulo compartilhado de apresentação, sem alterar seus dados.
- Séries em uma linha com número, carga, repetições e botão de 88px; legenda única; estados Marcar/Feito/Falhou com texto, símbolo e cor. Campos/labels/aria/handlers existentes preservados.
- Vídeo com Assistir execução e ícones, mesmo iframe e comportamento. Observações/Cardio/AMRAP neutros, histórico em chips, sugestão verde.
- Cronômetros apresentados em grade quando há espaço; rodapé com salvar em largura total e nota mais simples sobre registros no aparelho.

A ordem relativa dos controles no DOM foi conservada; a ordem visual dos blocos informativos no corpo do exercício usa CSS order para atender à hierarquia solicitada. O OpenCode deve conferir leitura assistiva e visual juntas. As funções de cálculo, persistência, storageKey, props, estado, handlers e APIs permanecem sem mudança nesta etapa. Nenhum arquivo de backend foi editado. O service worker permanece na versão anterior, fora do escopo exclusivamente visual.

Validação e publicação ficam para OpenCode. Pontos de aceite: 360/390/430px, ausência de overflow da página, contraste, grade das séries, foco, botões de estado, vídeo, timer, PRs/semanas, preservação de registros e apresentação do ramo administrativo. Esta lista é orientação para os testes pendentes, não evidência de aprovação.
