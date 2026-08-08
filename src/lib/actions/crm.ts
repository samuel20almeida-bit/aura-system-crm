"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { slugPrefix } from "@/lib/format";

const PALETTE = ["#0B6B54", "#8FA8B8", "#C99A4E", "#3E5C8C", "#B4552F", "#6C6A9E"];

async function uniquePrefix(name: string) {
  const supabase = await createClient();
  const base = slugPrefix(name) || "CLI";
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    // Sem conferir o erro, uma consulta que falha devolve data nulo e o código
    // concluía que o prefixo estava LIVRE — gravando um code_prefix duplicado.
    // Como os códigos de tarefa derivam do prefixo, dois clientes passariam a
    // gerar códigos colidentes. .limit(1) evita que o próprio duplicado
    // (se já existir um) faça o maybeSingle() estourar.
    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .ilike("code_prefix", candidate)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  return `${base}${Date.now() % 1000}`;
}

export async function createClientRecord(input: {
  name: string;
  segment?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  ownerId?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const codePrefix = await uniquePrefix(input.name);
  const { count } = await supabase.from("clients").select("id", { count: "exact", head: true });
  const color = PALETTE[(count ?? 0) % PALETTE.length];

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name: input.name,
      code_prefix: codePrefix,
      color,
      segment: input.segment ?? null,
      contact_name: input.contactName ?? null,
      contact_email: input.contactEmail ?? null,
      contact_phone: input.contactPhone ?? null,
      owner_id: input.ownerId ?? user?.id ?? null,
      client_since: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (error) throw error;

  await logActivity(supabase, user?.id ?? null, "adicionou o cliente", client.name);
  revalidatePath("/crm");
  return client;
}

export async function updateClient(
  id: string,
  patch: Partial<{
    name: string;
    segment: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    status: string;
    notes: string | null;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(patch).eq("id", id);
  if (error) throw error;
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
}

export async function createContract(input: {
  clientId: string;
  name: string;
  contractType: string;
  value: number | null;
  startDate: string | null;
  endDate: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("contracts").insert({
    client_id: input.clientId,
    name: input.name,
    contract_type: input.contractType,
    value: input.value,
    start_date: input.startDate,
    end_date: input.endDate,
  });
  if (error) throw error;
  revalidatePath(`/crm/${input.clientId}`);
}

export async function createInvoice(input: {
  clientId: string;
  referencePeriod: string;
  dueDate: string;
  amount: number;
  status: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").insert({
    client_id: input.clientId,
    reference_period: input.referencePeriod,
    due_date: input.dueDate,
    amount: input.amount,
    status: input.status,
    paid_at: input.status === "paid" ? new Date().toISOString().slice(0, 10) : null,
  });
  if (error) throw error;
  revalidatePath("/crm");
  revalidatePath(`/crm/${input.clientId}`);
}

export async function markInvoiceStatus(invoiceId: string, clientId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", invoiceId);
  if (error) throw error;
  revalidatePath("/crm");
  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/inicio");
}

export async function createDeal(input: {
  name: string;
  clientId: string | null;
  stage: string;
  value: number | null;
  ownerId: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("deals").insert({
    name: input.name,
    client_id: input.clientId,
    stage: input.stage,
    value: input.value,
    owner_id: input.ownerId,
  });
  if (error) throw error;
  revalidatePath("/crm");
}

export async function updateDealStage(dealId: string, stage: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("deals").update({ stage, updated_at: new Date().toISOString() }).eq("id", dealId);
  if (error) throw error;
  revalidatePath("/crm");
}

export async function addClientContact(clientId: string, note: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("client_contacts").insert({ client_id: clientId, author_id: user?.id ?? null, note });
  if (error) throw error;
  revalidatePath(`/crm/${clientId}`);
}
