export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { encryptForPublicKey, computeBlindIndex } from "@/lib/crypto/e2ee";
import { requireAuthUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const authed = await requireAuthUser(request);
    const userId = (authed as any)?.$id || (authed as any)?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID missing" }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRole) {
      return NextResponse.json({ ok: false, error: "Supabase env vars missing" }, { status: 500 });
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: keyRow, error: keyError } = await supabase
      .from("user_keys")
      .select("publicKey, blindIndexSecret")
      .eq("userId", userId)
      .maybeSingle();
    if (keyError) {
      return NextResponse.json({ ok: false, error: keyError.message }, { status: 500 });
    }
    if (!keyRow?.publicKey || !keyRow?.blindIndexSecret) {
      return NextResponse.json({ ok: false, error: "User keys not found" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({ }));
    const description: string = body?.description || "Sample payment";
    const counterparty: string = body?.counterparty || "Test Merchant";
    const amount: number = Number(body?.amount ?? -42.5);
    const currency: string = body?.currency || "EUR";

    const encryptField = (value: unknown): string | null => {
      if (!value && value !== 0) return encryptForPublicKey(keyRow.publicKey, null);
      return encryptForPublicKey(keyRow.publicKey, typeof value === "string" ? value : String(value));
    };

    const transactionId = `test-${Date.now()}`;
    const bookingDate = body?.bookingDate || new Date().toISOString().slice(0, 10);

    const encrypted = {
      userid: userId,
      accountid_enc: encryptField(body?.accountId || "test-account"),
      transactionid_enc: encryptField(transactionId),
      amount_enc: encryptField(amount),
      currency_enc: encryptField(currency),
      bookingdate_enc: encryptField(bookingDate),
      bookingdatetime_enc: encryptField(body?.bookingDateTime || null),
      valuedate_enc: encryptField(body?.valueDate || null),
      category_enc: encryptField(body?.category || "Test"),
      exclude_enc: encryptField(false),
      description_enc: encryptField(description),
      counterparty_enc: encryptField(counterparty),
      raw_enc: encryptField(JSON.stringify(body || {})),
      desc_hmac: computeBlindIndex(keyRow.blindIndexSecret, description),
      cp_hmac: computeBlindIndex(keyRow.blindIndexSecret, counterparty),
    } as const;

    const { error: insertError } = await supabase
      .from("transactions_dev")
      .insert(encrypted);
    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    const { data, error: readError } = await supabase
      .from("transactions_dev")
      .select("id, userid, accountid_enc, transactionid_enc, amount_enc, currency_enc, bookingdate_enc, category_enc, description_enc")
      .eq("userid", userId)
      .eq("transactionid_enc", encrypted.transactionid_enc)
      .maybeSingle();
    if (readError) {
      return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inserted: encrypted, stored: data });
  } catch (err: any) {
    console.error("Supabase E2EE test failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "Test failed" }, { status: err?.status || 500 });
  }
}

