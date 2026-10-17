/** Crockford base32。I L O U を含まない */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BYTES = 20;

export const CODE_LENGTH = (BYTES * 8) / 5;

type FillRandom = (bytes: Uint8Array) => Uint8Array;

const fillRandom: FillRandom = (bytes) => crypto.getRandomValues(bytes);

export function generateCode(random: FillRandom = fillRandom): string {
  const bytes = random(new Uint8Array(BYTES));
  let code = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      code += ALPHABET[(buffer >> bits) & 31];
    }
    buffer &= (1 << bits) - 1;
  }
  return code;
}

export function normalizeCode(input: string): string | null {
  const code = input
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  if (code.length !== CODE_LENGTH) return null;
  for (const char of code) if (!ALPHABET.includes(char)) return null;
  return code;
}

export function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? "";
}
