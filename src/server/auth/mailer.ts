import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { getAuthEnvironment } from "@/server/env";

import type { OtpPurpose } from "./constants";

export type OtpMailer = {
  sendCode: (input: {
    code: string;
    email: string;
    purpose: OtpPurpose;
  }) => Promise<void>;
};

const globalForMailer = globalThis as typeof globalThis & {
  __kampusMailer?: Transporter;
};

export function normalizeSmtpPassword(
  host: string,
  password: string | undefined,
) {
  if (!password) return password;

  // Google displays 16-character app passwords in four groups. Copying that
  // presentation verbatim is a common production failure; Gmail expects the
  // same password without formatting whitespace. Preserve whitespace for
  // every other SMTP provider because it may be part of a real password.
  return host.trim().toLowerCase() === "smtp.gmail.com"
    ? password.replace(/\s+/gu, "")
    : password;
}

function getMailer() {
  if (globalForMailer.__kampusMailer) {
    return globalForMailer.__kampusMailer;
  }

  const environment = getAuthEnvironment();
  const smtpPassword = normalizeSmtpPassword(
    environment.SMTP_HOST,
    environment.SMTP_PASSWORD,
  );
  const hasCredentials =
    environment.SMTP_USER !== undefined &&
    smtpPassword !== undefined;

  globalForMailer.__kampusMailer = nodemailer.createTransport({
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    secure: environment.SMTP_SECURE,
    requireTLS: environment.SMTP_REQUIRE_TLS,
    connectionTimeout: environment.SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: environment.SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: environment.SMTP_SOCKET_TIMEOUT_MS,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
    ...(hasCredentials
      ? {
          auth: {
            user: environment.SMTP_USER,
            pass: smtpPassword,
          },
        }
      : {}),
  });

  return globalForMailer.__kampusMailer;
}

export const smtpOtpMailer: OtpMailer = {
  async sendCode({ code, email, purpose }) {
    const { EMAIL_FROM } = getAuthEnvironment();
    const actionText =
      purpose === "registration" ? "kaydını tamamlamak" : "giriş yapmak";

    await getMailer().sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: `KAMPÜS doğrulama kodun: ${code}`,
      text: [
        `KAMPÜS'te ${actionText} için doğrulama kodun: ${code}`,
        "",
        "Bu kod 5 dakika geçerlidir ve en fazla 3 kez denenebilir.",
        "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1c2821">
          <p>KAMPÜS'te ${actionText} için doğrulama kodun:</p>
          <p style="font-size:30px;font-weight:800;letter-spacing:8px;margin:20px 0">${code}</p>
          <p>Bu kod 5 dakika geçerlidir ve en fazla 3 kez denenebilir.</p>
          <p style="color:#68736c">Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
        </div>
      `,
    });
  },
};
