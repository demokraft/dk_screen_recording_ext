import React, { useContext, useEffect, useState } from 'react'
import * as Dialog from "@radix-ui/react-dialog";
import { contentStateContext } from '../Content/context/ContentState';
import { StopIcon } from '../Content/toolbar/components/SVG';

export default function VideoAbout() {
      const [contentState, setContentState] = useContext(contentStateContext);
const [open, setOpen] = useState(false);

const [description, setDescription] = useState("");
useEffect(()=>{
    if(contentState?.VideoAbout==true)
setOpen(contentState?.VideoAbout)
},[contentState?.VideoAbout])

const handleSubmit = (e) => {
    e.preventDefault(); // prevent default close if button inside form
    if (!description.trim()) {
      return;
    }
    chrome.storage.local.set({ videoDescription: description }, () => {
      setOpen(false);
      setContentState((prevContentState) => ({
        ...prevContentState,
      cursorMode: "target",
      VideoAbout:false
      }));

      contentState.startStreaming();


      });
  };
  return (
 
       <Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Overlay
    style={{
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      position: "fixed",
      inset: 0,
      zIndex: 999,
      width: "100%",
      height: "100%",
      left: 0,
      top: 0,
     pointerEvents: "auto",

    }}
  />
  <Dialog.Content
    style={{
      backgroundColor: "white",
      borderRadius: "6px",
      boxShadow: "0 10px 15px rgba(0,0,0,0.3)",
      padding: "20px",
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      minWidth: "300px",
      zIndex: 1000,
      color:"#000",
      fontFamily:"Satoshi-Medium"
    }}


 onOpenAutoFocus={(e) => {
    e.preventDefault();
    setTimeout(() => textareaRef.current?.focus(), 0); // ensures focus in extensions
  }}
  onPointerDownOutside={(e) => {
    e.preventDefault();
    textareaRef.current?.focus(); // keep focus inside
  }}
  onInteractOutside={(e) => {
    e.preventDefault();
    textareaRef.current?.focus();
  }}
  onEscapeKeyDown={(e) => e.preventDefault()} // optional: disable ESC




  >
      <label
      htmlFor="videoDescription"
      style={{
        display: "block",
        marginBottom: "15px",
        fontSize: "18px",
        fontWeight: "bold",
        fontFamily: 'Satoshi-Medium'

      }}
    >
   Recommendation
    </label>

       <ul style={{
        marginLeft:'0px',
        paddingLeft: "15px"
       }}>
      <li><b>Narrate actions</b> as you record; avoid silent videos.</li>
      <li><b>Click purposefully</b>. Avoid extra clicks, as they generate screenshots.</li>
      <li><b>Focus on clear visuals</b> (cursor, flow) since video is final; audio can be edited later.</li>
      <li><div className='start-recording-footer' style={{
        gap:"0px",
        height:'auto',
        justifyContent:"unset",


      }}><b>Stop Recording:</b> To stop recording, click the extension icon <span style={{
        marginTop:"5px",
        marginLeft:"5px"
      }}><StopIcon width="20" height="20"   /></span> .</div> </li>   </ul>


    <label
      htmlFor="videoDescription"
      style={{
        display: "block",
        marginBottom: "15px",
        fontSize: "14px",
      }}
    >
      Can you tell us what is this video about?
    </label>

    <textarea
      id="videoDescription"
      rows={4}
      placeholder="Write your description here..."
      style={{
        width: "calc(100% - 16px)",
        padding: "8px",
        fontSize: "14px",
        borderRadius: "4px",
        border: "1px solid #ccc",
        resize: "vertical",
        fontFamily: "Satoshi-Medium"
      }}
      value={description}
      onChange={(e) => setDescription(e.target.value)}
    />
 


    <Dialog.Close asChild>
      <button
        style={{
          marginTop: "15px",
          padding: "8px 16px",
          backgroundColor: "#ff9800",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
        }}
        onClick={handleSubmit}
      >
        Submit
      </button>
    </Dialog.Close>
  </Dialog.Content>
</Dialog.Root>

    
  )
}
