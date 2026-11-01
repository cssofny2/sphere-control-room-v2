# Contributing

1. Use Node.js 24.x (see `.nvmrc`) and `npm ci` to install the locked dependencies.
2. Branch from `main`; open a pull request back to `main`.
3. Before pushing, run `npm test` and `npm run build`. CI runs both plus `git diff --check`.
4. Add or update a regression script under `scripts/` for behavior changes, and a `CHANGELOG.md` entry for user-visible ones.

This is an educational simulator; keep content scientifically honest and clearly labelled as a simulation.
