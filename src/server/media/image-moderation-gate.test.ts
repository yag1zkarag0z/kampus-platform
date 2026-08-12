import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const moderationState = vi.hoisted(() => ({
  inspect: vi.fn(),
}));

vi.mock("./moderation", () => ({
  getImageModerator: () => ({ inspect: moderationState.inspect }),
}));

const { processImage } = await import("./service");

async function pngFile() {
  const body = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  })
    .png()
    .toBuffer();

  return new File([new Uint8Array(body)], "photo.png", { type: "image/png" });
}

describe("processImage moderation gate", () => {
  beforeEach(() => {
    moderationState.inspect.mockReset();
  });

  it("returns the encoded image when moderation is clean", async () => {
    moderationState.inspect.mockResolvedValue({ safe: true });

    const result = await processImage(await pngFile());

    expect(result.width).toBe(32);
    expect(moderationState.inspect).toHaveBeenCalledOnce();
  });

  it("refuses an image that moderation flagged", async () => {
    moderationState.inspect.mockResolvedValue({
      safe: false,
      labels: ["Explicit Nudity"],
    });

    await expect(processImage(await pngFile())).rejects.toMatchObject({
      code: "MEDIA_REJECTED",
      status: 422,
    });
  });

  it("does not leak the matched labels to the caller", async () => {
    moderationState.inspect.mockResolvedValue({
      safe: false,
      labels: ["Explicit Nudity"],
    });

    // Etiketleri söylemek eşiği deneyerek aşmayı kolaylaştırırdı.
    await expect(processImage(await pngFile())).rejects.toSatisfy(
      (error: Error) => !error.message.includes("Nudity"),
    );
  });

  it("fails the upload when the moderation service is unavailable", async () => {
    moderationState.inspect.mockRejectedValue(new Error("rekognition down"));

    // Taranmamış görseli yayına almaktansa yükleme düşer.
    await expect(processImage(await pngFile())).rejects.toMatchObject({
      code: "MEDIA_MODERATION_UNAVAILABLE",
      status: 503,
    });
  });

  it("scans the encoded output, not the original upload", async () => {
    moderationState.inspect.mockResolvedValue({ safe: true });

    const result = await processImage(await pngFile());
    const scanned = moderationState.inspect.mock.calls[0]![0] as Buffer;

    // Rekognition WebP'yi de okuyor; yeniden kodlanmış gövdeyi taramak,
    // sharp'ın attığı gizli veriyi (EXIF, ek karel-er) taramanın dışında
    // bırakmamak için önemli.
    expect(Buffer.compare(scanned, result.body)).toBe(0);
  });
});
