import "server-only";

import {
  createImageModerator,
  type ImageModerator,
  type ModerationVerdict,
} from "./moderation-core";

export {
  createImageModerator,
  type ImageModerator,
  type ModerationVerdict,
};

const globalForImageModerator = globalThis as typeof globalThis & {
  __kampusImageModerator?: ImageModerator;
};

export function getImageModerator() {
  if (globalForImageModerator.__kampusImageModerator) {
    return globalForImageModerator.__kampusImageModerator;
  }

  const moderator = createImageModerator();

  globalForImageModerator.__kampusImageModerator = moderator;
  return moderator;
}
