import { NextRequest, NextResponse } from "next/server";
import { getHorasPageData } from "@/lib/data/time";

export async function GET(req: NextRequest) {
  const monthParam = req.nextUrl.searchParams.get("month");
  const now = monthParam ? new Date(`${monthParam}-01T00:00:00`) : new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const { entries } = await getHorasPageData(monthStart, monthEnd);

  const header = "Data,Pessoa,Cliente,Tarefa,Horas,Faturável,Nota";
  const rows = entries.map((e) => {
    const date = new Date(e.started_at).toLocaleDateString("pt-BR");
    const hours = ((e.minutes ?? 0) / 60).toFixed(2).replace(".", ",");
    const cols = [
      date,
      e.user?.full_name ?? "",
      e.client?.name ?? "Interno",
      e.task?.title ?? "",
      hours,
      e.billable ? "Sim" : "Não",
      (e.note ?? "").replace(/[\r\n,]/g, " "),
    ];
    return cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="horas-${monthStart.toISOString().slice(0, 7)}.csv"`,
    },
  });
}
