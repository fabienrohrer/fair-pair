<p align="center">
  <img src="./docs/fair-pair-logo.svg" alt="Fair Pair logo" width="420" />
</p>

# Fair Pair

**Fair Pair** is a lightweight vibe-coded browser app that helps a tournament organizer build the **next round pairings** with a visual interface.

The app supports manual ranking rounds and a Swiss-system mode where pairings follow current scores, organizers can choose common Swiss scoring presets, and the standings show score + Buchholz information.

## Product scope

- Manage multiple tournaments locally.
- Support multiple tournament types:
  - **Manual ranking rounds:** round 1 uses a special pairing step (manual drag-and-drop, random helper, or registration-order helper). From round 2 onward, pairing remains editable and the organizer can use both random and automatic helpers.
  - **Swiss system:** round 1 uses the same special pairing step (manual drag-and-drop, random helper, or registration-order helper). From round 2 onward, pairings are generated automatically by the Swiss algorithm and are no longer manually editable.
- For each round, guide the organizer through a clear flow adapted to the tournament type.
- Keep pairing helper algorithms available while respecting each mode's pairing rules.

## Features

- **Tournament setup and root management:** create/open/delete tournaments from a home grid. Tournament setup requires a name and a dedicated player manager with add/edit/delete actions, optional birth date metadata, and persistent player chips.
- **Mode-aware pairing workflow:** round-1 pairing is manual-first in both tournament types, while later rounds follow each mode's rules (editable pairing for manual ranking rounds, locked Swiss pairing from round 2).
- **Touch-friendly drag and drop:** pairing and ranking drag-and-drop are designed to work on tablets (touch/pen) and desktop pointer devices.
- **Persistent player chips and metadata:** each player gets a dedicated color chip when the tournament is created, keeps that label consistently across pairing and ranking views, and can carry optional birth-date metadata with age and hue derived automatically for tooltips and category grouping.
- **Automatic pairing assistant (optional):** inside the pairing view, a dedicated panel lets the organizer choose:
  - mode: random, automatic, or registration order (depending on tournament type and current round),
  - BYE strategy: random eligible or lowest-ranked eligible,
  - priority order: any permutation of `avoid rematch`, `minimize ranking gap`, `bye fairness`.
  Pressing **Try** fills table slots automatically according to the active mode rules.
- **Round start gate:** a round can start only when every player is assigned exactly once across tables + optional BYE.
- **Manual ranking workflow:** after starting a round, the organizer sets global ranking as vertical ranks with ties (multiple players on the same rank row).
- **Ranking reset shortcut:** in ranking view, a dedicated reset action clears current ranking placements without leaving the round flow.
- **Reversible round navigation:** while a round draft is active, the organizer can go back from ranking to pairing without losing draft data, or return to tournament view (with confirmation to discard the draft).
- **Safe URL navigation:** top-level views (home, setup, tournament) are reflected in the URL query string so browser back/forward works naturally without exposing round-draft internals that could corrupt tournament flow.
- **Clear round context:** pairing and ranking screens prominently display the current round number and active step.
- **Swiss score tracking:** Swiss tournaments store points and expose the current standings with score and Buchholz information.
- **Automatic persistence:** complete app state is stored in `localStorage` after every change.
- **Centralized in-app notifications:** validation and success feedback use a non-blocking stacked notification UI.
- **Internationalization:** English and French are supported; default language follows browser language.

## Technology

- HTML5 + CSS3 + Vanilla JavaScript (native ES modules).
- Bootstrap 5 via CDN.
- `localStorage` persistence.
- No backend, no database, no build pipeline.

## UI architecture note

- Prefer lightweight home-made components from [`docs/app/components/`](/Users/fabien/repos/fair-pair/docs/app/components) built on the local runtime in [`docs/app/components/core/runtime.js`](/Users/fabien/repos/fair-pair/docs/app/components/core/runtime.js).
- Use explicit UI-suffix naming for components: `*-header-component`, `*-card-component`, `*-panel-component`, `*-banner-component`, `*-toolbar-component`, `*-list-component`, `*-empty-state-component`.
- Keep tournament/business rules in pure modules ([`docs/pairing.js`](/Users/fabien/repos/fair-pair/docs/pairing.js), [`docs/tournament-state.js`](/Users/fabien/repos/fair-pair/docs/tournament-state.js), [`docs/swiss.js`](/Users/fabien/repos/fair-pair/docs/swiss.js)); components should focus on rendering and UI interactions.

