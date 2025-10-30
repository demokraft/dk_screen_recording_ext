import React, { useContext, useEffect, useState } from "react";

// Components
import PlayerNav from "./PlayerNav";
import CropNav from "../editor/CropNav";
import AudioNav from "../editor/AudioNav";
import RightPanel from "./RightPanel";
import Content from "./Content";

import styles from "../../styles/player/_Player.module.scss";
import CryptoJS from "crypto-js";

const SECRET_KEY = "Demokraft@123@#$"; // ⚠ Don't hardcode real secrets in frontend


 const encryptData = (data) => {
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
  return encrypted.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
// Context
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

const Player = () => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context


useEffect(() => {
  if (contentState.videoUploadContentService) {
    chrome.storage.local.remove(["clickCoordinates", "savedTime"], () => {
      let studioID = encryptData(contentState?.studio_video_id);

      // Get current active tab and update its URL
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.update(tabs[0].id, {
            url: `https://app.demokraft.ai/studio?studio_video_id=${studioID}`
          });
        }
      });

      console.log("Selected keys removed and tab replaced");
    });
  }
}, [contentState.videoUploadContentService]);

  return (
    <div className={styles.layout}>
      <div    style={{
        position:"fixed",
        top:"0px",
        left:"0px",
        width:"100%",
        height:"100%",
        background:"rgba(0,0,0,0.2)",
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        backdropFilter: "saturate(180%) blur(10px)",
        zIndex:"999999999999"
        
      }}>
        <div className={styles.loader}>

        </div>
      </div>
      {contentState.mode === "crop" && <CropNav />}
      {contentState.mode === "player" && <PlayerNav />}
      {contentState.mode === "audio" && <AudioNav />}
      <div className={styles.content}>
        <Content />
        <RightPanel />
      </div>
    </div>
  );
};

export default Player;
