import { NextResponse } from "next/server";

interface AccountInput {
  email: string;
  password: string;
  refreshToken: string;
  clientId: string;
}

async function renewSingleAccount(acc: AccountInput) {
  const endpoints = [
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    "https://login.live.com/oauth20_token.srf",
  ];

  let lastError = "Gagal menukar token";

  for (const url of endpoints) {
    try {
      const body = new URLSearchParams({
        client_id: acc.clientId.trim(),
        refresh_token: acc.refreshToken.trim(),
        grant_type: "refresh_token",
      });

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const data = await res.json();

      if (res.ok && data.refresh_token) {
        return {
          email: acc.email,
          ok: true,
          newLine: `${acc.email}|${acc.password}|${data.refresh_token}|${acc.clientId}`,
          error: null,
        };
      }

      if (data.error_description || data.error) {
        lastError = data.error_description || data.error;
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : "Network error";
    }
  }

  return {
    email: acc.email,
    ok: false,
    newLine: `${acc.email}|${acc.password}|${acc.refreshToken}|${acc.clientId}`,
    error: String(lastError).slice(0, 120),
  };
}

export async function POST(req: Request) {
  try {
    const { accounts } = (await req.json()) as { accounts: AccountInput[] };
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return NextResponse.json({ error: "Daftar akun kosong." }, { status: 400 });
    }

    // Proses paralel per 5 akun agar cepat tapi tetap aman dari rate-limit
    const results = [];
    const chunkSize = 5;
    for (let i = 0; i < accounts.length; i += chunkSize) {
      const chunk = accounts.slice(i, i + chunkSize);
      const chunkRes = await Promise.all(chunk.map(renewSingleAccount));
      results.push(...chunkRes);
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
