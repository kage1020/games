export const NAME_MAX = 16;

export function cleanName(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeName(input: string): string | null {
  const name = Array.from(cleanName(input)).slice(0, NAME_MAX).join("").trim();
  return name === "" ? null : name;
}
