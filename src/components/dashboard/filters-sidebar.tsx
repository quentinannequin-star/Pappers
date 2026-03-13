"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, SlidersHorizontal } from "lucide-react";
import type { RefNaf, RefDepartement, RefRegion } from "@/types/database";
import { EFFECTIF_LABELS } from "@/types/database";

interface FiltersSidebarProps {
  nafCodes: RefNaf[];
  regions: RefRegion[];
  departements: RefDepartement[];
}

export function FiltersSidebar({
  nafCodes,
  regions,
  departements,
}: FiltersSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse initial state from URL
  const [selectedNaf, setSelectedNaf] = useState<string[]>(
    searchParams.get("naf")?.split(",").filter(Boolean) || []
  );
  const [selectedRegions, setSelectedRegions] = useState<string[]>(
    searchParams.get("regions")?.split(",").filter(Boolean) || []
  );
  const [selectedDepts, setSelectedDepts] = useState<string[]>(
    searchParams.get("depts")?.split(",").filter(Boolean) || []
  );
  const [effectifMin, setEffectifMin] = useState(
    searchParams.get("eff_min") || "03"
  );
  const [effectifMax, setEffectifMax] = useState(
    searchParams.get("eff_max") || "42"
  );
  const [denomination, setDenomination] = useState(
    searchParams.get("q") || ""
  );
  const [nafSearch, setNafSearch] = useState("");
  const [minAge, setMinAge] = useState(
    parseInt(searchParams.get("age") || "0")
  );

  // Filter departements by selected regions
  const filteredDepts =
    selectedRegions.length > 0
      ? departements.filter((d) => selectedRegions.includes(d.code_region))
      : departements;

  // Filter NAF codes by search
  const filteredNaf = nafSearch
    ? nafCodes.filter(
        (n) =>
          n.code.includes(nafSearch) ||
          n.libelle.toLowerCase().includes(nafSearch.toLowerCase())
      )
    : nafCodes;

  function handleSearch() {
    const params = new URLSearchParams();
    if (selectedNaf.length > 0) params.set("naf", selectedNaf.join(","));
    if (selectedRegions.length > 0)
      params.set("regions", selectedRegions.join(","));
    if (selectedDepts.length > 0) params.set("depts", selectedDepts.join(","));
    if (effectifMin !== "00") params.set("eff_min", effectifMin);
    if (effectifMax !== "53") params.set("eff_max", effectifMax);
    if (denomination) params.set("q", denomination);
    if (minAge > 0) params.set("age", minAge.toString());
    params.set("page", "1");

    router.push(`/dashboard?${params.toString()}`);
  }

  function handleReset() {
    setSelectedNaf([]);
    setSelectedRegions([]);
    setSelectedDepts([]);
    setEffectifMin("03");
    setEffectifMax("42");
    setDenomination("");
    setMinAge(0);
    router.push("/dashboard");
  }

  function toggleNaf(code: string) {
    setSelectedNaf((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function toggleRegion(code: string) {
    setSelectedRegions((prev) => {
      const next = prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code];
      // Clear dept selections if region changes
      setSelectedDepts((d) =>
        d.filter((dc) =>
          departements
            .filter((dep) => next.includes(dep.code_region))
            .map((dep) => dep.code)
            .includes(dc)
        )
      );
      return next;
    });
  }

  function toggleDept(code: string) {
    setSelectedDepts((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  const effectifOptions = Object.entries(EFFECTIF_LABELS);

  return (
    <div className="flex h-full w-80 flex-col border-r border-zinc-100 bg-white">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <h2 className="font-semibold text-zinc-900">Filtres</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-zinc-400 hover:text-zinc-600">
          Réinitialiser
        </Button>
      </div>

      <ScrollArea className="flex-1 px-5">
        <div className="space-y-5 pb-4">
          {/* Recherche par nom */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Recherche par nom</Label>
            <Input
              placeholder="Dénomination..."
              value={denomination}
              onChange={(e) => setDenomination(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="rounded-xl"
            />
          </div>

          <Separator className="bg-zinc-100" />

          {/* NAF Code */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Secteur (code NAF)</Label>
            <Input
              placeholder="Rechercher un code NAF..."
              value={nafSearch}
              onChange={(e) => setNafSearch(e.target.value)}
              className="rounded-xl text-sm"
            />
            {selectedNaf.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedNaf.map((code) => (
                  <Badge
                    key={code}
                    className="cursor-pointer rounded-lg bg-indigo-100 text-xs text-indigo-700 hover:bg-indigo-200"
                    onClick={() => toggleNaf(code)}
                  >
                    {code} <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
            <ScrollArea className="h-40 rounded-xl border border-zinc-100">
              <div className="p-1.5">
                {filteredNaf.slice(0, 100).map((naf) => (
                  <button
                    key={naf.code}
                    onClick={() => toggleNaf(naf.code)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-indigo-50 ${
                      selectedNaf.includes(naf.code)
                        ? "bg-indigo-50 font-medium text-indigo-700"
                        : "text-zinc-600"
                    }`}
                  >
                    <span className="font-mono text-zinc-400">{naf.code}</span>{" "}
                    {naf.libelle}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator className="bg-zinc-100" />

          {/* Région */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Région</Label>
            {selectedRegions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedRegions.map((code) => {
                  const region = regions.find((r) => r.code === code);
                  return (
                    <Badge
                      key={code}
                      className="cursor-pointer rounded-lg bg-emerald-100 text-xs text-emerald-700 hover:bg-emerald-200"
                      onClick={() => toggleRegion(code)}
                    >
                      {region?.nom} <X className="ml-1 h-3 w-3" />
                    </Badge>
                  );
                })}
              </div>
            )}
            <ScrollArea className="h-32 rounded-xl border border-zinc-100">
              <div className="p-1.5">
                {regions.map((region) => (
                  <button
                    key={region.code}
                    onClick={() => toggleRegion(region.code)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-emerald-50 ${
                      selectedRegions.includes(region.code)
                        ? "bg-emerald-50 font-medium text-emerald-700"
                        : "text-zinc-600"
                    }`}
                  >
                    {region.nom}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Département */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Département</Label>
            {selectedDepts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedDepts.map((code) => {
                  const dept = departements.find((d) => d.code === code);
                  return (
                    <Badge
                      key={code}
                      className="cursor-pointer rounded-lg bg-amber-100 text-xs text-amber-700 hover:bg-amber-200"
                      onClick={() => toggleDept(code)}
                    >
                      {code} - {dept?.nom} <X className="ml-1 h-3 w-3" />
                    </Badge>
                  );
                })}
              </div>
            )}
            <ScrollArea className="h-32 rounded-xl border border-zinc-100">
              <div className="p-1.5">
                {filteredDepts.map((dept) => (
                  <button
                    key={dept.code}
                    onClick={() => toggleDept(dept.code)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-amber-50 ${
                      selectedDepts.includes(dept.code)
                        ? "bg-amber-50 font-medium text-amber-700"
                        : "text-zinc-600"
                    }`}
                  >
                    <span className="font-mono text-zinc-400">{dept.code}</span>{" "}
                    {dept.nom}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator className="bg-zinc-100" />

          {/* Effectif */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Tranche effectif</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-zinc-400">Min</span>
                <select
                  value={effectifMin}
                  onChange={(e) => setEffectifMin(e.target.value)}
                  className="w-full rounded-xl border border-zinc-100 bg-white px-2.5 py-2 text-xs"
                >
                  {effectifOptions.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-xs text-zinc-400">Max</span>
                <select
                  value={effectifMax}
                  onChange={(e) => setEffectifMax(e.target.value)}
                  className="w-full rounded-xl border border-zinc-100 bg-white px-2.5 py-2 text-xs"
                >
                  {effectifOptions.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Ancienneté */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Ancienneté minimum: <span className="text-indigo-600">{minAge} ans</span>
            </Label>
            <input
              type="range"
              min={0}
              max={50}
              value={minAge}
              onChange={(e) => setMinAge(parseInt(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>
      </ScrollArea>

      <div className="border-t border-zinc-100 p-5">
        <Button onClick={handleSearch} className="h-11 w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
          <Search className="mr-2 h-4 w-4" />
          Rechercher
        </Button>
      </div>
    </div>
  );
}
