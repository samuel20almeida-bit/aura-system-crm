import { createClient } from "@/lib/supabase/server";

export function currentQuarter(date = new Date()) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${q}`;
}

export function quarterRange(quarter: string) {
  const [yearStr, qStr] = quarter.split("-Q");
  const year = Number(yearStr);
  const q = Number(qStr);
  const startMonth = (q - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 1);
  return { start, end };
}

export async function listGoals(quarter: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select("*, owner:profiles(id, full_name, initials)")
    .eq("quarter", quarter)
    .order("position");
  return data ?? [];
}

export type GoalRow = Awaited<ReturnType<typeof listGoals>>[number];
