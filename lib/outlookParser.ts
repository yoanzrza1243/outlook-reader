export interface ParsedOutlookAccount {
  email: string;
  password: string;
  refreshToken: string;
  clientId: string;
  rawCredential: string;
}

export function parseOutlookLine(raw: string): ParsedOutlookAccount | null {
  if (!raw || typeof raw !== "string") return null;

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Bersihkan awalan "Akses:" atau "akses:" jika ada
    const cleaned = line.replace(/^akses\s*:\s*/i, "").trim();

    // Wajib memiliki minimal 3 tanda pemisah '|' (4 kolom)
    const parts = cleaned.split("|").map((p) => p.trim());
    if (parts.length < 4) continue;

    const [email, password, refreshToken, clientId] = parts;

    if (
      !email ||
      !email.includes("@") ||
      !refreshToken ||
      refreshToken.length < 20 ||
      !clientId
    ) {
      continue;
    }

    const normalizedEmail = email.toLowerCase();
    return {
      email: normalizedEmail,
      password: password || "",
      refreshToken,
      clientId,
      rawCredential: `${normalizedEmail}|${password || ""}|${refreshToken}|${clientId}`,
    };
  }

  return null;
}

export function parseMultipleOutlookLines(rawText: string): {
  valid: ParsedOutlookAccount[];
  invalidCount: number;
} {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const valid: ParsedOutlookAccount[] = [];
  let invalidCount = 0;

  for (const line of lines) {
    const cleaned = line.replace(/^akses\s*:\s*/i, "").trim();
    const pipeCount = (cleaned.match(/\|/g) || []).length;

    // Abaikan baris pendek "email|canva_pw" dari hasil Copy All
    if (pipeCount === 1) {
      continue;
    }

    const parsed = parseOutlookLine(cleaned);
    if (parsed) {
      valid.push(parsed);
    } else {
      invalidCount++;
    }
  }

  return { valid, invalidCount };
}
