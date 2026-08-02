"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { nextTaskCode } from "@/lib/data/tasks";

export async function createCategory(name: string) {
  const supabase = await createClient();
  const { data: maxPos } = await supabase
    .from("playbook_categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("playbook_categories")
    .insert({ name, position: (maxPos?.position ?? 0) + 1 })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/playbooks");
  return data;
}

export async function createPlaybook(input: {
  categoryId: string;
  name: string;
  type: string;
  estimatedDays: number | null;
  steps: string[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: playbook, error } = await supabase
    .from("playbooks")
    .insert({
      category_id: input.categoryId,
      name: input.name,
      type: input.type,
      estimated_days: input.estimatedDays,
      updated_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  if (input.steps.length > 0) {
    await supabase.from("playbook_steps").insert(
      input.steps.map((title, i) => ({ playbook_id: playbook.id, title, position: i }))
    );
  }

  revalidatePath("/playbooks");
  return playbook;
}

export async function addStep(playbookId: string, title: string) {
  const supabase = await createClient();
  const { data: maxPos } = await supabase
    .from("playbook_steps")
    .select("position")
    .eq("playbook_id", playbookId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("playbook_steps")
    .insert({ playbook_id: playbookId, title, position: (maxPos?.position ?? 0) + 1 });
  if (error) throw error;
  revalidatePath("/playbooks");
}

export async function deleteStep(stepId: string) {
  const supabase = await createClient();
  await supabase.from("playbook_steps").delete().eq("id", stepId);
  revalidatePath("/playbooks");
}

export async function runPlaybook(playbookId: string, clientId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: playbook }, { data: steps }] = await Promise.all([
    supabase.from("playbooks").select("*").eq("id", playbookId).single(),
    supabase.from("playbook_steps").select("*").eq("playbook_id", playbookId).order("position"),
  ]);
  if (!playbook || !steps || steps.length === 0) throw new Error("Playbook sem etapas");

  const { data: run, error: runError } = await supabase
    .from("playbook_runs")
    .insert({ playbook_id: playbookId, client_id: clientId, status: "in_progress" })
    .select()
    .single();
  if (runError) throw runError;

  await supabase
    .from("playbook_run_steps")
    .insert(steps.map((s) => ({ run_id: run.id, step_id: s.id, done: false })));

  const isInternal = !clientId;
  const code = await nextTaskCode(clientId, isInternal);
  const [prefix] = code.split("-");
  const { data: existing } = await supabase.from("tasks").select("code").ilike("code", `${prefix}-%`);
  let counter = existing?.length ?? 0;

  const taskRows = steps.map((s) => {
    counter += 1;
    return {
      code: `${prefix}-${String(counter).padStart(2, "0")}`,
      title: s.title,
      client_id: clientId,
      is_internal: isInternal,
      status: "todo" as const,
      priority: "medium",
      created_by: user?.id ?? null,
      description: `Gerado pelo playbook "${playbook.name}".`,
    };
  });
  await supabase.from("tasks").insert(taskRows);

  revalidatePath("/playbooks");
  revalidatePath("/kanban");
  return run;
}

export async function toggleRunStep(runStepId: string, done: boolean) {
  const supabase = await createClient();
  await supabase.from("playbook_run_steps").update({ done }).eq("id", runStepId);

  const { data: step } = await supabase.from("playbook_run_steps").select("run_id").eq("id", runStepId).single();
  if (step) {
    const { data: allSteps } = await supabase.from("playbook_run_steps").select("done").eq("run_id", step.run_id);
    const allDone = (allSteps ?? []).every((s) => s.done);
    await supabase
      .from("playbook_runs")
      .update({ status: allDone ? "done" : "in_progress", completed_at: allDone ? new Date().toISOString() : null })
      .eq("id", step.run_id);
  }

  revalidatePath("/playbooks");
}
