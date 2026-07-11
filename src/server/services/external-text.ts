const MAX_TEXT_LENGTH = 15000;

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

export async function fetchRecipePage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; NutriApp/1.0)" },
    });
    if (!res.ok) throw new Error(`A página respondeu ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Página sem conteúdo");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < 1_000_000) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    await reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks).toString("utf-8");
    const text = htmlToText(html);
    if (text.length < 100) throw new Error("Não consegui ler a receita nesse link — cole o texto direto");
    return text;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("O site demorou demais para responder — cole o texto da receita");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
