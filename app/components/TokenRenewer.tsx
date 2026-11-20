"use client";

import React, { useState, useRef } from "react";

interface RenewResult {
  email: string;
  ok: boolean;
  newLine: string;
  error: string | null;
}

export default function TokenRenewer() {
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RenewResult[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseAccounts = (text: string) => {
    const lines = text.split(/\r?\n/);
    const parsed = [];
    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed || !trimmed.includes("|") || !trimmed.includes("@")) continue;
      const clean = trimmed.replace(/^\d+[\.\)]\s*/, "").trim();
      const parts = clean.split("|").map((p) => p.trim());
      if (parts.length < 4) continue;
      parsed.push({
        email: parts[0],
        password: parts[1],
        refreshToken: parts[2],
        clientId: parts[3],
      });
    }
    return parsed;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRawInput(String(ev.target?.result || ""));
    reader.readAsText(file);
  };

  const handleRenew = async () => {
    const accounts = parseAccounts(rawInput);
    if (accounts.length === 0) return;

    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/renew-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts }),
      });
      const data = await res.json();
      if (data.results) setResults(data.results);
    } finally {
      setLoading(false);
    }
  };

  const successList = results.filter((r) => r.ok);
  const failedList = results.filter((r) => !r.ok);
  const successText = successList.map((r) => r.newLine).join("\n");

  const copyText = async (text: string, key: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const downloadTxt = (content: string) => {
    if (!content) return;
    const blob = new Blob([content + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outlook_renewed_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>🔄 Perbarui Refresh Token (Renew)</h3>
          <p style={styles.subtitle}>
            Tukar refresh_token lama jadi token baru lewat Microsoft agar akun tetap awet.
          </p>
        </div>
      </div>

      <div style={styles.uploadRow}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
        <button onClick={() => fileInputRef.current?.click()} style={styles.btnSecondary}>
          📂 Upload .TXT
        </button>
        <button
          onClick={handleRenew}
          disabled={loading || !rawInput.trim()}
          style={styles.btnPrimary}
        >
          {loading ? "⏳ Memproses..." : "🔄 Renew Token"}
        </button>
      </div>

      <textarea
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        placeholder="email|password|refresh_token|client_id (satu akun per baris)"
        rows={5}
        style={styles.textarea}
      />

      {results.length > 0 && (
        <div style={styles.resultSection}>
          <div style={styles.summaryRow}>
            <span style={styles.badgeOk}>✅ Berhasil: {successList.length}</span>
            <span style={styles.badgeFail}>❌ Gagal: {failedList.length}</span>
            {successText && (
              <div style={styles.btnGroup}>
                <button
                  onClick={() => copyText(successText, "all")}
                  style={styles.btnAction}
                >
                  {copiedKey === "all" ? "✅ Tersalin!" : "📋 Salin Semua"}
                </button>
                <button
                  onClick={() => downloadTxt(successText)}
                  style={styles.btnSuccess}
                >
                  ⬇️ Download .txt
                </button>
              </div>
            )}
          </div>

          {successText && (
            <textarea
              readOnly
              value={successText}
              rows={5}
              style={styles.resultTextarea}
            />
          )}

          {failedList.length > 0 && (
            <div style={styles.failBox}>
              <div style={styles.failTitle}>Daftar Gagal:</div>
              {failedList.map((f, i) => (
                <div key={i} style={styles.failItem}>
                  • <b>{f.email}</b> — {f.error}
                </div>
              ))}
            </div>
          )}
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
  header: { marginBottom: "14px" },
  title: { margin: 0, fontSize: "1.05rem", fontWeight: 700 },
  subtitle: { margin: "4px 0 0", fontSize: "0.8rem", color: "#94a3b8" },
  uploadRow: { display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" },
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
  resultSection: { marginTop: "14px" },
  summaryRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
  },
  badgeOk: {
    fontSize: "0.78rem",
    background: "rgba(16, 185, 129, 0.15)",
    color: "#34d399",
    padding: "5px 10px",
    borderRadius: "999px",
    fontWeight: 600,
  },
  badgeFail: {
    fontSize: "0.78rem",
    background: "rgba(239, 68, 68, 0.15)",
    color: "#f87171",
    padding: "5px 10px",
    borderRadius: "999px",
    fontWeight: 600,
  },
  btnGroup: { display: "flex", gap: "6px", marginLeft: "auto" },
  resultTextarea: {
    width: "100%",
    background: "rgba(2, 6, 23, 0.8)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    borderRadius: "8px",
    padding: "8px 10px",
    color: "#cbd5e1",
    fontSize: "0.75rem",
    fontFamily: "monospace",
    boxSizing: "border-box",
  },
  failBox: {
    marginTop: "10px",
    padding: "10px",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "8px",
    fontSize: "0.75rem",
    color: "#fca5a5",
  },
  failTitle: { fontWeight: 700, marginBottom: "4px" },
  failItem: { marginBottom: "2px", wordBreak: "break-word" },
  btnPrimary: {
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    padding: "8px 18px",
    fontSize: "0.82rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSecondary: {
    background: "rgba(148, 163, 184, 0.18)",
    color: "#e2e8f0",
    border: "1px solid rgba(148, 163, 184, 0.3)",
    borderRadius: "999px",
    padding: "8px 14px",
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
};
