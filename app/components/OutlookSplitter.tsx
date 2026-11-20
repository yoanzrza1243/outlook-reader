"use client";

import React, { useState, useRef } from "react";

interface ParsedAccount {
  email: string;
  password: string;
  refreshToken: string;
  clientId: string;
  recovery: string;
  cleanLine: string;
  recoveryLine: string;
}

export default function OutlookSplitter() {
  const [rawInput, setRawInput] = useState("");
  const [accounts, setAccounts] = useState<ParsedAccount[]>([]);
  const [fileName, setFileName] = useState("outlook");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseText = (text: string) => {
    setRawInput(text);
    const lines = text.split(/\r?\n/);
    const parsed: ParsedAccount[] = [];

    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed || !trimmed.includes("|") || !trimmed.includes("@")) continue;

      const withoutNumber = trimmed.replace(/^\d+[\.\)]\s*/, "").trim();
      const parts = withoutNumber.split("|").map((p) => p.trim());

      if (parts.length < 4 || !parts[0].includes("@")) continue;

      const email = parts[0];
      const password = parts[1];
      const refreshToken = parts[2];
      const clientId = parts[3];
      const recovery = parts[4] || "";

      parsed.push({
        email,
        password,
        refreshToken,
        clientId,
        recovery,
        cleanLine: `${email}|${password}|${refreshToken}|${clientId}`,
        recoveryLine: recovery ? `${email}|${recovery}` : "",
      });
    }

    setAccounts(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name.replace(/\.txt$/i, ""));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || "");
      parseText(content);
    };
    reader.readAsText(file);
  };

  const cleanAllText = accounts.map((a) => a.cleanLine).join("\n");
  const recoveryOnly = accounts.filter((a) => a.recoveryLine);
  const recoveryAllText = recoveryOnly.map((a) => a.recoveryLine).join("\n");

  const copyText = async (text: string, key: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const downloadTxt = (content: string, suffix: string) => {
    if (!content) return;
    const blob = new Blob([content + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}_${suffix}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setRawInput("");
    setAccounts([]);
    setFileName("outlook");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>✂️ Pisahkan Outlook & Recovery</h3>
          <p style={styles.subtitle}>
            Upload file .txt atau tempel teks mentah (otomatis buang header, nomor urut & pisah recovery).
          </p>
        </div>
        {accounts.length > 0 && (
          <button onClick={resetAll} style={styles.btnDanger}>
            🗑 Reset
          </button>
        )}
      </div>

      <div style={styles.uploadRow}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={styles.btnPrimary}
        >
          📂 Upload File .TXT
        </button>
        {accounts.length > 0 && (
          <span style={styles.badge}>
            ✅ Terdeteksi {accounts.length} Akun ({recoveryOnly.length} ada recovery)
          </span>
        )}
      </div>

      <textarea
        value={rawInput}
        onChange={(e) => parseText(e.target.value)}
        placeholder="Atau tempel langsung isi file .txt di sini...&#10;1. email@outlook.com | pw | refreshtoken | clientid | recovery@mail.com"
        rows={4}
        style={styles.textarea}
      />

      {accounts.length > 0 && (
        <div style={styles.grid}>
          <div style={styles.resultBox}>
            <div style={styles.boxHeader}>
              <span style={styles.boxTitle}>
                🛒 Akun Bersih ({accounts.length}) — Tanpa Recovery
              </span>
              <div style={styles.btnGroup}>
                <button
                  onClick={() => copyText(cleanAllText, "clean_all")}
                  style={styles.btnAction}
                >
                  {copiedKey === "clean_all" ? "✅ Tersalin!" : "📋 Salin Semua"}
                </button>
                <button
                  onClick={() => downloadTxt(cleanAllText, "tanpa_recovery")}
                  style={styles.btnSuccess}
                >
                  ⬇️ Download .txt
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={cleanAllText}
              rows={6}
              style={styles.resultTextarea}
            />
          </div>

          <div style={styles.resultBox}>
            <div style={styles.boxHeader}>
              <span style={styles.boxTitle}>
                🔐 Daftar Recovery ({recoveryOnly.length}) — Simpanan Admin
              </span>
              <div style={styles.btnGroup}>
                <button
                  onClick={() => copyText(recoveryAllText, "rec_all")}
                  style={styles.btnAction}
                  disabled={!recoveryAllText}
                >
                  {copiedKey === "rec_all" ? "✅ Tersalin!" : "📋 Salin Recovery"}
                </button>
                <button
                  onClick={() => downloadTxt(recoveryAllText, "recovery_only")}
                  style={styles.btnSuccess}
                  disabled={!recoveryAllText}
                >
                  ⬇️ Download .txt
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={recoveryAllText || "(Tidak ada kolom email recovery di data ini)"}
              rows={6}
              style={styles.resultTextarea}
            />
          </div>
        </div>
      )}

      {accounts.length > 0 && (
        <div style={styles.listWrapper}>
          <div style={styles.listTitle}>⚡ Salin Cepat per Akun (Tanpa Recovery)</div>
          <div style={styles.listScroll}>
            {accounts.map((acc, idx) => (
              <div key={`${acc.email}-${idx}`} style={styles.listRow}>
                <div style={styles.rowText}>
                  <span style={styles.rowIndex}>{idx + 1}.</span>
                  <span style={styles.rowEmail}>{acc.email}</span>
                  {acc.recovery && (
                    <span style={styles.rowRecBadge}>Rec: {acc.recovery}</span>
                  )}
                </div>
                <button
                  onClick={() => copyText(acc.cleanLine, `row_${idx}`)}
                  style={styles.btnSmall}
                >
                  {copiedKey === `row_${idx}` ? "✅" : "📋 Salin"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(15, 23, 42, 0.75)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "16px",
    padding: "20px",
    marginTop: "20px",
    color: "#f8fafc",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
  },
  title: { margin: 0, fontSize: "1.05rem", fontWeight: 700 },
  subtitle: { margin: "4px 0 0", fontSize: "0.8rem", color: "#94a3b8" },
  uploadRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },
  badge: {
    fontSize: "0.78rem",
    background: "rgba(16, 185, 129, 0.15)",
    color: "#34d399",
    padding: "6px 12px",
    borderRadius: "999px",
    fontWeight: 600,
  },
  textarea: {
    width: "100%",
    background: "rgba(2, 6, 23, 0.7)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    borderRadius: "10px",
    padding: "10px 12px",
    color: "#e2e8f0",
    fontSize: "0.8rem",
    fontFamily: "monospace",
    resize: "vertical",
    boxSizing: "border-box",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "14px",
    marginTop: "16px",
  },
  resultBox: {
    background: "rgba(2, 6, 23, 0.55)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: "12px",
    padding: "12px",
  },
  boxHeader: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
  },
  boxTitle: { fontSize: "0.82rem", fontWeight: 700, color: "#e2e8f0" },
  btnGroup: { display: "flex", gap: "6px", flexWrap: "wrap" },
  resultTextarea: {
    width: "100%",
    background: "rgba(15, 23, 42, 0.85)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "8px",
    padding: "8px 10px",
    color: "#cbd5e1",
    fontSize: "0.75rem",
    fontFamily: "monospace",
    boxSizing: "border-box",
  },
  listWrapper: {
    marginTop: "16px",
    background: "rgba(2, 6, 23, 0.45)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: "12px",
    padding: "12px",
  },
  listTitle: { fontSize: "0.82rem", fontWeight: 700, marginBottom: "8px", color: "#cbd5e1" },
  listScroll: {
    maxHeight: "220px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    background: "rgba(30, 41, 59, 0.55)",
    padding: "6px 10px",
    borderRadius: "8px",
  },
  rowText: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    overflow: "hidden",
    fontSize: "0.78rem",
  },
  rowIndex: { color: "#64748b", fontWeight: 700, minWidth: "22px" },
  rowEmail: {
    color: "#f1f5f9",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowRecBadge: {
    fontSize: "0.7rem",
    color: "#fbbf24",
    background: "rgba(251, 191, 36, 0.12)",
    padding: "2px 6px",
    borderRadius: "6px",
    whiteSpace: "nowrap",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    padding: "8px 16px",
    fontSize: "0.82rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnAction: {
    background: "rgba(59, 130, 246, 0.2)",
    color: "#93c5fd",
    border: "1px solid rgba(59, 130, 246, 0.35)",
    borderRadius: "8px",
    padding: "5px 10px",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSuccess: {
    background: "rgba(16, 185, 129, 0.2)",
    color: "#6ee7b7",
    border: "1px solid rgba(16, 185, 129, 0.35)",
    borderRadius: "8px",
    padding: "5px 10px",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDanger: {
    background: "rgba(239, 68, 68, 0.18)",
    color: "#fca5a5",
    border: "1px solid rgba(239, 68, 68, 0.35)",
    borderRadius: "8px",
    padding: "6px 12px",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSmall: {
    background: "rgba(148, 163, 184, 0.15)",
    color: "#e2e8f0",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "0.72rem",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
};
