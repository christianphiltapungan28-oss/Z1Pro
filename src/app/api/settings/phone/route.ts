import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { createOtp, verifyOtp } from "@/lib/otp";
import { sendSms, smsConfigured } from "@/lib/sms";

/** "+63 917 123 4567" from the ten digits after +63 ("9171234567"). */
function display(digits: string) {
  return `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/**
 * Add or change the mobile number (mobile Figma "Dialog / Mobile number").
 * POST { step: "send", digits } texts a 6-digit code to +63 digits;
 * POST { step: "verify", code } confirms it and saves the number.
 * Removing the number is PATCH /api/settings { phone: null }.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!smsConfigured()) {
    return NextResponse.json(
      { error: "Adding a mobile number isn't available yet." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));

  if (body?.step === "send") {
    const digits = typeof body.digits === "string" ? body.digits.replace(/\D/g, "") : "";
    if (!/^9\d{9}$/.test(digits)) {
      return NextResponse.json(
        { error: "Enter the 10 digits after +63, starting with 9." },
        { status: 400 },
      );
    }
    const otp = await createOtp("phone", userId, digits);
    if ("error" in otp) {
      return NextResponse.json({ error: otp.error }, { status: 429 });
    }
    const sent = await sendSms(
      `0${digits}`,
      `Your Z1P verification code is ${otp.code}. It expires in 10 minutes. Don't share it with anyone.`,
    );
    if (!sent) {
      return NextResponse.json(
        { error: "Couldn't send the text. Please try again." },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (body?.step === "verify") {
    const code = typeof body.code === "string" ? body.code : "";
    if (!/^\d{6}$/.test(code.trim())) {
      return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
    }
    const result = await verifyOtp("phone", userId, code);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const phone = display(result.target);
    const now = new Date();
    try {
      await db
        .insert(userSettings)
        .values({ userId, phone, phoneVerifiedAt: now })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: { phone, phoneVerifiedAt: now, updatedAt: now },
        });
    } catch (err) {
      if (isMissingTable(err)) {
        return NextResponse.json(
          { error: "These settings aren't available yet." },
          { status: 503 },
        );
      }
      throw err;
    }
    return NextResponse.json({ phone });
  }

  return NextResponse.json({ error: "Unknown step" }, { status: 400 });
}
