// src/DataExplorer.jsx
import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
} from "recharts";
import "./App.css";

/* ===== Formatting Helpers ===== */
function fmtNumber(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(n)) return "–";
  const v = Number(n);

  // ✅ Large values (>= 1000) – show as integers
  if (Math.abs(v) >= 1000) {
    return v.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  // ✅ Small values (< 1000) – always two decimals
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtMoney(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(n)) return "–";
  const v = Number(n);
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPercent(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(n)) return "–";
  const v = Number(n);
  if (Math.abs(v) <= 1) return (v * 100).toFixed(2) + "%";
  return v.toFixed(2) + "%";
}

function coerceNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (s === "" || s === "–") return null;
  s = s.replace(/[€%\s]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const num = parseFloat(s);
  return Number.isNaN(num) ? null : num;
}

function formatMaybeRange(v, kind = "number") {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "number")
    return kind === "money" ? fmtMoney(v) : fmtNumber(v);

  const parts = String(v)
    .replace(/€/g, "")
    .split(/\s*(?:-|–|to)\s*/i);
  if (parts.length >= 2) return `${parts[0]} – ${parts[1]}`;
  return v;
}

// === Helper for comparing periods chronologically (e.g. Q1 2020 < Q4 2020) ===
function comparePeriods(a, b) {
  if (!a || !b) return 0;
  const [qa, ya] = a.split(" ");
  const [qb, yb] = b.split(" ");
  if (ya !== yb) return Number(ya) - Number(yb);
  return Number(qa.replace("Q", "")) - Number(qb.replace("Q", ""));
}


/* ===== Reusable Row ===== */
function Row({ label, value }) {
  return (
    <div className="row">
      <div className="row-label">{label}</div>
      <div className="row-value">{value}</div>
    </div>
  );
}

/* ===== Historical Series Builder ===== */
function buildTrendSeries(raw, sector, country, city, submarket, metric) {
  const cityNode = raw?.countries?.[sector]?.[country]?.cities?.[city];
  // ... rest bleibt gleichc
  if (!cityNode?.periods) return [];
  const periods = Object.keys(cityNode.periods);

  const sortPeriods = (a, b) => {
    const [qa, ya] = a.split(" ");
    const [qb, yb] = b.split(" ");
    if (ya !== yb) return Number(ya) - Number(yb);
    return Number(qa.replace("Q", "")) - Number(qb.replace("Q", ""));
  };

  const out = [];
  for (const p of periods.sort(sortPeriods)) {
    const cityData = cityNode.periods?.[p];
    if (!cityData) continue;
    const subData = cityData?.subMarkets?.[submarket] || {};
    const leasing = cityData?.leasing || {};
    const merged = { ...leasing, ...subData };
    const val = coerceNumber(merged?.[metric]);
    if (val !== null) out.push({ period: p, value: val });
  }
  return out;
}

/* ===== Tooltip Component (deduplicated) ===== */
const MultiTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  // ✅ remove duplicates by combining same name+value
  const unique = Array.from(
    new Map(payload.map(p => [`${p.name}:${p.value}`, p])).values()
  );

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ccc",
        padding: "6px 10px",
        fontSize: "12px",
      }}
    >
      <strong>{label}</strong>
      {unique.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {fmtNumber(p.value)}
        </div>
      ))}
    </div>
  );
};


/* ===== Main App ===== */
export default function DataExplorerApp() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sector, setSector] = useState("Office");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [submarket, setSubmarket] = useState("");
  const [period, setPeriod] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("primeRentEurSqmMonth");

// 🔹 Smarter scaling — labels grow more with fewer bars
const getDynamicFontSize = (dataLength, kind = "axis") => {
  if (kind === "label") {
    // labels: grow faster when fewer bars
    return Math.max(11, Math.min(20, 22 - dataLength * 0.6)); // range 11–20px
  } else {
    // axes: more subtle scaling
    return Math.max(9, Math.min(13, 15 - dataLength * 0.1)); // range 9–13px
  }
};

