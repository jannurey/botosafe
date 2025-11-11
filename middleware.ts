import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = [
  // admin pages
  "/admin/admins",
  "/admin/candidates",
  "/admin/dashboard",
  "/admin/elections/position",
  "/admin/elections",
  "/admin/profile/edit",
  "/admin/profile",
  "/admin/settings",
  "/admin/voters",

  // face-scan and signin flow
  "/face-scan",

  // user pages (listed "pages/..." variants and clean variants)
  "/pages/candidates",
  "/pages/dashboard",
  "/pages/profile",
  "/pages/vote",
  "/candidates",
  "/dashboard",
  "/profile",
  "/vote",

  // signin/flow (prevent navigating back to signin after logout)
  "/signin/face-register",
  "/signin/face-scan",
  "signin/login/forgot-password",
  "/signin/login/reset-password",
  "/signin/verify-otp",
  "/signin",
];

function isProtected(pathname: string) {
  // Normalize trailing slash
  const p = pathname.replace(/\/+$/, "");
  return PROTECTED_PATHS.some(
    (prefix) =>
      p === prefix || p.startsWith(prefix + "/") || p.startsWith(prefix)
  );
}

export function middleware(req: NextRequest) {
  const { nextUrl, cookies } = req;
  const pathname = nextUrl.pathname;

  // Allow public or API or static asset paths (don't protect)
  // Also allow the signin page itself and public API endpoints
  const publicPrefixes = [
    "/api/",
    "/_next/",
    "/_static/",
    "/static/",
    "/favicon.ico",
    "/signin",
  ];
  for (const pre of publicPrefixes) {
    if (pathname.startsWith(pre)) return NextResponse.next();
  }

  if (!isProtected(pathname)) {
    // not a protected path — let it through
    return NextResponse.next();
  }

  // Check for auth cookie (adjust name if different)
  const authToken =
    cookies.get("authToken")?.value ?? cookies.get("token")?.value;

  if (!authToken) {
    // Not authenticated — redirect to signin/login
    const loginUrl = new URL("/signin/login", req.url);
    // Add a returnTo param so user can go back after login (optional)
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth cookie present — allow (server-side verification could be added here)
  return NextResponse.next();
}

// Limit middleware to run on all paths (or narrow if you want)
// NOTE: Next.js expects a config export to match paths — run on all requests.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
