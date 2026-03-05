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

  const checkPermissions = async () => {
    // Individually check the camera and microphone permissions using the
    // Permissions API, then enumerate devices accordingly.
    try {
      const cameraPermission = await navigator.permissions.query({
        name: "camera",
      });
      const microphonePermission = await navigator.permissions.query({
        name: "microphone",
      });

      cameraPermission.onchange = () => {
        checkPermissions();
      };

      microphonePermission.onchange = () => {
        checkPermissions();
      };

      // If at least one permission is already granted, enumerate what we can
      if (
        cameraPermission.state === "granted" ||
        microphonePermission.state === "granted"
      ) {
        enumerateDevices(
          cameraPermission.state === "granted",
          microphonePermission.state === "granted"
        );
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
        // State is "prompt" for at least one — attempt to request access once
        enumerateDevices(
          cameraPermission.state !== "denied",
          microphonePermission.state !== "denied"
        );
      }
    } catch (err) {
      // Permissions API unavailable (e.g. some Chrome profile policies) — try anyway
      enumerateDevices();
    }
  };

  // Enumerate devices
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
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label,
          }));

        audiooutput = devicesInfo
          .filter((device) => device.kind === "audiooutput")
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label,
          }));
      }

      if (camGranted) {
        videoinput = devicesInfo
          .filter((device) => device.kind === "videoinput")
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label,
          }));
      }

      // Save in Chrome local storage
      chrome.storage.local.set({
        audioinput: audioinput,
        audiooutput: audiooutput,
        videoinput: videoinput,
        cameraPermission: camGranted,
        microphonePermission: micGranted,
      });

      // Reply to parent with device list. Use the captured parent origin so
      // the browser validates the target and does not broadcast to other frames.
      window.parent.postMessage(
        {
          type: "screenity-permissions",
          success: true,
          audioinput: audioinput,
          audiooutput: audiooutput,
          videoinput: videoinput,
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
