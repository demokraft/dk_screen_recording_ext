# CLAUDE.md

# DemoKraft Screen Recording Chrome Extension

## Overview

This is the DemoKraft AI Chrome extension for screen recording. It is a **fork of [Screenity](https://screenity.io)** (open-source, GPLv3), customized and trimmed for DemoKraft's specific needs. Not all Screenity features are used — the focus is on recording product screens and uploading the result directly into the DemoKraft Studio video editor for AI-powered post-processing.

**The README.md in this directory is from the upstream Screenity project and describes the full original feature set. Many of those features may not be active or relevant to DemoKraft's use case.**

Extension manifest version: **0.7** (Chrome Manifest V3).

---

## How It Fits in the DemoKraft Platform

```
User clicks "Record" in DemoKraft web app (web_seller)
        ↓
Extension receives seller credentials via postMessage
        ↓
User records screen (tab/desktop/region + microphone/system audio)
        ↓
Recording stored locally in IndexedDB (localforage)
        ↓
User optionally edits (trim, crop, annotate) in the Sandbox editor
        ↓
Extension uploads video → DemoKraft backend (studio + content APIs)
        ↓
Browser redirected to app.demokraft.ai/studio?studio_video_id=...
        ↓
dk_ai_studio backend processes the video (scripts, voiceover, effects)
```

---

## Commands

```bash
# Install dependencies (runs patch-package on postinstall)
npm install

# Dev server with hot reload (webpack-dev-server on port 3000, writes to build/)
npm start

# Production build (minified)
npm run build

# Format code
npm run prettier
```

### Loading in Chrome for Development

1. Run `npm start` (or `npm run build` for a one-time build)
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** → select the `build/` folder
5. The extension is now active

Hot-reload in dev mode:
- UI pages (Sandbox, Recorder, etc.) reload via HMR
- Background service worker and content script reload via SSE middleware (`utils/server.js`)

---

## Architecture

### Manifest V3 Structure

- **Service Worker**: `background.bundle.js` — message routing, recording lifecycle, keyboard shortcuts, alarms
- **Content Script**: `contentScript.bundle.js` — injected into all pages; handles popup UI, click tracking, token exchange with DemoKraft web app
- **Sandbox**: `editor.html` — isolated sandbox page for FFmpeg WASM video processing (required by MV3 security model)
- **Offscreen**: `recorderoffscreen.html` — handles recording in an offscreen document (MV3 pattern)

### Webpack Entry Points (12+ bundles)

| Entry | Purpose |
|-------|---------|
| `background` | Service worker: lifecycle, messages, alarms, keyboard shortcuts |
| `contentScript` | Content script: popup UI, click tracking, token relay |
| `recorder` | Screen/tab capture recording UI (`getDisplayMedia`) |
| `recorderoffscreen` | Offscreen document recording |
| `camera` | Webcam recording with background blur (TensorFlow.js) |
| `sandbox` | Main video editor UI (player, timeline, export) |
| `editor` | FFmpeg WASM processor (runs inside MV3 sandbox) |
| `region` | Drag-to-select region recording overlay |
| `download` | Download/export handler (`chrome.downloads` API) |
| `waveform` | Audio waveform visualization (Wavesurfer.js) |
| `permissions` | Microphone/camera permission check dialog |
| `setup` | Initial setup wizard |
| `editorfallback` | Fallback editor for Chrome ≤109 |
| `backup` | Local file system backup (File System Access API) |

Build output goes to `build/`. Each entry produces `[name].bundle.js` plus an associated `.html` via HtmlWebpackPlugin.

---

## Key Source Files

### `src/pages/Background/index.js` — Service Worker

Central message router. Manages:
- Recording state machine (idle → recording → paused → stopped)
- Tab focus tracking (which tab is being recorded)
- Keyboard command listeners (`Alt+Shift+G` start, `Alt+Shift+X` cancel, `Alt+Shift+M` pause)
- Auto-stop timer via `chrome.alarms`
- Google Drive upload orchestration

**Key chrome.storage.local keys used by background:**

| Key | Purpose |
|-----|---------|
| `recording` | Boolean recording status |
| `recordingStartTime` | Unix timestamp |
| `activeTab` | Tab ID being recorded |
| `SELLER_DETAILS` | DemoKraft auth `{ ACCESS_TOKEN, COMPANY_ID, SELLER_ID }` |
| `qualityValue` | Video resolution (240p → 4k) |
| `alarm` / `alarmTime` | Auto-stop config |
| `countdown` | Countdown seconds before recording starts |

---

### `src/pages/Content/index.jsx` — Content Script

Injected into all pages. DemoKraft-specific responsibilities:

1. **Token Exchange**: Listens for `postMessage({ type: "SET_TOKEN" })` from DemoKraft web app → stores credentials in `chrome.storage.local["SELLER_DETAILS"]`
2. **Click Tracking**: Records `window.click` events, normalizes `(clientX, clientY)` to video coordinate space (accounting for zoom/resolution), stores `{ x, y, time }` for use by dk_ai_studio during preprocessing
3. **Popup UI**: Renders the recording control overlay on any page

**Security**: Only processes postMessages from whitelisted origins:
- `https://app.demokraft.ai`
- `https://devapp.demokraft.ai`
- `https://betaapp.demokraft.ai`
- `http://localhost:3000`

---

### `src/pages/Recorder/Recorder.jsx` — Screen Recorder

Captures screen/tab/desktop via `getDisplayMedia()`. Mixes audio tracks (microphone + system audio) using Web Audio API. Encodes to WebM (VP8 video, Opus audio) and stores chunks in IndexedDB via localforage.

**Quality presets** (`qualityValue`):

| Setting | Resolution | Video Bitrate | Audio Bitrate |
|---------|-----------|---------------|---------------|
| 4K | 4096×2160 | 40 Mbps | 192 kbps |
| 1080p | 1920×1080 | 8 Mbps | 192 kbps |
| 720p | 1280×720 | 5 Mbps | 128 kbps |
| 480p / 360p / 240p | Lower | Scaled down | Scaled down |

---

### `src/pages/Sandbox/context/ContentState.jsx` — Editor State + DemoKraft Upload

Central state for the video editor. Contains the DemoKraft upload logic:

**Step 1** — Create a studio video record:
```
POST /studio/api/v1/studio/videos
Authorization: Bearer {ACCESS_TOKEN}
Body: { company_id, seller_id, title, status: "pending" }
Response: { data: { studio_video_id } }
```

**Step 2** — Upload the video file:
```
POST /content/v1/studio
Authorization: Bearer {ACCESS_TOKEN}
Body: FormData { studio_video_id, seller_id, file: Blob }
```

**Step 3** — Redirect user to studio editor:
```
window.location.href = `https://app.demokraft.ai/studio?studio_video_id={encrypted_id}`
```

The studio backend (dk_ai_studio) then takes over: transcription, script enhancement, AI voiceover, effects, export.

---

## DemoKraft Integration: Web App → Extension Token Flow

When the user initiates recording from the DemoKraft web app (`web_seller`), the app sends credentials to the extension:

```js
// web_seller sends:
window.postMessage({
  type: "SET_TOKEN",
  token: localStorage.getItem("ACCESS_TOKEN"),
  companyId: localStorage.getItem("COMPANY_ID"),
  sellerId: localStorage.getItem("SELLER_ID")
}, "https://app.demokraft.ai")

// Extension content script receives and stores:
chrome.storage.local.set({ SELLER_DETAILS: { ACCESS_TOKEN, COMPANY_ID, SELLER_ID } })

// Extension replies:
event.source.postMessage({ type: "SET_TOKEN_RESPONSE" }, event.origin)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 17 |
| Build | Webpack 5 (12+ entry points) |
| Transpilation | Babel (`@babel/preset-env`, `@babel/preset-react`) |
| Video encoding | FFmpeg WASM (`assets/vendor/`) |
| Canvas/drawing | Fabric.js 5.3 |
| Video player | Plyr 3.7 |
| Audio waveform | Wavesurfer.js 7.4 |
| Video storage | localforage (IndexedDB) |
| Camera BG blur | TensorFlow.js + Selfie Segmentation (`@mediapipe/selfie_segmentation`) |
| UI components | Radix UI Primitives |
| HTTP (upload) | Axios |
| Crop UI | react-advanced-cropper |
| Error tracking | Sentry (`@sentry/browser`) |
| i18n | Chrome `_locales` (17 languages: en, es, fr, de, it, ko, zh_CN, zh_TW, ...) |

---

## Permissions

**Required** (`permissions` in manifest):
- `identity` — OAuth for Google Drive
- `activeTab`, `tabs`, `tabCapture` — Tab recording
- `storage`, `unlimitedStorage` — Store video chunks + seller credentials
- `downloads` — Export video to disk
- `scripting` — Inject scripts programmatically

**Optional** (`optional_permissions`):
- `offscreen` — Offscreen document recording (MV3 pattern)
- `desktopCapture` — Full desktop capture
- `alarms` — Auto-stop recording timer

**Host permissions** (`host_permissions`):
- `https://app.demokraft.ai/*`
- `https://devapp.demokraft.ai/*`
- `https://betaapp.demokraft.ai/*`
- `http://localhost:3000/*`
- `<all_urls>` (fallback for recording any page)

---

## Google Drive Integration

To enable the Drive upload OAuth consent screen, set the correct `client_id` in `src/manifest.json` under `oauth2`. Create an OAuth Client ID in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create Credential → OAuth Client ID → Chrome App. The current key in the manifest is for the existing extension.

---

## Features Active in DemoKraft Fork

DemoKraft uses a subset of Screenity's full feature set. The following are the core active features:

- Screen/tab/desktop/region recording
- Microphone + system audio capture and mixing
- Webcam recording (with optional background blur)
- Drawing and annotation tools (pen, shapes, text, arrows)
- Click tracking and cursor highlighting
- Trim/cut/crop video editing (via FFmpeg WASM)
- Export to MP4, GIF, WebM
- Google Drive upload
- **DemoKraft-specific**: Seller token exchange, studio video creation, upload to DemoKraft backend, redirect to studio editor

---

## Important Notes

- **README.md is from upstream Screenity** — it describes the full Screenity feature set. Not all features listed there are used or relevant in this DemoKraft fork.
- **License**: GPLv3 (inherited from Screenity 3.x / MV3 version). Read the license before making derivative work public.
- **No test suite** — there are no automated tests.
- **Large vendor assets** — FFmpeg WASM (`assets/vendor/`) is large; don't move or rename these files.
- **`editor.html` runs in MV3 sandbox** — required for FFmpeg WASM's `unsafe-eval`. Do not remove the sandbox entry from manifest.
- **Chrome version support** — `editorfallback.html` is used for Chrome ≤109 which lacks the MV3 sandbox API.
- **Backup files** — Any files ending in `Bkp`, `_bkp`, `copy`, or `Copy` are legacy; prefer the non-suffixed version.
