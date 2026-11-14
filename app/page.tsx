"use client";

import React, { useState, useEffect } from "react";
import { parseOutlookLine } from "@/lib/outlookParser";

interface EmailItem {
  id: string;
  from: string;
  subject: string;
  received_at: string;
  text_body: string;
  html_body: string;
  otp: string | null;
}

export default function HomePage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [rawInput, setRawInput] = useState("");
  const [activeEmail, setActiveEmail] = useState("");
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [latestOtp, setLatestOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 1600);
  };

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("omail_theme") as
        | "dark"
        | "light"
        | null;
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      }
      const lastCred = localStorage.getItem("omail_last_cred");
      if (lastCred) {
        setRawInput(lastCred);
      }
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("omail_theme", next);
    } catch {}
  };

  const handleCheckInbox = async (customRaw?: string) => {
    const targetRaw = (customRaw !== undefined ? customRaw : rawInput).trim();
    if (!targetRaw) {
      showToast("Tempel kode akses terlebih dahulu!");
      return;
    }

    const parsed = parseOutlookLine(targetRaw);
    if (!parsed) {
      showToast("Format tidak valid! Gunakan email|pw|refreshtoken|clientid");
      return;
    }

    setLoading(true);
    setActiveEmail(parsed.email);

    try {
      const res = await fetch("/api/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: targetRaw }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        showToast(data.error || "Gagal membaca kotak masuk.");
      } else {
        setEmails(data.emails || []);
        setLatestOtp(data.latestOtp || null);
        try {
          localStorage.setItem("omail_last_cred", targetRaw);
        } catch {}
        showToast("Kotak masuk diperbarui!");
      }
    } catch {
      showToast("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyEmail = () => {
    const parsed = parseOutlookLine(rawInput);
    const emailToCopy = parsed?.email || activeEmail;
    if (!emailToCopy) {
      showToast("Belum ada alamat email!");
      return;
    }
    navigator.clipboard.writeText(emailToCopy);
    showToast("Alamat email disalin!");
  };

  const handleClear = () => {
    setRawInput("");
    setActiveEmail("");
    setEmails([]);
    setLatestOtp(null);
    try {
      localStorage.removeItem("omail_last_cred");
    } catch {}
    showToast("Dibersihkan");
  };

  return (
    <main className="container">
      {/* Topbar */}
      <header className="topbar">
        <a href="/" className="brand">
          <div className="logo-box">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <span className="brand-title">Omail</span>
        </a>

        <button
          onClick={toggleTheme}
          className="theme-btn"
          title="Ganti Tema"
          aria-label="Ganti Tema"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </header>

      {/* Hero */}
      <section className="hero">
        <h1 className="hero-title">Outlook Reader</h1>
        <p className="hero-sub">Cek OTP & kotak masuk Outlook instan.</p>
      </section>

      {/* Card Input Akses */}
      <section className="card">
        <div className="card-label">
          <span>AKSES AKUN OUTLOOK KAMU</span>
          {activeEmail && <span className="mono">{activeEmail}</span>}
        </div>

        <div className="input-pill-wrap">
          <span className="input-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </span>
          <textarea
            rows={2}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleCheckInbox();
              }
            }}
            placeholder="Tempel kode akses: email|pw|refreshtoken|clientid"
            className="cred-input"
          />
        </div>

        <div className="action-row">
          <button
            onClick={() => handleCheckInbox()}
            disabled={loading}
            className="btn-primary-pill"
          >
            {loading ? "⏳ Memuat Inbox..." : "🔍 Cek Kotak Masuk"}
          </button>

          <button
            onClick={handleCopyEmail}
            className="icon-circle-btn"
            title="Salin Alamat Email"
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>

          <button
            onClick={handleClear}
            className="icon-circle-btn"
            title="Bersihkan"
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </section>

      {/* Banner Highlight OTP */}
      {latestOtp && (
        <section className="otp-banner">
          <div>
            <div className="otp-banner-label">🔥 KODE OTP TERBARU</div>
            <div className="otp-banner-code">{latestOtp}</div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(latestOtp);
              showToast(`OTP ${latestOtp} disalin!`);
            }}
            className="btn-copy-otp"
          >
            📋 Salin OTP
          </button>
        </section>
      )}

      {/* Card Kotak Masuk */}
      <section className="card">
        <div className="card-label">
          <span>KOTAK MASUK · {emails.length}</span>
        </div>

        {emails.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>
              {activeEmail
                ? "Belum ada email masuk di akun ini."
                : "Tempel kode akses akun dulu lalu klik Cek Kotak Masuk."}
            </p>
          </div>
        ) : (
          <div className="email-list">
            {emails.map((em) => (
              <div
                key={em.id}
                onClick={() => setSelectedEmail(em)}
                className="email-item"
              >
                <div className="email-top">
                  <span className="email-sender">{em.from}</span>
                  {em.otp && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(em.otp!);
                        showToast(`OTP ${em.otp} disalin!`);
                      }}
                      className="email-otp-badge"
                    >
                      OTP: {em.otp}
                    </span>
                  )}
                </div>
                <div className="email-bottom">
                  <span className="email-subject">{em.subject}</span>
                  <span className="email-time">
                    {new Date(em.received_at).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="footer">
        © 2026 StoreGuweh. All Rights Reserved.
      </footer>

      {/* Modal Detail Email */}
      {selectedEmail && (
        <div className="modal-overlay" onClick={() => setSelectedEmail(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedEmail.subject}</h3>
              <button
                onClick={() => setSelectedEmail(null)}
                className="modal-close"
              >
                ✕
              </button>
            </div>

            <div className="modal-meta">
              <span>Dari: {selectedEmail.from}</span>
              {selectedEmail.otp && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedEmail.otp!);
                    showToast(`OTP ${selectedEmail.otp} disalin!`);
                  }}
                  className="email-otp-badge"
                  style={{ cursor: "pointer" }}
                >
                  📋 Salin OTP: {selectedEmail.otp}
                </button>
              )}
            </div>

            <div className="modal-body">
              {selectedEmail.html_body ? (
                <iframe
                  sandbox=""
                  srcDoc={selectedEmail.html_body}
                  className="modal-iframe"
                  title="Email Content"
                />
              ) : (
                <pre className="modal-pre">
                  {selectedEmail.text_body || "(kosong)"}
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
