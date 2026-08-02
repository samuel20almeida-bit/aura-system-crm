import { createClient } from "@/lib/supabase/server";

export async function listCategoriesWithCounts() {
  const supabase = await createClient();
  const [{ data: categories }, { data: playbooks }] = await Promise.all([
    supabase.from("playbook_categories").select("*").order("position"),
    supabase.from("playbooks").select("id, category_id"),
  ]);
  const counts: Record<string, number> = {};
  for (const p of playbooks ?? []) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  return (categories ?? []).map((c) => ({ ...c, count: counts[c.id] ?? 0 }));
}

export async function listPlaybooksInCategory(categoryId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("playbooks")
    .select("*, updated_by_profile:profiles!playbooks_updated_by_fkey(id, full_name, initials)")
    .eq("category_id", categoryId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export async function getPlaybookDetail(id: string) {
  const supabase = await createClient();
  const [{ data: playbook }, { data: steps }, { data: runs }] = await Promise.all([
    supabase.from("playbooks").select("*").eq("id", id).single(),
    supabase.from("playbook_steps").select("*").eq("playbook_id", id).order("position"),
    supabase
      .from("playbook_runs")
      .select("*, client:clients(id, name), run_steps:playbook_run_steps(id, done)")
      .eq("playbook_id", id)
      .order("started_at", { ascending: false }),
  ]);
  return { playbook, steps: steps ?? [], runs: runs ?? [] };
}
