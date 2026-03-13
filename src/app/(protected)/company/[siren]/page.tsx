import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EFFECTIF_LABELS } from "@/types/database";
import { notFound } from "next/navigation";

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

  const { data: etablissements } = await supabase
    .from("etablissements")
    .select("*")
    .eq("siren", siren)
    .order("est_siege", { ascending: false });

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
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux résultats
        </Button>
      </Link>

      <div className="space-y-6">
        {/* Company header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {company.denomination || "Sans dénomination"}
                </CardTitle>
                <p className="mt-1 font-mono text-sm text-zinc-500">
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
                value={company.forme_juridique}
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

        {/* Etablissements */}
        {etablissements && etablissements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Établissements ({etablissements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {etablissements.map((etab) => (
                  <div
                    key={etab.siret}
                    className="flex items-start justify-between rounded-lg border border-zinc-100 p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-500">
                          {etab.siret}
                        </span>
                        {etab.est_siege && (
                          <Badge variant="outline" className="text-xs">
                            Siège
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm">
                        {[etab.numero_voie, etab.type_voie, etab.libelle_voie]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {etab.code_postal} {etab.commune}
                      </p>
                    </div>
                    {etab.enseigne && (
                      <span className="text-sm text-zinc-600">
                        {etab.enseigne}
                      </span>
                    )}
                  </div>
                ))}
              </div>
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
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}
