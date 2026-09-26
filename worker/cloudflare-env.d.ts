declare module "cloudflare:workers" {
  // Legacy D1 helper uses the Worker runtime binding. Keep this declaration
  // scoped to that binding instead of adding global Worker types to the app.
  export const env: { DB?: import("drizzle-orm/d1").AnyD1Database };
}
