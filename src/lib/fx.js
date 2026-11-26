const FX_URL = process.env.FX_API_URL || "https://open.er-api.com/v6/latest/USD";
const MAX_AGE_SECONDS = Number(process.env.FX_MAX_AGE_SECONDS || 86_400);

export async function getZarRate() {
  const response = await fetch(FX_URL, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`FX provider returned HTTP ${response.status}`);
  const payload = await response.json();
  const rate = Number(payload?.rates?.ZAR);
  const observedUnix = Number(payload?.time_last_update_unix);
  if (payload?.result !== "success" || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(observedUnix)) {
    throw new Error("FX provider returned an invalid USD/ZAR rate");
  }
  const observedAt = new Date(observedUnix * 1000);
  const ageSeconds = (Date.now() - observedAt.getTime()) / 1000;
  if (ageSeconds < -300 || ageSeconds > MAX_AGE_SECONDS) {
    throw new Error("FX rate is stale or has an invalid timestamp");
  }
  return { rate, observedAt, provider: new URL(FX_URL).host };
}

export function zarCentsToTokenUnits(zarCents, rate) {
  const rateE6 = BigInt(Math.round(rate * 1_000_000));
  if (rateE6 <= 0n) throw new Error("FX rate must be positive");
  return (BigInt(zarCents) * 10_000_000_000n + rateE6 / 2n) / rateE6;
}
