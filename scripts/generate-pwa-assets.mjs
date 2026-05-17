/**
 * Optional: replace dynamic /icons/* routes with branded PNGs for stores & iOS.
 *
 * 1. Export 512×512 and 192×192 PNGs (maskable safe zone ~80% center).
 * 2. Save as public/icons/icon-512.png and public/icons/icon-192.png
 * 3. Point manifest.json "src" to those paths if you prefer static files.
 *
 * Splash (iPhone): use https://progressier.com/pwa-icons-and-ios-splash-screen-generator
 * or apple-touch-startup-image meta tags per device size in app/layout.tsx.
 */

console.log("Lock In PWA icons: default routes /icons/192 and /icons/512 are generated at runtime.");
console.log("Drop branded PNGs in public/icons/ and update manifest.json when ready.");
