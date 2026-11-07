/** The hour (0–23) in Manila, whatever the device's own timezone. */
export function manilaHour(at: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-PH", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" }).format(at),
  );
}

/** "Good morning, Juan" by the hour in Manila. */
export function greeting(firstName: string, at: Date): string {
  const hour = manilaHour(at);
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return firstName ? `${part}, ${firstName}` : part;
}
