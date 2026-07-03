# App de Nutrição Personalizada — Brief de Início de Projeto

## Contexto e objetivo

Sou nutricionista e quero substituir minha atual colcha de retalhos de ferramentas (uma
para plano alimentar, outra para feedback, Drive para avaliações físicas e materiais) por
um único aplicativo web voltado inicialmente **apenas para os pacientes da minha
consultoria** (grupo pequeno, menos de 50 pacientes, sem pressa de prazo — o objetivo é
validar a experiência antes de pensar em qualquer expansão).

## O problema central que este app resolve

Mesmo entregando planos alimentares com opções de substituição, os pacientes sentem falta
de variedade. Eles encontram receitas na internet e perguntam se cabem na dieta, e eu não
consigo cadastrar manualmente uma quantidade praticamente infinita de receitas. O
diferencial deste app é uma camada de IA que trabalha **em cima da estrutura nutricional
que eu (ou minha equipe) já defini para cada paciente** — sugerindo e adaptando receitas
sem nunca estourar as metas daquela refeição.

## Stack técnica (decidida)

- **Frontend:** Next.js (App Router) + TypeScript
- **UI:** Tailwind CSS v4
- **Banco de dados:** PostgreSQL hospedado no Render
- **Autenticação:** NextAuth.js (Auth.js) — logins individuais para pacientes e para
  usuários internos (nutricionista + equipe)
- **Storage de arquivos:** Cloudflare R2 (compatível com S3) — fotos do diário alimentar,
  fotos de progresso, materiais de apoio em PDF/imagem
- **IA:** API da Anthropic (Claude) para geração/seleção/adaptação de receitas e para
  interpretar receitas externas coladas pelo paciente

## Papéis de usuário

1. **Admin/Equipe** (nutricionista + colaboradores) — acesso ao painel administrativo.
   Todos com o mesmo nível de acesso no MVP (sem hierarquia de permissões refinada por
   enquanto).
2. **Paciente** — acesso ao app do paciente, vê apenas seus próprios dados.

## Funcionalidades do MVP

### 1. Gestão de plano alimentar (painel admin)
- Cadastro de paciente com login individual.
- Definição de metas calóricas totais e distribuição de calorias/macros por refeição
  (café da manhã, almoço, lanche, jantar etc. — refeições configuráveis por paciente).
- Exibição para o paciente da dieta base montada pela equipe.

### 2. Banco de receitas + sugestões por IA
- Equipe mantém um banco de receitas (ingredientes, modo de preparo, informações
  nutricionais) que cresce ao longo do tempo.
- Para cada refeição do paciente, a IA seleciona receitas do banco compatíveis com as
  calorias/macros daquela refeição e **ajusta porções** quando necessário para bater os
  valores-alvo.
- Paciente pode trocar entre diferentes opções sugeridas sem sair dos parâmetros
  definidos pela equipe.
- Quando o banco não tem opção adequada, a IA pode gerar uma sugestão nova (a definir se
  entra automaticamente no banco para reuso — ver "Questões em aberto").

### 3. Avaliação de receitas externas (trazidas pelo paciente)
- Paciente cola um link ou o texto de uma receita encontrada na internet.
- IA extrai/calcula informações nutricionais, ajusta a porção para caber na refeição-alvo
  e informa se (e como) ela se encaixa na dieta.

### 4. Adaptação dinâmica ao longo do dia
- Paciente registra o que de fato realizou em cada refeição: a opção sugerida, uma
  alternativa validada pela IA, uma receita externa aprovada, um registro livre de
  calorias, ou "não realizei esta refeição".
- A cada registro, o app recalcula o saldo de calorias/macros restante do dia.
- A IA passa a considerar esse saldo atualizado ao sugerir as próximas refeições do
  mesmo dia.

### 5. Diário alimentar
- Registro de refeições com fotos.
- Campo de observações do paciente por refeição/dia (serve também como canal de
  feedback informal para a equipe — sem chat dedicado no MVP).

### 6. Avaliações físicas
- Equipe registra dados formais de avaliação (peso, medidas, bioimpedância etc.) no
  painel admin.
- Paciente também pode registrar peso e fotos de progresso entre consultas.

### 7. Materiais de apoio
- Equipe faz upload de materiais (PDFs, imagens, links) associados a um paciente ou a
  todos.
- Paciente acessa esses materiais dentro do app.

### 8. Histórico de evolução
- Linha do tempo consolidando avaliações físicas, fotos de progresso e aderência ao
  plano ao longo do tempo.

## Fora do escopo do MVP

- Chat/mensageria dedicada entre paciente e nutricionista.
- Hierarquia de permissões entre membros da equipe.
- Qualquer funcionalidade voltada a público geral fora da base atual de pacientes.

## Questões em aberto para decidir no início do desenvolvimento

1. **Precisão nutricional da IA:** como validar/computar macros de forma confiável (ex:
   API de dados nutricionais como referência) em vez de confiar cegamente no que o LLM
   "calcula"?
2. **Reuso de receitas geradas pela IA:** quando a IA cria uma receita nova (banco
   insuficiente ou receita externa aprovada), ela deve ser salva automaticamente no banco
   geral para reuso futuro, ou fica só associada àquele paciente/momento?
3. **Modelagem da dieta base:** estrutura de dados para "meta calórica por refeição" que
   suporte tanto refeições fixas quanto o recálculo dinâmico do saldo diário.
4. **Custo de IA:** estratégia de cache/limite de chamadas à API da Anthropic para manter
   custo previsível com o volume de pacientes esperado.

## Próximo passo

Este documento é a base de requisitos. O próximo passo é transformar isso em um plano de
implementação técnico (arquitetura de dados, estrutura de páginas, contratos de API,
modelagem do fluxo de IA) antes de começar a escrever código.