## Suggested structure

```text
fair-pair/
├── README.md
└── docs/
    ├── index.html             # Application shell
    ├── style.css              # Visual styles (dark modern UI)
    ├── app.js                 # Thin app entrypoint
    ├── app/
    │   ├── main.js            # App bootstrap + render orchestration
    │   ├── listeners/
    │   │   ├── index.js               # Listener entrypoint exports
    │   │   ├── global-listeners.js    # Global UI listeners
    │   │   ├── home-listeners.js      # Home view listeners
    │   │   ├── setup-listeners.js     # Setup view listeners
    │   │   ├── tournament-listeners.js # Tournament flow listeners
    │   │   ├── dnd.js                 # Drag-and-drop behavior
    │   │   └── shared.js              # Shared listener helpers
    │   ├── renderers.js       # Public renderer facade
    │   ├── renderers/
    │   │   ├── layout-renderers.js    # App bar + notification rendering
    │   │   ├── home-renderers.js      # Home view rendering
    │   │   ├── setup-renderers.js     # Setup view rendering
    │   │   ├── tournament-renderers.js # Tournament renderer compatibility export
    │   │   ├── tournament/
    │   │   │   ├── index.js             # Tournament renderer orchestration
    │   │   │   ├── overview-renderers.js # Tournament overview rendering
    │   │   │   ├── pairing-renderers.js  # Pairing draft rendering
    │   │   │   ├── results-renderers.js  # Swiss results rendering
    │   │   │   └── ranking-renderers.js  # Ranking draft rendering
    │   │   └── shared-renderers.js    # Shared renderer helpers
    │   ├── constants.js       # i18n messages + UI constants
    │   ├── utils.js           # Shared app utilities
    │   └── components/
    │       ├── app-header-component.js
    │       ├── app-footer-panel-component.js
    │       ├── notification-list-component.js
    │       ├── home-hero-banner-component.js
    │       ├── home-actions-toolbar-component.js
    │       ├── home-empty-state-component.js
    │       ├── setup-header-component.js
    │       ├── setup-swiss-settings-component.js
    │       ├── setup-type-panel-component.js
    │       ├── pairing-tools-panel-component.js
    │       ├── round-stage-banner-component.js
    │       ├── round-history-card-component.js
    │       ├── ranking-snapshot-card-component.js
    │       ├── swiss-results-table-list-component.js
    │       ├── tournament-empty-state-component.js
    │       ├── tournament-header-component.js
    │       ├── tournament-round-intro-card-component.js
    │       └── core/
    │           └── runtime.js        # Tiny component runtime (render + bind)
    ├── pairing.js             # Pure pairing assistant logic
    └── tournament-state.js    # Pure app/tournament state helpers
```

## Running tests

```bash
npm test
```

Tests use Node built-in test runner and focus on:
- pairing assistant correctness and edge cases,
- compact scenario-matrix coverage for automatic pairing behaviors (priority order, rematches, odd-player BYE fairness),
- BYE fairness,
- state migration and tournament lifecycle helpers,
- ranking-group normalization rules.

## Technical requirements

1. **Exact matching for automatic mode:** automatic pairing uses exact minimum-cost perfect matching (bitmask DP), with configurable priority order.
2. **Manual control first:** automatic suggestions never lock the organizer; all pairings and rankings remain editable by drag and drop.
3. **Serializable state model:** all tournaments, rounds, pairing drafts, and ranking groups are persisted in one versioned localStorage payload.

## Deployment

The application is hosted at:

https://fabienrohrer.github.io/fair-pair/

Push files to GitHub and enable GitHub Pages from `/docs` on branch `main`.
