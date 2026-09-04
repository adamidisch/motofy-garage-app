export type ScanConfidence = "high" | "medium" | "low";

export interface ScanResult {
  plate: string | null;
  make: string | null;
  model: string | null;
  confidence: ScanConfidence;
  source: "ai";
}

export interface RunPlateRecognizerScanOptions {
  apiToken: string | undefined;
  imageData: unknown;
  mimeType?: string;
  region?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  log?: (message: string, ...rest: unknown[]) => void;
}

export interface RunPlateRecognizerScanOutcome {
  result: ScanResult;
  upstream: unknown;
}

export interface RunVehicleScanOptions {
  apiKey: string | undefined;
  imageData: unknown;
  mimeType?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  log?: (message: string, ...rest: unknown[]) => void;
}

export interface RunVehicleScanOutcome {
  result: ScanResult;
  rawText: string;
  upstream: unknown;
}

export declare const GEMINI_INTERACTIONS_URL: string;
export declare const DEFAULT_MODEL: string;
export declare const PLATE_RECOGNIZER_URL: string;
export declare const SCAN_PROMPT: string;
export declare const SCAN_SCHEMA: Record<string, unknown>;
export declare const MAX_IMAGE_BASE64_LENGTH: number;

export declare class ScanError extends Error {
  constructor(status: number, userMessage: string, detail?: string | null);
  status: number;
  userMessage: string;
  detail: string | null;
}

export declare function canonicalisePlateChars(value: unknown): string;
export declare function normalisePlate(value: unknown): string | null;
export declare function extractInteractionText(payload: unknown): string | null;
export declare function parseLooseJson(text: unknown): Record<string, unknown> | null;
export declare function toScanResult(raw: unknown): ScanResult;
export declare function stripDataUrl(value: unknown): string;
export declare function redactSecrets(text: string, secrets?: Array<string | undefined>): string;
export declare function buildScanRequestBody(options: {
  imageData: string;
  mimeType: string;
  model?: string;
}): Record<string, unknown>;
export declare function runPlateRecognizerScan(options: RunPlateRecognizerScanOptions): Promise<RunPlateRecognizerScanOutcome>;
export declare function runVehicleScan(options: RunVehicleScanOptions): Promise<RunVehicleScanOutcome>;
