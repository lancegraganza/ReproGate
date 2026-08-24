import type { StructuredEnvironment } from "@/types/domain";

const aliases: Record<string, string> = {
  node: "node.js",
  nodejs: "node.js",
  "node js": "node.js",
  win: "windows",
  win32: "windows",
  macos: "macos",
  "mac os": "macos",
  osx: "macos",
};

function normalizedText(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return aliases[normalized] ?? normalized;
}

function normalizedVersion(value: string): string {
  return value.trim().toLowerCase().replace(/^v(?=\d)/, "").replace(/\s+/g, "");
}

export function normalizeEnvironment(input: StructuredEnvironment): StructuredEnvironment {
  const dependencies = Object.fromEntries(
    Object.entries(input.dependencies)
      .map(([name, version]) => [normalizedText(name), normalizedVersion(version)] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

  return {
    operatingSystem: normalizedText(input.operatingSystem),
    runtime: normalizedText(input.runtime),
    runtimeVersion: normalizedVersion(input.runtimeVersion),
    packageManager: normalizedText(input.packageManager),
    packageManagerVersion: normalizedVersion(input.packageManagerVersion),
    dependencies,
  };
}

export function environmentKey(environment: StructuredEnvironment): string {
  return JSON.stringify(normalizeEnvironment(environment));
}

export function isValidEnvironment(environment: StructuredEnvironment): boolean {
  const normalized = normalizeEnvironment(environment);
  return Boolean(
    normalized.operatingSystem &&
      normalized.runtime &&
      normalized.runtimeVersion &&
      normalized.packageManager &&
      normalized.packageManagerVersion,
  );
}

