"use client";

import React, { useMemo, memo } from "react";
import { Country, State, ICountry, IState } from "country-state-city";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n-context";

interface CountryStatePickerProps {
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

// Memoized country list - only computed once
const allCountries = Country.getAllCountries();

export const CountryStatePicker = memo(function CountryStatePicker({
  selectedCountryCode,
  onCountryChange,
  selectedCityName,
  onCityChange,
  showCity = true,
  disabled = false,
  className,
  selectClassName,
  labels,
}: CountryStatePickerProps) {
  const { t } = useI18n();

  // Use translated defaults if labels not provided
  const countryLabel = labels?.country ?? t("countryStatePicker.country");
  const cityLabel = labels?.city ?? t("countryStatePicker.city");

  const citiesOfCountry = useMemo(function () {
    return State.getStatesOfCountry(selectedCountryCode) || [];
  }, [selectedCountryCode]);

  return (
    <div className={cn("grid grid-cols-2 gap-4", className)}>
      <div className="space-y-2">
        {countryLabel && <Label>{countryLabel}</Label>}
        <Select
          value={selectedCountryCode}
          onValueChange={function (value: string) {
            const country = allCountries.find(function (c: ICountry) { return c.isoCode === value; });
            onCountryChange(value, country?.name || "");
          }}
          disabled={disabled}
        >
          <SelectTrigger className={selectClassName}>
            <SelectValue placeholder={t("countryStatePicker.selectCountry")} />
          </SelectTrigger>
          <SelectContent>
            {allCountries.map(function (c: ICountry) {
              return (
                <SelectItem key={c.isoCode} value={c.isoCode}>
                  {c.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      {showCity && (
        <div className="space-y-2">
          {cityLabel && <Label>{cityLabel}</Label>}
          <Select
            value={selectedCityName}
            onValueChange={onCityChange}
            disabled={disabled || citiesOfCountry.length === 0}
          >
            <SelectTrigger className={selectClassName}>
              <SelectValue placeholder={t("countryStatePicker.selectCity")} />
            </SelectTrigger>
            <SelectContent>
              {citiesOfCountry.map(function (state: IState, index: number) {
                return (
                  <SelectItem key={`${state.name}-${index}`} value={state.name}>
                    {state.name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
});


