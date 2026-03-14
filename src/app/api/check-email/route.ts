import { NextRequest, NextResponse } from "next/server";

// Server-side email whitelist check — never exposed to client bundle
const ALLOWED_EMAILS = [
  "qannequin@alvora-partners.com",
  "pajouzel@alvora-partners.com",
  "hjanoir@alvora-partners.com",
  "quentinannequin@berkeley.edu",
];

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ allowed: false });
  }

  const normalized = email.toLowerCase().trim();
  const allowed = ALLOWED_EMAILS.includes(normalized);

  return NextResponse.json({ allowed });
}
