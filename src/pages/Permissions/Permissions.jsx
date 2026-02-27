import React, { useEffect, useState, useRef, useCallback } from "react";

const Recorder = () => {
  const mapDevices = (devicesInfo, camAllowed, micAllowed) => {
    let audioinput = [];
    let audiooutput = [];
    let videoinput = [];

    if (micAllowed) {
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

    if (camAllowed) {
      videoinput = devicesInfo
        .filter((device) => device.kind === "videoinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label,
        }));
    }

    return { audioinput, audiooutput, videoinput };
  };

  const postPermissions = ({
    success,
    audioinput = [],
    audiooutput = [],
    videoinput = [],
    cameraPermission = false,
    microphonePermission = false,
    error = null,
  }) => {
    chrome.storage.local.set({
      // Maintain both key variants for backward compatibility with existing flows.
      audioinput,
      audioInput: audioinput,
      audiooutput,
      videoinput,
      videoInput: videoinput,
      cameraPermission,
      microphonePermission,
    });

    window.parent.postMessage(
      {
        type: "screenity-permissions",
        success,
        audioinput,
        audiooutput,
        videoinput,
        cameraPermission,
        microphonePermission,
        error,
      },
      "*"
    );
  };

  useEffect(() => {
    window.parent.postMessage(
      {
        type: "screenity-permissions-loaded",
      },
      "*"
    );
  }, []);

  const checkPermissions = async () => {
    // Individually check the camera and microphone permissions using the Permissions API. Then enumerate devices respectively.
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

      // If any permission is available (granted/prompt), enumerate devices and let getUserMedia request as needed.
      const canAskCamera = cameraPermission.state !== "denied";
      const canAskMic = microphonePermission.state !== "denied";

      if (canAskCamera || canAskMic) {
        enumerateDevices(canAskCamera, canAskMic);
      } else {
        postPermissions({
          success: false,
          cameraPermission: false,
          microphonePermission: false,
          error: "permissions-denied",
        });
      }
    } catch (err) {
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
      const { audioinput, audiooutput, videoinput } = mapDevices(
        devicesInfo,
        camGranted,
        micGranted
      );

      postPermissions({
        success: true,
        audioinput,
        audiooutput,
        videoinput,
        cameraPermission: camGranted,
        microphonePermission: micGranted,
      });

      // End the stream
      stream.getTracks().forEach(function (track) {
        track.stop();
      });
    } catch (err) {
      // Fallback: still attempt to enumerate devices to avoid false "no mic/camera" states.
      try {
        const devicesInfo = await navigator.mediaDevices.enumerateDevices();
        const cameraPermission = camGranted && err?.name !== "NotAllowedError";
        const microphonePermission = micGranted && err?.name !== "NotAllowedError";
        const { audioinput, audiooutput, videoinput } = mapDevices(
          devicesInfo,
          cameraPermission,
          microphonePermission
        );

        postPermissions({
          success: true,
          audioinput,
          audiooutput,
          videoinput,
          cameraPermission,
          microphonePermission,
          error: err?.name || "unknown-error",
        });
      } catch (_err) {
        postPermissions({
          success: false,
          cameraPermission: false,
          microphonePermission: false,
          error: err?.name || "unknown-error",
        });
      }
    }
  };

  const onMessage = (message) => {
    if (message.type === "screenity-get-permissions") {
      checkPermissions();
    }
  };

  // Post message listener
  useEffect(() => {
    const handleWindowMessage = (event) => {
      if (event.source !== window.parent) return;
      onMessage(event.data);
    };
    window.addEventListener("message", handleWindowMessage);

    return () => {
      window.removeEventListener("message", handleWindowMessage);
    };
  }, []);

  return <div></div>;
};

export default Recorder;
