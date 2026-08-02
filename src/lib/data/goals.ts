import { createClient } from "@/lib/supabase/server";
import { currentQuarterInAppTz, quarterRangeInAppTz } from "@/lib/timezone";

export const currentQuarter = currentQuarterInAppTz;
export const quarterRange = quarterRangeInAppTz;

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
