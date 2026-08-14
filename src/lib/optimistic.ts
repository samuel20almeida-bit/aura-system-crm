/**
 * Movimento otimista entre colunas, genérico no conjunto de colunas.
 *
 * Era fixo em `"todo" | "in_progress" | "done"` até o Pipeline precisar de
 * cinco colunas diferentes (`negocio_estagio`). Generalizar aqui, em vez de
 * copiar um segundo módulo quase idêntico para o Pipeline, é o mesmo raciocínio
 * que já se aplicou ao cálculo de dias de calendário: duas implementações do
 * mesmo mecanismo divergem com o tempo.
 */
export type Columns<T, C extends string = string> = Record<C, T[]>;

export function reorderWithin<T extends { id: string }>(items: T[], activeId: string, overId: string): T[] {
  const from = items.findIndex((i) => i.id === activeId);
  const to = items.findIndex((i) => i.id === overId);
  if (from === -1 || to === -1) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Coluna que contém `id`, ou `null` se nenhuma contém. */
export function findColumnIn<T extends { id: string }, C extends string>(
  columns: Columns<T, C>,
  columnIds: readonly C[],
  id: string
): C | null {
  for (const col of columnIds) {
    if (columns[col].some((item) => item.id === id)) return col;
  }
  return null;
}

export function moveItem<T extends { id: string }, C extends string>(
  columns: Columns<T, C>,
  columnIds: readonly C[],
  itemId: string,
  toColumn: C,
  beforeItemId: string | null
): Columns<T, C> {
  const fromColumn = columnIds.find((id) => columns[id].some((i) => i.id === itemId));
  if (!fromColumn) return columns;

  if (fromColumn === toColumn && beforeItemId) {
    return { ...columns, [toColumn]: reorderWithin(columns[toColumn], itemId, beforeItemId) };
  }

  const item = columns[fromColumn].find((i) => i.id === itemId)!;
  const stripped = columns[fromColumn].filter((i) => i.id !== itemId);
  const target = fromColumn === toColumn ? stripped : [...columns[toColumn]];
  const insertAt = beforeItemId ? target.findIndex((i) => i.id === beforeItemId) : -1;
  const next = [...target];
  next.splice(insertAt === -1 ? next.length : insertAt, 0, item);

  return { ...columns, [fromColumn]: stripped, [toColumn]: next };
}
