import { describe, expect, it } from "vitest";

import { normalizeSmtpPassword } from "./mailer";

describe("normalizeSmtpPassword", () => {
  it("removes presentation whitespace from Gmail app passwords", () => {
    expect(
      normalizeSmtpPassword(
        "smtp.gmail.com",
        "abcd efgh ijkl mnop",
      ),
    ).toBe("abcdefghijklmnop");
  });

  it("preserves whitespace for other SMTP providers", () => {
    expect(
      normalizeSmtpPassword("smtp.example.com", "real password"),
    ).toBe("real password");
  });
});
