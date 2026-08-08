import { describe, expect, it } from "vitest";
import { isInvoiceOverdue } from "./invoices";

const HOJE = "2026-08-08";

describe("isInvoiceOverdue", () => {
  it("nunca considera vencida uma fatura já paga, mesmo com a data no passado", () => {
    // A guarda é a única proteção do KPI de inadimplência do CRM, que recebe
    // todas as faturas sem filtrar por status na consulta.
    expect(isInvoiceOverdue("paid", "2026-06-10", HOJE)).toBe(false);
  });

  it("considera vencida a fatura em aberto cuja data já passou", () => {
    expect(isInvoiceOverdue("pending", "2026-07-15", HOJE)).toBe(true);
  });

  it("não considera vencida a fatura em aberto que vence hoje", () => {
    expect(isInvoiceOverdue("pending", HOJE, HOJE)).toBe(false);
  });

  it("não considera vencida a fatura em aberto com data futura", () => {
    expect(isInvoiceOverdue("pending", "2026-09-01", HOJE)).toBe(false);
  });

  it("respeita o status marcado à mão para antecipar o alerta antes do vencimento", () => {
    expect(isInvoiceOverdue("overdue", "2026-09-01", HOJE)).toBe(true);
  });
});
