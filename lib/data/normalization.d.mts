export declare function normalizePlate(raw: unknown): string | null;
export declare function formatPlate(raw: unknown): string | null;
export declare function normalizeSearchText(text: string): string;
export declare function transliterateGreeklish(latinText: string): string;
export declare function buildSearchVariants(query: string): string[];
export declare function matchesSearchVariants(haystack: string | null | undefined, variants: string[]): boolean;
export declare function smartMatch(query: string, fields: Array<string | null | undefined>): boolean;
export declare function formatVocativeName(name: string): string;
