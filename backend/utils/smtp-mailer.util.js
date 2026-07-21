import nodemailer from "nodemailer";
import { appConfig } from "../config/app.config.js";
import { AppError } from "./app-error.util.js";
import { logger } from "./logger.util.js";

let transporter = null;

export async function sendMail({ to, subject, text, html }) {
  if (!appConfig.smtpHost || !appConfig.smtpUser || !appConfig.smtpPass || !appConfig.smtpFromEmail) {
    logger.warn("SMTP email configuration is incomplete.", { missing: getMissingSmtpKeys() });
    throw new AppError("Hiện chưa thể gửi email xác thực. Vui lòng thử lại sau.", 503, "SMTP_NOT_CONFIGURED");
  }

  try {
    const info = await getTransporter().sendMail({
      from: { name: appConfig.smtpFromName, address: appConfig.smtpFromEmail },
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
    logger.error("SMTP email delivery failed.", { message: error?.message, code: error?.code });
    throw new AppError("Hiện chưa thể gửi email xác thực. Vui lòng thử lại sau.", 503, "SMTP_SEND_FAILED");
  }
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: appConfig.smtpHost,
      port: appConfig.smtpPort,
      secure: appConfig.smtpSecure,
      auth: {
        user: appConfig.smtpUser,
        pass: appConfig.smtpPass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }
  return transporter;
}

function getMissingSmtpKeys() {
  return [
    ["SMTP_HOST", appConfig.smtpHost],
    ["SMTP_PORT", appConfig.smtpPort],
    ["SMTP_USER", appConfig.smtpUser],
    ["SMTP_PASS", appConfig.smtpPass],
    ["SMTP_FROM_NAME", appConfig.smtpFromName],
    ["SMTP_FROM_EMAIL", appConfig.smtpFromEmail]
  ].filter(([, value]) => !value).map(([key]) => key);
}

