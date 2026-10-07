# Mounted sweep lifecycle validation

Run npm ci, then npm ci --prefix tests/mounted --ignore-scripts, then node scripts/mounted-sweep-lifecycle.test.mjs under Node 24.

The isolated test package locks jsdom without changing application dependency versions. GitHub foundation validation runs this suite separately from the existing npm test command; Vercel build configuration is unchanged.

The 24 cases cover six sweep scenarios across Strict Mode on/off and normal/reduced-motion timing. The harness mounts React effects using extracted application sweep and cleanup functions, a controlled timer fixture, and mocked measurement/state handling. It does not mount the full control room or prove scan-sequencer, movement/settling, background-tab, or full-run ownership correctness.
