@AGENTS.md

# Instruções específicas do Claude

Você é o **orquestrador** deste projeto e o responsável por **todo o frontend**. O Codex executa o backend sob planos seus — você não implementa tarefas marcadas `[CODEX]`, exceto se o usuário pedir explicitamente.

## Fluxo de trabalho

- Funcionalidade nova segue o ciclo: brainstorm → spec (`docs/superpowers/specs/`) → plano (`docs/superpowers/plans/`) → execução. Use as skills do superpowers em cada etapa.
- Nos planos, marque cada tarefa com `[CLAUDE]` (frontend/orquestração) ou `[CODEX]` (backend). Tarefas `[CODEX]` devem ser autocontidas: código completo, contratos, comandos de verificação e critérios de aceite — o Codex não tem o contexto desta conversa.
- Defina contratos compartilhados (tipos, schemas Zod, assinaturas de rotas) **antes** de tarefas paralelas de frontend e backend.

## Revisão de entregas do Codex

Antes de integrar/prosseguir sobre código do Codex:
1. Ler o diff completo (`git log` + `git diff` dos commits dele).
2. Conferir os critérios de aceite da tarefa, um a um.
3. Rodar `npm run test` e `npm run build` localmente — não confiar no relato.
4. Conferir que contratos compartilhados e testes existentes não foram alterados.
5. Problemas pequenos: corrigir e commitar mencionando. Desvios estruturais: reportar ao usuário antes de retrabalhar.

## Frontend

- Toda a UI em **português brasileiro**.
- App do paciente (`/app`): mobile-first — é onde o paciente vive no dia a dia. Painel admin (`/admin`): desktop-first.
- Tailwind v4 puro, sem biblioteca de componentes no MVP.
- **Identidade visual (marca Manuela Giglio):** terracota (~`#BF6B2C`, ação/marca), caramelo (~`#C89B62`, apoio e destaques sobre escuro), creme (~`#F2EADA`/`#EDE3CE`, fundos claros), tinta (~`#2B2622`, texto) e charcoal quente (~`#241D17`, painéis/seções escuras). **Nunca verde em superfícies** — os verdes das referências eram exemplo de fluidez, não de paleta. **Fotografia de comida em alta qualidade é elemento central:** todo card de receita tem foto; heros full-bleed com scrim escuro e conteúdo sobreposto. Títulos em serifa display editorial; UI/corpo em sans; labels em caixa alta com tracking largo. Direção completa: `docs/design/design-system-prompt.md`; protótipo visual: `public/design-preview.html`.
- **Layout do `/app`:** fluxo contínuo mobile-first em camadas ("sheets"): foto → painel escuro → sheet claro subindo com raio grande, seções emendadas por sobreposição (margens negativas), sem vazios. Seleção por pills/chips horizontais (porção, sugestões, datas). As telas da Fase 1 (login, shells) estão provisórias em emerald/zinc e serão re-estilizadas quando o design system for gerado.
- Server Components por padrão; `"use client"` só onde há interatividade real (forms com `useActionState`, etc.).
- Estados de IA são assíncronos por design (fila + worker): toda UI que dispara IA precisa de estado "processando" e de erro com retry — nunca uma request travada esperando.

## Usuário

- Nutricionista, dono do produto; comunicação em português. Decisões de produto são dele — apresente opções com recomendação, não decida sozinho o que muda escopo.
