# Fair Pair

**Fair Pair** is a lightweight, browser-based tournament manager for casual Swiss-style tournaments. It helps organizers run rounds, enter match results, and generate fair pairings while minimizing repeat opponents.

## Features

- **Tournament setup:** The app manages one active tournament at a time. When creating a tournament, the organizer specifies its name, settings (pairing mode, BYE strategy, etc.), and players via a text area. A tournament can support any number of players, including odd counts.
- **Round management:** At the beginning of each round, the organizer can choose how to pair the next round (manually by drag and drop, randomly, or automatically by default). The automatic pairing mode uses the current standings and seeks to avoid rematches whenever possible. Once pairings are proposed, the organizer reorders the full player ranking by drag and drop to match the desired standings for the next round. Draws are allowed, so several players may share the same rank. The organizer can then proceed to the next round.
- **Smart pairings:** Pairings are selected globally rather than greedily from the top of the standings. The priority order is: (1) avoid rematches whenever possible, (2) minimize ranking gaps between paired players, and (3) prefer players with better BYE-related eligibility when all other criteria are equal.
- **BYE management:** For odd player counts, exactly one BYE is assigned per round. A default strategy is chosen during setup: random or lowest-ranked eligible player. A manual BYE override can be applied before generating a round (for example, if a player is absent). Automatic BYE selection must favor players with the fewest previous BYEs, so nobody receives a second BYE while another player has none. A BYE counts as a win in the standings.
- **Reversible workflow:** The organizer can move back to previous steps at any time to review or correct information without losing data. If an earlier edit invalidates future rounds, the app asks for confirmation before discarding and regenerating dependent rounds.
- **Automatic persistence:** The complete tournament state is saved to `localStorage` after every change, and the app resumes on reload. The organizer can also reset the current tournament with confirmation.
- **URL-based setup:** Query parameters can prepopulate players (in the specified order) and setup settings, such as `?player=Alice&player=Bob&player=Carol&bye=lowest`. These parameters are treated as initial setup only and are never treated as live shared state. If a tournament is already saved, the URL parameters are ignored.
- **Friendly interface:** The app includes responsive, intuitive screens for setup, pairings, results, and standings, with clear navigation, simple controls, and confirmation prompts for destructive actions.
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
    ├── app.js         # UI, tournament state, standings, persistence
    └── pairing.js     # Pure pairing and BYE-selection algorithms
```

## Technical requirements

1. **Pairing algorithm:** Use an exact minimum-cost perfect matching, implemented with bitmask DP and a hierarchical cost encoding the true priority order. The pairing logic must prioritize: avoid rematches first, then minimize ranking gaps, then prefer BYE-related fairness when needed.
2. **Persistent state and backward navigation:** Persist the complete tournament state and history in `localStorage`, allowing navigation and corrections at any previous step without data loss.
3. **Automated tests:** Use Node.js built-in test runner (`node --test`) to validate pairing correctness, especially that no avoidable rematches occur and that edge cases are handled correctly.

## Implementation notes

- Keep **one serializable tournament state** containing players (with stable IDs), settings, rounds, pairings, results, current step, and BYE history (directly or derived from rounds). Use a versioned `localStorage` key.
- Keep pairing logic independent from the DOM: given standings, past opponents, and BYE history, return valid proposed pairings. Never assign a player twice in the same round.
- Distinguish **navigation** from **editing history**: moving backward must not erase anything; changing completed results should invalidate only the subsequent dependent rounds after confirmation.
- Require all active match results before completing a round. Support draws and ensure deterministic tie-breaking when rankings are equal.
- Treat the organizer as the **local operator** of the app; there is no authenticated admin account or multi-device synchronization.
- Keep the code readable and dependency-free. Add automated tests for the pairing algorithm and edge cases (odd player counts, exhausted unique opponents, repeated BYEs, and historical edits) where practical.

## Deployment

Push the files to GitHub, then enable **Settings → Pages → Deploy from a branch → `main` → `/docs`**. The application is served as static files, with no compilation or deployment pipeline required.