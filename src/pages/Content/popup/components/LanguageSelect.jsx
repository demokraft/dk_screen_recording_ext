import React, { useState, useRef, useEffect } from "react";

export default function LanguageDropdown({ value, handleChange }) {
  const [currentValue, setCurrentValue] = useState(value);
  
  // Update local state when prop changes
  useEffect(() => {
    console.log('Prop value changed to:', value);
    setCurrentValue(value);
    
    // Verify the value is in our language list
    const validLanguages = Object.keys(languageFlagMap);
    if (value && !validLanguages.includes(value)) {
      console.warn(`Warning: Invalid language value received: ${value}. Valid options are:`, validLanguages);
    }
  }, [value]);
  
 const handleLanguageSelect = async (lang) => {
  console.log("1. Language selected:", lang);

  setCurrentValue(lang);
  setOpenLang(false);

  if (handleChange && typeof handleChange === "function") {
    handleChange(lang);
  }

  try {
    await new Promise((resolve, reject) => {
      chrome.storage.local.get(["SELLER_DETAILS"], (result) => {
        const seller = result.SELLER_DETAILS || {};

        const updatedSeller = {
          ...seller,
          selectedLanguage: lang,
        };

        chrome.storage.local.set({ SELLER_DETAILS: updatedSeller }, () => {
          if (chrome.runtime.lastError) {
            console.error("Storage error:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log("5. Successfully saved:", updatedSeller);
            resolve();
          }
        });
      });
    });
  } catch (error) {
    console.error("Error saving language:", error);
  }
};

  
      const dropdownIcon = "https://img.icons8.com/?size=60&id=99991&format=png"; // down arrow
  const dropdownUpIcon = "https://img.icons8.com/?size=60&id=101314&format=png"; // up arrow

  const languageFlagMap = {
    Dutch: "https://flagcdn.com/nl.svg",
    English: "https://flagcdn.com/gb.svg",
    French: "https://flagcdn.com/fr.svg",
    German: "https://flagcdn.com/de.svg",
    Hindi: "https://flagcdn.com/in.svg",
    Indonesian: "https://flagcdn.com/id.svg",
    Italian: "https://flagcdn.com/it.svg",
    Japanese: "https://flagcdn.com/jp.svg",
    Korean: "https://flagcdn.com/kr.svg",
    Malay: "https://flagcdn.com/my.svg",
    Portuguese: "https://flagcdn.com/pt.svg",
    Russian: "https://flagcdn.com/ru.svg",
    Spanish: "https://flagcdn.com/es.svg",
    Turkish: "https://flagcdn.com/tr.svg",
  };

  const languages = Object.keys(languageFlagMap);
  const [openlang, setOpenLang] = useState(false);
  const dropdownRef = useRef();

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenLang(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = currentValue || "Select Language";

  return (
    <div
      ref={dropdownRef}
      style={{
        display: "flex",
    alignItems: "center",
        width: '306px',
       gap: "10px",
        height:'100%',
        fontFamily: "Arial, sans-serif",
      }}
    >

      <label
    style={{
    fontWeight: 500,
      fontSize: "15px",
      whiteSpace: "nowrap",
    }}
  >
    Recording Language:
  </label>
      {/* Trigger Button */}
        <div
    style={{
      position: "relative",
      width: "220px",
    }}
  >
      <button
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent focus changes that might interfere with click
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOpenLang(!openlang);
        }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          height:"28px",
          borderRadius: "28px",
          background: "#fff",
          cursor: "pointer",
          border: "1px solid #ccc",
          outline: "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {value && (
            <img
              src={languageFlagMap[value]}
              width={20}
              height={14}
              alt={value}
              style={{ objectFit: "cover", borderRadius: 2 }}
            />
          )}
          <span style={{ color: value ? "#000" : "#999" }}>{selectedLabel}</span>
        </div>
         <img
          src={openlang ? dropdownUpIcon : dropdownIcon}
          alt="dropdown"
          style={{ width: 12, height: 12 }}
        />
      </button>

      {/* Dropdown List */}
      {openlang && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            width: "100%",
            maxHeight: 200,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 6,
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
            zIndex: 1000,
          }}
        >
          {languages.map((lang) => (
            <div
              key={lang}
               onMouseDown={(e) => {
                e.preventDefault(); // Prevent focus changes that might close the dropdown
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleLanguageSelect(lang);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                cursor: "pointer",
                background: currentValue === lang ? "#f0f0f0" : "#fff",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f8f8")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = currentValue === lang ? "#f0f0f0" : "#fff")
              }
            >
              <img
             
                src={languageFlagMap[lang]}
                width={20}
                height={14}
                alt={lang}
                style={{ objectFit: "cover", borderRadius: 2 }}
              />
              <span>{lang}</span>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
