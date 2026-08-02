"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";

export async function createGoal(input: {
  quarter: string;
  area: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  ownerId: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: maxPos } = await supabase
    .from("goals")
    .select("position")
    .eq("quarter", input.quarter)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("goals").insert({
    quarter: input.quarter,
    area: input.area,
    title: input.title,
    target: input.target,
    current: input.current,
    unit: input.unit,
    owner_id: input.ownerId,
    position: (maxPos?.position ?? 0) + 1,
  });
  if (error) throw error;

  await logActivity(supabase, user?.id ?? null, "criou a meta", input.title);
  revalidatePath("/metas");
}

export async function updateGoalProgress(goalId: string, current: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").update({ current }).eq("id", goalId);
  if (error) throw error;
  revalidatePath("/metas");
}

export async function deleteGoal(goalId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw error;
  revalidatePath("/metas");
}
