import nodemailer from "nodemailer";
import { appConfig } from "../config/app.config.js";
import { AppError } from "./app-error.util.js";
import { logger } from "./logger.util.js";

let transporter = null;

export async function sendMail({ to, subject, text, html }) {
  if (!appConfig.smtpHost || !appConfig.smtpUser || !appConfig.smtpPass || !appConfig.smtpFromEmail) {
    throw new AppError("Dịch vụ email chưa được cấu hình.", 503, "SMTP_NOT_CONFIGURED");
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
    throw new AppError("Không thể gửi email xác thực.", 503, "SMTP_SEND_FAILED");
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
      }
    });
  }
  return transporter;
}

