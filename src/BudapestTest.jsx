import React, { useEffect, useState } from "react";

export default function BudapestTest() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("");
  const [submarket, setSubmarket] = useState("City Total");

  useEffect(() => {
    fetch("/market_data_budapest.json")
      .then((r) => r.json())
      .then((json) => {
        const periods = Object.keys(
          json?.countries?.Hungary?.cities?.Budapest?.periods || {}
        );
        periods.sort((a, b) => {
          const pa = { y: +a.split(" ")[1], q: +a[1] };
          const pb = { y: +b.split(" ")[1], q: +b[1] };
          return pa.y === pb.y ? pa.q - pb.q : pa.y - pb.y;
        });
        setData(json);
        if (periods.length && !period) setPeriod(periods[0]);
      })
      .catch((e) => console.error("Failed to load Budapest data:", e));
  }, []);

  const periods =
    Object.keys(data?.countries?.Hungary?.cities?.Budapest?.periods || {}) || [];

  const submarkets =
    period
      ? ["City Total"].concat(
          Object.keys(
            data?.countries?.Hungary?.cities?.Budapest?.periods?.[period] || {}
          ).filter((k) => k !== "City Total")
        )
      : ["City Total"];

  const node =
    data?.countries?.Hungary?.cities?.Budapest?.periods?.[period]?.[submarket];

  const metrics = node?.metrics || null;
  const leasing = node?.leasing || null;

  const formatNum = (n, d = 0) =>
    n == null || isNaN(n)
      ? "-"
      : Number(n).toLocaleString("en-US", {
          minimumFractionDigits: d,
          maximumFractionDigits: d,
        });

  const formatPct = (n) => {
    if (n == null || isNaN(n)) return "-";
    const v = Number(n);
    const pct = v > 1 ? v : v * 100; // accept 6.5 or 0.065
    return `${pct.toFixed(2)}%`;
  };

  return (
    <div className="max-w-sm mx-auto p-4">
      <h1 className="text-xl font-bold text-center text-blue-700 mb-4">
        Budapest Office Market
      </h1>

      {/* Vertical dropdowns */}
      <div className="flex flex-col space-y-2 mb-5">
        <div className="border p-2 rounded bg-gray-50 text-gray-700">
          Country: <b>Hungary</b>
        </div>
        <div className="border p-2 rounded bg-gray-50 text-gray-700">
          City: <b>Budapest</b>
        </div>

        <select
          className="border p-2 rounded"
          value={submarket}
          onChange={(e) => setSubmarket(e.target.value)}
          disabled={!period}
        >
          {submarkets.map((sm) => (
            <option key={sm} value={sm}>
              {sm}
            </option>
          ))}
        </select>

        <select
          className="border p-2 rounded"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {periods
            .sort((a, b) => {
              const pa = { y: +a.split(" ")[1], q: +a[1] };
              const pb = { y: +b.split(" ")[1], q: +b[1] };
              return pa.y === pb.y ? pa.q - pb.q : pa.y - pb.y;
            })
            .map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
        </select>
      </div>

      {/* Output */}
      {metrics && leasing ? (
        <>
          <div className="bg-blue-800 text-white text-center p-3 rounded mb-3">
            <div className="font-bold">
              Budapest Office Market – {period}
              {submarket !== "City Total" ? ` (${submarket})` : ""}
            </div>
          </div>

          {/* Market Metrics */}
          <div className="border rounded p-3 mb-4 bg-gray-50">
            <h3 className="font-semibold text-blue-700 mb-2">📊 Market Metrics</h3>
            <table className="w-full text-sm">
              <tbody>
                <tr><td>Total Stock (sqm)</td><td className="text-right font-medium">{formatNum(metrics["Total Stock (sqm)"])}</td></tr>
                <tr><td>Vacancy (sqm)</td><td className="text-right font-medium">{formatNum(metrics["Vacancy (sqm)"])}</td></tr>
                <tr><td>Vacancy Rate</td><td className="text-right font-medium">{formatPct(metrics["Vacancy Rate (%)"])}</td></tr>
                <tr><td>YTD Take-Up (sqm)</td><td className="text-right font-medium">{formatNum(metrics["YTD Take-Up (sqm)"])}</td></tr>
                <tr><td>Net Absorption (sqm)</td><td className="text-right font-medium">{formatNum(metrics["Net Absorption (sqm)"])}</td></tr>
                <tr><td>YTD Completions (sqm)</td><td className="text-right font-medium">{formatNum(metrics["YTD Completions (sqm)"])}</td></tr>
                <tr><td>Under Construction (sqm)</td><td className="text-right font-medium">{formatNum(metrics["Under Construction (sqm)"])}</td></tr>
                <tr><td>Prime Rent</td><td className="text-right font-medium">{formatNum(metrics["Prime Rent"], 2)} €</td></tr>
                <tr><td>Average Rent</td><td className="text-right font-medium">{formatNum(metrics["Average Rent"], 2)} €</td></tr>
                <tr><td>Prime Yield</td><td className="text-right font-medium">{formatPct(metrics["Prime Yield"])}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Leasing Conditions */}
          <div className="border rounded p-3 bg-gray-50">
            <h3 className="font-semibold text-blue-700 mb-2">📑 Leasing Conditions</h3>
            <table className="w-full text-sm">
              <tbody>
                <tr><td>Rent-free period (month/year)</td><td className="text-right font-medium">{formatNum(leasing["Rent-free period (month/year)"], 2)}</td></tr>
                <tr><td>Lease length (months)</td><td className="text-right font-medium">{formatNum(leasing["Lease length (months)"], 0)}</td></tr>
                <tr><td>Fit-out contribution (€/sqm) - shell & core</td><td className="text-right font-medium">{formatNum(leasing["Fit-out contribution (€/sqm) - shell & core"], 2)} €</td></tr>
                <tr><td>Average service charge (€/sqm/month)</td><td className="text-right font-medium">{formatNum(leasing["Average service charge (€/sqm/month)"], 2)} €</td></tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-center text-gray-500">Select a period to view data.</p>
      )}
    </div>
  );
}
