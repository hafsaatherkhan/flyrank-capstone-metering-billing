import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protected routes requiring active authentication
const PROTECTED_PATHS = ["/dashboard", "/playground", "/events", "/connect"];
const ACCESS_TOKEN_KEY = "hisaabledger_access_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isProtected) {
    const token = request.cookies.get(ACCESS_TOKEN_KEY)?.value;

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/playground/:path*",
    "/events/:path*",
    "/connect/:path*",
  ],
};
