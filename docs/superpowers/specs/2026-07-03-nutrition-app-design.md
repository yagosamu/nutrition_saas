# App de Nutrição Personalizada — Design Doc

**Data:** 2026-07-03
**Status:** Aprovado em brainstorming (seções 1–4 validadas com o usuário)
**Base de requisitos:** [PROJECT_BRIEF.md](../../../PROJECT_BRIEF.md)

## 1. Contexto e objetivo

App web único para a consultoria de nutrição (< 50 pacientes), substituindo ferramentas dispersas. O diferencial é uma camada de IA que sugere, gera e avalia receitas **sem nunca estourar as metas nutricionais** definidas pela equipe para cada refeição de cada paciente.

Dois públicos no mesmo app: **Admin/Equipe** (painel administrativo, todos com o mesmo nível de acesso no MVP) e **Paciente** (vê apenas os próprios dados).

## 2. Decisões resolvidas (questões em aberto do brief)

| Questão | Decisão |
|---|---|
| Precisão nutricional da IA | **Banco de ingredientes verificado** (importado da TACO/TBCA). Macros de receitas são sempre a soma dos ingredientes, calculada pelo sistema. O LLM nunca produz valores nutricionais — só mapeia texto para ingredientes do banco. |
| Reuso de receitas geradas pela IA | **Fila de curadoria.** Receita gerada/aprovada vale imediatamente para o paciente (status `PRIVATE`/`PENDING_REVIEW`); só entra no banco geral (`APPROVED`) após revisão da equipe no admin. |
| Modelagem da dieta base | `MealPlan` → `MealSlot` (refeições configuráveis com metas de kcal/macros por refeição) → `MealSlotItem` (itens prescritos). Saldo diário é um serviço calculado sobre os `MealLog`s do dia, não uma tabela. |
| Custo de IA | Limite diário configurável por paciente (padrão 10 operações caras/dia), prompt caching da Anthropic, sugestões persistidas e reutilizadas, modelos por tarefa (Haiku para extração, Sonnet para geração/ranqueamento), log de tokens/custo por chamada. |
| Hospedagem do app | Adiada. Design agnóstico de plataforma: nenhum recurso proprietário de host; worker é um processo Node comum. |

## 3. Arquitetura

**Monolito Next.js (App Router) + worker de IA**, no mesmo repositório, sem ferramenta de monorepo.

```
┌─────────────────────────────┐      ┌──────────────────────┐
│  Next.js App                │      │  Worker de IA        │
│  ├─ /admin  (equipe)        │      │  consome jobs:       │
│  ├─ /app    (paciente)      │─fila─│  · sugerir refeições │
│  ├─ Route Handlers (API)    │      │  · gerar receita     │
│  └─ Camada de serviços      │      │  · avaliar externa   │
└──────────────┬──────────────┘      └──────────┬───────────┘
               │                                │
        PostgreSQL (Render) ◄───────────────────┘
               │
        Cloudflare R2 (fotos, PDFs)      Claude API
```

- **Stack:** Next.js (App Router) + TypeScript, Tailwind CSS v4, PostgreSQL (Render), NextAuth (credenciais), Cloudflare R2, API Anthropic.
- **Fila:** `pg-boss` sobre o próprio PostgreSQL (retry, backoff, sem Redis). Migração futura para BullMQ é localizada se um dia for necessária.
- **Fluxo assíncrono:** requests de IA enfileiram job e respondem na hora; UI mostra estado "analisando…" e faz polling leve até o resultado. Nenhuma request HTTP espera o Claude.
- **Camada de serviços** (`src/server/services/`): toda lógica de negócio (cálculo nutricional, saldo diário, fator de porção, orçamento de IA, curadoria) vive fora de componentes e route handlers, testável isoladamente.
- **ORM:** Prisma (migrations, tipos gerados).
- **Worker:** processo Node comum (`node worker.js`), compartilhando a camada de serviços e o client Prisma com o app.

## 4. Modelagem de dados

Nomes em inglês no schema Prisma. Entidades por domínio:

### Identidade
- **User** — email, hash de senha, `role: ADMIN | PATIENT`, ativo/inativo. Equipe e pacientes na mesma tabela.
- **PatientProfile** — 1:1 com User paciente: nascimento, sexo, notas da equipe, `dailyAiLimit` (padrão 10).

