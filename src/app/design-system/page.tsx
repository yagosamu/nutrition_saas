import { notFound } from "next/navigation";
import { Icon, ICON_NAMES, type IconName } from "@/components/icons";

// Biblioteca viva de padrões do app do paciente.
// Cada exemplo usa exatamente as classes/tokens que o código de produção usa.
// Direção: docs/design/design-system-prompt.md · protótipo: public/design-preview.html

const SECTIONS = [
  ["shell", "0 · Shell"],
  ["tipografia", "1 · Tipografia"],
  ["cores", "2 · Cores e estados"],
  ["navegacao", "3 · Navegação"],
  ["formularios", "4 · Formulários"],
  ["dados", "5 · Dados nutricionais"],
  ["componentes", "6 · Componentes"],
  ["layout", "7 · Layout"],
  ["motion", "8 · Motion"],
  ["icones", "9 · Ícones"],
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-line-200 py-10">
      <h2 className="font-display text-xl font-semibold text-ink-900">{title}</h2>
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
      {children}
    </p>
  );
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[390px] max-w-full overflow-hidden rounded-[40px] border border-line-200 bg-cream-100 shadow-xl">
      {children}
    </div>
  );
}

// ---------- 5 · componentes de dados nutricionais ----------

function MacroRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line-200 py-2.5 text-sm last:border-0">
      <span className="text-ink-500">{label}</span>
      <span className="font-display text-base font-semibold text-ink-900">{value}</span>
    </div>
  );
}

function MacroBar({
  label,
  value,
  max,
  onDark,
}: {
  label: string;
  value: number;
  max: number;
  onDark?: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const over = pct > 100;
  return (
    <div>
      <div
        className={`mb-1 flex justify-between text-[11px] ${onDark ? "text-caramel-200" : "text-ink-500"}`}
      >
        <span>{label}</span>
        <span className={onDark ? "font-medium text-cream-100" : "font-medium text-ink-900"}>
          {value} / {max} g
        </span>
      </div>
      <div className={`h-1.5 rounded-full ${onDark ? "bg-charcoal-700" : "bg-cream-200"}`}>
        <div
          className={`h-full rounded-full ${over ? "bg-danger-600" : "bg-caramel-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function BalancePanel() {
  return (
    <div className="rounded-3xl bg-charcoal-900 p-5 text-cream-100">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-caramel-500">
        Saldo de hoje
      </p>
      <p className="mt-1 font-display text-4xl font-semibold tracking-tight">
        1.240 <span className="text-base font-normal text-caramel-200">kcal restantes de 1.800</span>
      </p>
      <div className="mt-4 space-y-3">
        <MacroBar label="Proteína" value={82} max={130} onDark />
        <MacroBar label="Carboidrato" value={96} max={180} onDark />
        <MacroBar label="Gordura" value={31} max={60} onDark />
      </div>
    </div>
  );
}

// ---------- 3/6 · navegação e componentes ----------

const NAV_ITEMS: { icon: IconName; label: string; active?: boolean; disabled?: boolean }[] = [
  { icon: "home", label: "Hoje", active: true },
  { icon: "book", label: "Diário" },
  { icon: "list", label: "Meu plano" },
  { icon: "chart", label: "Progresso", disabled: true },
];

function BottomNav() {
  return (
    <nav className="flex border-t border-line-200 bg-cream-50/95 px-2 pb-5 pt-2 backdrop-blur">
      {NAV_ITEMS.map((item) => (
        <span
          key={item.label}
          className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] ${
            item.active
              ? "font-semibold text-brand-500"
              : item.disabled
                ? "text-ink-300 opacity-50"
                : "text-ink-500"
          }`}
        >
          <Icon name={item.icon} size={20} />
          {item.label}
        </span>
      ))}
    </nav>
  );
}

