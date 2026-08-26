import React, { useEffect, useContext, useState, useRef } from "react";

import Dropdown from "../components/Dropdown";
import Switch from "../components/Switch";
import RegionDimensions from "../components/RegionDimensions";
import Settings from "./Settings";
import { contentStateContext } from "../../context/ContentState";
import { CameraOffBlue, MicOffBlue } from "../../images/popup/images";
import * as Dialog from "@radix-ui/react-dialog";
import stoprecodingicon from "../../../../assets/recording-logo.png"

import BackgroundEffects from "../components/BackgroundEffects";

import { AlertIcon, TimeIcon,StopIcon, NoInternet } from "../../toolbar/components/SVG";
import VideoAbout from "../../../VideoAbout/VideoAbout";
import LimitExciedPop from "../../../Sandbox/LimitExciedPop/LimitExciedPop";
import LanguageDropdown from "../components/LanguageSelect";

const RecordingType = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [cropActive, setCropActive] = useState(false);
     const [description, setDescription] = useState("");
     const [language, setLanguage] = useState("English");

     // Load saved language from Chrome storage on component mount
  useEffect(() => {
  const validLanguages = [
    "Bengali", "Bulgarian", "Chinese", "Czech", "Danish", "Dutch", "English",
    "Finnish", "French", "German", "Greek", "Gujarati", "Hindi", "Indonesian",
    "Italian", "Japanese", "Kannada", "Korean", "Malay", "Marathi",
    "Norwegian", "Polish", "Portuguese", "Punjabi", "Romanian",
    "Russian", "Slovak", "Spanish", "Swedish", "Tamil", "Telugu",
    "Thai", "Turkish", "Ukrainian", "Vietnamese"
  ];

  chrome.storage.local.get(["SELLER_DETAILS"], (result) => {
    const seller = result.SELLER_DETAILS || {};
    const savedLang = seller.selectedLanguage;

    if (savedLang && validLanguages.includes(savedLang)) {
      setLanguage(savedLang);
    } else {
      // Log so a silently-reset language choice (e.g. saved before a language was
      // added to validLanguages, or a stale/typo'd value) is debuggable — this
      // branch otherwise fails silent, resetting the seller's saved language.
      if (savedLang) {
        console.warn(`Saved language "${savedLang}" is not in validLanguages; resetting to English.`);
      }
      setLanguage("English");
      chrome.storage.local.set({
        SELLER_DETAILS: { ...seller, selectedLanguage: "English" }
      });
    }
  });

  const handleStorageChange = (changes, areaName) => {
    if (areaName !== "local") return;
    if (changes.SELLER_DETAILS) {
      const newLanguage = changes.SELLER_DETAILS.newValue?.selectedLanguage;
      if (newLanguage) setLanguage(newLanguage);
    }
  };

  chrome.storage.onChanged.addListener(handleStorageChange);

  return () => {
    chrome.storage.onChanged.removeListener(handleStorageChange);
  };
}, []);



    const [open, setOpen] = useState(false);

  const [time, setTime] = useState(0);
  const [URL, setURL] = useState(
""  );
  const [URL2, setURL2] = useState(
""  );

  const buttonRef = useRef(null);
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  useEffect(() => {
    const locale = chrome.i18n.getMessage("@@ui_locale");
    if (!locale.includes("en")) {
      setURL(
""      );
      setURL2(
""      );
    }
  }, []);

  useEffect(() => {
    // Convert seconds to mm:ss
    let minutes = Math.floor(contentState.alarmTime / 60);
    let seconds = contentState.alarmTime - minutes * 60;
    if (seconds < 10) {
      seconds = "0" + seconds;
    }
    setTime(minutes + ":" + seconds);
  }, []);

  useEffect(() => {
    // Convert seconds to mm:ss
    let minutes = Math.floor(contentState.alarmTime / 60);
    let seconds = contentState.alarmTime - minutes * 60;
    if (seconds < 10) {
      seconds = "0" + seconds;
    }
    setTime(minutes + ":" + seconds);
  }, [contentState.alarmTime]);

