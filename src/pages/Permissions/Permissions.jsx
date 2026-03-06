import React, { useEffect, useRef } from "react";

const Recorder = () => {
  // Capture the parent window's origin from the first screenity-get-permissions
  // message so we can use it as the postMessage target for all replies.
  // The parent is the web page the content script is running in (NOT an
  // extension page), so chrome.runtime.getURL() is the wrong target origin.
  const parentOrigin = useRef("*");

  useEffect(() => {
    // Notify parent that the iframe is ready. We don't know the parent's origin
    // yet, so use "*" here — this message carries no sensitive data.
    window.parent.postMessage({ type: "screenity-permissions-loaded" }, "*");
  }, []);

  // Wrap chrome.storage.local.get in a Promise so we can await it.
  const getStoredDevices = () =>
    new Promise((resolve) => {
      chrome.storage.local.get(
        ["audioinput", "audiooutput", "videoinput", "cameraPermission", "microphonePermission"],
        resolve
      );
    });

  const checkPermissions = async () => {
    try {
      const cameraPermission = await navigator.permissions.query({ name: "camera" });
      const microphonePermission = await navigator.permissions.query({ name: "microphone" });

      // Re-run when the user changes permissions in Chrome settings
      cameraPermission.onchange = () => {
        checkPermissions();
      };
      microphonePermission.onchange = () => {
        checkPermissions();
      };

      const camGranted = cameraPermission.state === "granted";
      const micGranted = microphonePermission.state === "granted";

      if (camGranted || micGranted) {
        // Permission already granted — try to serve from cache to avoid calling
        // getUserMedia from this hidden iframe, which can fail on some Chrome
        // profiles/versions even when permission was previously given.
        const stored = await getStoredDevices();

        const cacheValid =
          stored.cameraPermission === camGranted &&
          stored.microphonePermission === micGranted &&
          Array.isArray(stored.audioinput) &&
          Array.isArray(stored.videoinput);

        if (cacheValid) {
          window.parent.postMessage(
            {
              type: "screenity-permissions",
              success: true,
              audioinput: stored.audioinput,
              audiooutput: stored.audiooutput || [],
              videoinput: stored.videoinput,
              cameraPermission: stored.cameraPermission,
              microphonePermission: stored.microphonePermission,
            },
            parentOrigin.current
          );
          return;
        }

        // Cache missing or stale — do a full enumeration
        await enumerateDevices(camGranted, micGranted);
      } else if (
        cameraPermission.state === "denied" &&
        microphonePermission.state === "denied"
      ) {
        // Both explicitly denied — report failure without triggering getUserMedia
        window.parent.postMessage(
          {
            type: "screenity-permissions",
            success: false,
            error: "NotAllowedError",
          },
          parentOrigin.current
        );
      } else {
        // At least one is "prompt" — request access for what isn't denied
        await enumerateDevices(
          cameraPermission.state !== "denied",
          microphonePermission.state !== "denied"
        );
      }
    } catch (err) {
      // Permissions API unavailable (e.g. some Chrome enterprise policies).
      // Fall back to cached data first; only call getUserMedia if cache is empty.
      const stored = await getStoredDevices();

      const hasCachedData =
        (stored.cameraPermission === true || stored.microphonePermission === true) &&
        Array.isArray(stored.audioinput);

      if (hasCachedData) {
        window.parent.postMessage(
          {
            type: "screenity-permissions",
            success: true,
            audioinput: stored.audioinput,
            audiooutput: stored.audiooutput || [],
            videoinput: stored.videoinput || [],
            cameraPermission: !!stored.cameraPermission,
            microphonePermission: !!stored.microphonePermission,
          },
          parentOrigin.current
        );
      } else {
        await enumerateDevices();
      }
    }
  };

  // Enumerate devices — only called when cache is absent or stale.
  const enumerateDevices = async (camGranted = true, micGranted = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: micGranted,
        video: camGranted,
      });

      const devicesInfo = await navigator.mediaDevices.enumerateDevices();

      let audioinput = [];
      let audiooutput = [];
      let videoinput = [];

      if (micGranted) {
        audioinput = devicesInfo
          .filter((device) => device.kind === "audioinput")
          .map((device) => ({ deviceId: device.deviceId, label: device.label }));

        audiooutput = devicesInfo
          .filter((device) => device.kind === "audiooutput")
          .map((device) => ({ deviceId: device.deviceId, label: device.label }));
      }

      if (camGranted) {
        videoinput = devicesInfo
          .filter((device) => device.kind === "videoinput")
          .map((device) => ({ deviceId: device.deviceId, label: device.label }));
      }

      // Cache results so future opens don't need to call getUserMedia again
      chrome.storage.local.set({
        audioinput,
        audiooutput,
        videoinput,
        cameraPermission: camGranted,
        microphonePermission: micGranted,
      });

      window.parent.postMessage(
        {
          type: "screenity-permissions",
          success: true,
          audioinput,
          audiooutput,
          videoinput,
          cameraPermission: camGranted,
          microphonePermission: micGranted,
        },
        parentOrigin.current
      );

      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      window.parent.postMessage(
        {
          type: "screenity-permissions",
          success: false,
          error: err.name,
        },
        parentOrigin.current
      );
    }
  };

  // Post message listener
  useEffect(() => {
    const handler = (event) => {
      // Only accept messages from the direct parent frame, not from other windows
      if (event.source !== window.parent) return;
      if (!event.data || event.data.type !== "screenity-get-permissions") return;

      // Capture the parent's origin for use in all replies
      parentOrigin.current = event.origin;
      checkPermissions();
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  return <div></div>;
};

export default Recorder;
