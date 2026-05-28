// Single source of truth for the in-memory ↔ Postgres switch.
//
// Tests run with NODE_ENV=test (Jest default) → in-memory.
// Local dev runs without NODE_ENV set → in-memory.
// Railway runs with NODE_ENV=production. The bindings flip to the
// Postgres-backed implementations only when DATABASE_URL is *also*
// set; if it isn't (current Railway state), we stay on in-memory and
// emit a one-line warning at boot. This keeps the demo working
// without a database while still honouring the user-facing
// "Pg-in-production" contract once DATABASE_URL is provisioned.
export function usePg(): boolean {
  return (
    process.env.NODE_ENV === 'production' && !!process.env.DATABASE_URL
  );
}
