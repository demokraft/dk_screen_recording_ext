# Changelog

All notable changes to the Demokraft AI Screen Recording Extension are documented here.

---

## [Unreleased] — 2026-03-03

### Bug Fixes

#### Permission Issues (Chrome Profile Fix) — `src/pages/Permissions/Permissions.jsx`
- **Critical bug fix**: In `checkPermissions()`, the `else` branch referenced `err.name` when `err` was not defined in that scope. This caused a `ReferenceError` which was silently caught by the outer `try/catch`, unexpectedly calling `enumerateDevices()` with default arguments. The side effect was a repeated `getUserMedia()` call that triggered the browser's permission prompt dialog on every popup open — the root cause of the "keeps giving popup about mic/camera permission" issue reported on Chrome profiles.
  - **Before**: `error: err.name` → always threw `ReferenceError` when both permissions were not `"granted"`.
  - **After**: Correctly distinguishes between `"denied"` (report failure without calling `getUserMedia`) and `"prompt"` (attempt access once, gracefully).
- Fixed: `window.addEventListener("message", ...)` in `useEffect` was never cleaned up, causing listener accumulation across component mounts. Added cleanup `return () => window.removeEventListener(...)`.

#### Memory Leaks — `src/pages/Recorder/Recorder.jsx`
- **AudioContext never closed on stop**: `aCtx.current` was set to `null` in `stopRecording()` but `.close()` was never called, keeping the Web Audio API context and all connected nodes alive in memory indefinitely after every recording session.
  - **Fix**: Added `aCtx.current.close()` before dereferencing.
- **Tab-capture AudioContext leaked**: When recording in tab-capture mode (`isTab === true`), a new `AudioContext` was created as an anonymous local variable (`const output = new AudioContext()`). Since no reference was held, it could never be closed, leaking audio resources on every tab recording.
  - **Fix**: Introduced `tabAudioCtx` ref to store the context. It is now properly closed in `stopRecording()`.

#### Memory Leaks — `src/pages/RecorderOffscreen/RecorderOffscreen.jsx`
- **AudioContext never closed on stop**: Same issue as `Recorder.jsx`. `aCtx.current.close()` is now called in `stopRecording()`.

#### Duplicate Stop Messages — `src/pages/Recorder/Recorder.jsx` and `RecorderOffscreen.jsx`
- Both `liveStream` and `helperVideoStream` had separate anonymous `onended` handlers that each fired `chrome.runtime.sendMessage({ type: "stop-recording-tab" })`. When the screen share was stopped by the user, both handlers fired independently, sending two stop messages and causing state inconsistency.
  - **Fix**: Extracted a single named `handleStreamEnded` function shared by both tracks. Added an `isFinishing` guard to prevent duplicate messages when `stopRecording()` is already in progress.

#### Background Script Bug — `src/pages/Background/index.js`
- **Alarm handler used undefined `tab` variable**: In `handleAlarm`, the `chrome.tabs.get(activeTab, (t) => {...})` callback used `tab.id` in its else branch, but the parameter name was `t` (not `tab`). This would throw `ReferenceError: tab is not defined` at runtime when the active tab no longer existed at alarm time.
  - **Fix**: Replaced with a safe fallback that queries the current active tab.
- **`restoreRecording()` had a hanging `Promise` that never resolved**: The function wrapped a `chrome.tabs.onUpdated.addListener(...)` call inside `await new Promise((resolve) => {...})` but `resolve` was never called. This left a permanently-pending Promise in memory and the listener was never removed after firing.
  - **Fix**: Removed the wrapping Promise. Switched to the established pattern already used elsewhere in the file: register the listener, call `removeListener` inside on match, then proceed.

