import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { errorJson, guardMutation, json } from "@/server/security/route-helpers";
import { getCurrentSession } from "@/server/auth/current-session";
import { beginMfaEnrolment } from "@/application/auth";
import { getMe } from "@/server/dal/users";

export async function POST(req: NextRequest) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const session = await getCurrentSession(req);
  if (!session) return errorJson(401, "Not authenticated");

  const me = await getMe(session.userId);
  if (!me) return errorJson(401, "Not authenticated");

  const r = await beginMfaEnrolment(session.userId, me.email);
  const qr_data_url = await QRCode.toDataURL(r.uri);
  return json({ ok: true, secret: r.secret, uri: r.uri, qr_data_url });
}
