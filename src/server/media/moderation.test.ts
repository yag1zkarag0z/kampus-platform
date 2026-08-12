import { describe, expect, it } from "vitest";

import { createImageModerator } from "./moderation";

describe("createImageModerator", () => {
  it("allows everything when the driver is off", async () => {
    const moderator = createImageModerator({});

    // Yerel geliştirme ve testler AWS kimlik bilgisi olmadan çalışmalı.
    await expect(
      moderator.inspect(Buffer.from([1, 2, 3])),
    ).resolves.toEqual({ safe: true });
  });

  it("requires a region before Rekognition can be selected", () => {
    expect(() =>
      createImageModerator({ MEDIA_MODERATION_DRIVER: "rekognition" }),
    ).toThrow();
  });

  it("rejects an unknown driver instead of silently disabling scanning", () => {
    // Yazım hatası taramayı sessizce kapatmamalı.
    expect(() =>
      createImageModerator({ MEDIA_MODERATION_DRIVER: "rekognitionn" }),
    ).toThrow();
  });

  it("rejects a confidence threshold outside the percentage range", () => {
    expect(() =>
      createImageModerator({
        MEDIA_MODERATION_DRIVER: "rekognition",
        AWS_REGION: "eu-central-1",
        MEDIA_MODERATION_MIN_CONFIDENCE: "0",
      }),
    ).toThrow();
  });

  it("builds a Rekognition moderator when fully configured", () => {
    const moderator = createImageModerator({
      MEDIA_MODERATION_DRIVER: "rekognition",
      AWS_REGION: "eu-central-1",
    });

    expect(moderator.inspect).toBeTypeOf("function");
  });
});
