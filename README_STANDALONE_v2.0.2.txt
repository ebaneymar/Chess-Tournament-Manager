Chess Tournament Manager v2.0.2

Fixes v2.0.1 startup failure ERR_FAILED (-2) at http://127.0.0.1:49179/.

Changes:
- Removes localhost web-server dependency completely.
- Electron opens the bundled app directly with loadFile().
- Desktop operations use a secure preload/IPC bridge.
- GitHub update checking/install remains available.
- Logo/standalone Electron window remain.
- Local Electron saves are stored under the Windows local app data folder.

Migration safety:
If tournament data was created in v2.0.0, reopen v2.0.0 and Export Backup before moving to v2.0.2, then Import the backup in v2.0.2.
