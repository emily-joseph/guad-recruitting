import { NextResponse, type NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  void _request;
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/apply/:path*", "/login", "/reset-password", "/admin/:path*", "/auth/:path*", "/api/:path*"] };
