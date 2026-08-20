CHESS TOURNAMENT MANAGER 2.0 — MODULAR OFFLINE EDITION
Concept and Tournament Manager Design: John Vincent A. Averia

HOW TO OPEN
1. Extract the ZIP.
2. Keep the whole folder together.
3. Double-click index.html.
4. Chrome or Microsoft Edge is recommended.
5. Internet is not required.

IMPORTANT
Do not copy index.html by itself. It needs css/, js/, and data/ beside it.

CLEAN STARTUP
Opening the application shows MAIN MENU ONLY.
It does not automatically:
- open a saved tournament
- open Pairings
- open Standings
- restore the previous page
- generate Round 1

SAVED TOURNAMENT
A saved event enters the working screen only when Open Dashboard is selected.

NEW TOURNAMENT
Create Tournament ends on Dashboard with zero generated rounds.
Round 1 is created only when Generate Next Round is deliberately used.

SETTINGS
Settings remains separate from tournament page navigation.
Available:
- Light / Dark Theme
- Font
- Interface Size
- English / Filipino interface

MODULAR STRUCTURE
index.html
css/styles.css
data/schools.js
js/state.js
js/settings.js
js/app.js
js/schools.js
js/players.js
js/pairings.js
js/standings.js
js/reports.js
js/tournaments.js
js/startup.js

WHY SCHOOLS.JS INSTEAD OF JSON?
A local JSON file would normally need fetch().
Browsers can restrict fetch() for a double-clicked file:// project.
Using schools.js keeps the nationwide database available completely offline.

DEVELOPMENT
This Modular Edition should be used for future changes and debugging.
Once a release is stable, it can later be bundled into a one-file Portable Edition.
