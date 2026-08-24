const STROOPS_PER_XLM = BigInt(10_000_000);

export function xlmToStroops(value: string): bigint {
  if (!/^\d+(\.\d{1,7})?$/.test(value)) {
    throw new Error("Invalid XLM amount.");
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction.padEnd(7, "0"));
}

export function stroopsToXlm(value: string | bigint): string {
  const stroops = typeof value === "bigint" ? value : BigInt(value);
  const whole = stroops / STROOPS_PER_XLM;
  const fraction = (stroops % STROOPS_PER_XLM).toString().padStart(7, "0");
  return `${whole}.${fraction}`.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function formatXlm(value: string | bigint): string {
  const amount = Number(stroopsToXlm(value));
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 7,
  }).format(amount);
}
