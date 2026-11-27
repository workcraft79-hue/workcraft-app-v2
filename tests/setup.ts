// Test-process-only signing key. Never used by deployed application runtimes.
// CI and local unit tests need deterministic cryptographic context without production secrets.
// A real integration-test environment can override this with its isolated Neon test key.
if (!process.env.PG_ACTOR_CONTEXT_SECRET) {
  process.env.PG_ACTOR_CONTEXT_SECRET = 'a'.repeat(64);
}
