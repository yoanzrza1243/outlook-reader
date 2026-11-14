"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  parseMultipleOutlookLines,
  ParsedOutlookAccount,
} from "@/lib/outlookParser";

const PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "";
const DEFAULT_CANVA_PW =
  process.env.NEXT_PUBLIC_DEFAULT_CANVA_PW || "Leodavinci123!";

interface EmailItem {
  id: string;
  from: string;
  subject: string;
  received_at: string;
  text_body: string;
  html_body: string;
  otp: string | null;
}

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(!PIN);
  const [pinInput, setPinInput] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const [batch, setBatch] = useState<ParsedOutlookAccount[]>([]);
  const [canvaPwInput, setCanvaPwInput] = useState(DEFAULT_CANVA_PW);
  const [manualInput, setManualInput] = useState("");

  const [started, setStarted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [latestOtp, setLatestOtp] = useState<string | null>(null);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [detail, setDetail] = useState<EmailItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 1600);
  };

  // Hydrate dari localStorage & sessionStorage
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("omail_theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        document.documentElement.setAttribute("data-theme", savedTheme);
      }

      if (PIN && sessionStorage.getItem("omail_admin_ok") === "1") {
        setUnlocked(true);
      }

      const rawBatch = localStorage.getItem("omail_admin_batch");
      if (rawBatch) {
        const parsed = JSON.parse(rawBatch);
        if (Array.isArray(parsed)) setBatch(parsed);
      }

      const savedPw = localStorage.getItem("omail_admin_canvapw");
      if (savedPw) setCanvaPwInput(savedPw);
    } catch {}
    setHydrated(true);
  }, []);

  // Simpan perubahan batch ke localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("omail_admin_batch", JSON.stringify(batch));
    } catch {}
  }, [batch, hydrated]);

  // Simpan perubahan Password Canva
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("omail_admin_canvapw", canvaPwInput);
    } catch {}
  }, [canvaPwInput, hydrated]);

  const handleUnlock = () => {
    if (pinInput === PIN) {
      setUnlocked(true);
      try {
        sessionStorage.setItem("omail_admin_ok", "1");
      } catch {}
    } else {
      showToast("PIN salah");
    }
  };

  const addManual = () => {
    if (!manualInput.trim()) {
      showToast("Tempel daftar akun terlebih dahulu!");
      return;
    }

    const { valid } = parseMultipleOutlookLines(manualInput);
    if (valid.length === 0) {
      showToast("Format akun tidak valid!");
      return;
    }

    const existingEmails = new Set(batch.map((b) => b.email.toLowerCase()));
    const newItems: ParsedOutlookAccount[] = [];
    let dupCount = 0;

    for (const acc of valid) {
      if (existingEmails.has(acc.email)) {
        dupCount++;
      } else {
        existingEmails.add(acc.email);
        newItems.push(acc);
      }
    }

    if (newItems.length === 0) {
      showToast("Semua akun sudah ada di dalam antrian stok");
      return;
    }

    setBatch((prev) => [...prev, ...newItems]);
    setManualInput("");
    showToast(
      `${newItems.length} akun ditambahkan (${dupCount} duplikat diabaikan)`,
    );
  };

  const resetBatch = () => {
    if (!window.confirm("Hapus semua stok akun tersimpan?")) return;
    setBatch([]);
    setStarted(false);
    setActiveIndex(0);
    setEmails([]);
    setLatestOtp(null);
    showToast("Stok dikosongkan");
  };

  const removeItem = (emailAddr: string) => {
    setBatch((prev) => {
      const next = prev.filter((item) => item.email !== emailAddr);
      if (next.length === 0) {
        setStarted(false);
        setActiveIndex(0);
      } else if (activeIndex >= next.length) {
        setActiveIndex(next.length - 1);
      }
      return next;
    });
  };

  const formatSellBlock = (item: ParsedOutlookAccount) => {
    const pw = (canvaPwInput || DEFAULT_CANVA_PW).trim();
    return `${item.email}|${pw}\nAkses: ${item.rawCredential}`;
  };

  const copyAllSellFormat = () => {
    if (batch.length === 0) {
      showToast("Stok kosong!");
      return;
    }
    const text = batch.map(formatSellBlock).join("\n\n");
    navigator.clipboard.writeText(text);
    showToast(`${batch.length} akun disalin (Format Jual)!`);
  };

  const copyAllRawFormat = () => {
    if (batch.length === 0) {
      showToast("Stok kosong!");
      return;
    }
    const text = batch.map((b) => b.rawCredential).join("\n");
    navigator.clipboard.writeText(text);
    showToast(`${batch.length} akun Raw Outlook disalin!`);
  };

  const activeAccount = batch[activeIndex] || null;

  const loadActiveEmails = useCallback(async () => {
    if (!started || !activeAccount) return;
    setLoadingEmails(true);
    try {
      const res = await fetch("/api/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: activeAccount.email,
          refreshToken: activeAccount.refreshToken,
          clientId: activeAccount.clientId,
        }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setEmails(data.emails || []);
        setLatestOtp(data.latestOtp || null);
      }
    } catch {
    } finally {
      setLoadingEmails(false);
    }
  }, [started, activeAccount]);

  useEffect(() => {
    if (!started || !activeAccount) {
      setEmails([]);
      setLatestOtp(null);
      return;
    }
    setEmails([]);
    setLatestOtp(null);
    loadActiveEmails();

    const timer = setInterval(() => {
      loadActiveEmails();
    }, 8000);

    return () => clearInterval(timer);
  }, [started, activeIndex, activeAccount, loadActiveEmails]);

  if (!unlocked) {
    return (
      <div className="am-pin-wrap">
        <div className="am-pin-card">
          <h2 className="am-title" style={{ fontSize: "1.5rem" }}>
            Mode Admin
          </h2>
          <p className="am-subtitle" style={{ marginBottom: 16 }}>
            Masukkan PIN untuk lanjut.
          </p>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            placeholder="PIN Admin"
            className="am-input"
            style={{ marginBottom: 12, textAlign: "center" }}
          />
          <button
            onClick={handleUnlock}
            className="am-btn am-btn-grad"
            style={{ width: "100%" }}
          >
            Masuk
          </button>
        </div>
        {toast && <div className="toast-pill">{toast}</div>}
      </div>
    );
  }

  return (
    <main className="am-container">
      {/* Header */}
      <header className="am-header">
        <div>
          <h1 className="am-title">Mode Admin</h1>
          <p className="am-subtitle">Manajemen stok Outlook & antrian OTP</p>
        </div>
        <a href="/" className="am-back-btn">
          ← Beranda
        </a>
      </header>

      {/* Card Input Stok */}
      <section className="am-card">
        <div className="am-card-head">
          <div className="am-card-title-group">
            <span className="am-accent-bar" />
            <h2 className="am-card-title">Tambah Stok Akun</h2>
          </div>
          <span className="am-badge">{batch.length} akun tersimpan</span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="am-hint">
            Password Canva (untuk format Salin Semua):
          </label>
          <input
            type="text"
            value={canvaPwInput}
            onChange={(e) => setCanvaPwInput(e.target.value)}
            placeholder="Leodavinci123!"
            className="am-input"
          />
        </div>

        <label className="am-hint">
          Paste banyak akun Outlook di sini (1 baris 1 akun, atau hasil Salin
          Semua):
        </label>
        <textarea
          rows={4}
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              addManual();
            }
          }}
          placeholder={
            "email1@outlook.com|pw|M.C531...|9e5f94bc...\nemail2@outlook.com|pw|M.C531...|9e5f94bc..."
          }
          className="am-textarea"
        />

        <div className="am-row-between">
          <button onClick={resetBatch} className="am-btn am-btn-danger">
            Reset Semua
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={addManual}
            className="am-btn am-btn-grad"
          >
            + Tambah ke Stok
          </button>
        </div>
      </section>

      {/* Card Antrian Stok */}
      <section className="am-card">
        <div className="am-card-head">
          <div className="am-card-title-group">
            <span className="am-accent-bar" />
            <h2 className="am-card-title">Antrian Stok & Cek Inbox</h2>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={copyAllSellFormat} className="am-btn">
              ⧉ Salin Semua (Format Jual)
            </button>
            <button onClick={copyAllRawFormat} className="am-btn">
              📋 Salin Raw
            </button>
            <button
              onClick={() => {
                if (batch.length === 0) {
                  showToast("Stok kosong!");
                  return;
                }
                if (!started) {
                  setStarted(true);
                  setActiveIndex(0);
                } else {
                  setStarted(false);
                }
              }}
              className="am-btn am-btn-grad"
            >
              {started ? "Berhenti" : "Mulai ▶"}
            </button>
          </div>
        </div>

        {/* Panel Aktif saat Started */}
        {started && activeAccount && (
          <div className="am-active-panel">
            <div className="card-label" style={{ marginBottom: 4 }}>
              <span>
                SEDANG DIGUNAKAN · Akun {activeIndex + 1} dari {batch.length}
              </span>
              {latestOtp && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(latestOtp);
                    showToast(`OTP ${latestOtp} disalin!`);
                  }}
                  className="email-otp-badge"
                  style={{ cursor: "pointer" }}
                >
                  🔥 OTP: {latestOtp}
                </button>
              )}
            </div>

            <div className="am-active-email">{activeAccount.email}</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeAccount.email);
                  showToast("Email disalin!");
                }}
                className="am-btn-xs"
              >
                Salin Email
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(formatSellBlock(activeAccount));
                  showToast("Format jual disalin!");
                }}
                className="am-btn-xs"
              >
                Salin Format Jual
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeAccount.rawCredential);
                  showToast("Akses Outlook disalin!");
                }}
                className="am-btn-xs"
              >
                Salin Akses
              </button>
            </div>

            <div className="am-nav-grid">
              <button
                disabled={activeIndex <= 0}
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                className="am-btn"
              >
                ← Sebelumnya
              </button>
              <button
                disabled={activeIndex >= batch.length - 1}
                onClick={() =>
                  setActiveIndex((i) => Math.min(batch.length - 1, i + 1))
                }
                className="am-btn"
              >
                Lanjut →
              </button>
            </div>

            <div className="card-label">
              <span>KOTAK MASUK {loadingEmails ? "(Memuat...)" : ""}</span>
              <button onClick={loadActiveEmails} className="am-btn-xs">
                ⟳ Refresh
              </button>
            </div>

            {emails.length === 0 ? (
              <div className="empty-state" style={{ padding: "18px 12px" }}>
                Belum ada email masuk.
              </div>
            ) : (
              <div className="email-list">
                {emails.map((em) => (
                  <div
                    key={em.id}
                    onClick={() => setDetail(em)}
                    className="email-item"
                  >
                    <div className="email-top">
                      <span className="email-sender">{em.from}</span>
                      {em.otp && (
                        <span className="email-otp-badge">OTP: {em.otp}</span>
                      )}
                    </div>
                    <div className="email-bottom">
                      <span className="email-subject">{em.subject}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Daftar Antrian */}
        {batch.length === 0 ? (
          <div className="empty-state">
            Belum ada stok akun. Tempelkan akun Outlook di atas untuk memulai.
          </div>
        ) : (
          <div className="am-queue-list">
            {batch.map((item, idx) => (
              <div
                key={item.email}
                className={`am-queue-item ${
                  started && idx === activeIndex ? "active" : ""
                }`}
              >
                <div
                  className="am-queue-left"
                  onClick={() => {
                    if (started) setActiveIndex(idx);
                  }}
                >
                  <span className="am-num-box">{idx + 1}</span>
                  <span className="am-queue-address">{item.email}</span>
                </div>

                <div className="am-queue-actions">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(formatSellBlock(item));
                      showToast("Format jual disalin!");
                    }}
                    className="am-btn-xs"
                  >
                    Salin Jual
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(item.rawCredential);
                      showToast("Akses disalin!");
                    }}
                    className="am-btn-xs"
                  >
                    Salin Akses
                  </button>
                  <button
                    onClick={() => removeItem(item.email)}
                    className="am-btn-xs am-btn-danger"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal Detail Email */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{detail.subject}</h3>
              <button onClick={() => setDetail(null)} className="modal-close">
                ✕
              </button>
            </div>
            <div className="modal-meta">
              <span>Dari: {detail.from}</span>
              {detail.otp && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(detail.otp!);
                    showToast(`OTP ${detail.otp} disalin!`);
                  }}
                  className="email-otp-badge"
                  style={{ cursor: "pointer" }}
                >
                  📋 Salin OTP: {detail.otp}
                </button>
              )}
            </div>
            <div className="modal-body">
              {detail.html_body ? (
                <iframe
                  sandbox=""
                  srcDoc={detail.html_body}
                  className="modal-iframe"
                  title="Detail Email"
                />
              ) : (
                <pre className="modal-pre">
                  {detail.text_body || "(kosong)"}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-pill">{toast}</div>}
    </main>
  );
}
