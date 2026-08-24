# Two-file updates (MATH-a-PANG style)

Version 2.0.3 is the one-time bridge.

After users have v2.0.3 or newer, normal Chess Tournament Manager updates do NOT need:
- a GitHub Release
- a Git tag
- a new EXE
- a GitHub Actions run

For a normal app/UI/tournament update, upload only these two files to the repository root:

1. `update-manifest.json`
2. `Chess_Tournament_Manager_Update_X.X.X.zip`

The permanent desktop EXE reads `update-manifest.json`, downloads the ZIP, verifies SHA-256,
stages it, restarts, and replaces only the local runtime app files.

Tournament saves are stored separately under the local Chess Tournament Manager profile and
are not included in update packages.

A new EXE is only needed later if the Electron desktop shell/updater itself must change.
