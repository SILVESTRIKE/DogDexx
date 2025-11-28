"use client";

import React, { useMemo } from "react";
import { Country, State } from "country-state-city";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LocationPickerProps {
  selectedCountryCode: string;
  onCountryChange: (countryCode: string, countryName: string) => void;
  selectedCityName: string;
  onCityChange: (cityName: string) => void;
  showCity?: boolean;
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
  labels?: {
    country?: string;
    city?: string;
  };
}

export function LocationPicker({
  selectedCountryCode,
  onCountryChange,
  selectedCityName,
  onCityChange,
  showCity = true,
  disabled = false,
  className,
  selectClassName,
  labels = { country: "Quốc gia", city: "Thành phố" },
}: LocationPickerProps) {
  const allCountries = useMemo(() => Country.getAllCountries(), []);
  const citiesOfCountry = useMemo(() => {
    return State.getStatesOfCountry(selectedCountryCode) || [];
  }, [selectedCountryCode]);

  return (
    <div className={cn("grid grid-cols-2 gap-4", className)}>
      <div className="space-y-2">
        {labels.country && <Label>{labels.country}</Label>}
        <Select
          value={selectedCountryCode}
          onValueChange={(value) => {
            const country = allCountries.find((c) => c.isoCode === value);
            onCountryChange(value, country?.name || "");
          }}
          disabled={disabled}
        >
          <SelectTrigger className={selectClassName}>
            <SelectValue placeholder="Chọn quốc gia" />
          </SelectTrigger>
          <SelectContent>
            {allCountries.map((c) => (
              <SelectItem key={c.isoCode} value={c.isoCode}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showCity && (
        <div className="space-y-2">
          {labels.city && <Label>{labels.city}</Label>}
          <Select
            value={selectedCityName}
            onValueChange={onCityChange}
            disabled={disabled || citiesOfCountry.length === 0}
          >
            <SelectTrigger className={selectClassName}>
              <SelectValue placeholder="Chọn thành phố" />
            </SelectTrigger>
            <SelectContent>
              {citiesOfCountry.map((state, index) => (
                <SelectItem key={`${state.name}-${index}`} value={state.name}>
                  {state.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
