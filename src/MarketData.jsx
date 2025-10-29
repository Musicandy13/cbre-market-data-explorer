import React, { useState, useEffect } from "react";

export default function MarketData() {
  const [data, setData] = useState(null);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [submarket, setSubmarket] = useState("");
  const [period, setPeriod] = useState("");

  useEffect(() => {
    fetch("/market_data.json")
      .then((r) => r.json())
      .then((json) => setData(json.countries));
  }, []);

  if (!data) return <p className="p-4">Loading...</p>;

  const countries = Object.keys(data);
  const cities = country ? Object.keys(data[country].cities) : [];
  const periods =
    country && city ? Object.keys(data[country].cities[city].periods) : [];

  const submarkets =
    country && city && period
      ? Object.keys(
          data[country].cities[city].periods[period].subMarkets || {}
        )
      : [];

  const selected =
    country && city && period
      ? data[country].cities[city].periods[period]
      : null;

  // helper to format %
  const formatValue = (k, v) => {
    if (v === null || v === undefined) return "-";
    if (k.includes("Rate") || k.includes("Yield")) return (v * 100).toFixed(2) + "%";
    if (typeof v === "number") return v.toLocaleString();
    return v;
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-center text-blue-600 mb-4">
        🏢 CEE Office Market Data
      </h1>

      {/* Dropdowns stacked vertically */}
      <div className="space-y-3 mb-6">
        {/* Country */}
        <select
          className="w-full border p-2 rounded"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setCity("");
            setSubmarket("");
            setPeriod("");
          }}
        >
          <option value="">Select Country</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* City */}
        {country && (
          <select
            className="w-full border p-2 rounded"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setSubmarket("");
              setPeriod("");
            }}
          >
            <option value="">Select City</option>
            {cities.map((ct) => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </select>
        )}

        {/* Submarket */}
        {city && periods.length > 0 && (
          <select
            className="w-full border p-2 rounded"
            value={submarket}
            onChange={(e) => setSubmarket(e.target.value)}
          >
            <option value="">City Total</option>
            {period &&
              submarkets.map((sm) => (
                <option key={sm} value={sm}>
                  {sm}
                </option>
              ))}
          </select>
        )}

        {/* Period */}
        {city && (
          <select
            className="w-full border p-2 rounded"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="">Select Period</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Output */}
      {selected && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-blue-800 text-white text-center p-3 rounded">
            <h2 className="font-bold text-lg">
              {city} Office Market – {period}
              {submarket && submarket !== "" ? ` (${submarket})` : ""}
            </h2>
          </div>

          {/* Market Metrics */}
          <div className="border rounded p-3 bg-gray-50">
            <h3 className="font-semibold text-blue-700 mb-2">
              📊 Market Metrics
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(
                  submarket && submarket !== ""
                    ? selected.subMarkets?.[submarket] || {}
                    : selected.metrics
                ).map(([k, v]) => (
                  <tr key={k} className="border-b last:border-none">
                    <td className="py-1">{k}</td>
                    <td className="py-1 text-right font-medium">
                      {formatValue(k, v)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Leasing Conditions (always from city) */}
          <div className="border rounded p-3 bg-gray-50">
            <h3 className="font-semibold text-blue-700 mb-2">
              📑 Leasing Conditions
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(selected.leasing).map(([k, v]) => (
                  <tr key={k} className="border-b last:border-none">
                    <td className="py-1">{k}</td>
                    <td className="py-1 text-right font-medium">
                      {formatValue(k, v)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
