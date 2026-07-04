# Prompt — Design System do App do Paciente (`/app`)

> Adaptado do prompt de pattern library do projeto SCSI. Executor: **Claude** (frontend).
> Momento de execução: primeira tarefa da fase de frontend do `/app` (Fase 3), podendo ser antecipado.
> Escopo: **apenas o app do paciente**. O painel `/admin` terá um design system próprio, denso/CRM, em outra rodada.

<system>
Você é um especialista em Design Systems para aplicações web mobile-first.
Sua função é sintetizar, a partir das referências visuais e da identidade da marca documentadas abaixo, um design system completo para o app do paciente — e materializá-lo como uma biblioteca viva de padrões dentro do próprio projeto Next.js + Tailwind CSS v4.
</system>

<context>
O app é usado diariamente por pacientes de uma consultoria de nutrição, no celular: registrar refeições, ver o saldo de kcal/macros do dia, alternar sugestões de receita geradas por IA, colar receitas externas para avaliação, acompanhar peso/fotos e acessar materiais.

**Identidade da marca (Manuela Giglio · Nutricionista) — fonte da verdade para cor:**
- Terracota ~`#BF6B2C` — cor de marca e ação primária
- Caramelo ~`#C89B62` — apoio, superfícies quentes
- Creme ~`#F2EADA` / `#EDE3CE` — fundos
- Tinta marrom-escura ~`#2B2622` — texto principal
- O logo usa serifa display elegante em caixa alta com tracking largo

**Referências visuais (síntese do que aproveitar de cada):**
1. **App de reserva de quadras (mobile) — REFERÊNCIA ESTRUTURAL PRINCIPAL:** fotografia full-bleed como protagonista, com scrim escuro e conteúdo sobreposto; camadas fluidas que se sobrepõem (foto → painel escuro → sheet claro com raio grande subindo por cima, via margem negativa); chips de seleção horizontais (datas, opções) com ativo contornado; grid de opções selecionáveis; CTA largo escuro na base ("Book now"); painéis escuros em tom quente com acento claro vibrante (no nosso caso: charcoal quente + caramelo/terracota, no deles: preto + lima).
2. **ASAGIRI (matcha, editorial):** o *clima tipográfico* — serifa display com itálico expressivo em palavras-chave; eyebrow labels em caps com tracking largo; stat blocks (valor grande serifado + label caps).
3. **VITALIS (nutrição/longevidade):** os *componentes do domínio* — tabs de refeição; lista com item ativo destacado; pills de tag com check; linhas de macro label-esquerda/valor-direita; barras de progresso de score.

**ATENÇÃO — cores das referências:** os verdes (matcha do ASAGIRI, oliva do VITALIS) **não fazem parte da paleta** — as referências 2 e 3 valem pela fluidez, tipografia e componentes, nunca pela cor. Superfícies escuras são **charcoal quente (~`#241D17`)**; acentos sobre escuro são caramelo/creme; ação é terracota. Verde só é admitido, discreto, em micro-elementos semânticos de sucesso (dot/badge pequeno), nunca em superfícies.

**Fotografia é o material principal do app:** toda receita exibida tem foto de alta qualidade (hero full-bleed no detalhe, thumbnail nos cards e listas). Gradientes são proibidos como decoração, mas **obrigatórios como scrim** sobre fotografia para garantir contraste do texto sobreposto. Protótipo visual de referência: `public/design-preview.html`.
</context>

<objective>
1. Definir os tokens do sistema em `src/app/globals.css` via `@theme` do Tailwind v4 (cores, fontes, raios, sombras). Nenhuma cor/fonte hardcoded fora dos tokens.
2. Criar a rota `src/app/design-system/page.tsx` (+ componentes locais na mesma pasta) como biblioteca viva: cada seção documenta e demonstra um padrão com exemplos renderizados de verdade, usando exatamente as classes Tailwind que o app de produção usará.
3. Re-estilizar as telas já existentes (login, troca de senha, shells) para o novo sistema, substituindo o emerald/zinc provisório da Fase 1.
</objective>

<hard_rules>
1. Interface 100% em português brasileiro.
2. Mobile-first: tudo projetado para ~390px; desktop é adaptação, não o contrário.
3. **Fluxo contínuo em camadas**: seções emendadas por sobreposição (foto → painel charcoal → sheet claro com raio grande subindo por margem negativa), sem grandes vazios; a respiração vem da alternância de superfícies (foto ↔ charcoal ↔ creme/branco), não de espaço em branco.
4. Tipografia: serifa display para títulos e valores de destaque (itálico como recurso expressivo pontual); sans para corpo e UI; labels/eyebrows em caixa alta com tracking largo.
5. NENHUM estilo inline; NENHUMA cor fora dos tokens `@theme`.
6. Todo componente com estados documentados lado a lado: default / hover / active / focus / disabled / loading / empty / error (os que se aplicarem).
7. Toda UI que dispara IA tem obrigatoriamente estado "processando" (skeleton/shimmer + mensagem) e estado de erro com botão "tentar de novo" — nunca um botão que trava esperando resposta.
8. Estados semânticos nutricionais são um sistema próprio (ver seção 2) — não reutilizar success/error genéricos para eles sem critério.
9. Contraste AA no mínimo; áreas de toque ≥ 44px; foco visível em todos os interativos.
10. Não incluir componentes fora do escopo do app do paciente (nada de tabela densa, paginação de admin, etc.).
11. Sem biblioteca de componentes; ícones via SVG inline consistente (traço fino, 1.5px).
</hard_rules>

