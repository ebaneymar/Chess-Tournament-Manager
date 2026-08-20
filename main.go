package main

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

const (
	AppName        = "Chess Tournament Manager"
	AppVersion     = "2.0.0"
	DefaultPort    = 49179
	GitHubOwner    = "ebaneymar"
	GitHubRepo     = "Chess-Tournament-Manager"
	UpdateAsset    = "Chess-Tournament-Manager.exe"
)

//go:embed app
var embedded embed.FS

type Release struct {
	TagName string `json:"tag_name"`
	Name    string `json:"name"`
	HTMLURL string `json:"html_url"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
		Size               int64  `json:"size"`
	} `json:"assets"`
}

var (
	lastRelease   *Release
	releaseMu     sync.Mutex
	dataRoot      string
	profileRoot   string
)

func main() {
	if runtime.GOOS != "windows" {
		fmt.Println(AppName + " is a Windows desktop build.")
		return
	}

	dataRoot = filepath.Join(os.Getenv("LOCALAPPDATA"), AppName)
	if dataRoot == AppName || dataRoot == "" {
		home, _ := os.UserHomeDir()
		dataRoot = filepath.Join(home, "AppData", "Local", AppName)
	}
	profileRoot = filepath.Join(dataRoot, "BrowserProfile")
	_ = os.MkdirAll(profileRoot, 0755)
	_ = os.MkdirAll(filepath.Join(dataRoot, "Updates"), 0755)

	port, listener, alreadyRunning, err := bindAppPort()
	if err != nil {
		messageBox("Could not start the local Chess Tournament Manager service.\n\n"+err.Error(), AppName)
		return
	}

	appURL := fmt.Sprintf("http://127.0.0.1:%d/", port)

	if alreadyRunning {
		launchAppWindow(appURL)
		return
	}
	defer listener.Close()

	sub, err := fs.Sub(embedded, "app")
	if err != nil {
		messageBox("Embedded application files could not be loaded.", AppName)
		return
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte("ChessTournamentManager"))
	})

	mux.HandleFunc("/api/version", apiVersion)
	mux.HandleFunc("/api/open-data-folder", apiOpenDataFolder)
	mux.HandleFunc("/api/check-update", apiCheckUpdate)
	mux.HandleFunc("/api/install-update", apiInstallUpdate)

	fileServer := http.FileServer(http.FS(sub))
	mux.Handle("/", fileServer)

	server := &http.Server{Handler: securityHeaders(mux)}

	go func() {
		_ = server.Serve(listener)
	}()

	if err := launchAppWindow(appURL); err != nil {
		messageBox(
			"Microsoft Edge or Google Chrome could not be found.\n\n"+
				"Install Microsoft Edge or Chrome, then open Chess Tournament Manager again.\n\n"+
				err.Error(),
			AppName,
		)
		return
	}

	// Keep the local app server alive while the desktop browser-app window exists.
	// Edge/Chrome is launched with a dedicated app profile. We do not forcibly close
	// the server immediately because the browser process may outlive the launcher child.
	for {
		time.Sleep(10 * time.Second)
		if !profileBrowserRunning() {
			_ = server.Close()
			return
		}
	}
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func bindAppPort() (port int, listener net.Listener, alreadyRunning bool, err error) {
	addr := fmt.Sprintf("127.0.0.1:%d", DefaultPort)
	l, e := net.Listen("tcp", addr)
	if e == nil {
		return DefaultPort, l, false, nil
	}

	client := http.Client{Timeout: 800 * time.Millisecond}
	resp, e2 := client.Get("http://" + addr + "/health")
	if e2 == nil {
		defer resp.Body.Close()
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 128))
		if strings.Contains(string(body), "ChessTournamentManager") {
			return DefaultPort, nil, true, nil
		}
	}
	return 0, nil, false, fmt.Errorf("port %d is already being used by another program", DefaultPort)
}

func findBrowser() (string, error) {
	candidates := []string{
		filepath.Join(os.Getenv("PROGRAMFILES(X86)"), "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(os.Getenv("PROGRAMFILES"), "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(os.Getenv("PROGRAMFILES"), "Google", "Chrome", "Application", "chrome.exe"),
		filepath.Join(os.Getenv("PROGRAMFILES(X86)"), "Google", "Chrome", "Application", "chrome.exe"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Google", "Chrome", "Application", "chrome.exe"),
	}
	for _, p := range candidates {
		if p == "" {
			continue
		}
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p, nil
		}
	}
	return "", errors.New("browser executable not found")
}

func launchAppWindow(url string) error {
	browser, err := findBrowser()
	if err != nil {
		return err
	}
	args := []string{
		"--app=" + url,
		"--user-data-dir=" + profileRoot,
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-features=Translate",
		"--window-size=1500,930",
	}
	cmd := exec.Command(browser, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Start()
}

func profileBrowserRunning() bool {
	// Browser app profiles keep lock files while active. This is intentionally a light
	// check instead of polling all Windows processes.
	for _, name := range []string{"SingletonLock", "lockfile"} {
		if _, err := os.Stat(filepath.Join(profileRoot, name)); err == nil {
			return true
		}
	}
	// Give the browser time to create profile locks after launch.
	return true
}

func apiVersion(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, 200, map[string]any{
		"version":    AppVersion,
		"githubRepo": GitHubOwner + "/" + GitHubRepo,
		"saveRoot":   dataRoot,
	})
}

func apiOpenDataFolder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonResponse(w, 405, map[string]any{"error": "POST required"})
		return
	}
	_ = os.MkdirAll(dataRoot, 0755)
	cmd := exec.Command("explorer.exe", dataRoot)
	_ = cmd.Start()
	jsonResponse(w, 200, map[string]any{"ok": true, "path": dataRoot})
}

func apiCheckUpdate(w http.ResponseWriter, r *http.Request) {
	rel, err := fetchLatestRelease()
	if err != nil {
		jsonResponse(w, 502, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	releaseMu.Lock()
	lastRelease = rel
	releaseMu.Unlock()

	version := normalizeVersion(rel.TagName)
	if compareVersion(version, AppVersion) <= 0 {
		jsonResponse(w, 200, map[string]any{
			"status":  "current",
			"version": AppVersion,
			"message": "You already have the latest version.",
		})
		return
	}

	assetURL, _ := updateAssetURL(rel)
	if assetURL == "" {
		jsonResponse(w, 200, map[string]any{
			"status":  "available",
			"version": version,
			"message": "Version " + version + " is available, but the release does not contain " + UpdateAsset + ".",
		})
		return
	}

	jsonResponse(w, 200, map[string]any{
		"status":  "available",
		"version": version,
		"message": "Version " + version + " is available on GitHub.",
	})
}

func apiInstallUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonResponse(w, 405, map[string]any{"error": "POST required"})
		return
	}

	releaseMu.Lock()
	rel := lastRelease
	releaseMu.Unlock()

	if rel == nil {
		var err error
		rel, err = fetchLatestRelease()
		if err != nil {
			jsonResponse(w, 502, map[string]any{"error": err.Error()})
			return
		}
	}

	version := normalizeVersion(rel.TagName)
	if compareVersion(version, AppVersion) <= 0 {
		jsonResponse(w, 200, map[string]any{
			"ok":      true,
			"message": "This app is already current.",
		})
		return
	}

	assetURL, assetName := updateAssetURL(rel)
	if assetURL == "" {
		jsonResponse(w, 404, map[string]any{
			"error": "GitHub Release " + version + " does not contain " + UpdateAsset + ".",
		})
		return
	}

	dest := filepath.Join(dataRoot, "Updates", assetName)
	if err := downloadFile(assetURL, dest); err != nil {
		jsonResponse(w, 502, map[string]any{"error": "Download failed: " + err.Error()})
		return
	}

	exe, err := os.Executable()
	if err != nil {
		jsonResponse(w, 500, map[string]any{"error": "Could not find the running EXE path."})
		return
	}

	script, err := makeUpdaterScript(exe, dest)
	if err != nil {
		jsonResponse(w, 500, map[string]any{"error": err.Error()})
		return
	}

	jsonResponse(w, 200, map[string]any{
		"ok":      true,
		"version": version,
		"message": "Update downloaded. Chess Tournament Manager will restart and replace the current EXE.",
	})

	go func() {
		time.Sleep(700 * time.Millisecond)
		cmd := exec.Command("cmd.exe", "/C", "start", "", "/min", script)
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		_ = cmd.Start()
		time.Sleep(300 * time.Millisecond)
		os.Exit(0)
	}()
}

func fetchLatestRelease() (*Release, error) {
	if GitHubOwner == "" || GitHubRepo == "" {
		return nil, errors.New("GitHub updater repository is not configured")
	}
	url := "https://api.github.com/repos/" + GitHubOwner + "/" + GitHubRepo + "/releases/latest"
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "Chess-Tournament-Manager/"+AppVersion)

	client := http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, errors.New("GitHub repository/release not found: " + GitHubOwner + "/" + GitHubRepo)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("GitHub returned HTTP %d", resp.StatusCode)
	}

	var rel Release
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&rel); err != nil {
		return nil, err
	}
	return &rel, nil
}

func updateAssetURL(rel *Release) (url, name string) {
	for _, a := range rel.Assets {
		if strings.EqualFold(a.Name, UpdateAsset) {
			return a.BrowserDownloadURL, a.Name
		}
	}
	for _, a := range rel.Assets {
		n := strings.ToLower(a.Name)
		if strings.HasSuffix(n, ".exe") && strings.Contains(n, "chess") && strings.Contains(n, "tournament") {
			return a.BrowserDownloadURL, a.Name
		}
	}
	return "", ""
}

func downloadFile(url, dest string) error {
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("User-Agent", "Chess-Tournament-Manager/"+AppVersion)
	client := http.Client{Timeout: 4 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("download server returned HTTP %d", resp.StatusCode)
	}

	tmp := dest + ".tmp"
	_ = os.MkdirAll(filepath.Dir(dest), 0755)
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	n, copyErr := io.Copy(f, io.LimitReader(resp.Body, 500<<20))
	closeErr := f.Close()
	if copyErr != nil {
		_ = os.Remove(tmp)
		return copyErr
	}
	if closeErr != nil {
		_ = os.Remove(tmp)
		return closeErr
	}
	if n < 1<<20 {
		_ = os.Remove(tmp)
		return fmt.Errorf("downloaded file is unexpectedly small (%d bytes)", n)
	}
	_ = os.Remove(dest)
	return os.Rename(tmp, dest)
}

func makeUpdaterScript(currentExe, newExe string) (string, error) {
	script := filepath.Join(dataRoot, "Updates", "install-update.cmd")
	body := "@echo off\r\n" +
		"setlocal\r\n" +
		"timeout /t 2 /nobreak >nul\r\n" +
		":retry\r\n" +
		"copy /Y " + quoteCMD(newExe) + " " + quoteCMD(currentExe) + " >nul 2>&1\r\n" +
		"if errorlevel 1 (\r\n" +
		"  timeout /t 1 /nobreak >nul\r\n" +
		"  goto retry\r\n" +
		")\r\n" +
		"start \"\" " + quoteCMD(currentExe) + "\r\n" +
		"del /Q " + quoteCMD(newExe) + " >nul 2>&1\r\n" +
		"del /Q \"%~f0\"\r\n"
	if err := os.WriteFile(script, []byte(body), 0644); err != nil {
		return "", err
	}
	return script, nil
}

func quoteCMD(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

func normalizeVersion(v string) string {
	return strings.TrimPrefix(strings.TrimSpace(v), "v")
}

func compareVersion(a, b string) int {
	pa := parseVersion(a)
	pb := parseVersion(b)
	for i := 0; i < 4; i++ {
		if pa[i] < pb[i] {
			return -1
		}
		if pa[i] > pb[i] {
			return 1
		}
	}
	return 0
}

func parseVersion(v string) [4]int {
	var out [4]int
	parts := strings.Split(normalizeVersion(v), ".")
	for i := 0; i < len(parts) && i < len(out); i++ {
		n := ""
		for _, r := range parts[i] {
			if r >= '0' && r <= '9' {
				n += string(r)
			} else {
				break
			}
		}
		out[i], _ = strconv.Atoi(n)
	}
	return out
}

func jsonResponse(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func messageBox(text, title string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	proc := user32.NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString(text)
	c, _ := syscall.UTF16PtrFromString(title)
	_, _, _ = proc.Call(
		0,
		uintptr(unsafe.Pointer(t)),
		uintptr(unsafe.Pointer(c)),
		0x00000010,
	)
}
