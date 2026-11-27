import type { NextConfig } from "next";

const r2Domain = process.env.R2_PUBLIC_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. Mídias só do próprio site e do bucket R2; imagens externas apenas dos CDNs
 * usados pelo widget de atividade (Discord/Spotify); fetch/WebSocket só para a Lanyard e upload direto no R2.
 * Scripts inline são necessários para o payload do App Router (sem nonce, a página seria 100% dinâmica);
 * em desenvolvimento o HMR precisa de eval e WebSocket.
 */
function contentSecurityPolicy(): string {
  const r2 = r2Domain ? `https://${r2Domain}` : "";
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", r2, "https://cdn.discordapp.com", "https://media.discordapp.net", "https://i.scdn.co", "https://avatars.githubusercontent.com"],
    "media-src": ["'self'", "blob:", r2],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", "https://api.lanyard.rest", "wss://api.lanyard.rest", "https://*.r2.cloudflarestorage.com", r2, ...(isDev ? ["ws:", "wss:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values.filter(Boolean)].join(" "))
    .join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  images: {
    remotePatterns: r2Domain ? [{ protocol: "https", hostname: r2Domain }] : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          // HSTS só em produção (HTTPS); em desenvolvimento quebraria o acesso via http://.
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
