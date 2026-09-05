import type { Dataset } from "./schema.d.mts";

export declare const DEMO_GARAGE_ID: string;
export declare function createSeed(options?: { now?: Date | string; garageId?: string }): Dataset;
