import nodemailer from "nodemailer";
import { AppError } from "./app-error.util.js";
import { logger } from "./logger.util.js";

let transporter = null;
let verifyStarted = false;

export async function verifyBrevoSmtpConnection() {
  if (verifyStarted) return;
  verifyStarted = true;

  try {
    await getTransporter().verify();
    console.log("Brevo SMTP connection verified");
  } catch (error) {
    logSafeSmtpError(error);
  }
}

export async function sendMail({ to, subject, text, html }) {
  if (!hasRequiredSmtpConfig()) {
    const error = new Error("SMTP configuration is incomplete.");
    error.code = "SMTP_CONFIG_INCOMPLETE";
    logSafeSmtpError(error);
    throw new AppError("Hiện chưa thể gửi email xác thực. Vui lòng thử lại sau.", 503, "SMTP_NOT_CONFIGURED");
  }

  try {
    const info = await getTransporter().sendMail({
      from: {
        name: process.env.SMTP_FROM_NAME || "N&L Store",
        address: process.env.SMTP_FROM_EMAIL
      },
      to,
      subject,
      text,
      html
    });

    logger.info("Password reset email sent.", {
      messageId: info.messageId,
      accepted: Array.isArray(info.accepted) ? info.accepted.length : 0,
      rejected: Array.isArray(info.rejected) ? info.rejected.length : 0
    });
  } catch (error) {
    logSafeSmtpError(error);
    throw new AppError("Hiện chưa thể gửi email xác thực. Vui lòng thử lại sau.", 503, "SMTP_SEND_FAILED");
  }
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      requireTLS: true,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });
  }
  return transporter;
}

function hasRequiredSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_USER
    && process.env.SMTP_PASS
    && process.env.SMTP_FROM_EMAIL
  );
}

function logSafeSmtpError(error) {
  console.error("[SMTP_SEND_FAILED]", {
    code: error?.code,
    command: error?.command,
    responseCode: error?.responseCode,
    response: error?.response,
    message: error?.message,
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE,
    hasUser: Boolean(process.env.SMTP_USER),
    hasPass: Boolean(process.env.SMTP_PASS),
    fromEmail: process.env.SMTP_FROM_EMAIL
  });
}

