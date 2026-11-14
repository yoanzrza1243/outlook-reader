export interface ParsedOutlookAccount {
  email: string;
  password: string;
  refreshToken: string;
  clientId: string;
  canvaPw?: string;
  rawCredential: string;
}

export function parseOutlookLine(raw: string): ParsedOutlookAccount | null {
  if (!raw || typeof raw !== "string") return null;

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let detectedCanvaPw: string | undefined = undefined;

  for (const line of lines) {
    if (line.startsWith("===")) continue;

    const isAkses = /^akses\s*:\s*/i.test(line);
    const cleaned = line.replace(/^akses\s*:\s*/i, "").trim();
    const parts = cleaned.split("|").map((p) => p.trim());

    // Tangkap password Canva jika baris pertama berformat "email|pwcanva"
    if (!isAkses && parts.length === 2 && parts[0].includes("@")) {
      detectedCanvaPw = parts[1];
      continue;
    }

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
      canvaPw: detectedCanvaPw,
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

  const canvaPwMap = new Map<string, string>();
  const valid: ParsedOutlookAccount[] = [];
  let invalidCount = 0;

  // Pass 1: Tangkap pasangan email|pwcanva dari hasil Create Akun / Salin Semua
  for (const line of lines) {
    if (/^akses\s*:\s*/i.test(line) || line.startsWith("===")) continue;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length === 2 && parts[0].includes("@")) {
      canvaPwMap.set(parts[0].toLowerCase(), parts[1]);
    }
  }

  // Pass 2: Tangkap baris kredensial Outlook (4+ kolom)
  for (const line of lines) {
    if (line.startsWith("===")) continue;
    const cleaned = line.replace(/^akses\s*:\s*/i, "").trim();
    const pipeCount = (cleaned.match(/\|/g) || []).length;

    // Abaikan baris pendek "email|pwcanva" karena sudah dicatat di Pass 1
    if (pipeCount === 1) continue;

    const parsed = parseOutlookLine(cleaned);
    if (parsed) {
      const savedCanvaPw = canvaPwMap.get(parsed.email);
      if (savedCanvaPw) {
        parsed.canvaPw = savedCanvaPw;
      }
      valid.push(parsed);
    } else {
      invalidCount++;
    }
  }

  return { valid, invalidCount };
}