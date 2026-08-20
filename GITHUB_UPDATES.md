# GitHub-Based Updates

The Windows EXE currently checks this GitHub repository:

`ebaneymar/Chess-Tournament-Manager`

The repository name must match exactly unless `GitHubOwner` / `GitHubRepo` in `main.go`
are changed and the application is rebuilt.

## First-time setup

1. On GitHub, create a repository named:

   `Chess-Tournament-Manager`

   under the `ebaneymar` account.

2. Upload/commit this entire project, including:

   - `main.go`
   - `go.mod`
   - `app/`
   - `.github/workflows/release.yml`

3. Push it to the `main` branch.

4. Create the first tag:

   `v2.0.0`

   and push the tag.

GitHub Actions will build:

`Chess-Tournament-Manager.exe`

and attach it to the GitHub Release.

## Updating later

For example, for version 2.1.0:

1. Edit the project.
2. Change in `main.go`:

   `AppVersion = "2.1.0"`

3. Commit and push the changes to `main`.
4. Create and push tag:

   `v2.1.0`

5. GitHub Actions builds the new EXE and creates the release automatically.
6. Existing installed/portable copies of Chess Tournament Manager can use:

   Settings → Check for Updates

7. The app compares its current `AppVersion` to the newest GitHub Release tag.
8. If the GitHub version is newer, it downloads the release asset and replaces the old EXE.
9. Local tournament saves remain in the dedicated Windows profile and are not part of the EXE.

## Required release asset name

The updater first looks for:

`Chess-Tournament-Manager.exe`

Do not rename the release EXE unless you also update `UpdateAsset` in `main.go`.

## Important version rule

The GitHub tag and the `AppVersion` inside `main.go` should match.

Example:

`main.go`: `AppVersion = "2.1.0"`

GitHub tag: `v2.1.0`

## Update path

Current PC:

`Chess-Tournament-Manager.exe 2.0.0`

↓

GitHub Release:

`v2.1.0`

↓

App sees newer version

↓

Download & Install

↓

EXE is replaced

↓

Local saved tournaments remain untouched
