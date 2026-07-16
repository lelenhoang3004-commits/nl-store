/**
 * Duration utility.
 * It converts compact duration strings such as 15m, 7d, and 30d into milliseconds.
 */
const DURATION_UNITS = Object.freeze({
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
});

export function parseDurationToMs(value, fallbackMs) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const match = String(value || "").trim().match(/^(\d+)(ms|s|m|h|d)$/);

  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  return amount * DURATION_UNITS[unit];
}
