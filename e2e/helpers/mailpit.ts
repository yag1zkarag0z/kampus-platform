const MAILPIT_HTTP_URL =
  process.env.MAILPIT_HTTP_URL ?? "http://127.0.0.1:8025";
const OTP_POLL_TIMEOUT_MS = 15_000;

type MailpitAddress = {
  Address: string;
};

type MailpitMessageSummary = {
  ID: string;
  Subject: string;
  To: MailpitAddress[];
};

type MailpitSearchResponse = {
  messages: MailpitMessageSummary[];
};

type MailpitMessage = {
  HTML: string;
  Subject: string;
  Text: string;
};

type OtpPurpose = "registration" | "login";

function wait(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function findMessages(email: string) {
  const searchUrl = new URL("/api/v1/search", MAILPIT_HTTP_URL);
  searchUrl.searchParams.set("query", `to:${email}`);
  searchUrl.searchParams.set("limit", "10");

  const response = await fetch(searchUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(2_000),
  });

  if (!response.ok) {
    throw new Error(
      `Mailpit search failed with status ${response.status}.`,
    );
  }

  const result = (await response.json()) as MailpitSearchResponse;

  return result.messages.filter((message) =>
    message.To.some(
      (recipient) =>
        recipient.Address.toLowerCase() === email.toLowerCase(),
    ),
  );
}

async function readMessage(messageId: string) {
  const messageUrl = new URL(
    `/api/v1/message/${encodeURIComponent(messageId)}`,
    MAILPIT_HTTP_URL,
  );
  const response = await fetch(messageUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(2_000),
  });

  if (!response.ok) {
    throw new Error(
      `Mailpit message lookup failed with status ${response.status}.`,
    );
  }

  return (await response.json()) as MailpitMessage;
}

export async function waitForOtpEmail(
  email: string,
  purpose: OtpPurpose,
) {
  const deadline = Date.now() + OTP_POLL_TIMEOUT_MS;
  const purposeMarker =
    purpose === "registration" ? "kaydını tamamlamak" : "giriş yapmak";
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const summaries = await findMessages(email);

      for (const summary of summaries) {
        const message = await readMessage(summary.ID);
        const messageContent =
          `${message.Subject}\n${message.Text}\n${message.HTML}`;

        if (!messageContent.includes(purposeMarker)) {
          continue;
        }

        const match = messageContent.match(/\b(\d{6})\b/);

        if (match?.[1]) {
          return match[1];
        }

        lastError = new Error(
          `Mailpit message for ${email} did not contain a six-digit OTP.`,
        );
      }
    } catch (error) {
      lastError = error;
    }

    await wait(200);
  }

  throw new Error(
    `No ${purpose} OTP email arrived in Mailpit for ${email} within ${OTP_POLL_TIMEOUT_MS}ms.`,
    { cause: lastError },
  );
}
