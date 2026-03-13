"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, ChevronLeft, ChevronRight, Sparkles, Search } from "lucide-react";
import type { SearchResult } from "@/types/database";
import { EFFECTIF_LABELS } from "@/types/database";
import { useState } from "react";

interface ResultsTableProps {
  results: SearchResult[];
  total: number;
  page: number;
  perPage: number;
}

export function ResultsTable({
  results,
  total,
  page,
  perPage,
}: ResultsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [enriching, setEnriching] = useState(false);

  const totalPages = Math.ceil(total / perPage);
  const enrichedCount = results.filter((r) => r.date_enrichissement).length;

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/dashboard?${params.toString()}`);
  }

  async function handleExport() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    window.open(`/api/export?${params.toString()}`, "_blank");
  }

  async function handleEnrich() {
    setEnriching(true);
    try {
      const sirens = results
        .filter((r) => !r.date_enrichissement)
        .map((r) => r.siren);

      if (sirens.length === 0) return;

      const response = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sirens: sirens.slice(0, 50) }),
      });

      if (response.ok) {
        router.refresh();
      }
    } finally {
      setEnriching(false);
    }
  }

  function formatCA(ca: number | null) {
    if (ca == null) return "—";
    if (ca >= 1_000_000) return `${(ca / 1_000_000).toFixed(1)}M€`;
    if (ca >= 1_000) return `${(ca / 1_000).toFixed(0)}k€`;
    return `${ca}€`;
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-950">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-zinc-900 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-indigo-950 px-5 py-2.5">
            <span className="text-3xl font-bold text-indigo-400">{total.toLocaleString("fr-FR")}</span>
            <span className="ml-2 text-sm font-medium text-indigo-500">sociétés</span>
          </div>
          {enrichedCount > 0 && (
            <Badge className="rounded-lg bg-emerald-950 text-emerald-400">
              {enrichedCount} enrichie{enrichedCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnrich}
            disabled={enriching || results.length === 0}
            className="rounded-xl border-indigo-800 text-indigo-400 hover:bg-indigo-950"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {enriching ? "Enrichissement..." : "Enrichir"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={total === 0}
            className="rounded-xl"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="w-24 text-xs font-medium uppercase tracking-wider text-zinc-500">SIREN</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Dénomination</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Activité</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Ville</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Département</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Effectif</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Dirigeant</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-zinc-500">CA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-950">
                        <Search className="h-6 w-6 text-indigo-400" />
                      </div>
                      <p className="text-sm text-zinc-500">
                        {total === 0
                          ? "Aucun résultat. Ajustez vos filtres."
                          : "Utilisez les filtres pour lancer une recherche."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                results.map((company) => (
                  <TableRow
                    key={company.siren}
                    className="cursor-pointer border-zinc-800/50 transition-colors hover:bg-zinc-800/50"
                    onClick={() => router.push(`/company/${company.siren}`)}
                  >
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {company.siren}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-semibold text-white">
                      {company.denomination || "—"}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-zinc-400">
                      {company.naf_libelle || company.naf_code || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-400">
                      {company.ville || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-400">
                      {company.departement_nom || "—"}
                    </TableCell>
                    <TableCell>
                      {company.tranche_effectif ? (
                        <span className="inline-flex rounded-lg bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                          {EFFECTIF_LABELS[company.tranche_effectif] || company.tranche_effectif}
                        </span>
                      ) : (
                        <span className="text-sm text-zinc-600">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-400">
                      {company.dirigeant_nom
                        ? `${company.dirigeant_prenom || ""} ${company.dirigeant_nom}`.trim()
                        : <span className="text-zinc-600">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {company.ca_dernier_exercice ? (
                        <span className="text-emerald-400">{formatCA(company.ca_dernier_exercice)}</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900 px-6 py-3">
          <span className="text-sm text-zinc-500">
            Page {page} sur {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded-xl"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded-xl"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
