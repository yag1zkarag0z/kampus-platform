import {
  DetectModerationLabelsCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { z } from "zod";

/**
 * Marker-free moderation core shared with the custom Node.js entrypoint.
 * Next.js-facing modules re-export it through a `server-only` boundary.
 */
const moderationEnvironmentSchema = z
  .object({
    MEDIA_MODERATION_DRIVER: z.enum(["off", "rekognition"]).default("off"),
    MEDIA_MODERATION_MIN_CONFIDENCE: z.coerce
      .number()
      .min(1)
      .max(100)
      .default(70),
    AWS_REGION: z.string().trim().min(1).optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      value.MEDIA_MODERATION_DRIVER !== "rekognition"
    ) {
      context.addIssue({
        code: "custom",
        message: "Production image moderation must use Rekognition.",
        path: ["MEDIA_MODERATION_DRIVER"],
      });
    }

    if (value.MEDIA_MODERATION_DRIVER === "rekognition" && !value.AWS_REGION) {
      context.addIssue({
        code: "custom",
        message: "AWS_REGION is required for Rekognition image moderation.",
        path: ["AWS_REGION"],
      });
    }
  });

export type ModerationVerdict =
  | { safe: true }
  | { safe: false; labels: readonly string[] };

export type ImageModerator = {
  inspect: (image: Buffer) => Promise<ModerationVerdict>;
};

function createRekognitionModerator(
  region: string,
  minConfidence: number,
): ImageModerator {
  const client = new RekognitionClient({ region });

  return {
    async inspect(image) {
      const response = await client.send(
        new DetectModerationLabelsCommand({
          Image: { Bytes: image },
          MinConfidence: minConfidence,
        }),
      );

      const labels = (response.ModerationLabels ?? [])
        .map((label) => label.ParentName || label.Name)
        .filter((name): name is string => Boolean(name));

      if (labels.length === 0) {
        return { safe: true };
      }

      return { safe: false, labels: [...new Set(labels)] };
    },
  };
}

const allowAllModerator: ImageModerator = {
  inspect: async () => ({ safe: true }),
};

export function createImageModerator(
  source: Readonly<Record<string, string | undefined>> = process.env,
): ImageModerator {
  const environment = moderationEnvironmentSchema.parse(source);

  if (environment.MEDIA_MODERATION_DRIVER !== "rekognition") {
    return allowAllModerator;
  }

  return createRekognitionModerator(
    environment.AWS_REGION!,
    environment.MEDIA_MODERATION_MIN_CONFIDENCE,
  );
}
