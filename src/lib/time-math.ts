/** Minutos entre dois instantes, arredondados, com piso de 1 minuto. */
export function elapsedMinutes(startedAt: string | Date, endedAt: string | Date): number {
  const start = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
  const end = typeof endedAt === "string" ? new Date(endedAt) : endedAt;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
}