#### Video Quality Bug — `src/pages/RecorderOffscreen/RecorderOffscreen.jsx`
- **Hardcoded `frameRate: 30` in `getDisplayMedia`**: The screen capture constraints always requested 30 fps regardless of the user's FPS setting stored in `fps.current`. This caused recordings to be capped at 30 fps even when the user selected a higher frame rate.
  - **Fix**: Replaced `frameRate: 30` with `{ ideal: fpsVal, max: fpsVal }` (where `fpsVal` reads from `fps.current`). Also added `width` and `height` ideal constraints to the video track so the capture surface resolution is properly requested.

#### False Memory Error — `src/pages/Recorder/Recorder.jsx` and `RecorderOffscreen.jsx`
- **`memoryError: true` set on MediaRecorder `inactive` state**: When MediaRecorder entered the `inactive` state (which is normal after calling `stop()`), the code erroneously set `memoryError: true` in content state, showing an error to the user even when nothing had gone wrong.
  - **Fix**: Added a null guard on `recorder.current` in the onstop path and removed the false-positive `memoryError` flag that triggered on normal recorder lifecycle transitions.

#### Uncancellable `onstop` Timer — `src/pages/Recorder/Recorder.jsx` and `RecorderOffscreen.jsx`
- **`setTimeout` inside `onstop` handler was not stored**: The 3-second delay timer that waits for final blob chunks before sending `video-ready` was never assigned to a ref or variable. If `dismissRecording()` was called while the timer was pending, it would fire after dismissal—sending a stale `video-ready` message and corrupting the recording state machine.
  - **Fix**: Stored the timer ID in a local variable and exposed a `recorder.current._onstopTimer()` cancel function. `dismissRecording()` now calls `_onstopTimer()` to reliably clear any pending timer before tearing down recorder state.

#### Camera RAF Loop Never Stopped — `src/pages/Camera/Camera.jsx`
- **`requestAnimationFrame` loop ran indefinitely after component unmount**: The `captureFrame` function called `requestAnimationFrame(captureFrame)` recursively without storing the RAF ID, making it impossible to cancel. The loop continued consuming CPU and GPU resources even after the Camera page was closed.
  - **Fix**: Added `rafIdRef = useRef(null)`. Every `requestAnimationFrame` call now stores its return ID (`rafIdRef.current = requestAnimationFrame(captureFrame)`). The `useEffect` cleanup calls `cancelAnimationFrame(rafIdRef.current)`.
- **`chrome.runtime.onMessage` listener was anonymous and never removed**: The message listener added in the camera switch `useEffect` was an anonymous function, so the `return` cleanup could not call `removeListener` with the correct reference. A new listener was added on every re-render without removing the old one.
  - **Fix**: Extracted the listener into a named `onMessage` function. Cleanup now correctly calls `chrome.runtime.onMessage.removeListener(onMessage)`.
- **Camera switch debounce was 2000 ms**: Rapid device-change events (e.g., user clicking a different camera) queued a new `getCameraStream()` call after a 2-second delay, blocking UI responsiveness.
  - **Fix**: Reduced to 200 ms. Multiple rapid switches now cancel the previous pending timeout via `switchTimerRef`, so only the last selection triggers a stream acquisition.

#### Stream Orphaned on Error — `src/pages/RecorderOffscreen/RecorderOffscreen.jsx`
- **`catch` block in `startStreaming` did not clean up open streams**: If an error occurred mid-setup (after screen capture but before `MediaRecorder.start()`), the live stream, helper video stream, helper audio stream, and AudioContext were all left open. The user's screen/microphone stayed captured with no way to stop them until the browser was restarted.
  - **Fix**: The catch block now calls `.stop()` on all active tracks and `.close()` on the AudioContext before sending the `recording-error` message.

#### Duplicate State Property — `src/pages/Content/context/ContentState.jsx`
- **`recordingShortcut` defined twice in initial state**: The `ContentState` initial object contained two `recordingShortcut` keys: `"⌥⇧W"` and `"⌥⇧D"`. JavaScript silently uses the last definition, but the duplicate caused confusion and wasted memory.
  - **Fix**: Removed the first (stale `"⌥⇧W"`) definition, leaving only `"⌥⇧D"`.

