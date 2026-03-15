import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { EFFECTIF_LABELS, FORME_JURIDIQUE_LABELS } from "@/types/database";
import { notFound } from "next/navigation";
import { BackButton } from "./back-button";

interface CompanyPageProps {
  params: Promise<{ siren: string }>;
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { siren } = await params;
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("siren", siren)
    .single();

  if (!company) notFound();

  const { data: naf } = await supabase
    .from("ref_naf")
    .select("libelle")
    .eq("code", company.naf_code)
    .single();

  function formatCA(ca: number | null) {
    if (ca == null) return "—";
    if (ca >= 1_000_000) return `${(ca / 1_000_000).toFixed(1)}M€`;
    if (ca >= 1_000) return `${(ca / 1_000).toFixed(0)}k€`;
    return `${ca}€`;
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <BackButton />

      <div className="space-y-6">
        {/* Company header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {company.denomination || "Sans dénomination"}
                </CardTitle>
                <p className="mt-1 font-mono text-sm text-zinc-400">
                  SIREN {siren}
                </p>
              </div>
              {company.date_enrichissement && (
                <Badge variant="secondary">Enrichie</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <InfoItem
                label="Activité (NAF)"
                value={
                  naf?.libelle
                    ? `${company.naf_code} — ${naf.libelle}`
                    : company.naf_code
                }
              />
              <InfoItem
                label="Effectif"
                value={
                  company.tranche_effectif
                    ? EFFECTIF_LABELS[company.tranche_effectif] ||
                      company.tranche_effectif
                    : null
                }
              />
              <InfoItem label="Catégorie" value={company.categorie_entreprise} />
              <InfoItem
                label="Forme juridique"
                value={
                  company.forme_juridique
                    ? FORME_JURIDIQUE_LABELS[company.forme_juridique] || company.forme_juridique
                    : null
                }
              />
              <InfoItem label="Date de création" value={company.date_creation} />
              <InfoItem
                label="État"
                value={
                  company.etat_administratif === "A" ? "Active" : "Fermée"
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Dirigeant + Financials */}
        {company.date_enrichissement && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dirigeant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <InfoItem
                    label="Nom"
                    value={
                      [company.dirigeant_prenom, company.dirigeant_nom]
                        .filter(Boolean)
                        .join(" ") || null
                    }
                  />
                  <InfoItem label="Fonction" value={company.dirigeant_fonction} />
                  <InfoItem
                    label="Âge estimé"
                    value={
                      company.dirigeant_age_est
                        ? `${company.dirigeant_age_est} ans`
                        : null
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Données financières</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <InfoItem
                    label="Chiffre d'affaires"
                    value={formatCA(company.ca_dernier_exercice)}
                  />
                  <InfoItem
                    label="Résultat net"
                    value={formatCA(company.resultat_net)}
                  />
                  <InfoItem
                    label="Enrichi le"
                    value={company.date_enrichissement}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Adresse siège */}
        {company.siege_adresse && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Siège social</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {company.siege_adresse}
              </p>
              <p className="text-sm text-zinc-400">
                {company.siege_code_postal} {company.siege_ville}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}
