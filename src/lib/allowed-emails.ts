export const ALLOWED_EMAILS = [
  "qannequin@alvora-partners.com",
  "pajouzel@alvora-partners.com",
  "hjanoir@alvora-partners.com",
  "quentinannequin@berkeley.edu",
];

export function isEmailAllowed(email: string): boolean {
  return ALLOWED_EMAILS.includes(email.toLowerCase().trim());
}
