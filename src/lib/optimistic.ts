export type ColumnId = "todo" | "in_progress" | "done";
export type Columns<T> = Record<ColumnId, T[]>;

const COLUMN_IDS: ColumnId[] = ["todo", "in_progress", "done"];

export function reorderWithin<T extends { id: string }>(items: T[], activeId: string, overId: string): T[] {
  const from = items.findIndex((i) => i.id === activeId);
  const to = items.findIndex((i) => i.id === overId);
  if (from === -1 || to === -1) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function moveItem<T extends { id: string }>(
  columns: Columns<T>,
  itemId: string,
  toColumn: ColumnId,
  beforeItemId: string | null
): Columns<T> {
  const fromColumn = COLUMN_IDS.find((id) => columns[id].some((i) => i.id === itemId));
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
