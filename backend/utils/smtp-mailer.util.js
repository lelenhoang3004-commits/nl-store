import nodemailer from "nodemailer";
import { appConfig } from "../config/app.config.js";
import { AppError } from "./app-error.util.js";
import { logger } from "./logger.util.js";

const BREVO_SMTP_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";

let transporter = null;
let verifyStarted = false;

export async function verifyBrevoSmtpConnection() {
  if (verifyStarted) return;
  verifyStarted = true;

  if (hasRequiredBrevoConfig()) {
    logger.info("Brevo Transactional Email API configured.", {
      provider: "brevo",
      fromEmail: appConfig.brevoFromEmail
    });
    return;
  }

  try {
    await getTransporter().verify();
    console.log("Brevo SMTP connection verified");
  } catch (error) {
    logSafeSmtpError(error);
  }
}

export async function sendMail({ to, subject, text, html }) {
  if (hasRequiredBrevoConfig()) {
    try {
      await sendBrevoTransactionalEmail({ to, subject, text, html });
      return;
    } catch (error) {
      logSafeBrevoError(error);

      if (!hasRequiredSmtpConfig()) {
        throw new AppError("Hiện chưa thể gửi email xác thực. Vui lòng thử lại sau.", 503, "BREVO_SEND_FAILED");
      }

      logger.warn("Brevo email failed. Falling back to SMTP.", {
        code: error?.code || error?.name,
        status: error?.status
      });
    }
  }

  if (!hasRequiredSmtpConfig()) {
    const error = new Error("Email configuration is incomplete.");
    error.code = "EMAIL_CONFIG_INCOMPLETE";
    logSafeSmtpError(error);
    throw new AppError("Hiện chưa thể gửi email xác thực. Vui lòng thử lại sau.", 503, "EMAIL_NOT_CONFIGURED");
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

    logger.info("Password reset email sent by SMTP.", {
      messageId: info.messageId,
      accepted: Array.isArray(info.accepted) ? info.accepted.length : 0,
      rejected: Array.isArray(info.rejected) ? info.rejected.length : 0
    });
  } catch (error) {
    logSafeSmtpError(error);
    throw new AppError("Hiện chưa thể gửi email xác thực. Vui lòng thử lại sau.", 503, "SMTP_SEND_FAILED");
  }
}

async function sendBrevoTransactionalEmail({ to, subject, text, html }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), appConfig.brevoEmailTimeoutMs);

  try {
    const response = await fetch(BREVO_SMTP_EMAIL_URL, {
      method: "POST",
      headers: {
        "api-key": appConfig.brevoApiKey,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        sender: {
          email: appConfig.brevoFromEmail,
          name: appConfig.brevoFromName
        },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = new Error("Brevo Transactional Email API rejected the request.");
      error.code = "BREVO_HTTP_ERROR";
      error.status = response.status;
      error.statusText = response.statusText;
      error.responseBody = await readLimitedErrorBody(response);
      throw error;
    }

    logger.info("Password reset email sent by Brevo API.", {
      provider: "brevo",
      status: response.status
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      error.code = "BREVO_TIMEOUT";
    }
    throw error;
  } finally {
    clearTimeout(timeout);
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

function hasRequiredBrevoConfig() {
  return Boolean(appConfig.brevoApiKey && appConfig.brevoFromEmail);
}

function hasRequiredSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_USER
    && process.env.SMTP_PASS
    && process.env.SMTP_FROM_EMAIL
  );
}

async function readLimitedErrorBody(response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

function logSafeBrevoError(error) {
  console.error("[BREVO_SEND_FAILED]", {
    code: error?.code || error?.name,
    status: error?.status,
    statusText: error?.statusText,
    responseBody: error?.responseBody,
    message: error?.message,
    hasApiKey: Boolean(appConfig.brevoApiKey),
    fromEmail: appConfig.brevoFromEmail
  });
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