### Nutrição
- **Ingredient** — nome, fonte (`TACO | TBCA | CUSTOM`), macros por 100 g (kcal, proteína, carboidrato, gordura, fibra), medidas caseiras opcionais. Populada por script de importação TACO/TBCA no setup.
- **Recipe** — nome, modo de preparo, rendimento, tipos de refeição adequados, `status: APPROVED | PENDING_REVIEW | PRIVATE`, origem (`TEAM | AI_GENERATED | EXTERNAL`), `patientId` opcional (receitas privadas/pendentes pertencem a um paciente até a curadoria aprovar). Totais nutricionais denormalizados (recalculados a cada edição de ingredientes) para busca rápida.
- **RecipeIngredient** — receita → ingrediente + quantidade em gramas.

### Plano alimentar
- **MealPlan** — 1 plano ativo por paciente; metas diárias totais (kcal + macros).
- **MealSlot** — refeição configurável (nome, ordem, horário aproximado) com meta de kcal e macros. É a unidade que a IA respeita.
- **MealSlotItem** — dieta base: ingrediente ou receita + quantidade prescrita pela equipe.

### Execução diária
- **MealLog** — um registro por refeição por dia: `status: COMPLETED | SKIPPED`, tipo (`PLAN | AI_SUGGESTION | EXTERNAL_RECIPE | FREE_ENTRY`), receita/porção usada ou kcal livre, **snapshot dos macros consumidos** (histórico imutável), observações, fotos (R2).
- **Saldo diário** — serviço, não tabela: soma dos MealLogs do dia contra as metas do MealPlan.

### IA
- **AiJob** — jobs da fila: tipo (`SUGGEST | GENERATE | EVALUATE_EXTERNAL`), paciente, input, status, resultado, tokens/custo. Fila (pg-boss), auditoria e contador do limite diário numa tabela só.
- **MealSuggestion** — sugestão para slot/dia: receita + fator de porção + snapshot dos macros resultantes. Paciente alterna entre sugestões sem nova chamada de IA.

### Acompanhamento
- **Assessment** — avaliação física, `source: TEAM | PATIENT` (equipe registra tudo; paciente, só peso). Medidas como colunas nulláveis (permite gráficos).
- **ProgressPhoto** — fotos de progresso (R2).
- **DiaryNote** — observação livre do paciente por dia (as por refeição ficam no MealLog).
- **Material** + **MaterialAssignment** — arquivo (R2) ou link; assignment nulo = todos os pacientes.

A linha do tempo de evolução é uma consulta consolidando Assessment, ProgressPhoto e aderência derivada dos MealLogs — sem tabela própria.

## 5. Fluxo de IA

Princípio: **a IA escolhe e mapeia; a matemática é sempre do sistema.** Toda saída do Claude é JSON estruturado (tool use) com referências a ingredientes do banco e quantidades — nunca valores nutricionais.

### 5.1 Sugestão de refeição (comum, barata)
1. SQL pré-filtra receitas `APPROVED` por tipo de refeição e viabilidade de escala (fator de porção ~0.5x–2x da meta).
2. Sistema calcula deterministicamente o fator de porção e valida tolerâncias (±5% kcal, ±10% por macro).
3. Claude recebe candidatas válidas + contexto (o que o paciente já comeu hoje, sugestões recentes) e apenas ranqueia e escolhe 3 por variedade.
4. Resultado persiste como `MealSuggestion`s; trocar de opção não chama IA.
5. Registro de refeição diferente do planejado atualiza o saldo, que entra no prompt das sugestões seguintes do dia.

### 5.2 Geração de receita nova
1. Claude recebe ingredientes disponíveis do banco (filtrados por tipo de refeição) + metas do slot; monta receita usando só IDs do banco + gramas.
2. Sistema soma macros. Fora da tolerância: tenta escala determinística; senão, devolve o erro ao Claude para ajustar (máx. 2 tentativas; falhou, informa o paciente).
3. Receita validada salva como `PRIVATE`/`PENDING_REVIEW` → vale para o paciente, entra na curadoria.

### 5.3 Avaliação de receita externa
1. Paciente cola texto ou link (worker baixa a página e extrai o texto).
2. Claude extrai ingredientes + quantidades e mapeia para o banco, sinalizando os sem correspondência confiável.
3. Sistema soma macros e calcula ajuste de porção para o slot alvo.
4. Veredito: *cabe como está* / *cabe comendo X% da receita* / *não cabe, e por quê*. Não mapeados viram ressalva e vão para lista da equipe cadastrar.
5. Receita usada pelo paciente vira `PRIVATE`/`PENDING_REVIEW` (como 5.2).

