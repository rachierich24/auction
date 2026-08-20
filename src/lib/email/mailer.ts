import "server-only";

/**
 * Transport-agnostic mail. Callers depend on `sendEmail` only; swapping
 * provider is an env change (EMAIL_DRIVER) plus one adapter below.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string }>;
}

const FROM = process.env.EMAIL_FROM ?? "Maison Auctions <no-reply@maison.auction>";

/** Development default — writes the message to the server log. */
const consoleTransport: EmailTransport = {
  name: "console",
  async send(message) {
    console.info(
      [
        "",
        "──────────── EMAIL ────────────",
        `From:    ${FROM}`,
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
        "───────────────────────────────",
        "",
      ].join("\n"),
    );
    return { id: `console_${Date.now()}` };
  },
};

const resendTransport: EmailTransport = {
  name: "resend",
  async send(message) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Resend rejected the message (${response.status}): ${await response.text()}`,
      );
    }

    const body = (await response.json()) as { id: string };
    return { id: body.id };
  },
};

function transport(): EmailTransport {
  switch (process.env.EMAIL_DRIVER) {
    case "resend":
      return resendTransport;
    default:
      return consoleTransport;
  }
}

export async function sendEmail(message: EmailMessage): Promise<{ id: string }> {
  return transport().send(message);
}

export function siteUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

// -- Templates --------------------------------------------------------------

export function verifyEmailMessage(name: string, token: string): EmailMessage {
  const link = siteUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  return {
    to: "",
    subject: "Confirm your Maison Auctions account",
    text: `Welcome, ${name}.

Confirm your email address to start bidding:
${link}

This link expires in 24 hours. If you did not create an account, ignore this message.`,
  };
}

export function passwordResetMessage(name: string, token: string): EmailMessage {
  const link = siteUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  return {
    to: "",
    subject: "Reset your Maison Auctions password",
    text: `Hello ${name},

Reset your password using the link below:
${link}

This link expires in one hour and can be used once. If you did not request a reset, no action is needed.`,
  };
}
