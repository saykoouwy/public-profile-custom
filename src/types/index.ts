export const SOCIAL_PLATFORMS = [
  "x",
  "steam",
  "spotify",
  "lastfm",
  "discord",
  "instagram",
  "github",
  "youtube",
  "tiktok",
  "twitch",
  "custom",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const ACTIVITY_TYPES = ["LISTENING", "PLAYING"] as const;

export const BACKGROUND_TYPES = ["IMAGE", "GIF", "VIDEO"] as const;
export type BackgroundKind = (typeof BACKGROUND_TYPES)[number];

export type PublicSocialLink = {
  id: string;
  platform: string;
  label: string | null;
  url: string;
  iconName: string;
};

export type PublicTrack = {
  id: string;
  title: string | null;
  artist: string | null;
  audioUrl: string;
  coverUrl: string | null;
};

export type AdminTrack = {
  id: string;
  title: string;
  artist: string;
  audioUrl: string | null;
  coverUrl: string | null;
};

export const MAX_TRACKS = 5;

/** Dados do perfil seguros para enviar ao cliente (sem userId ou campos internos). */
export type PublicProfile = {
  displayName: string;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  hasHaloEffect: boolean;
  customCursorUrl: string | null;
  backgroundType: BackgroundKind;
  backgroundUrl: string | null;
  tracks: PublicTrack[];
  shuffleTracks: boolean;
  discordUserId: string | null;
  showDiscordStatus: boolean;
  manualStatusText: string | null;
  manualActivityType: string | null;
  viewsCount: number;
  socialLinks: PublicSocialLink[];
};

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export type UploadKind = "background" | "audio" | "audioCover" | "avatar" | "cursor";