### 5.4 Controle de custo
- Fluxos 5.2 e 5.3 contam no `dailyAiLimit` do paciente.
- Prompt caching da Anthropic nos blocos estáveis (system prompt, lista de ingredientes).
- Haiku para extração/mapeamento; Sonnet para ranqueamento/geração. Configuração de modelos centralizada.
- `AiJob` registra tokens/custo → tela de consumo no admin.

## 6. Estrutura de páginas

### Admin (`/admin`, role ADMIN)
- Dashboard — visão geral dos pacientes
- Pacientes — lista, cadastro; perfil com abas: plano alimentar, avaliações, diário do paciente, materiais, evolução
- Editor de plano — refeições configuráveis, metas por refeição, dieta base
- Receitas — banco + fila de curadoria (aprovar/editar/rejeitar `PENDING_REVIEW`)
- Ingredientes — busca e cadastro manual
- Materiais globais
- Consumo de IA

### Paciente (`/app`, role PATIENT, mobile-first)
- **Hoje** — refeições do dia, saldo de kcal/macros restante, registro rápido
- Detalhe da refeição — dieta base, sugestões da IA (alternar opções), colar receita externa, registro livre, foto e observação
- Diário (histórico) · Progresso (peso, fotos, gráficos) · Meu plano · Materiais

## 7. Autenticação e storage

- **NextAuth**, provider de credenciais (email + senha), sessão JWT com role; middleware bloqueia `/admin` para não-admins e `/app` para não-pacientes.
- Pacientes cadastrados pela equipe com senha provisória (troca obrigatória no primeiro login). Reset de senha no MVP: equipe redefine pelo painel (sem fluxo de email).
- **R2:** bucket privado. Upload direto do navegador via URL pré-assinada; leitura via URLs assinadas de curta duração. Chaves com namespace `patients/{id}/...`.

## 8. Tratamento de erros

- Jobs de IA: retry automático com backoff (pg-boss); falha definitiva vira status visível com botão "tentar de novo".
- Validação com Zod em toda fronteira de API.
- Snapshot de macros no MealLog: histórico nunca muda retroativamente.

## 9. Testes

- **Núcleo determinístico** (soma nutricional, fator de porção, saldo diário, tolerâncias, orçamento de IA): cobertura unitária completa, TDD.
- **Pipeline de IA:** testes de integração com respostas do Claude mockadas (contrato JSON testável sem API).
- E2E fora do MVP.

## 10. Modelo de execução (orquestração)

Desenvolvimento com dois agentes:

- **Claude (orquestrador + frontend):** apoia as decisões com o usuário, escreve os planos de implementação, define contratos de interface, e implementa todo o frontend.
- **Codex (executor de backend):** implementa tarefas de backend seguindo instruções escritas pelo Claude.

Regras para os planos de implementação:
1. Cada tarefa é marcada como **frontend (Claude)** ou **backend (Codex)**.
2. Tarefas de backend são autocontidas: contrato de API (rotas, payloads, tipos), schema envolvido, critérios de aceite e testes esperados.
3. **Contratos primeiro:** tipos TypeScript compartilhados, schemas Zod e assinaturas de rotas são definidos antes das tarefas paralelas, para frontend e backend integrarem sem retrabalho.
4. Claude revisa o código entregue pelo Codex contra os critérios de aceite antes de integrar.

## 11. Fases de construção

Cada fase termina utilizável:

1. **Fundação** — scaffold Next.js, schema Prisma completo, auth com roles, importação TACO/TBCA.
2. **Admin core** — ingredientes, receitas, pacientes, editor de plano alimentar.
3. **App do paciente** — dieta base, registro de refeições com fotos, saldo diário (útil já sem IA).
4. **Camada de IA** — worker + fila pg-boss, os 3 fluxos, curadoria, limites de custo.
5. **Acompanhamento** — avaliações físicas, fotos de progresso, materiais, linha do tempo.

## 12. Fora de escopo do MVP

- Chat/mensageria dedicada (observações do diário são o canal informal).
- Hierarquia de permissões na equipe.
- Funcionalidades para público fora da base atual de pacientes.
- Fluxo de reset de senha por email.
- Testes E2E.
