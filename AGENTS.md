<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Projeto: App de Nutrição Personalizada

App web para consultoria de nutrição (< 50 pacientes): equipe define planos alimentares com metas de kcal/macros por refeição; uma camada de IA (Claude API) sugere, gera e avalia receitas sem nunca estourar essas metas.

**Documentos canônicos — leia antes de qualquer tarefa:**
- Requisitos (canônico): `docs/PRD.md` — em divergência entre documentos, vale o PRD
- Brief original: `PROJECT_BRIEF.md`
- Design aprovado: `docs/superpowers/specs/2026-07-03-nutrition-app-design.md`
- Plano da fase atual: `docs/superpowers/plans/2026-07-03-fase-1-fundacao.md`

## Divisão de trabalho entre agentes

- **Claude** — orquestrador: decisões com o usuário, planos, revisão de código e todo o **frontend**.
- **Codex** — executor de **backend**: implementa as tarefas marcadas `[CODEX]` nos planos, seguindo os passos na ordem escrita.

### Regras para o Codex

1. Execute somente tarefas marcadas `[CODEX]` no plano. Não crie nem altere páginas/componentes de UI (`src/app/**/page.tsx`, `layout.tsx`, componentes) — exceto quando a tarefa mandar explicitamente (ex.: route handlers em `src/app/api/`).
2. Siga os passos da tarefa **na ordem, sem pular os passos de teste** (TDD: teste falhando → implementação → teste passando → commit).
3. Não altere os contratos compartilhados (`src/lib/types.ts`, `src/lib/validation/*`, `src/types/next-auth.d.ts`) nem os testes existentes para "fazer passar" — se um contrato parecer errado, pare e reporte.
4. Cada tarefa termina cumprindo os **critérios de aceite** listados nela. Verifique um a um antes de dar por concluída.
5. Ao terminar (ou travar), escreva um resumo do que foi feito, decisões tomadas e qualquer desvio do plano — o Claude revisa antes de integrar.

## Princípios de arquitetura (todos os agentes)

- **A IA nunca calcula nutrição.** Valores nutricionais são sempre somados pelo sistema a partir de ingredientes verificados (tabela TACO). O LLM só seleciona, ranqueia e mapeia texto → ingredientes do banco.
- Lógica de negócio vive em `src/server/services/` como funções testáveis (dependências injetáveis); route handlers e server actions são finos.
- `src/server/auth/config.ts` é importado pelo `src/proxy.ts` (Next 16 renomeou `middleware` → `proxy`), que roda a cada request: nunca importe Prisma, bcrypt ou nada pesado nele.
- Snapshots imutáveis: registros históricos (`MealLog`) congelam macros no momento do registro.

## Convenções

- Commits pequenos e frequentes, mensagens em português, prefixos `feat:`/`chore:`/`test:`/`docs:`/`fix:`.
- **Nunca** commitar `.env` ou segredos; nunca logar senhas/hashes.
- Antes de encerrar qualquer tarefa: `npm run test` e `npm run build` devem passar.
- Zod v4 (sintaxe `z.email()`, não `z.string().email()`). Tailwind v4. Auth.js v5 (`next-auth@beta`).
- **Prisma 7** (não 6): generator `prisma-client` com output em `src/generated/prisma` (gitignorado), URL do banco em `prisma.config.ts` (não no schema), client via driver adapter `@prisma/adapter-pg`. Importe o client sempre de `src/server/db.ts` — nunca instancie `PrismaClient` direto fora dele.
- Windows/PowerShell no ambiente local — os comandos dos planos já estão nesse formato.
