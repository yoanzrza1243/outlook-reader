import { NextRequest, NextResponse } from "next/server";
import { parseOutlookLine } from "@/lib/outlookParser";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface EmailMessageItem {
  id: string;
  from: string;
  subject: string;
  received_at: string;
  text_body: string;
  html_body: string;
  otp: string | null;
}

function extractSixDigitOtp(text: string): string | null {
  if (!text) return null;
  const clean = text.replace(/<[^>]+>/g, " ").replace(/#[0-9a-fA-F]{6}/g, " ");
  const matches = clean.match(/(?<!\d)(\d{6})(?!\d)/g);
  if (!matches) return null;
  const valid = matches.find((m) => m !== "000000" && !/^(\d)\1{5}$/.test(m));
  return valid || null;
}

async function getMicrosoftAccessToken(
  refreshToken: string,
  clientId: string,
): Promise<string | null> {
  const tokenEndpoints = [
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    "https://login.live.com/oauth20_token.srf",
  ];

  for (const url of tokenEndpoints) {
    try {
      const body = new URLSearchParams({
        client_id: clientId.trim(),
        refresh_token: refreshToken.trim(),
        grant_type: "refresh_token",
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.access_token) {
          return data.access_token as string;
        }
      }
    } catch {
      // Lanjut ke endpoint berikutnya
    }
  }

  return null;
}

async function fetchViaGraphApi(
  accessToken: string,
): Promise<EmailMessageItem[] | null> {
  try {
    const url =
      "https://graph.microsoft.com/v1.0/me/messages?$top=12&$select=id,subject,from,receivedDateTime,bodyPreview,body&$orderby=receivedDateTime desc";
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.value)) return null;

    const results: EmailMessageItem[] = data.value.map((item: any) => {
      const fromName = item?.from?.emailAddress?.name || "";
      const fromAddr = item?.from?.emailAddress?.address || "";
      const fromFormatted =
        fromName && fromAddr
          ? `${fromName} <${fromAddr}>`
          : fromAddr || fromName || "Tidak diketahui";

      const content = item?.body?.content || item?.bodyPreview || "";
      const isHtml =
        item?.body?.contentType?.toLowerCase() === "html" ||
        content.includes("<html") ||
        content.includes("<div") ||
        content.includes("<table");

      const plainText = content
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const otp = extractSixDigitOtp(plainText);

      return {
        id: String(item.id || Math.random()),
        from: fromFormatted,
        subject: item.subject || "(Tanpa Subjek)",
        received_at: item.receivedDateTime || new Date().toISOString(),
        text_body: plainText,
        html_body: isHtml ? content : "",
        otp,
      };
    });

    return results;
  } catch {
    return null;
  }
}

async function fetchViaImapXoauth2(
  email: string,
  accessToken: string,
): Promise<EmailMessageItem[] | null> {
  const client = new ImapFlow({
    host: "outlook.office365.com",
    port: 993,
    secure: true,
    auth: {
      user: email,
      accessToken: accessToken,
    },
    logger: false,
  });

  const collected: EmailMessageItem[] = [];

  try {
    await client.connect();

    for (const folder of ["INBOX", "Junk"]) {
      try {
        const mailbox = await client.mailboxOpen(folder, { readOnly: true });
        if (!mailbox || mailbox.exists === 0) continue;

        const total = mailbox.exists;
        const startSeq = Math.max(1, total - 7);
        const range = `${startSeq}:*`;

        for await (const msg of client.fetch(range, {
          uid: true,
          envelope: true,
          source: true,
          internalDate: true,
        })) {
          try {
            if (!msg.source) continue;
            const parsed = await simpleParser(msg.source);
            const fromText =
              parsed.from?.text ||
              msg.envelope?.from?.[0]?.address ||
              "Tidak diketahui";
            const subject =
              parsed.subject || msg.envelope?.subject || "(Tanpa Subjek)";
            const textBody = (parsed.text || "").trim();
            const htmlBody = typeof parsed.html === "string" ? parsed.html : "";
            const combinedForOtp = `${subject} ${textBody} ${htmlBody}`;
            const otp = extractSixDigitOtp(combinedForOtp);

            const dateVal =
              parsed.date ||
              (msg.internalDate ? new Date(msg.internalDate) : new Date());

            collected.push({
              id: `${folder}_${msg.uid}`,
              from: fromText,
              subject:
                folder === "Junk" ? `[Spam] ${subject}` : String(subject),
              received_at: dateVal.toISOString(),
              text_body:
                textBody ||
                htmlBody
                  .replace(/<[^>]+>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim(),
              html_body: htmlBody,
              otp,
            });
          } catch {
            // Lewati pesan yang gagal di-parse
          }
        }
      } catch {
        // Lewati jika folder tidak tersedia
      }
    }

    await client.logout();

    collected.sort(
      (a, b) =>
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
    );

    return collected.slice(0, 12);
  } catch {
    try {
      await client.logout();
    } catch {}
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let email = (body.email || "").trim().toLowerCase();
    let refreshToken = (body.refreshToken || "").trim();
    let clientId = (body.clientId || "").trim();

    if (body.raw) {
      const parsed = parseOutlookLine(String(body.raw));
      if (!parsed) {
        return NextResponse.json(
          {
            error:
              "Format tidak valid! Gunakan: email|pw|refresh_token|client_id",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      email = parsed.email;
      refreshToken = parsed.refreshToken;
      clientId = parsed.clientId;
    }

    if (!email || !refreshToken || !clientId) {
      return NextResponse.json(
        {
          error:
            "Format tidak valid! Gunakan: email|pw|refresh_token|client_id",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const accessToken = await getMicrosoftAccessToken(refreshToken, clientId);
    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Gagal mendapatkan Access Token. Pastikan Refresh Token & Client ID masih aktif.",
        },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    let emails = await fetchViaGraphApi(accessToken);

    if (!emails || emails.length === 0) {
      const imapEmails = await fetchViaImapXoauth2(email, accessToken);
      if (imapEmails) {
        emails = imapEmails;
      }
    }

    const finalEmails = emails || [];
    const latestOtp = finalEmails.find((e) => e.otp)?.otp || null;

    return NextResponse.json(
      {
        email,
        latestOtp,
        emails: finalEmails,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Terjadi kesalahan server internal." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