---

### Security Fixes

#### `src/pages/Content/index.jsx` — postMessage Wildcard Origin
- `window.postMessage({...}, "*")` was used when replying to `SET_TOKEN` and `CLEAR_TOKEN` messages. Using `"*"` as the target origin means **any window on the page** (including attacker-controlled iframes) could receive the confirmation message. While the confirmation message itself no longer carries the token, the approach was unsafe and could be exploited in a confused-deputy attack.
  - **Fix**:
    1. Added an `ALLOWED_ORIGINS` allowlist (`app.demokraft.ai`, `devapp.demokraft.ai`, `betaapp.demokraft.ai`, `localhost:3000`).
    2. Incoming messages are now validated against `event.origin` before processing.
    3. Replies now use `event.origin` as the target origin instead of `"*"`.

#### `src/pages/Permissions/Permissions.jsx` and `src/pages/Content/Wrapper.jsx` — postMessage Origin Fix
- **Regression fix**: The previous change in `Permissions.jsx` replaced `"*"` with `chrome.runtime.getURL("/").slice(0, -1)` as the `postMessage` target for messages sent from the `permissions.html` iframe to its parent. This was incorrect: the parent of the iframe is the **web page** the content script is running in (e.g. `https://example.com`), not an extension page. The browser silently dropped all messages where the target origin didn't match the parent's actual origin, causing `permissionsLoaded` to never become `true` and breaking the entire permissions flow — manifesting as repeated mic/camera permission prompts.
  - **Fix**: The `permissions-loaded` notification (no sensitive data) now uses `"*"` as the target since the parent origin is not yet known at mount time.
  - **Fix**: The message handler now captures `event.origin` from the incoming `screenity-get-permissions` message and stores it in a `parentOrigin` ref. All subsequent replies (`screenity-permissions` with device lists) use `parentOrigin.current` as the target, so the reply is scoped to the origin that triggered the check.
  - **Fix**: Added `event.source !== window.parent` guard so only the direct parent frame can trigger permission checks — other windows on the page cannot send spoofed `screenity-get-permissions` messages to the hidden iframe.
  - **Fix**: `Wrapper.jsx` now sends `screenity-get-permissions` to the iframe using `chrome.runtime.getURL("/").slice(0, -1)` as the target (extension origin), which is correct for parent → child iframe messaging since the iframe IS an extension page.
