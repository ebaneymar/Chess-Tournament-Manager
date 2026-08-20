CHESS TOURNAMENT MANAGER v2.0.1 — STANDALONE WINDOWS EDITION

WHAT CHANGED
- No external Microsoft Edge / Google Chrome app-mode window.
- Runs in its own Electron desktop window.
- One portable Windows EXE: Chess-Tournament-Manager.exe
- New Chess Tournament Manager logo in the Home screen, sidebar, window/taskbar icon.
- GitHub Releases updater retained.
- Local PC saves retained under the Chess Tournament Manager profile.

IMPORTANT MIGRATION SAFETY
Before moving from v2.0.0 to v2.0.1, open v2.0.0 and Export Backup once.
v2.0.1 intentionally keeps the same localhost origin (127.0.0.1:49179) and same
%LOCALAPPDATA%\Chess Tournament Manager\BrowserProfile path to maximize save continuity,
but a JSON backup is recommended before changing desktop shells.

GITHUB BUILD
1. Upload/replace this source on the main branch.
2. Make sure .github/workflows/release.yml is replaced with the included Electron workflow.
3. Create/publish tag v2.0.1 on main.
4. GitHub Actions builds dist/Chess-Tournament-Manager.exe.
5. The release workflow attaches that EXE to v2.0.1.
6. Existing v2.0.0 app can detect v2.0.1 through Settings > Check for Updates.

DEVELOPMENT
- npm install
- npm start
- npm run dist

The GitHub workflow uses windows-latest because Electron Builder creates the Windows portable EXE there.