<sections>
A página `/design-system` tem navegação fixa no topo com âncoras para:

**0 — Shell do App (clone de referência).** O frame real do `/app`: header compacto (saudação + data ou título + voltar), área de conteúdo contínua, bottom nav fixa com 4 destinos (Hoje · Diário · Progresso · Materiais). Demonstrar com conteúdo de exemplo real.

**1 — Tipografia.** Tabela de especificação com preview vivo + tamanho/linha: Título de página (serif) → Título de seção (serif, com variante itálica) → Título de card → Valor de destaque (serif, números grandes: kcal, peso) → Eyebrow/label (caps + tracking) → Corpo → Corpo pequeno → Helper/caption.

**2 — Cores, Superfícies e Estados.**
2.1 Interface: fundo creme, card branco-quente, painel escuro charcoal, foto com scrim, header/bottom-nav.
2.2 Semânticas de sistema: sucesso / alerta / erro / info / neutro-desabilitado — badge, mensagem inline e toast de cada.
2.3 **Semânticas nutricionais** (núcleo do produto): dentro da meta / próximo do limite / meta estourada / refeição pulada / não registrada — aplicadas em barra de progresso, badge de refeição e no card de saldo.
2.4 Estados de IA: processando (shimmer) / pronto / falhou (com retry) / limite diário atingido.
2.5 Superfícies: bordas, sombras (card, sheet, toast), overlay de bottom sheet, raios (escala rounded-xl → 3xl).

**3 — Navegação.** Bottom nav (ativo/inativo); header com voltar; tabs de refeição com underline no ativo (padrão VITALIS); chips de seleção horizontal com scroll (datas, opções de sugestão — padrão do app de quadras, com ativo contornado); âncoras/steps quando houver.

**4 — Formulários.** Input texto (default/focus/preenchido/erro/desabilitado, com label e helper); textarea (colar receita externa — com contador); campo de link; upload de foto (vazio/preview/enviando/erro); stepper de quantidade/porção; busca simples. Composição: 1 formulário completo de exemplo (registro livre de refeição).

**5 — Dados Nutricionais.**
5.1 Linhas de macro (label esquerda, valor direita, divisor sutil — padrão VITALIS).
5.2 Barras de progresso de kcal/macro com os estados nutricionais da seção 2.3.
5.3 **Painel de saldo do dia** (superfície charcoal quente, valores serifados em creme, barras em caramelo) — o componente-assinatura do app.
5.4 Stat blocks (peso atual, variação, aderência — padrão ASAGIRI).
5.5 Card de receita/refeição: imagem com overlay + badges, variante sem imagem, estado ativo/selecionado, fator de porção visível ("¾ da receita").
5.6 Card de veredito de receita externa: cabe / cabe com X% / não cabe — com motivo e ressalvas de ingredientes não mapeados.

**6 — Componentes de UI.** Botões: primário pill terracota (largo, CTA de base do fluxo) / secundário outline / ghost / destrutivo / desabilitado / loading — tamanhos e com ícone. Badges e pills de tag (com check — padrão VITALIS). Bottom sheet (mobile) para detalhe/confirmação. Toast (sucesso/erro). Skeleton/shimmer para cards e listas (estado de IA). Avatar/inicial do paciente. Empty states ilustrados com texto (dia sem registros, sem materiais, sem sugestões).

**7 — Layout e Espaçamento.** Grid do fluxo contínuo (padding lateral padrão, gaps entre cards, encosto entre seções); escala de espaçamento; largura máxima em desktop (coluna central ~480px para o /app); safe areas do bottom nav. 3 composições reais: tela "Hoje" completa, detalhe de refeição com sugestões, fluxo de avaliação de receita externa (incluindo estados processando e veredito).

**8 — Motion.** Transições de chips/tabs; entrada de bottom sheet; shimmer de IA; barra de progresso animando ao registrar; toast entrando/saindo; micro-feedback de tap. Durações e easings tokenizados; galeria demonstrando cada um. `prefers-reduced-motion` respeitado.

**9 — Ícones.** Set SVG inline (traço 1.5px): navegação (casa, diário, progresso, materiais), ações (câmera, colar/link, trocar, editar, check, retry), status (alerta, IA/faísca, relógio). Tamanhos 16/20/24 herdando cor do texto.
</sections>

<output_format>
- Tokens: `src/app/globals.css` (bloco `@theme`)
- Biblioteca viva: rota `src/app/design-system/page.tsx` (bloqueada em produção; disponível em dev)
- Re-skin das telas da Fase 1 no mesmo PR/commit ou em commit imediatamente seguinte
- `npm run build` verde; verificação visual em 390px e desktop antes de dar por concluído
</output_format>
