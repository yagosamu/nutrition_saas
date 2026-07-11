import { describe, expect, it } from "vitest";
import { htmlToText } from "./external-text";

describe("htmlToText", () => {
  it("remove tags, scripts e estilos e colapsa espaços", () => {
    const html = `<html><head><style>.x{color:red}</style><script>alert(1)</script></head>
      <body><h1>Bolo  de banana</h1><p>2 bananas</p><p>100g de aveia</p></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Bolo de banana");
    expect(text).toContain("100g de aveia");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
  });

  it("limita o tamanho da saída", () => {
    const html = `<p>${"x".repeat(50000)}</p>`;
    expect(htmlToText(html).length).toBeLessThanOrEqual(15000);
  });
});
