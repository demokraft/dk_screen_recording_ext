import React from "react";
import { render } from "react-dom";
import Content from "./Content";

// Check if screenity-ui already exists, if so, remove it
const existingRoot = document.getElementById("screenity-ui");
if (existingRoot) {
  document.body.removeChild(existingRoot);
}

// Use this if your video recording captures the entire page including scroll:
if (!window.hasClickListener) {
  window.hasClickListener = true;

  window.addEventListener("click", (e) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const pageWidth = document.documentElement.scrollWidth;
    const pageHeight = document.documentElement.scrollHeight;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;

    const normalizedClientX = (e.clientX + scrollX) / pageWidth;
    const normalizedClientY = (e.clientY + scrollY) / pageHeight;

    chrome.storage.local.get(["qualityValue", "savedTime"], (res) => {
      if (!res.savedTime) {
        return;
      }

      const qualityValue = res.qualityValue ?? "1080p";
      const savedTime = res.savedTime;
      const startTime = savedTime / 1000;
      const currentTime = Date.now() / 1000;
      const clickTime = currentTime - startTime;

      let videoWidth = 1920, videoHeight = 1080;
      if (qualityValue === "4k") { videoWidth = 4096; videoHeight = 2160; }
      else if (qualityValue === "720p") { videoWidth = 1280; videoHeight = 720; }
      else if (qualityValue === "480p") { videoWidth = 854; videoHeight = 480; }
      else if (qualityValue === "360p") { videoWidth = 640; videoHeight = 360; }
      else if (qualityValue === "240p") { videoWidth = 426; videoHeight = 240; }

     const vx = Math.round(normalizedClientX * videoWidth);
    const vy = Math.round(normalizedClientY * videoHeight);


      const clickData = {
        // x: e.clientX,
        // y: e.clientY,
        // pageX: e.pageX,
        // pageY: e.pageY,
        // nx: normalizedClientX,
        // ny: normalizedClientY,
       x: vx,
       y: vy,
        // videoWidth,
        // videoHeight,
        // qualityValue,
        // viewportWidth,
        // viewportHeight,
        // pageWidth,
        // pageHeight,
        // devicePixelRatio,
        // scrollX,
        // scrollY,
        time: clickTime,
        // url: window.location.href
      };

      chrome.runtime.sendMessage({ type: "SAVE_CLICK", data: clickData });
    });
  });
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_COMPANY_ID") {
    const COMPANY_ID = localStorage.getItem("COMPANY_ID");
    const ACCESS_TOKEN = localStorage.getItem("ACCESS_TOKEN");
    const SELLER_ID = localStorage.getItem("SELLER_ID");

    if (!COMPANY_ID || !ACCESS_TOKEN || !SELLER_ID) {
      sendResponse({ error: "MISSING_DATA" });
    } else {
      sendResponse({ data: { COMPANY_ID, ACCESS_TOKEN, SELLER_ID } });
    }
  }
  return true; // ✅ Needed for async sendResponse
});




// content.js

const ALLOWED_ORIGINS = [
  "https://app.demokraft.ai",
  "https://devapp.demokraft.ai",
  "https://betaapp.demokraft.ai",
  "http://localhost:3000",
];

// Listen for messages from web app
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  // Only process messages from known demokraft origins
  if (!ALLOWED_ORIGINS.includes(event.origin)) return;

  // Handle saving token
  if (event.data.type === "SET_TOKEN") {
    chrome.storage.local.set(
      {
        SELLER_DETAILS: {
          ACCESS_TOKEN: event.data.token,
          COMPANY_ID: event.data.companyId,
          SELLER_ID: event.data.sellerId,
        },
      },
      () => {
        // Reply only to the sender's specific origin
        window.postMessage(
          {
            type: "SET_TOKEN_RESPONSE",
            status: "SUCCESS",
          },
          event.origin
        );
      }
    );
  }

  // Handle clearing token
  if (event.data.type === "CLEAR_TOKEN") {
    chrome.storage.local.remove("SELLER_DETAILS", () => {
      // Reply only to the sender's specific origin
      window.postMessage(
        {
          type: "CLEAR_TOKEN_RESPONSE",
          status: "SUCCESS",
        },
        event.origin
      );
    });
  }
});


const root = document.createElement("div");
root.id = "screenity-ui";
document.body.appendChild(root);
render(<Content />, root);
