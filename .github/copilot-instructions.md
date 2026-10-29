# Fair Pair — GitHub Copilot Instructions

- Follow `README.md` as the source of truth for requirements and tournament rules.
- Keep the app static and build-free: HTML, CSS, vanilla JavaScript (native ES modules), and Bootstrap 5 via CDN. Serve from `/docs` on GitHub Pages. No frameworks, npm, backend, or database.
- Prefer simple, readable code and small, focused changes. Keep pairing and BYE algorithms pure and separate from the UI.
- Use one serializable tournament state, persisted in `localStorage`. Preserve reversible navigation; confirm before invalidating later rounds.
- Prioritize correct, fair pairings and test edge cases (rematches, ties, odd player counts, repeated BYEs).
- Use responsive, accessible Bootstrap components; add custom CSS only when needed.
- Prefer home-made components from `docs/app/components/` and the local component runtime instead of introducing external component frameworks or abstractions.
- Ask before inventing tournament rules not covered by the README.
