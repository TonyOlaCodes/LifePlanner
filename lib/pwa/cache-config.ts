/** Workbox runtime caching for next-pwa (production builds). */
export const runtimeCaching = [
  {
    urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
    handler: "CacheFirst" as const,
    options: {
      cacheName: "lockin-google-fonts",
      expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
    },
  },
  {
    urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
    handler: "StaleWhileRevalidate" as const,
    options: {
      cacheName: "lockin-static-fonts",
      expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 7 },
    },
  },
  {
    urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
    handler: "StaleWhileRevalidate" as const,
    options: {
      cacheName: "lockin-images",
      expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
    },
  },
  {
    urlPattern: /\/_next\/static\/.*/i,
    handler: "CacheFirst" as const,
    options: {
      cacheName: "lockin-next-static",
      expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 365 },
    },
  },
  {
    urlPattern: /\/_next\/image\?url=.*/i,
    handler: "StaleWhileRevalidate" as const,
    options: {
      cacheName: "lockin-next-image",
      expiration: { maxEntries: 48, maxAgeSeconds: 60 * 60 * 24 * 7 },
    },
  },
  {
    urlPattern: /\/icons\/\d+/i,
    handler: "CacheFirst" as const,
    options: {
      cacheName: "lockin-pwa-icons",
      expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
    },
  },
  {
    urlPattern: /\/api\/rooms/i,
    handler: "NetworkOnly" as const,
    options: { cacheName: "lockin-api-rooms" },
  },
  {
    urlPattern: /^\/(?:$|habits|planner|focus|journal|settings|offline|board|poll|wave-lock|transcript|life)/i,
    handler: "NetworkFirst" as const,
    options: {
      cacheName: "lockin-pages",
      expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 7 },
      networkTimeoutSeconds: 8,
    },
  },
];
