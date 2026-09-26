import type { Repository } from './data/repository.d.mts';

export declare function resolveMiniAI(
  query: string,
  repository: Repository,
  options?: { selectedVehicleId?: string | null; now?: Date }
): {
  type: string;
  text?: string;
  action?: string;
  vehicle?: import('./data/schema.d.mts').Vehicle;
  vehicles?: import('./data/schema.d.mts').Vehicle[];
  rows?: Array<{ job: import('./data/schema.d.mts').Job; vehicle: import('./data/schema.d.mts').Vehicle }>;
  jobs?: import('./data/schema.d.mts').Job[];
  notes?: import('./data/schema.d.mts').Note[];
  body?: string;
};