function Chip({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        active
          ? "whitespace-nowrap rounded-full bg-caramel-200 px-4 py-2 text-xs font-semibold text-ink-900"
          : "whitespace-nowrap rounded-full border border-line-200 bg-cream-50 px-4 py-2 text-xs text-ink-500"
      }
    >
      {children}
    </span>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "over" | "muted" | "info";
  children: React.ReactNode;
}) {
  const classes = {
    ok: "bg-success-100 text-success-600",
    warn: "bg-caramel-200 text-ink-900",
    over: "bg-danger-100 text-danger-600",
    muted: "bg-cream-200 text-ink-300",
    info: "bg-brand-100 text-brand-600",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${classes}`}
    >
      {children}
    </span>
  );
}

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-dvh bg-cream-100 text-ink-900">
      <nav className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-line-200 bg-cream-50/95 px-4 py-3 backdrop-blur">
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs text-ink-500 hover:bg-brand-100 hover:text-brand-600"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="mx-auto max-w-4xl px-4 pb-24">
        <header className="pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-caramel-500">
            Manuela Giglio · Nutricionista
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            Design system do app do paciente
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            Biblioteca viva: cada exemplo renderiza com os tokens e classes de produção.
            Mobile-first (390 px), fluxo contínuo em camadas, fotografia como material —
            disponível apenas em desenvolvimento.
          </p>
        </header>

        {/* ============ 0 · SHELL ============ */}
        <Section id="shell" title="0 · Shell do app">
          <Phone>
            <div className="flex items-center justify-between px-5 pb-3 pt-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-caramel-500">
                  Sexta · 4 de julho
                </p>
                <p className="font-display text-2xl font-semibold">
                  Bom dia, <span className="text-brand-500">Ana</span>.
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-caramel-500 text-xs font-semibold text-charcoal-900">
                AN
              </span>
            </div>
            <div className="px-4">
              <BalancePanel />
            </div>
            <div className="mt-3 space-y-2 px-4 pb-4">
              <div className="flex items-center justify-between rounded-2xl border border-line-200 bg-cream-50 px-4 py-3">
                <div>
                  <p className="font-display text-base font-semibold">Café da manhã</p>
                  <p className="text-xs text-ink-500">418 kcal registradas</p>
                </div>
                <StatusBadge tone="ok">
                  <Icon name="check" size={12} /> na meta
                </StatusBadge>
              </div>
              <div className="rounded-2xl border-[1.5px] border-brand-500 bg-cream-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-display text-base font-semibold">Almoço</p>
                  <span className="text-xs text-ink-500">meta 650 kcal</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <span className="rounded-full bg-brand-500 px-4 py-1.5 text-xs font-semibold text-cream-50">
                    Registrar
                  </span>
                  <span className="rounded-full border border-line-200 px-3 py-1.5 text-xs text-ink-500">
                    Detalhes
                  </span>
                </div>
              </div>
            </div>
            <BottomNav />
          </Phone>
          <p className="text-xs text-ink-500">
            Camadas: saudação → painel de saldo (charcoal) → cards em creme → bottom nav.
            Sem grandes vazios; a respiração vem da alternância de superfícies.
          </p>
        </Section>

        {/* ============ 1 · TIPOGRAFIA ============ */}
        <Section id="tipografia" title="1 · Tipografia">
          <div className="divide-y divide-line-200 rounded-2xl border border-line-200 bg-cream-50">
            {(
              [
                ["Título de página", "font-display text-2xl font-semibold", "24 / 30 · Manrope 600"],
                ["Título de seção", "font-display text-xl font-semibold", "20 / 26 · Manrope 600"],
                ["Título de card", "font-display text-base font-semibold", "16 / 22 · Manrope 600"],
                ["Valor de destaque", "font-display text-4xl font-semibold tracking-tight", "36 / 40 · Manrope 600"],
                ["Eyebrow / label", "text-[11px] font-semibold uppercase tracking-[0.16em] text-caramel-500", "11 · caps + tracking"],
                ["Corpo", "text-sm", "14 / 20 · Inter 400"],
                ["Corpo pequeno", "text-xs text-ink-500", "12 / 16 · Inter 400"],
                ["Helper / caption", "text-[11px] text-ink-300", "11 / 14 · Inter 400"],
              ] as const
            ).map(([name, cls, spec]) => (
              <div key={name} className="flex items-baseline justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-ink-300">{name}</p>
                  <p className={`truncate ${cls}`}>Saldo de hoje: 1.240 kcal</p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-300">{spec}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-500">
            Destaque de palavra em título é por <span className="font-semibold text-brand-500">cor</span> —
            Manrope não tem itálico. Sobre escuro, o destaque usa caramelo.
          </p>
        </Section>

        {/* ============ 2 · CORES E ESTADOS ============ */}
        <Section id="cores" title="2 · Cores, superfícies e estados">
          <Label>2.1 · Interface</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Fundo do app", "bg-cream-100 border border-line-200", "cream-100"],
                ["Card", "bg-cream-50 border border-line-200", "cream-50"],
                ["Painel escuro", "bg-charcoal-900", "charcoal-900"],
                ["Ação / marca", "bg-brand-500", "brand-500"],
                ["Apoio quente", "bg-caramel-500", "caramel-500"],
                ["Destaque s/ escuro", "bg-caramel-200", "caramel-200"],
                ["Texto", "bg-ink-900", "ink-900"],
                ["Divisores", "bg-line-200", "line-200"],
              ] as const
            ).map(([name, cls, token]) => (
              <div key={token} className="overflow-hidden rounded-xl border border-line-200">
                <div className={`h-14 ${cls}`} />
                <div className="bg-cream-50 px-3 py-2">
                  <p className="text-xs font-medium">{name}</p>
                  <p className="text-[10px] text-ink-300">{token}</p>
                </div>
              </div>
            ))}
          </div>

          <Label>2.2 · Semânticas de sistema</Label>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone="ok">Sucesso</StatusBadge>
            <StatusBadge tone="warn">Atenção</StatusBadge>
            <StatusBadge tone="over">Erro</StatusBadge>
            <StatusBadge tone="info">Info</StatusBadge>
            <StatusBadge tone="muted">Neutro</StatusBadge>
          </div>
          <div className="space-y-2">
            <p className="rounded-xl bg-success-100 px-4 py-3 text-sm text-success-600">
              Refeição registrada.
            </p>
            <p className="rounded-xl bg-danger-100 px-4 py-3 text-sm text-danger-600">
              Não foi possível salvar. Tente de novo.
            </p>
          </div>

          <Label>2.3 · Semânticas nutricionais (núcleo do produto)</Label>
          <div className="space-y-4 rounded-2xl border border-line-200 bg-cream-50 p-5">
            <div>
              <p className="mb-1 text-xs text-ink-500">Dentro da meta (≤ 100%)</p>
              <MacroBar label="Proteína" value={82} max={130} />
            </div>
            <div>
              <p className="mb-1 text-xs text-ink-500">Meta estourada (&gt; 100%)</p>
              <MacroBar label="Gordura" value={74} max={60} />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <StatusBadge tone="ok">
                <Icon name="check" size={12} /> na meta
              </StatusBadge>
              <StatusBadge tone="over">estourou</StatusBadge>
              <StatusBadge tone="muted">pulada</StatusBadge>
              <StatusBadge tone="warn">não registrada</StatusBadge>
            </div>
          </div>

          <Label>2.4 · Estados de IA (toda ação de IA é assíncrona)</Label>
          <div className="space-y-2">
            <div className="flex animate-shimmer items-center gap-2 rounded-xl bg-cream-200 px-4 py-3 text-sm text-ink-500">
              <Icon name="sparkles" size={16} /> Gerando sugestões… você pode continuar navegando.
            </div>
            <div className="flex items-center justify-between rounded-xl bg-danger-100 px-4 py-3 text-sm text-danger-600">
              <span>A análise falhou.</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-danger-600 px-3 py-1 text-xs font-semibold">
                <Icon name="refresh" size={12} /> Tentar de novo
              </span>
            </div>
            <p className="rounded-xl bg-cream-200 px-4 py-3 text-sm text-ink-500">
              Você usou as 10 análises de IA de hoje — o limite zera à meia-noite.
            </p>
          </div>

          <Label>2.5 · Superfícies e raios</Label>
          <div className="flex flex-wrap items-end gap-4">
            <div className="h-16 w-24 rounded-xl border border-line-200 bg-cream-50 p-2 text-[10px] text-ink-300">
              rounded-xl
            </div>
            <div className="h-16 w-24 rounded-2xl border border-line-200 bg-cream-50 p-2 text-[10px] text-ink-300">
              rounded-2xl
            </div>
            <div className="h-16 w-24 rounded-3xl border border-line-200 bg-cream-50 p-2 text-[10px] text-ink-300">
              rounded-3xl
            </div>
            <div className="h-16 w-24 rounded-3xl bg-cream-50 p-2 text-[10px] text-ink-300 shadow-xl">
              shadow-xl (sheet)
            </div>
          </div>
        </Section>

        {/* ============ 3 · NAVEGAÇÃO ============ */}
        <Section id="navegacao" title="3 · Navegação">
          <Label>Bottom nav (ativo · padrão · desabilitado)</Label>
          <div className="max-w-sm overflow-hidden rounded-2xl border border-line-200">
            <BottomNav />
          </div>

          <Label>Header com voltar</Label>
          <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-line-200 bg-cream-50 px-4 py-3">
            <Icon name="arrowLeft" size={18} className="text-ink-500" />
            <div>
              <p className="font-display text-base font-semibold">Almoço</p>
              <p className="text-[11px] text-ink-300">meta 650 kcal · 45 g proteína</p>
            </div>
          </div>

          <Label>Tabs (underline no ativo)</Label>
          <div className="flex gap-5 border-b border-line-200 text-sm">
            <span className="border-b-2 border-brand-500 pb-2 font-semibold text-ink-900">
              Dieta base
            </span>
            <span className="pb-2 text-ink-500">Sugestões</span>
            <span className="pb-2 text-ink-500">Receita externa</span>
          </div>

          <Label>Chips de seleção (scroll horizontal)</Label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip active>Sugestão 1</Chip>
            <Chip>Sugestão 2</Chip>
            <Chip>Sugestão 3</Chip>
            <Chip>
              <Icon name="refresh" size={12} className="inline" />
            </Chip>
          </div>
        </Section>

        {/* ============ 4 · FORMULÁRIOS ============ */}
        <Section id="formularios" title="4 · Formulários">
          <div className="grid max-w-sm gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Padrão
              <input
                placeholder="Descreva o que você comeu"
                className="rounded-xl border border-line-200 bg-cream-50 px-4 py-3 text-sm placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Com erro
              <input
                defaultValue="—"
                className="rounded-xl border border-danger-600 bg-cream-50 px-4 py-3 text-sm"
              />
              <span className="text-xs text-danger-600">Informe as calorias estimadas.</span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-300">
              Desabilitado
              <input
                disabled
                placeholder="Indisponível"
                className="rounded-xl border border-line-200 bg-cream-200 px-4 py-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Observações (com contador)
              <textarea
                rows={3}
                defaultValue="Almocei fora hoje."
                className="rounded-xl border border-line-200 bg-cream-50 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
              />
              <span className="self-end text-[11px] text-ink-300">18 / 1000</span>
            </label>
            <div>
              <p className="mb-1 text-sm font-medium">Stepper de porção</p>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ["¾", "485"],
                    ["1", "516"],
                    ["1¼", "645", true],
                    ["1½", "774"],
                  ] as const
                ).map(([portion, kcal, active]) => (
                  <div
                    key={portion}
                    className={`rounded-2xl border px-2 py-2.5 text-center ${
                      active
                        ? "border-[1.5px] border-ink-900 bg-cream-200 text-ink-900"
                        : "border-line-200 text-ink-500"
                    }`}
                  >
                    <p className="font-display text-lg font-semibold">{portion}</p>
                    <p className="text-[10px]">{kcal} kcal</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ============ 5 · DADOS NUTRICIONAIS ============ */}
        <Section id="dados" title="5 · Dados nutricionais">
          <Label>5.1 · Linhas de macro</Label>
          <div className="max-w-sm rounded-2xl border border-line-200 bg-cream-50 px-5 py-2">
            <MacroRow label="Calorias" value="645 kcal" />
            <MacroRow label="Proteína" value="48 g" />
            <MacroRow label="Carboidrato" value="52 g" />
            <MacroRow label="Gordura" value="18 g" />
          </div>

          <Label>5.3 · Painel de saldo do dia (componente-assinatura)</Label>
          <div className="max-w-sm">
            <BalancePanel />
          </div>

          <Label>5.4 · Stat blocks</Label>
          <div className="flex max-w-sm gap-6 rounded-2xl border border-line-200 bg-cream-50 px-5 py-4">
            {(
              [
                ["72,4", "kg atual"],
                ["-1,2", "kg no mês"],
                ["86%", "aderência"],
              ] as const
            ).map(([value, label]) => (
              <div key={label}>
                <p className="font-display text-2xl font-semibold">{value}</p>
                <p className="text-[10px] uppercase tracking-wider text-ink-300">{label}</p>
              </div>
            ))}
          </div>

          <Label>5.5 · Card de refeição/receita (foto entra com o R2 — placeholder padronizado)</Label>
          <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-line-200 bg-cream-50 p-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-caramel-200 text-caramel-500">
              <Icon name="camera" size={20} className="text-ink-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-semibold">
                Frango grelhado com legumes
              </p>
              <p className="text-xs text-ink-500">1¼ porção · 645 kcal</p>
            </div>
            <StatusBadge tone="ok">
              <Icon name="check" size={12} /> na meta
            </StatusBadge>
          </div>

          <Label>5.6 · Veredito de receita externa (3 estados)</Label>
          <div className="max-w-sm space-y-2">
            <div className="rounded-2xl border border-success-600/30 bg-success-100 px-4 py-3">
              <p className="text-sm font-semibold text-success-600">Cabe como está ✓</p>
              <p className="text-xs text-ink-500">612 kcal — dentro da meta do seu jantar.</p>
            </div>
            <div className="rounded-2xl border border-line-200 bg-caramel-200/60 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Cabe comendo ¾ da receita</p>
              <p className="text-xs text-ink-500">
                Porção inteira estoura 180 kcal. Ressalva: “queijo coalho” estimado sem
                correspondência exata na tabela.
              </p>
            </div>
            <div className="rounded-2xl border border-danger-600/30 bg-danger-100 px-4 py-3">
              <p className="text-sm font-semibold text-danger-600">Não cabe hoje</p>
              <p className="text-xs text-ink-500">
                A gordura estoura mesmo na porção mínima. Que tal guardar para o almoço de amanhã?
              </p>
            </div>
          </div>
        </Section>

        {/* ============ 6 · COMPONENTES ============ */}
        <Section id="componentes" title="6 · Componentes de UI">
          <Label>Botões</Label>
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-cream-50 transition hover:bg-brand-600">
              Registrar almoço
            </button>
            <button className="rounded-full border border-line-200 px-5 py-3 text-sm text-ink-500 hover:border-brand-500 hover:text-brand-600">
              Dieta base
            </button>
            <button className="rounded-full px-4 py-3 text-sm text-brand-600 hover:bg-brand-100">
              ghost
            </button>
            <button className="rounded-full bg-danger-600 px-5 py-3 text-sm font-semibold text-cream-50">
              Desfazer
            </button>
            <button disabled className="rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-cream-50 opacity-50">
              Salvando…
            </button>
            <button className="rounded-full bg-charcoal-900 px-6 py-3 text-sm font-semibold text-cream-100">
              CTA sobre claro
            </button>
          </div>

          <Label>Skeleton / shimmer (carregamento de IA)</Label>
          <div className="max-w-sm animate-shimmer space-y-2 rounded-2xl border border-line-200 bg-cream-50 p-4">
            <div className="h-4 w-2/3 rounded bg-cream-200" />
            <div className="h-3 w-full rounded bg-cream-200" />
            <div className="h-3 w-5/6 rounded bg-cream-200" />
          </div>

          <Label>Toast</Label>
          <div className="flex max-w-sm items-center gap-2 rounded-2xl bg-charcoal-900 px-4 py-3 text-sm text-cream-100 shadow-xl">
            <Icon name="check" size={16} className="text-caramel-200" /> Refeição registrada
          </div>

          <Label>Bottom sheet (confirmações no mobile)</Label>
          <div className="relative h-64 max-w-sm overflow-hidden rounded-[32px] border border-line-200 bg-ink-900/40">
            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-cream-50 p-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-200" />
              <p className="font-display text-lg font-semibold">Pular o lanche?</p>
              <p className="mt-1 text-sm text-ink-500">
                A refeição fica marcada como pulada e não conta no saldo.
              </p>
              <div className="mt-4 flex gap-2">
                <span className="flex-1 rounded-full bg-brand-500 py-2.5 text-center text-sm font-semibold text-cream-50">
                  Pular
                </span>
                <span className="flex-1 rounded-full border border-line-200 py-2.5 text-center text-sm text-ink-500">
                  Cancelar
                </span>
              </div>
            </div>
          </div>

          <Label>Empty state</Label>
          <div className="max-w-sm rounded-3xl border border-dashed border-line-200 bg-cream-50 px-6 py-8 text-center">
            <Icon name="sparkles" size={24} className="mx-auto text-caramel-500" />
            <p className="mt-2 font-display text-base font-semibold">
              Seu plano está sendo preparado
            </p>
            <p className="mt-1 text-sm text-ink-500">
              A equipe já está montando suas refeições. Volte em breve!
            </p>
          </div>
        </Section>

        {/* ============ 7 · LAYOUT ============ */}
        <Section id="layout" title="7 · Layout e espaçamento">
          <ul className="list-inside list-disc space-y-1 text-sm text-ink-500">
            <li>Coluna do app: <code className="text-ink-900">max-w-md mx-auto</code>; padding lateral 16 px; <code className="text-ink-900">pb-24</code> para a bottom nav.</li>
            <li>Camadas sobrepostas: painel/sheet sobe com <code className="text-ink-900">-mt-6 rounded-t-3xl</code> sobre a superfície anterior.</li>
            <li>Gap entre cards: 8–12 px; entre seções: 16–24 px — nunca mais que isso (fluxo denso).</li>
            <li>Toque mínimo 44 px; inputs com <code className="text-ink-900">py-3</code> no mobile.</li>
          </ul>
          <Label>Composição de camadas (foto → charcoal → sheet)</Label>
          <div className="w-[280px] overflow-hidden rounded-3xl border border-line-200">
            <div className="flex h-24 items-end bg-caramel-500 p-3">
              <p className="font-display text-sm font-semibold text-cream-50">
                Foto full-bleed + scrim
              </p>
            </div>
            <div className="-mt-4 rounded-t-3xl bg-charcoal-900 p-4 pb-8">
              <p className="text-xs text-caramel-200">Painel escuro sobreposto</p>
            </div>
            <div className="-mt-4 rounded-t-3xl bg-cream-50 p-4">
              <p className="text-xs text-ink-500">Sheet claro por cima</p>
            </div>
          </div>
        </Section>

        {/* ============ 8 · MOTION ============ */}
        <Section id="motion" title="8 · Motion">
          <ul className="list-inside list-disc space-y-1 text-sm text-ink-500">
            <li><code className="text-ink-900">transition</code> padrão (150 ms ease) em hover/tap de botões e chips.</li>
            <li><code className="text-ink-900">animate-shimmer</code> (token <code className="text-ink-900">--animate-shimmer</code>, 1.6 s) exclusivo de estados de IA/carregamento.</li>
            <li>Barras de progresso animam largura com <code className="text-ink-900">transition-[width] duration-500</code> ao registrar.</li>
            <li><code className="text-ink-900">prefers-reduced-motion</code> desliga tudo globalmente (ver globals.css).</li>
          </ul>
          <div className="flex max-w-sm items-center gap-4">
            <div className="h-1.5 flex-1 rounded-full bg-cream-200">
              <div className="h-full w-2/3 rounded-full bg-caramel-500 transition-[width] duration-500" />
            </div>
            <span className="animate-shimmer text-sm text-ink-500">analisando…</span>
          </div>
        </Section>

        {/* ============ 9 · ÍCONES ============ */}
        <Section id="icones" title="9 · Ícones">
          <p className="text-sm text-ink-500">
            SVG inline, traço 1.5 px, herdam a cor do texto. Tamanhos 16 / 20 / 24.
          </p>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
            {ICON_NAMES.map((name) => (
              <div
                key={name}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-line-200 bg-cream-50 py-3"
              >
                <Icon name={name} size={20} />
                <span className="text-[10px] text-ink-300">{name}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
