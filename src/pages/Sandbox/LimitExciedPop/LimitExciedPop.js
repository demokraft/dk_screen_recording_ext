import React, { useContext, useEffect, useState, useRef } from 'react';
import * as Dialog from "@radix-ui/react-dialog";
import { contentStateContext } from '../../Content/context/ContentState';
export default function LimitExciedPop() {
const [contentState, setContentState] = useContext(contentStateContext);
    
  const [open, setOpen] = useState(false);

useEffect(()=>{
    if(contentState?.limitexcied==true)
setOpen(contentState?.limitexcied)
},[contentState?.limitexcied])

  
  return (
    <Dialog.Root open={open} >
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
         style={{
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            position: "fixed",
            inset: 0,
            zIndex: 999,
          }}
        />

        {/* Modal content */}
        <Dialog.Content
          style={{
            backgroundColor: "#fff",
            color: "#333",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            padding: "32px 24px",
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "380px",
            textAlign: "center",
            zIndex: 1000,
          }}


       
          onEscapeKeyDown={(e) => e.preventDefault()} // optional: disable ESC


        >
          {/* Close Icon */}
        
          {/* Red Cross Icon */}
          <div
            style={{
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              backgroundColor: "#d32f2f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",

            }}
          >
            <span style={{ fontSize: "30px", fontWeight: "bold",
              display: "inline-block",
              height: "45px",
              color: "#fff"


             }}>×</span>
          </div>

          {/* Message */}
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px",fontFamily:"Satoshi-Medium"  }}>
            Studio project max limits exceeded
          </h3>
          <p style={{ fontSize: "14px", color: "#rgba(0,0,0,0.5)", marginBottom: "24px", fontFamily:"Satoshi-Medium" }}>
            You’ve reached the max allowed limit for studio projects.
            Please upgrade your plan for more projects.
          </p>

          {/* Okay button */}
          <Dialog.Close asChild>
            <button
            onClick={()=>{
                  setContentState((prevContentState) => ({
                        ...prevContentState,
                        limitexcied: false,
                    }));
                    setOpen(false)
            }}  
              style={{
                backgroundColor: "#ff9800",
                color: "white",
                border: "none",
                padding: "10px 24px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Okay
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
