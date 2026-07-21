import net from "node:net";
import tls from "node:tls";
import { appConfig } from "../config/app.config.js";
import { AppError } from "./app-error.util.js";
import { logger } from "./logger.util.js";

const SMTP_TIMEOUT_MS = 15000;

export async function sendMail({ to, subject, text, html }) {
  if (!appConfig.smtpHost || !appConfig.smtpUser || !appConfig.smtpPass) {
    throw new AppError("Dịch vụ email chưa được cấu hình.", 503, "SMTP_NOT_CONFIGURED");
  }

  const client = new SmtpClient({ host: appConfig.smtpHost, port: appConfig.smtpPort });
  try {
    await client.connect();
    await client.expect(220);
    await client.command(`EHLO ${client.localName}`, 250);
    if (appConfig.smtpPort !== 465) {
      await client.command("STARTTLS", 220);
      client.upgradeToTls();
      await client.command(`EHLO ${client.localName}`, 250);
    }
    await client.command("AUTH LOGIN", 334);
    await client.command(Buffer.from(appConfig.smtpUser).toString("base64"), 334);
    await client.command(Buffer.from(appConfig.smtpPass).toString("base64"), 235);
    await client.command(`MAIL FROM:<${extractEmail(appConfig.smtpFrom)}>`, 250);
    await client.command(`RCPT TO:<${to}>`, [250, 251]);
    await client.command("DATA", 354);
    await client.writeData(createMimeMessage({ to, subject, text, html }));
    await client.expect(250);
    await client.command("QUIT", 221).catch(() => null);
  } catch (error) {
    logger.error("SMTP email delivery failed.", { message: error?.message, code: error?.code });
    throw error instanceof AppError ? error : new AppError("Không thể gửi email xác thực.", 503, "SMTP_SEND_FAILED");
  } finally {
    client.close();
  }
}

class SmtpClient {
  constructor({ host, port }) {
    this.host = host;
    this.port = Number(port || 587);
    this.localName = "nl-store.local";
    this.socket = null;
    this.buffer = "";
    this.waiters = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      const socket = this.port === 465
        ? tls.connect({ host: this.host, port: this.port, servername: this.host }, resolve)
        : net.connect({ host: this.host, port: this.port }, resolve);
      socket.setEncoding("utf8");
      socket.setTimeout(SMTP_TIMEOUT_MS, () => socket.destroy(new Error("SMTP timeout")));
      socket.once("error", onError);
      socket.on("data", (chunk) => this.handleData(chunk));
      this.socket = socket;
    });
  }

  upgradeToTls() {
    this.socket.removeAllListeners("data");
    this.socket = tls.connect({ socket: this.socket, servername: this.host });
    this.socket.setEncoding("utf8");
    this.socket.setTimeout(SMTP_TIMEOUT_MS, () => this.socket.destroy(new Error("SMTP timeout")));
    this.socket.on("data", (chunk) => this.handleData(chunk));
    this.buffer = "";
  }

  async command(command, expected) {
    this.socket.write(`${command}\r\n`);
    return this.expect(expected);
  }

  async writeData(message) {
    this.socket.write(`${message}\r\n.\r\n`);
  }

  expect(expected) {
    const expectedCodes = Array.isArray(expected) ? expected : [expected];
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("SMTP response timeout")), SMTP_TIMEOUT_MS);
      this.waiters.push({ expectedCodes, resolve, reject, timer });
      this.flushWaiters();
    });
  }

  handleData(chunk) {
    this.buffer += chunk;
    this.flushWaiters();
  }

  flushWaiters() {
    if (!this.waiters.length) return;
    const lines = this.buffer.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return;
    const last = lines[lines.length - 1];
    if (!/^\d{3} /.test(last)) return;
    const response = lines.join("\n");
    this.buffer = "";
    const waiter = this.waiters.shift();
    clearTimeout(waiter.timer);
    const code = Number(last.slice(0, 3));
    if (waiter.expectedCodes.includes(code)) waiter.resolve(response);
    else waiter.reject(new Error(`SMTP unexpected response ${code}`));
  }

  close() {
    this.socket?.destroy?.();
  }
}

function createMimeMessage({ to, subject, text, html }) {
  const headers = [
    `From: ${encodeHeaderAddress(appConfig.smtpFrom)}`,
    `To: ${to}`,
    `Subject: ${encodeMimeWords(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit"
  ];
  return `${headers.join("\r\n")}\r\n\r\n${html || escapeHtml(text || "")}`.replace(/^\./gm, "..");
}

function encodeMimeWords(value) {
  return `=?UTF-8?B?${Buffer.from(String(value || ""), "utf8").toString("base64")}?=`;
}

function encodeHeaderAddress(value) {
  const email = extractEmail(value);
  const name = String(value || "").replace(/<[^>]+>/, "").trim();
  return name ? `${encodeMimeWords(name)} <${email}>` : email;
}

function extractEmail(value) {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match ? match[1] : value).trim();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

