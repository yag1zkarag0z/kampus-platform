import "server-only";

import { createAvatar } from "@dicebear/core";
import * as avataaars from "@dicebear/avataaars";

import {
  avatarPresets,
  type AvatarPresetId,
} from "@/avatar/presets";

export function renderAvatarPresetSvg(id: AvatarPresetId) {
  const preset = avatarPresets.find((candidate) => candidate.id === id)!;

  return createAvatar(avataaars, {
    seed: preset.seed,
    size: 512,
  }).toString();
}
