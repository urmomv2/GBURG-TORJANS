// src/lib/mediaCover.tsx
// Cover image loader that proxies through the server so YouTube/iTunes
// artwork renders without referrer blocks or CORS errors.

import { useEffect, useState, type ImgHTMLAttributes } from "react";

// ------------------------------------------------------------------
//  Encrypt the target URL so it can be passed safely in a path segment
// ------------------------------------------------------------------
// We XOR the URI-encoded URL with a rotating key, then base64url-encode
// the result. The server reverses it. This is NOT cryptographic security
// — it's just a tamper-resistant envelope so scrapers can't trivially
// enumerate remote URLs by reading our request paths.
const KEY = [116, 114, 111, 106, 97, 110, 115, 33]; // "trojans!"

function enc(url: string): string {
  const input = encodeURIComponent(url);
  let bin = "";
  for (let i = 0; i < input.length; i++) {
    bin += String.fromCharCode(input.charCodeAt(i) ^ KEY[i % KEY.length]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ------------------------------------------------------------------
//  Resolve an artwork URL to its served path
// ------------------------------------------------------------------
export function coverSrc(url: string): string {
  const u = String(url || "").trim();
  if (!u) return "";

  // Already a local path (our server or data/blob URIs)
  if (
    u.startsWith("/api/cover/") ||
    u.startsWith("/storage/") ||
    u.startsWith("data:") ||
    u.startsWith("blob:")
  ) {
    return u;
  }

  // Local paths pass through untouched
  if (u.startsWith("/") && !u.startsWith("//")) return u;

  // Only proxy absolute http(s) URLs
  if (!/^https?:\/\//i.test(u)) return u;

  // Googleusercontent / ytimg / mzstatic all block referrers on
  // cross-origin loads without a proxy. Route them through our server.
  try {
    return "/api/cover/" + enc(u);
  } catch {
    return u;
  }
}

// ------------------------------------------------------------------
//  Component
// ------------------------------------------------------------------
export function CoverImg({
  src,
  onError,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement>) {
  const orig = String(src || "");
  const [cur, setCur] = useState(() => coverSrc(orig));

  useEffect(() => {
    setCur(coverSrc(orig));
  }, [orig]);

  return (
    <img
      {...rest}
      src={cur}
      referrerPolicy="no-referrer"
      loading={rest.loading || "lazy"}
      onError={(e) => {
        // If the proxied URL failed, fall back to the original remote URL
        // (the browser may still be able to load it directly).
        if (orig && cur !== orig) {
          setCur(orig);
          return;
        }
        onError?.(e);
      }}
    />
  );
}