- **Root cause of per-user mic/camera access failure fixed** — The `permissions.html` iframe in `Wrapper.jsx` was styled with `display: none; visibility: hidden`. Chrome's Permissions Policy blocks `getUserMedia` calls from invisible iframes, especially in managed/Work profile Chrome setups. Affected users had camera and microphone enabled for the site they were on, but the extension's hidden iframe could not access those permissions — while other extensions that don't use a hidden iframe for this were unaffected.
  - **Fix (`Wrapper.jsx`)**: Changed the `permissions.html` iframe from `display: none; visibility: hidden` to `position: fixed; width: 1px; height: 1px; top: -9999px; left: -9999px; opacity: 0; pointer-events: none`. The iframe is now technically present in layout (satisfying Chrome's requirement for media capture from iframes) while being completely invisible and non-interactive to the user.
  - **Fix (`Permissions.jsx`)**: Added a cache-first strategy — `checkPermissions()` now reads `chrome.storage.local` first when the Permissions API reports "granted". If valid cached device data exists, it sends the cached data immediately without calling `getUserMedia` at all. `getUserMedia` is now only called when the cache is absent (first grant ever) or when permission state changes. This eliminates repeated `getUserMedia` calls on every extension open, which was causing silent failures for users in certain Chrome environments.
  - **Fix**: Same cache-first fallback applied to the `catch` path when the Permissions API is unavailable (enterprise policy), so those users also avoid unnecessary `getUserMedia` calls.

#### `src/manifest.json` — Wildcard Web-Accessible Resource
- The `web_accessible_resources` list included a trailing `"*"` entry which made **every file in the extension bundle** accessible to any website. Combined with `"matches": ["<all_urls>"]`, this allowed any page on the internet to load the extension's JS bundles, read their structure, or attempt to embed internal extension pages as iframes.
  - **Fix**: Removed the `"*"` wildcard. All legitimate resources (CSS, assets, and HTML pages injected into web pages by the content script) were already explicitly listed above it — the wildcard was redundant and dangerous.
- The `web_accessible_resources` list contained a duplicate `"playground.html"` entry.
  - **Fix**: Removed the duplicate.
- `host_permissions` and `content_scripts.matches` each repeated the specific Demokraft and localhost origins redundantly alongside `"<all_urls>"`. Since `"<all_urls>"` is a superset, the explicit entries were dead weight.
  - **Fix**: Removed the redundant explicit entries, leaving only `"<all_urls>"`. Note: `"<all_urls>"` is legitimately required here — the background script uses `chrome.scripting.executeScript()` to re-inject the content script into any open tab on extension update, which requires broad host permissions.

---

### Performance Improvements

#### Removed Excessive `console.log` Calls
The following debug/diagnostic log statements were removed to reduce runtime overhead and prevent information leakage:

- **`src/pages/Background/index.js`**: Removed `console.log(message.data, "clickData")` (fired on every user click during recording, printing raw click coordinates) and `console.log("COMPANY_ID found:", res.SELLER_DETAILS)` (printed auth token details).
- **`src/pages/Content/index.jsx`**: Removed `console.log("No saved time")` fired inside the per-click storage callback.
- **`src/pages/Content/context/ContentState.jsx`**: Removed four `console.log` / `console.log` calls around `clickCoordinates` cleanup and `savedTime` storage that ran at recording start.
- **`src/pages/Content/popup/layout/RecordingType.jsx`**: Removed seven numbered debug log statements (`"1. Component mounted..."` through `"7. Cleaning up..."`) that ran on every component mount, storage read, state change, and cleanup — and a `useEffect` that logged the language state on every language change.
- **`src/pages/Content/popup/components/LanguageSelect.jsx`**: Removed `console.log('Prop value changed to:', value)` (fired on every prop change), `console.log("1. Language selected:", lang)` (fired on every selection), and `console.log("5. Successfully saved:", updatedSeller)` (printed full SELLER_DETAILS object including auth tokens to console after every language save).
- **`src/pages/Sandbox/components/editor/VideoPlayer.jsx`**: Removed debug artifact `console.log("kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk")` left in from development.

#### `src/pages/Content/popup/layout/RecordingType.jsx` — Language Load Refactor
- Simplified the language-loading `useEffect`: merged the two redundant branches (invalid language and missing language both default to English with a single `set` call), removed unnecessary intermediate `console.warn`/`console.log` statements.

---

### Files Changed

| File | Change Type |
|------|-------------|
| `src/pages/Permissions/Permissions.jsx` | Bug fix, security, cleanup, regression fix |
| `src/pages/Content/Wrapper.jsx` | Bug fix, security |
| `src/pages/Recorder/Recorder.jsx` | Bug fix, memory leak, reliability |
| `src/pages/RecorderOffscreen/RecorderOffscreen.jsx` | Bug fix, memory leak, video quality, reliability |
| `src/pages/Camera/Camera.jsx` | Memory leak, performance |
| `src/pages/Content/index.jsx` | Security, cleanup |
| `src/pages/Content/context/ContentState.jsx` | Bug fix, cleanup |
| `src/pages/Content/popup/layout/RecordingType.jsx` | Cleanup, refactor |
| `src/pages/Content/popup/components/LanguageSelect.jsx` | Cleanup |
| `src/pages/Sandbox/components/editor/VideoPlayer.jsx` | Cleanup |
| `src/pages/Background/index.js` | Bug fix, cleanup |
| `src/manifest.json` | Security, cleanup |
