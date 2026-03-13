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
    <div className="flex h-full w-80 flex-col border-r border-zinc-200 bg-white">
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <h2 className="font-semibold">Filtres</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <X className="mr-1 h-3 w-3" />
          Reset
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-5 pb-4">
          {/* Recherche par nom */}
          <div className="space-y-2">
            <Label>Recherche par nom</Label>
            <Input
              placeholder="Dénomination..."
              value={denomination}
              onChange={(e) => setDenomination(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          <Separator />

          {/* NAF Code */}
          <div className="space-y-2">
            <Label>Secteur (code NAF)</Label>
            <Input
              placeholder="Rechercher un code NAF..."
              value={nafSearch}
              onChange={(e) => setNafSearch(e.target.value)}
              className="text-sm"
            />
            {selectedNaf.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedNaf.map((code) => (
                  <Badge
                    key={code}
                    variant="secondary"
                    className="cursor-pointer text-xs"
                    onClick={() => toggleNaf(code)}
                  >
                    {code} <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
            <ScrollArea className="h-40 rounded-md border">
              <div className="p-2">
                {filteredNaf.slice(0, 100).map((naf) => (
                  <button
                    key={naf.code}
                    onClick={() => toggleNaf(naf.code)}
                    className={`w-full rounded px-2 py-1 text-left text-xs hover:bg-zinc-100 ${
                      selectedNaf.includes(naf.code)
                        ? "bg-zinc-100 font-medium"
                        : ""
                    }`}
                  >
                    <span className="font-mono text-zinc-500">{naf.code}</span>{" "}
                    {naf.libelle}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Région */}
          <div className="space-y-2">
            <Label>Région</Label>
            {selectedRegions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedRegions.map((code) => {
                  const region = regions.find((r) => r.code === code);
                  return (
                    <Badge
                      key={code}
                      variant="secondary"
                      className="cursor-pointer text-xs"
                      onClick={() => toggleRegion(code)}
                    >
                      {region?.nom} <X className="ml-1 h-3 w-3" />
                    </Badge>
                  );
                })}
              </div>
            )}
            <ScrollArea className="h-32 rounded-md border">
              <div className="p-2">
                {regions.map((region) => (
                  <button
                    key={region.code}
                    onClick={() => toggleRegion(region.code)}
                    className={`w-full rounded px-2 py-1 text-left text-xs hover:bg-zinc-100 ${
                      selectedRegions.includes(region.code)
                        ? "bg-zinc-100 font-medium"
                        : ""
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
            <Label>Département</Label>
            {selectedDepts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedDepts.map((code) => {
                  const dept = departements.find((d) => d.code === code);
                  return (
                    <Badge
                      key={code}
                      variant="secondary"
                      className="cursor-pointer text-xs"
                      onClick={() => toggleDept(code)}
                    >
                      {code} - {dept?.nom} <X className="ml-1 h-3 w-3" />
                    </Badge>
                  );
                })}
              </div>
            )}
            <ScrollArea className="h-32 rounded-md border">
              <div className="p-2">
                {filteredDepts.map((dept) => (
                  <button
                    key={dept.code}
                    onClick={() => toggleDept(dept.code)}
                    className={`w-full rounded px-2 py-1 text-left text-xs hover:bg-zinc-100 ${
                      selectedDepts.includes(dept.code)
                        ? "bg-zinc-100 font-medium"
                        : ""
                    }`}
                  >
                    <span className="font-mono text-zinc-500">{dept.code}</span>{" "}
                    {dept.nom}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Effectif */}
          <div className="space-y-2">
            <Label>Tranche effectif</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-zinc-500">Min</span>
                <select
                  value={effectifMin}
                  onChange={(e) => setEffectifMin(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                >
                  {effectifOptions.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Max</span>
                <select
                  value={effectifMax}
                  onChange={(e) => setEffectifMax(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs"
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
            <Label>Ancienneté minimum: {minAge} ans</Label>
            <input
              type="range"
              min={0}
              max={50}
              value={minAge}
              onChange={(e) => setMinAge(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </ScrollArea>

      <div className="border-t border-zinc-200 p-4">
        <Button onClick={handleSearch} className="w-full">
          <Search className="mr-2 h-4 w-4" />
          Rechercher
        </Button>
      </div>
    </div>
  );
}
