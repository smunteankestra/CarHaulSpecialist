/** US phone numbers are stored as (305) 555-0134; anything with a + is left alone. */
export function formatPhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("+")) return trimmed;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
