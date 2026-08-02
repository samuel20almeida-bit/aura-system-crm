import { NextRequest, NextResponse } from "next/server";
import { getHorasPageData } from "@/lib/data/time";
import { createClient } from "@/lib/supabase/server";
import { APP_TIMEZONE, monthStartInAppTz, yearMonthInAppTz } from "@/lib/timezone";

// Cells starting with these characters can be interpreted as formulas by
// Excel/Sheets when the CSV is opened — neutralize with a leading apostrophe.
function csvSafe(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const monthParam = req.nextUrl.searchParams.get("month");
  let year: number;
  let month0: number;
  if (monthParam) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month0 = m - 1;
  } else {
    ({ year, month0 } = yearMonthInAppTz());
  }
  const monthStart = monthStartInAppTz(year, month0);
  const monthEnd = monthStartInAppTz(year, month0 + 1);

  const { entries } = await getHorasPageData(monthStart, monthEnd);

  const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE });

  const header = "Data,Pessoa,Cliente,Tarefa,Horas,Faturável,Nota";
  const rows = entries.map((e) => {
    const date = dateFormatter.format(new Date(e.started_at));
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
    return cols.map((c) => `"${csvSafe(String(c)).replace(/"/g, '""')}"`).join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `horas-${year}-${String(month0 + 1).padStart(2, "0")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