// 🔹 Helper: reusable Bar + LabelList with dynamic font
const renderBarWithLabels = (key, color, scaleBoost = 1) => (
  <Bar dataKey={key} fill={color} radius={[3, 3, 0, 0]}>
    <LabelList
      dataKey={key}
      position="center"
      content={({ x, y, width, height, value }) => {
        if (value == null) return null;
        const cx = x + width / 2;
        const cy = y + height / 2;

        // Dynamic font scaling
        let fontSize = getDynamicFontSize(mergedData.length, "label");
        fontSize = Math.round(fontSize * scaleBoost); // 🔸 boost by factor (e.g. 1.1)

        return (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            transform={`rotate(-90, ${cx}, ${cy})`}
            fill="#fff"
            fontSize={fontSize}
            fontWeight="600"
            style={{
              pointerEvents: "none",
              paintOrder: "stroke",
              stroke: "rgba(0,0,0,0.25)",
              strokeWidth: 2,
            }}
          >
            {fmtNumber(value)}
          </text>
        );
      }}
    />
  </Bar>
);



  // Historical Trend period range
const [startPeriod, setStartPeriod] = useState("");
const [endPeriod, setEndPeriod] = useState("");


  // Comparison controls
  const [showComp2, setShowComp2] = useState(false);
  const [showComp3, setShowComp3] = useState(false);
  const [country2, setCountry2] = useState("");
  const [city2, setCity2] = useState("");
  const [submarket2, setSubmarket2] = useState("");
  const [country3, setCountry3] = useState("");
  const [city3, setCity3] = useState("");
  const [submarket3, setSubmarket3] = useState("");

  
  // 1. Der Fetch-Effekt (ca. Zeile 230)
  useEffect(() => {
    fetch("/market_data.json")
      .then((r) => r.json())
      .then((json) => {
        setRaw(json);
        const firstSector = Object.keys(json.countries || {})[0];
        const firstCountry = Object.keys(json.countries[firstSector] || {})[0];
        const firstCity = Object.keys(json.countries[firstSector]?.[firstCountry]?.cities || {})[0] || "";
        const periods = Object.keys(json.countries[firstSector]?.[firstCountry]?.cities?.[firstCity]?.periods || {}).sort(comparePeriods);
        const latestPeriod = periods[periods.length - 1];
        const subs = Object.keys(json.countries[firstSector]?.[firstCountry]?.cities?.[firstCity]?.periods?.[latestPeriod]?.subMarkets || {});

        setSector(firstSector);
        setCountry(firstCountry);
        setCity(firstCity);
        setPeriod(latestPeriod);
        setSubmarket(subs[0] || "");
        setStartPeriod(periods[Math.max(0, periods.length - 20)]);
        setEndPeriod(latestPeriod);
        setLoading(false);
      });
  }, []); // Wichtig: leeres Array hier!

  // 2. Der Haupt-Cascading-Effekt (Sektor & Land)
  useEffect(() => {
    if (!raw || !sector) return;
    const availableCountries = Object.keys(raw.countries[sector] || {});
    if (!availableCountries.includes(country)) {
      setCountry(availableCountries[0] || "");
      return; 
    }
    const cities = Object.keys(raw.countries[sector][country].cities || {});
    if (!cities.includes(city)) {
      const firstCity = cities[0] || "";
      setCity(firstCity);
    }
  }, [sector, country, raw]);

  // 3. Der Stadt-Effekt
  useEffect(() => {
    if (!raw || !sector || !country || !city || !raw.countries[sector]?.[country]?.cities?.[city]) return;
    const node = raw.countries[sector][country].cities[city];
    const periods = Object.keys(node?.periods || {}).sort(comparePeriods);
    const latest = periods[periods.length - 1] || "";
    if (!periods.includes(period)) setPeriod(latest);
    const subs = Object.keys(node?.periods?.[latest]?.subMarkets || {});
    if (!subs.includes(submarket)) setSubmarket(subs[0] || "");
  }, [city, sector, country, raw]);

