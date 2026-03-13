import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchDirigeants, rateLimit } from "@/lib/enrichment";
import { NextRequest, NextResponse } from "next/server";

const throttle = rateLimit(4); // 4 req/sec to stay safe under 7/sec limit

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sirens } = (await request.json()) as { sirens: string[] };

  if (!sirens || sirens.length === 0) {
    return NextResponse.json({ error: "No SIRENs provided" }, { status: 400 });
  }

  // Cap at 50 per request
  const batch = sirens.slice(0, 50);
  const enriched: string[] = [];

  for (const siren of batch) {
    await throttle();

    const dirigeant = await fetchDirigeants(siren);

    const { error } = await supabaseAdmin
      .from("companies")
      .update({
        dirigeant_nom: dirigeant.nom,
        dirigeant_prenom: dirigeant.prenom,
        dirigeant_fonction: dirigeant.fonction,
        dirigeant_age_est: dirigeant.age_est,
        date_enrichissement: new Date().toISOString(),
      })
      .eq("siren", siren);

    if (!error) {
      enriched.push(siren);
    }
  }

  return NextResponse.json({
    enriched: enriched.length,
    total: batch.length,
  });
}
