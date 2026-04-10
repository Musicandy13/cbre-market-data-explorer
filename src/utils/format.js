export function fmtNumber(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(n)) return "–";
  const v = Number(n);

  if (Math.abs(v) >= 1000) {
    return v.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtMoney(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(n)) return "–";
  const v = Number(n);
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtPercent(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(n)) return "–";
  const v = Number(n);
  if (Math.abs(v) <= 1) return (v * 100).toFixed(2) + "%";
  return v.toFixed(2) + "%";
}

export function coerceNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;

  let s = String(v).trim();
  if (s === "" || s === "–") return null;

  s = s.replace(/[€%\s]/g, "");

  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const num = parseFloat(s);
  return Number.isNaN(num) ? null : num;
}

export function formatMaybeRange(v, kind = "number") {
  if (v === null || v === undefined || v === "") return "–";

  if (typeof v === "number") {
    return kind === "money" ? fmtMoney(v) : fmtNumber(v);
  }

  const parts = String(v)
    .replace(/€/g, "")
    .split(/\s*(?:-|–|to)\s*/i);

  if (parts.length >= 2) {
    return `${parts[0]} – ${parts[1]}`;
  }

  return v;
}