// Start recording
  const startRecording = () => {
     setContentState((prevContentState) => ({
        ...prevContentState,
        VideoAbout: true,
      }));
      return <VideoAbout />
  }

  



  const startStreaming = () => {
    chrome.storage.local.get(['SELLER_DETAILS'], async (result) => {
    if (!result?.SELLER_DETAILS) {
      console.log("No seller details saved yet.");
      return;
    }

    try {
      const SELLER_ID = result.SELLER_DETAILS?.SELLER_ID;
      const ACCESS_TOKEN = result.SELLER_DETAILS?.ACCESS_TOKEN;

      const header = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      };

      const body = JSON.stringify({ seller_id: SELLER_ID });

   

      // ✅ Prepare JSON file

      // ✅ First API call: create studio_video_id
      const response = await fetch("https://backend.demokraft.ai/studio/api/v1/studio/videos/validate_prj_limits", {
        method: "POST",
        headers: header,
        body: body,
      });

      const resultStudio = await response.json();

      if(resultStudio.status=="200"){
      startRecording()
      }else{
         setContentState((prevContentState) => ({
        ...prevContentState,
        limitexcied: true,
      }));
       return <LimitExciedPop />

      }
     
    } catch (err) {
      console.error("Upload failed:", err);
    }
  });

  };

  useEffect(() => {
    // Check if CropTarget is null
    if (typeof CropTarget === "undefined") {
      setCropActive(false);
      setContentState((prevContentState) => ({
        ...prevContentState,
        customRegion: false,
      }));
    } else {
      setCropActive(true);
    }
  }, []);

  useEffect(() => {
    if (contentState.recording) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        pendingRecording: false,
      }));
    }
  }, [contentState.recording]);




  const handleSubmit = (e) => {
    e.preventDefault(); // prevent default close if button inside form
    if (!description.trim()) {
      alert("Please enter a description");
      return;
    }

    // Save to localStorage (or chrome.storage.local if in extension)
  

    chrome.storage.local.set({ videoDescription: description }, () => {
  // alert("Description saved!");
      setOpen(false);
      contentState.startStreaming();
      });
  };



  return (
    <div>
      {contentState.updateChrome && (
        <div className="popup-warning">
          <div className="popup-warning-left">
            <AlertIcon />
          </div>
          <div className="popup-warning-middle">
            <div className="popup-warning-title">
              {chrome.i18n.getMessage("customAreaRecordingDisabledTitle")}
            </div>
            <div className="popup-warning-description">
              {chrome.i18n.getMessage("customAreaRecordingDisabledDescription")}
            </div>
          </div>
          <div className="popup-warning-right">
            <a href={URL} target="_blank">
              {chrome.i18n.getMessage("customAreaRecordingDisabledAction")}
            </a>
          </div>
        </div>
      )}
      {/*contentState.offline && (
        <div className="popup-warning">
          <div className="popup-warning-left">
            <NoInternet />
          </div>
          <div className="popup-warning-middle">
            <div className="popup-warning-title">You are currently offline</div>
            <div className="popup-warning-description">
              Some features are unavailable
            </div>
          </div>
          <div className="popup-warning-right">
            <a href="#">Try again</a>
          </div>
        </div>
			)*/}
      {!cropActive &&
        contentState.recordingType === "region" &&
        !contentState.offline && (
          <div className="popup-warning">
            <div className="popup-warning-left">
              <AlertIcon />
            </div>
            <div className="popup-warning-middle">
              <div className="popup-warning-title">
                {chrome.i18n.getMessage("customAreaRecordingDisabledTitle")}
              </div>
              <div className="popup-warning-description">
                {chrome.i18n.getMessage(
                  "customAreaRecordingDisabledDescription"
                )}
              </div>
            </div>
            <div className="popup-warning-right">
              <a
                href="https://support.google.com/chrome/answer/95414?hl=en-GB&co=GENIE.Platform%3DDesktop"
                target="_blank"
              >
                {chrome.i18n.getMessage("customAreaRecordingDisabledAction")}
              </a>
            </div>
          </div>
        )}
      {/* {!contentState.cameraPermission && (
        <button
          className="permission-button"
          onClick={() => {
            if (typeof contentState.openModal === "function") {
              contentState.openModal(
                chrome.i18n.getMessage("permissionsModalTitle"),
                chrome.i18n.getMessage("permissionsModalDescription"),
                chrome.i18n.getMessage("permissionsModalReview"),
                chrome.i18n.getMessage("permissionsModalDismiss"),
                () => {
                  chrome.runtime.sendMessage({
                    type: "extension-media-permissions",
                  });
                },
                () => {},
                chrome.runtime.getURL("assets/helper/permissions.webp"),
                chrome.i18n.getMessage("learnMoreDot"),
                URL2,
                true,
                false
              );
            }
          }}
        >
          <img src={CameraOffBlue} />
          <span>{chrome.i18n.getMessage("allowCameraAccessButton")}</span>
        </button>
      )} */}
      {/* {contentState.cameraPermission && (
        <Dropdown type="camera" shadowRef={props.shadowRef} />
      )} */}
      {contentState.cameraPermission &&
        contentState.defaultVideoInput != "none" &&
        contentState.cameraActive && (
          <div>
            {/* <Switch
              label={chrome.i18n.getMessage("flipCameraLabel")}
              name="flip-camera"
              value="cameraFlipped"
            />
            <Switch
              label={chrome.i18n.getMessage("backgroundEffectsLabel")}
              name="background-effects-active"
              value="backgroundEffectsActive"
            />
            {contentState.backgroundEffectsActive && <BackgroundEffects />} */}
          </div>
        )}

      {!contentState.microphonePermission && (
        <button
          className="permission-button"
          onClick={() => {
            if (typeof contentState.openModal === "function") {
              contentState.openModal(
                chrome.i18n.getMessage("permissionsModalTitle"),
                chrome.i18n.getMessage("permissionsModalDescription"),
                chrome.i18n.getMessage("permissionsModalReview"),
                chrome.i18n.getMessage("permissionsModalDismiss"),
                () => {
                  chrome.runtime.sendMessage({
                    type: "extension-media-permissions",
                  });
                },
                () => {},
                chrome.runtime.getURL("assets/helper/permissions.webp"),
                // chrome.i18n.getMessage("learnMoreDot"),
                // URL2,
                true,
                false
              );
            }
          }}
        >
          <img src={MicOffBlue} />
          <span>{chrome.i18n.getMessage("allowMicrophoneAccessButton")}</span>
        </button>
      )}
      {contentState.microphonePermission && (
        <Dropdown type="mic" shadowRef={props.shadowRef} />
      )}

       
     
      
      <LanguageDropdown
        value={language}
        handleChange={(newLang) => {
        
          setLanguage(prevLang => {
           
            return newLang;
          });
        }}
      />    
      
    



      {/* {((contentState.microphonePermission &&
        contentState.defaultAudioInput != "none" &&
        contentState.micActive) ||
        (contentState.microphonePermission && contentState.pushToTalk)) && (
        <div>
          <iframe
            style={{
              width: "100%",
              height: "30px",
              zIndex: 9999999999,
              position: "relative",
            }}
            allow="camera; microphone"
            src={chrome.runtime.getURL("waveform.html")}
          ></iframe>
          <Switch
            label={
              isMac
                ? chrome.i18n.getMessage("pushToTalkLabel") + " (⌥⇧U)"
                : chrome.i18n.getMessage("pushToTalkLabel") + " (Alt⇧U)"
            }
            name="pushToTalk"
            value="pushToTalk"
          />
        </div>
      )} */}
      {contentState.recordingType === "region" && cropActive && (
        <div>
          <div className="popup-content-divider"></div>
          <Switch
            label={chrome.i18n.getMessage("customAreaLabel")}
            name="customRegion"
            value="customRegion"
          />
          {contentState.customRegion && <RegionDimensions />}
        </div>
      )}
      <button
        role="button"
        className="main-button recording-button"
        ref={buttonRef}
        tabIndex="0"
        onClick={startStreaming}
        disabled={
          contentState.pendingRecording ||
          ((!contentState.cameraPermission || !contentState.cameraActive) &&
            contentState.recordingType === "camera")
        }
      >
        {contentState.alarm && contentState.alarmTime > 0 && (
          <div className="alarm-time-button">
            <TimeIcon />
            {time}
          </div>
        )}
        {/* (!contentState.cameraPermission || !contentState.cameraActive) && */}
        <span className="main-button-label">
          {contentState.pendingRecording
            ? chrome.i18n.getMessage("recordButtonInProgressLabel")
            : 
              contentState.recordingType === "camera"
            ? chrome.i18n.getMessage("recordButtonNoCameraLabel")
            : chrome.i18n.getMessage("recordButtonLabel")}
        </span>


        <span className="main-button-shortcut">
          {contentState.recordingShortcut}
        </span>
      </button>
      <div className="start-recording-footer">
        <span>To stop recording,click the extension icon</span>
        <StopIcon width="20" height="20"  />
      </div>
      
        <span style={{fontSize:"12px",color:"#00000080",fontWeight:"bold"}}>Built using Screenity (GPLv3 License)</span>
   

      <Settings />

    </div>
  );
};

export default RecordingType;