// --- Default + cascading logic for comparison markets (safe version) ---
useEffect(() => {
  if (!raw?.countries) return;

  // === MARKET 2 ===
  if (showComp2) {
    const countryList = Object.keys(raw.countries[sector] || {});
    // default
    if (!country2) {
      const defaultCountry = raw.countries[sector]?.["Austria"] ? "Austria" : countryList[0];
      setCountry2(defaultCountry);
      return;
    }

    // ensure valid country
    if (!raw.countries[country2]) return;

    const cities2 = Object.keys(raw.countries[sector][country2]?.cities || {}); // <--- sector hinzugefügt
    if (!city2 || !cities2.includes(city2)) {
      const firstCity = cities2[0] || "";
      setCity2(firstCity);
      return;
    }

    const periods2 = Object.keys(raw.countries[sector]?.[country2]?.cities[city2]?.periods || {}   );
    const latest2 = periods2[periods2.length - 1] || "";
    const subs2 = Object.keys(
      raw.countries[country2].cities[city2]?.periods?.[latest2]?.subMarkets || {}
    );
    if (!submarket2 || !subs2.includes(submarket2)) {
      setSubmarket2(subs2[0] || "");
    }
  }

  // === MARKET 3 ===
  if (showComp3) {
    const countryList = Object.keys(raw.countries[sector] || {});
    // default
    if (!country3) {
      const defaultCountry = raw.countries[sector]?.["Austria"] ? "Austria" : countryList[0];
      setCountry3(defaultCountry);
      return;
    }

    // ensure valid country
    if (!raw.countries[country3]) return;

    const cities3 = Object.keys(raw.countries[sector][country3]?.cities || {}); // <--- sector hinzugefügt
    if (!city3 || !cities3.includes(city3)) {
      const firstCity = cities3[0] || "";
      setCity3(firstCity);
      return;
    }

    const periods3 = Object.keys(raw.countries[sector]?.[country3]?.cities[city3]?.periods || {});
    const latest3 = periods3[periods3.length - 1] || "";
    const subs3 = Object.keys(
      raw.countries[country3].cities[city3]?.periods?.[latest3]?.subMarkets || {}
    );
    if (!submarket3 || !subs3.includes(submarket3)) {
      setSubmarket3(subs3[0] || "");
    }
  }
}, [
  raw,
  showComp2,
  showComp3,
  country2,
  city2,
  submarket2,
  country3,
  city3,
  submarket3,
]);

