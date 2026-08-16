import { redirect } from "next/navigation";

/**
 * `/início` era a home antes da Task 6 da Fase 3A. Os KPIs (faturamento do
 * mês, a cobrar) e "minhas tarefas de hoje" saíram: o primeiro é dado do CRM
 * antigo — tela aposentada, sem substituto até a Fase 3C decidir o que migra
 * — e o segundo virou redundante com o filtro por dono de `/hoje` (Task 5). O
 * `LiveActivity` que morava aqui foi transplantado para `/hoje`
 * (`HojeClient.tsx`) — ver `src/components/hoje/LiveActivity.tsx`.
 *
 * A rota fica como redirect puro (em vez de apagada) porque favoritos e
 * histórico do navegador de quem usava o sistema antes desta tarefa ainda
 * apontam para cá — `src/app/page.tsx`, o login e o middleware já mandam
 * direto para `/hoje`.
 */
export default function InicioPage() {
  redirect("/hoje");
}
