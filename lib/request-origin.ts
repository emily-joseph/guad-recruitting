function loopback(url: URL) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol);
}

export function authActionOrigin(requestUrl: string, configuredOrigin: string | undefined, development: boolean) {
  const request = new URL(requestUrl);
  if (development && loopback(request)) return request.origin;
  return new URL(configuredOrigin || requestUrl).origin;
}

export function isAllowedOrigin(requestUrl: string, origin: string | null, configuredOrigin: string | undefined, development: boolean) {
  if (!origin || origin === "null") return false;
  try {
    const request = new URL(requestUrl);
    const allowed = new URL(configuredOrigin || requestUrl);
    if (origin === allowed.origin) return true;
    // Next may select a different localhost port when the preferred port is busy.
    return development && loopback(request) && origin === request.origin;
  } catch { return false; }
}
