# Chess Tournament Manager 2.0 — Architecture

## App lifecycle

`Open App → Main Menu`

No tournament route runs automatically.

`Open Dashboard → Dashboard`
`Pairings & Results → Pairings`
`Settings → Settings`

Each screen is entered explicitly.

## Modules

### state.js
State foundation, browser persistence, saved tournament workspace.

### settings.js
Light/Dark theme, fonts, language, interface sizing, notifications, confirmation UI, Undo.

### app.js
Common save/navigation logic and tournament/tie-break form synchronization.

### data/schools.js
Only the nationwide offline DepEd school data.

### schools.js
School indexing, search, and cascading Region → Division → Town → School selectors.

### players.js
Player roster and CSV/player actions.

### pairings.js
Swiss/Round-Robin/Knockout/Team pairing engines and result management.

### standings.js
Standings and tie-break calculations including BH-C1, BH-M1, and BH-M2.

### reports.js
Notation sheets, exports, backups, reset/sample tools.

### tournaments.js
Main Menu, Settings modal controller, New Tournament wizard.

### startup.js
Render coordinator and the only startup bootstrap.

## Why classic scripts?

The project is designed to run offline by double-clicking index.html.
Classic script files are more reliable for file:// than ES modules and fetch-based local data.

## State-management direction

2.0 keeps the existing saved-state shape for compatibility.
The modular split is completed first so controlled actions/reducers can be introduced
incrementally later without rewriting the entire tournament engine at once.
