"use client";

import { useEffect, useRef, useState } from "react";

type BaseItem = { id: string; name: string };

type InlineSearchProps<T extends BaseItem> = {
  endpoint: string; // ex: /api/admin/ingredients/search
  placeholder: string;
  excludeIds?: string[];
  onPick: (item: T) => void;
  autoFocus?: boolean;
};

export function InlineSearch<T extends BaseItem>({
  endpoint,
  placeholder,
  excludeIds = [],
  onPick,
  autoFocus,
}: InlineSearchProps<T>) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { items: T[] };
          setItems(data.items);
        }
      } catch {
        // busca abortada/offline — silencioso
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, endpoint]);

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-line-200 bg-cream-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
      {loading && (
        <span className="absolute right-3 top-2.5 text-xs text-ink-300">…</span>
      )}
      {items.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line-200 bg-cream-50 shadow-lg">
          {items.map((item) => {
            const excluded = excludeIds.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={excluded}
                  onClick={() => {
                    onPick(item);
                    setQuery("");
                    setItems([]);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-ink-900 hover:bg-brand-100 disabled:cursor-not-allowed disabled:text-ink-300"
                >
                  {item.name}
                  {excluded && " (já adicionado)"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {query.trim().length >= 2 && !loading && items.length === 0 && (
        <p className="absolute z-10 mt-1 w-full rounded-lg border border-line-200 bg-cream-50 px-3 py-2 text-sm text-ink-500 shadow-lg">
          Nada encontrado.
        </p>
      )}
    </div>
  );
}