// --- Auto-adjust invalid period range (ensures End ≥ Start) ---
useEffect(() => {
  if (!startPeriod || !endPeriod) return;
  if (comparePeriods(startPeriod, endPeriod) > 0) {
    setEndPeriod(startPeriod);
  }
}, [startPeriod, endPeriod]);


  if (loading) return <div style={{ padding: 30 }}>Loading…</div>;
  if (error) return <div style={{ color: "crimson" }}>{error}</div>;

  // Diese Variablen müssen den [sector] kennen!
  const sectors = raw?.countries ? Object.keys(raw.countries) : [];
  const countries = (raw && sector) ? Object.keys(raw.countries[sector] || {}) : [];
  const cities = (raw && sector && country) ? Object.keys(raw.countries[sector][country]?.cities || {}) : [];
  
  const submarkets = (raw && sector && country && city && period) 
    ? raw.countries[sector][country].cities[city].periods[period]?.subMarkets || {} 
    : {};
  const submarketList = Object.keys(submarkets);
  
  const periodsAsc = (raw && sector && country && city)
    ? Object.keys(raw.countries[sector][country].cities[city].periods || {}).sort(comparePeriods)
    : [];
  const periodsDesc = [...periodsAsc].reverse();

  const cityNode = (raw && sector && country && city && period)
    ? raw.countries[sector][country].cities[city].periods[period]
    : null;

  const metricSource = cityNode?.subMarkets?.[submarket] || {};
  const leasingSource = cityNode?.leasing || {};

 const g = (key) => {
  // === PRIME RENT ===
  if (key === "primeRentEurSqmMonth") {
    // 1️⃣ Prime Rent exists ONLY where explicitly provided
    const prime =
      coerceNumber(metricSource?.primeRentEurSqmMonth) ??
      coerceNumber(metricSource?.primeRentLocal) ??
      coerceNumber(leasingSource?.primeRentEurSqmMonth) ??
      coerceNumber(leasingSource?.primeRentLocal);

    return prime ?? "–";
  }

  // === AVERAGE RENT €/m² pm ===
if (key === "averageRentEurSqmMonth") {
  // 1️⃣ Submarket first
  const sub = coerceNumber(metricSource?.[key]);
  if (sub != null) return sub;

  // 2️⃣ Fallback: TOTAL
  const total = coerceNumber(leasingSource?.[key]);
  if (total != null) return total;

  return "–";
}

  // === SERVICE CHARGE ===
  if (key === "serviceChargeEurSqmMonth") {
    const sc =
      coerceNumber(leasingSource?.serviceChargeEurSqmMonth) ??
      coerceNumber(leasingSource?.serviceCharge);

    return sc ?? "–";
  }

  // === EVERYTHING ELSE ===
  return metricSource[key] ?? leasingSource[key] ?? "–";
};

  const allowedMetrics = [
    { key: "totalStock", label: "Total Stock (m²)" },
    { key: "vacancy", label: "Vacancy (m²)" },
    { key: "vacancyRate", label: "Vacancy Rate (%)" },
    { key: "takeUp", label: "Take-up (m²)" },
    { key: "netAbsorption", label: "Net Absorption (m²)" },
    { key: "completionsYTD", label: "Completions (m²)" },
    { key: "primeYield", label: "Prime Yield - Local Convention (%)" },
    { key: "capitalValueEurSqm", label: "Capital Value (€/m²)" },
    { key: "primeRentEurSqmMonth", label: "Prime Rent (€/m² pm)" },
    { key: "averageRentEurSqmMonth", label: "Average Rent (€/m² pm)" },
    { key: "serviceChargeEurSqmMonth", label: "Service Charge (€/m² pm)" },    
  ];

  /* === Build Chart Data === */
  
const baseSeries = buildTrendSeries(raw, sector, country, city, submarket, selectedMetric);

const comp2Series =
  showComp2 && country2 && city2 && submarket2
    ? buildTrendSeries(raw, sector, country2, city2, submarket2, selectedMetric) // 'sector' hinzugefügt
    : [];

const comp3Series =
  showComp3 && country3 && city3 && submarket3
    ? buildTrendSeries(raw, sector, country3, city3, submarket3, selectedMetric) // 'sector' hinzugefügt
    : [];

  const periodsSet = Array.from(
    new Set([
      ...baseSeries.map((d) => d.period),
      ...comp2Series.map((d) => d.period),
      ...comp3Series.map((d) => d.period),
    ])
  ).sort((a, b) => {
    const [qa, ya] = a.split(" ");
    const [qb, yb] = b.split(" ");
    if (ya !== yb) return Number(ya) - Number(yb);
    return Number(qa.replace("Q", "")) - Number(qb.replace("Q", ""));
  });

  // Build merged dataset
let mergedData = periodsSet.map((p) => ({
  period: p,
  base: baseSeries.find((d) => d.period === p)?.value ?? null,
  comp2: comp2Series.find((d) => d.period === p)?.value ?? null,
  comp3: comp3Series.find((d) => d.period === p)?.value ?? null,
}));

// Filter by selected period range
if (startPeriod && endPeriod) {
  mergedData = mergedData.filter(
    (d) =>
      comparePeriods(d.period, startPeriod) >= 0 &&
      comparePeriods(d.period, endPeriod) <= 0
  );
}


  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px" }}>
      <h1>{city || "Market"} Office Market</h1>

      {/* --- Selection --- */}
      <div>
        <select value={sector} onChange={(e) => setSector(e.target.value)}>
  {sectors.map((s) => (
    <option key={s} value={s}>{s}</option>
  ))}
