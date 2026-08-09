import {
  campusAvatarUrl,
  type CampusAvatarSeed,
} from "@/avatar/catalog";

/** Misafir akışındaki kurgusal öğrencilerle aynı avatar seti. */
export const avatarPresets = [
  { id: "ece", label: "Avatar 1", seed: "ecearslan" },
  { id: "deniz", label: "Avatar 2", seed: "deniz-akin" },
  { id: "mert", label: "Avatar 3", seed: "mertcan" },
  { id: "selin", label: "Avatar 4", seed: "selin-yilmaz" },
  { id: "can", label: "Avatar 5", seed: "canberk" },
  { id: "beril", label: "Avatar 6", seed: "beril-aydin" },
  { id: "ece-yilmaz", label: "Avatar 7", seed: "ece-yilmaz" },
  { id: "irem", label: "Avatar 8", seed: "irem-ozturk" },
] as const;

export const avatarPresetIds = avatarPresets.map((preset) => preset.id) as [
  (typeof avatarPresets)[number]["id"],
  ...(typeof avatarPresets)[number]["id"][],
];

export type AvatarPresetId = (typeof avatarPresets)[number]["id"];

export function avatarPresetUrl(id: AvatarPresetId) {
  const preset = avatarPresets.find((candidate) => candidate.id === id)!;
  return campusAvatarUrl(preset.seed as CampusAvatarSeed);
}
