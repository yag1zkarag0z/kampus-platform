import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createAvatar } from "@dicebear/core";
import * as avataaars from "@dicebear/avataaars";

import { campusAvatarSeeds } from "../src/avatar/catalog";

const outputDirectory = path.join(
  process.cwd(),
  "public",
  "images",
  "avatars",
);

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  await Promise.all(
    campusAvatarSeeds.map(async (seed) => {
      const svg = createAvatar(avataaars, {
        seed,
        size: 512,
      }).toString();

      await writeFile(
        path.join(outputDirectory, `${seed}.svg`),
        svg,
        "utf8",
      );
    }),
  );

  await writeFile(
    path.join(outputDirectory, "ATTRIBUTION.md"),
    [
      "# Avatar attribution",
      "",
      "Generated with DiceBear Avataaars 9.4.2.",
      "Avataaars design by Pablo Stanley; used under its free personal and commercial use license.",
      "https://www.dicebear.com/styles/avataaars/",
      "",
    ].join("\n"),
    "utf8",
  );
}

void main();