</select>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          {cities.map((ct) => (
            <option key={ct}>{ct}</option>
          ))}
        </select>
        <select value={submarket} onChange={(e) => setSubmarket(e.target.value)}>
          {submarketList.map((sm) => (
            <option key={sm}>{sm}</option>
          ))}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {periodsDesc.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* --- Market Metrics --- */}
      <div className="section-box">
        <div className="section-header">📊 Market Metrics</div>
        <Row label="Total Stock (m²)" value={fmtNumber(g("totalStock"))} />
        <Row label="Vacancy (m²)" value={fmtNumber(g("vacancy"))} />
        <Row label="Vacancy Rate (%)" value={fmtPercent(g("vacancyRate"))} />
        <Row label="Prime Yield (%)" value={fmtPercent(g("primeYield"))} />
        <Row label="Capital Value (€/m²)" value={fmtMoney(g("capitalValueEurSqm"))} />
      </div>

      {/* --- Leasing Conditions --- */}
      <div className="section-box">
        <div className="section-header">📝 Leasing Conditions</div>
        <Row label="Prime Rent (€/m² pm)" value={fmtMoney(g("primeRentEurSqmMonth"))} />
        <Row label="Average Rent (€/m² pm)" value={fmtMoney(g("averageRentEurSqmMonth"))} />
        <Row label="Service Charge (€/m² pm)" value={fmtMoney(g("serviceChargeEurSqmMonth"))} />
        <Row label="Typical Lease Terms (years)" value={formatMaybeRange(g("leaseLengthMonths"))} />
        <Row label="Typical Rent Free Period (months)" value={formatMaybeRange(g("rentFreeMonthPerYear"))} />
      </div>

      {/* --- Historical Trend --- */}
      <div className="section-box">
        <div className="section-header section-header--green">📈 Historical Trend</div>

        <select
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "10px",
            fontSize: "15px",
          }}
        >
          {allowedMetrics.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>

        {/* === Period Range Selection === */}
<div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
  {/* Start Period */}
  <div style={{ flex: 1 }}>
    <label style={{ fontSize: "13px", color: "#555" }}>Start Period:</label>
    <select
      value={startPeriod}
      onChange={(e) => setStartPeriod(e.target.value)}
      style={{ width: "100%", padding: "6px" }}
    >
      {[...periodsAsc]
        .sort(comparePeriods) // ensure proper order before reversing
        .reverse()
        .map((p) => (
          <option key={p}>{p}</option>
        ))}
    </select>
  </div>

  {/* End Period */}
  <div style={{ flex: 1 }}>
    <label style={{ fontSize: "13px", color: "#555" }}>End Period:</label>
    <select
      value={endPeriod}
      onChange={(e) => setEndPeriod(e.target.value)}
      style={{ width: "100%", padding: "6px" }}
    >
      {[...periodsAsc]
        .sort(comparePeriods)
        .filter((p) => !startPeriod || comparePeriods(p, startPeriod) >= 0)
        .reverse()
        .map((p) => (
          <option key={p}>{p}</option>
        ))}
    </select>
  </div>
</div>

 {/* === Historical Trend Chart === */}
<ResponsiveContainer width="100%" height={340}>
  <ComposedChart
    data={mergedData}
    margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
    barGap={3}
  >
    {(() => {
      const fontSize = getDynamicFontSize(mergedData.length);
      return (
        <>
  <XAxis
  dataKey="period"
  interval={0}
  tickLine={false}
  axisLine={{ stroke: "#ccc", strokeWidth: 1 }}
  padding={{ left: 0, right: 0 }}
  height={80}
  tickMargin={10}
  tick={{
    angle: -90,           // ✅ enforce rotation
    textAnchor: "end",
    fontSize: getDynamicFontSize(mergedData.length),
    dy: 10,               // slight downward offset for alignment
  }}
/>


          <YAxis style={{ fontSize: `${fontSize - 1}px` }} />
          <Tooltip content={<MultiTooltip />} />

          {/* 🔹 Bars */}
          {renderBarWithLabels("base", "#003366", 1.0)}
          {showComp2 && renderBarWithLabels("comp2", "#e67e22", 1.15)}
          {showComp3 && renderBarWithLabels("comp3", "#2ecc71", 1.1)}

          {/* 🔹 Optional trend lines */}
          <Line
            type="monotone"
            dataKey="base"
            stroke="#777"
            strokeWidth={1.3}
            strokeDasharray="4 3"
            dot={{ r: 2, fill: "#777" }}
          />
          {showComp2 && (
            <Line
              type="monotone"
              dataKey="comp2"
              stroke="#e67e22"
              strokeWidth={1}
              strokeDasharray="2 2"
              dot={false}
            />
          )}
          {showComp3 && (
            <Line
              type="monotone"
              dataKey="comp3"
              stroke="#2ecc71"
              strokeWidth={1}
              strokeDasharray="2 2"
              dot={false}
            />
          )}
        </>
      );
    })()}
  </ComposedChart>
</ResponsiveContainer>

      {/* === Comparison selectors === */}
      <div style={{ marginTop: "15px" }}>

        {/* === MARKET 2 === */}
        {showComp2 && (
          <div style={{ marginTop: "10px", borderTop: "1px solid #ddd", paddingTop: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <strong>Market 2:</strong>
              <button
                onClick={() => { setShowComp2(false); setCountry2(""); setCity2(""); setSubmarket2(""); }}
                style={{ background: "transparent", border: "none", color: "#e67e22", cursor: "pointer", fontWeight: "bold" }}
              >
                ✖ Remove
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px", width: "100%" }}>
              <select value={country2} onChange={(e) => setCountry2(e.target.value)} style={{ flex: 1, padding: "6px" }}>
                <option value="">Select country</option>
                {countries.map((c) => <option key={c}>{c}</option>)}
              </select>

              <select value={city2} onChange={(e) => setCity2(e.target.value)} style={{ flex: 1, padding: "6px" }}>
                <option value="">Select city</option>
                {Object.keys(raw.countries[sector]?.[country2]?.cities || {}).map((ct) => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>

              <select value={submarket2} onChange={(e) => setSubmarket2(e.target.value)} style={{ flex: 1, padding: "6px" }}>
                <option value="">Select submarket</option>
                {Object.keys(raw.countries[sector]?.[country2]?.cities?.[city2]?.periods?.[period]?.subMarkets || {}).map((sm) => (
                  <option key={sm} value={sm}>{sm}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* === MARKET 3 === */}
        {showComp3 && (
          <div style={{ marginTop: "10px", borderTop: "1px solid #ddd", paddingTop: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <strong>Market 3:</strong>
              <button
                onClick={() => { setShowComp3(false); setCountry3(""); setCity3(""); setSubmarket3(""); }}
                style={{ background: "transparent", border: "none", color: "#2ecc71", cursor: "pointer", fontWeight: "bold" }}
              >
                ✖ Remove
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px", width: "100%" }}>
              <select value={country3} onChange={(e) => setCountry3(e.target.value)} style={{ flex: 1, padding: "6px" }}>
                <option value="">Select country</option>
                {countries.map((c) => <option key={c}>{c}</option>)}
              </select>

              <select value={city3} onChange={(e) => setCity3(e.target.value)} style={{ flex: 1, padding: "6px" }}>
                <option value="">Select city</option>
                {Object.keys(raw.countries[sector]?.[country3]?.cities || {}).map((ct) => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>

              <select value={submarket3} onChange={(e) => setSubmarket3(e.target.value)} style={{ flex: 1, padding: "6px" }}>
                <option value="">Select submarket</option>
                {Object.keys(raw.countries[sector]?.[country3]?.cities?.[city3]?.periods?.[period]?.subMarkets || {}).map((sm) => (
                  <option key={sm} value={sm}>{sm}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* === Add comparison buttons === */}
        <div style={{ marginTop: "10px" }}>
          {!showComp2 && (
            <button onClick={() => setShowComp2(true)}>+ Add 2nd Market</button>
          )}
          {showComp2 && !showComp3 && (
            <button onClick={() => setShowComp3(true)}>+ Add 3rd Market</button>
          )}
        </div>
      </div> 
      {/* === END comparison block === */}

    </div> // Schließt die "Historical Trend" Box
  </div> // Schließt den äußeren Container
);
}
