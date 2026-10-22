# Fair Pair

**Fair Pair** is a lightweight, browser-based tournament manager for casual, Swiss-style tournaments. It helps organizers run rounds, enter match results, and generate fair pairings while avoiding repeat opponents whenever possible.

! this project is highly vibe-coded.

## Features

- **Tournament setup:** The user can manage several tournaments simultaneously (create, delete, etc.). When creating a tournament, the user specifies its name, its settings (first appariement rule, BYE strategy, etc.) and the players (through a text area). A tournament can support any number of players, including odd numbers.
- **Round management:** At the beggining of each round, the user can choose how to pair the next round (manually by drag and drop, randomly, and automatically (default)). The automatic mode generates pairings based on the current standings, and if possible avoids repeat opponents. Then the user set only the new ranking by dragging and dropping players into the desired order. Draws are possible, so several players can share the same rank! He can then proceed to the next round.
- **Smart pairings:** Prefer opponents with similar rankings. Avoid rematches if a complete pairing without repeats exists; otherwise minimize rematches first, then ranking gaps. Consider all pairings globally rather than pairing greedily from the top.
- **BYE management:** For odd player counts, assign exactly one BYE per round. Choose a default strategy at setup: random or lowest-ranked eligible player. Allow a manual BYE override before generating any round (e.g., for an absent player). Automatic selection must favor players with the fewest previous BYEs, so nobody receives a second BYE while another player has none. A BYE counts as a win in the standings.
- **Reversible workflow:** The organizer can go back to previous steps at any time to review or correct information. Do not lose data merely by navigating backward. If an earlier edit makes future rounds invalid, ask for confirmation before discarding and regenerating dependent rounds.
- **Automatic persistence:** Save the complete tournament to `localStorage` after every change; resume on page reload. Provide a way to start over, with confirmation.
- **URL-based setup:** Prepopulate players (in the specified order) and settings from query parameters. Example: `?player=Alice&player=Bob&player=Carol&bye=lowest`. Treat URL parameters as *initial setup*, not as live shared tournament state, and never silently overwrite an existing saved tournament.
- **Friendly interface:** Responsive, intuitive screens for setup, pairings, results, and standings, with clear navigation, simple controls, and confirmation prompts for destructive actions.

## Technology

- **HTML5 + CSS3 + Vanilla JavaScript** (native ES modules; no framework).
- **Bootstrap 5** (CSS and bundled JS loaded via CDN) for buttons, forms, cards, modals, and responsive layout.
- **`localStorage`** for tournament persistence; **`URLSearchParams`** for URL configuration.
- **GitHub Pages**, served directly from the repository's `/docs` directory.
- **No backend, database, authentication, npm dependencies, or build step.** Everything runs entirely in the browser.

## Suggested structure

```text
fair-pair/
├── README.md
└── docs/
    ├── index.html     # Application shell
    ├── style.css      # Minimal custom styling
    ├── app.js         # UI, tournament state, standings, persistence
    └── pairing.js     # Pure pairing and BYE-selection algorithms
```

## Technical requirements

1. Pairing algorithm: Use bitmask dynamic programming with memoization to find globally optimal pairings, strictly avoiding rematches whenever possible, even at the expense of ranking proximity or BYE preferences.
2. Persistent state and backward navigation: Persist the complete tournament state and history in localStorage, allowing navigation and corrections at any previous step without data loss.
3. Automated tests: Use Node.js built-in test runner (node --test) to verify pairing correctness, especially that no avoidable rematches occur, including edge cases.

## Implementation notes

- Keep **one serializable tournament state** containing players (with stable IDs), settings, rounds, pairings, results, current step, and BYE history (directly or derived from rounds). Use a versioned `localStorage` key.
- Keep pairing logic independent from the DOM: given standings, past opponents, and BYE history, return valid proposed pairings. Never assign a player twice in the same round.
- Distinguish **navigation** from **editing history**: going back must not erase anything; changing completed results must invalidate only the subsequent dependent rounds after confirmation.
- Require all active match results before completing a round. Support draws and ensure deterministic tie-breaking when standings are equal.
- Treat the organizer as the **local operator** of the app; there is no authenticated admin account or multi-device synchronization.
- Keep the code readable and dependency-free. Add automated tests for the pairing algorithm and edge cases (odd player counts, exhausted unique opponents, repeated BYEs, and historical edits) where practical.

## Deployment

Push the files to GitHub, then enable **Settings → Pages → Deploy from a branch → `main` → `/docs`**. The application is served as static files, with no compilation or deployment pipeline required.