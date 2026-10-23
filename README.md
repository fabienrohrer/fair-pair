# Fair Pair

**Fair Pair** is a lightweight, browser-based tournament manager for casual Swiss-style tournaments. It helps organizers run rounds, enter match results, and generate fair pairings while minimizing repeat opponents.

## Features

- **Tournament setup and root management:** The app manages multiple tournaments in parallel. The home screen displays tournaments as a selectable grid. From this root view, the organizer can add a tournament, select one, then use dedicated actions to open/manage it (“Edit”) or delete it. Tournament creation and setup edition happen in a dedicated setup view. A tournament can support any number of players, including odd counts.
- **Round management:** At the beginning of each round, the organizer can choose how to pair the next round (manually by drag and drop, randomly, or automatically by default). The automatic pairing mode uses the current standings and seeks to avoid rematches whenever possible. Once pairings are proposed, the organizer reorders the full player ranking by drag and drop to match the desired standings for the next round. Draws are allowed, so several players may share the same rank. The organizer can then proceed to the next round.
- **Smart pairings:** Pairings are selected globally rather than greedily from the top of the standings. The priority order is: (1) avoid rematches whenever possible, (2) minimize ranking gaps between paired players, and (3) prefer players with better BYE-related eligibility when all other criteria are equal.
- **BYE management:** For odd player counts, exactly one BYE is assigned per round. A default strategy is chosen during setup: random or lowest-ranked eligible player. A manual BYE override can be applied before generating a round (for example, if a player is absent). Automatic BYE selection must favor players with the fewest previous BYEs, so nobody receives a second BYE while another player has none. A BYE counts as a win in the standings.
- **Reversible workflow:** The organizer can move back to previous steps at any time to review or correct information without losing data. If an earlier edit invalidates future rounds, the app asks for confirmation before discarding and regenerating dependent rounds.
- **Automatic persistence:** The complete application state (all tournaments + selected tournament) is saved to `localStorage` after every change, and the app resumes on reload. The organizer can also reset all tournaments with confirmation.
- **URL-based setup:** Query parameters can prepopulate players (in the specified order) and setup settings, such as `?player=Alice&player=Bob&player=Carol&bye=lowest`. These parameters are treated as initial setup only and are never treated as live shared state. They are used only to prefill the creation form when no tournament exists yet.
- **Friendly interface:** The app includes responsive, intuitive views (home grid, setup view, tournament view), a real app bar (title + language switch), and clear navigation with confirmation prompts for destructive actions.
- *translation*: internationalization is support. English is the default language, french is supported. a toggle in the app bar allows switching between languages. the default language is set thanks to the browser's language settings.

## Technology

- **HTML5 + CSS3 + Vanilla JavaScript** (native ES modules; no framework).
- **Bootstrap 5** (CSS and bundled JS loaded via CDN) for buttons, forms, cards, modals, and responsive layout.
- **`localStorage`** for tournament persistence; **`URLSearchParams`** for URL configuration.
- **GitHub Pages**, served directly from the repository's `/docs` directory.
- **No backend, database, authentication, npm dependencies, or build step.** Everything runs in the browser.

## Suggested structure

```text
fair-pair/
├── README.md
└── docs/
    ├── index.html     # Application shell
    ├── style.css      # Minimal custom styling
    ├── app.js         # UI, root tournament management, standings, persistence
    └── pairing.js     # Pure pairing and BYE-selection algorithms
    └── tournament-state.js  # Pure tournament collection/state helpers
```

## Running tests

This project uses the built-in Node.js test runner.

```bash
npm test
```

The tests focus on pairing correctness and key edge cases (avoidable rematches, odd player counts with BYE fairness, exhausted unique opponents, and standings behavior).

## Technical requirements

1. **Pairing algorithm:** Use an exact minimum-cost perfect matching, implemented with bitmask DP and a hierarchical cost encoding the true priority order. The pairing logic must prioritize: avoid rematches first, then minimize ranking gaps, then prefer BYE-related fairness when needed.
2. **Persistent state and backward navigation:** Persist the complete application state and tournament histories in `localStorage`, allowing navigation and corrections at any previous step without data loss.
3. **Automated tests:** Use Node.js built-in test runner (`node --test`) to validate pairing correctness, especially that no avoidable rematches occur and that edge cases are handled correctly.

## Implementation notes

- Keep **one serializable app state** containing a collection of tournaments. Each tournament stores players (with stable IDs), settings, rounds, pairings, results, current step, and BYE history (directly or derived from rounds). Use a versioned `localStorage` key.
- Keep pairing logic independent from the DOM: given standings, past opponents, and BYE history, return valid proposed pairings. Never assign a player twice in the same round.
- Distinguish **navigation** from **editing history**: moving backward must not erase anything; changing completed results should invalidate only the subsequent dependent rounds after confirmation.
- Require all active match results before completing a round. Support draws and ensure deterministic tie-breaking when rankings are equal.
- Treat the organizer as the **local operator** of the app; there is no authenticated admin account or multi-device synchronization.
- Keep the code readable and dependency-free. Add automated tests for the pairing algorithm and edge cases (odd player counts, exhausted unique opponents, repeated BYEs, and historical edits) where practical.

## Deployment

Push the files to GitHub, then enable **Settings → Pages → Deploy from a branch → `main` → `/docs`**. The application is served as static files, with no compilation or deployment pipeline required.