CHESS TOURNAMENT MANAGER — PORTABLE WINDOWS EXE

This source builds a single Windows EXE.

How it works
- The complete tournament manager is embedded inside the EXE.
- The EXE starts a private local service on 127.0.0.1:49179.
- Microsoft Edge opens it in app mode, so the user sees a desktop-app window rather than an HTML file.
- A dedicated browser profile is stored under:
  %LOCALAPPDATA%\Chess Tournament Manager\BrowserProfile
- Tournament localStorage therefore remains on the PC across EXE updates.

GitHub updater
The launcher currently points to:
  ebaneymar/Chess-Tournament-Manager

Publish future versions as GitHub Releases and attach the new EXE with the asset name:
  Chess-Tournament-Manager.exe

The in-app Settings → Check for Updates button will query that release.
If a newer version is found, Download & Install replaces the running portable EXE after exit.

Build command
  set GOOS=windows
  set GOARCH=amd64
  go build -ldflags="-H windowsgui -s -w" -o Chess-Tournament-Manager.exe .

This build depends on Microsoft Edge or Google Chrome being installed on Windows.
Windows 10/11 normally includes Microsoft Edge.
