// The start of this mess
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import './theme-dark.css';
import html2canvas from 'html2canvas';
import InspectTool from './components/InspectTool'; // Sidebar for item info, figure out images for stickers and keychains
import ControlsBar from './components/ControlsBar'; // Control bar thing
import TextureLoadingTest from './components/TextureLoadingTest'; // For testing textures, remove later


// Types for stickers, keychains, etc. Add more if needed
interface Sticker {
  slot: number;
  stickerId: number;
  name: string;
  codename: string;
  imageurl: string;
  rotation?: number;
  offset_x?: number;
  offset_y?:number;
  wear?: number;
}

interface Keychain {
  slot: number;
  sticker_id: number;
  pattern: number;
  name: string;
}

interface ItemInfo {
  full_item_name: string;
  wear_name: string;
  floatvalue: number;
  stickers: Sticker[];
  rarity_name: string;
  quality_name: string;
  customname: string;
  paintseed: number;
  imageurl: string;
  keychains: Keychain[];
}


// Backgrounds, Add more if you want
const BACKGROUND_OPTIONS = [
  { label: 'None', value: '', preview: '/backgrounds/none.jpg' },
  { label: 'Main', value: 'url(/backgrounds/bg1_1.png)', preview: '/backgrounds/bg1_1.png' },
  { label: 'Siege', value: 'url(/backgrounds/bg1_2.png)', preview: '/backgrounds/bg1_2.png' },
  { label: 'Orange', value: 'url(/backgrounds/bg1_3.png)', preview: '/backgrounds/bg1_3.png' },
  { label: 'Purple', value: 'url(/backgrounds/bg1_4.png)', preview: '/backgrounds/bg1_4.png' },
  { label: 'Blue', value: 'url(/backgrounds/bg1_5.png)', preview: '/backgrounds/bg1_5.png' },
];

// It's a big pile of state and hacks but it "works"
const App: React.FC = () => {
  const [inspectLink, setInspectLink] = useState(''); // What you're inspecting
  const [fetchedItems, setFetchedItems] = useState<ItemInfo[]>([]); // All the stuff you've looked at
  const [selectedIndex, setSelectedIndex] = useState(0); // Which one is selected
  const [theme, setTheme] = useState<'dark' | 'light'>('dark'); // Defaults to dark mode
  const [bgPreset, setBgPreset] = useState(''); // Backgrounds
  const [showInspected, setShowInspected] = useState(true); // Show/hide the list
  const [showInfoPanel, setShowInfoPanel] = useState(false); // Show/hide info
  const [showBackgroundSelector, setShowBackgroundSelector] = useState(false); // Show/hide bg picker
  const [isInitialized, setIsInitialized] = useState(false); // Did the iframe hack load
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // Errors go here
  const screenshotRef = useRef<HTMLDivElement>(null); // For screenshots, fix it later


  // Set the theme on the html tag, so css vars work
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);


  // iframe hack to get around CORS, no idea if this works
  useEffect(() => {
    const corsProxy = document.createElement('iframe');
    corsProxy.style.display = 'none';
    corsProxy.src = 'https://cstool.omaranwari.com/';
    document.body.appendChild(corsProxy);
    corsProxy.onload = () => {
      setIsInitialized(true);
      // Model validation, probably doesn't do anything
      setTimeout(async () => {
        console.log('Running model validation...');
      }, 2000);
    };
    return () => {
      document.body.removeChild(corsProxy);
    };
  }, []);


  // Fetches the item from the API, sometimes breaks
  const handleFetchItem = async () => {
    if (!inspectLink) return;
    setErrorMessage(null);
    // InspectTool does the real work, this is just for legacy reasons
    setErrorMessage(null);
    try {
      const response = await fetch(
        `https://cstool.omaranwari.com/?url=${encodeURIComponent(inspectLink)}`
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Fetch failed: ${response.status} ${response.statusText} - ${text}`);
      }
      const data = await response.json();
      if (data.iteminfo && data.iteminfo.full_item_name) {
        // Try to preload the model, doesn't always work
        const baseWeaponName = data.iteminfo.full_item_name.split('|')[0].trim();
        try {
          const { ModelPreloader } = require('./utils/modelPathResolver');
          ModelPreloader.getInstance().preloadModel(baseWeaponName);
        } catch (err) {
          console.warn('Model preloading failed:', err);
        }
        setFetchedItems(prevItems => [...prevItems, data.iteminfo]);
        setSelectedIndex(fetchedItems.length);
      }
      setFetchedItems(prev => {
        const next = [...prev, data.iteminfo];
        setSelectedIndex(next.length - 1);
        return next;
      });
    } catch (err: any) {
      console.error('Error fetching item:', err);
      let userMessage = err.message || 'Unknown error occurred';
      if (userMessage.includes('Failed to fetch')) {
        userMessage = 'CORS is being annoying, try clicking Inspect Item again.';
      }
      setErrorMessage(userMessage);
    }
  };


  // Toggles for various UI things, don't touch unless you want to break stuff
  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  const toggleInspected = () => setShowInspected(prev => !prev);
  const toggleInfoPanel = () => setShowInfoPanel(prev => !prev);


  // Screenshot function, hides the UI and grabs a png
  // Model isn't included in the screenshot, fix it later
  const takeScreenshot = async () => {
    if (!screenshotRef.current) return;
    document.body.classList.add('hide-ui');
    setTimeout(async () => {
      const canvas = await html2canvas(screenshotRef.current as HTMLElement, {
        backgroundColor: null,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = 'screenshot.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      document.body.classList.remove('hide-ui');
    }, 100);
  };


  // Wait for the iframe hack to load
  if (!isInitialized) {
    return <div className="loading-screen">Initializing...</div>;
  }

  return (
    <div
      className="app-container"
      style={{ background: bgPreset || 'var(--stripe-bg)' }}
      ref={screenshotRef}
    >
      {/* Main inspect tool (now covers the entire screen) */}
      <InspectTool
        key={`${selectedIndex}-${fetchedItems.length}`}
        inspectLink={inspectLink}
        onError={(error) => setErrorMessage(error)}
        onInspectSubmit={handleFetchItem}
      />

      {errorMessage && (
        <div className="error-message" role="alert">
          {errorMessage}
        </div>
      )}

      {/* Background Selector - integrated directly */}
      {showBackgroundSelector && (
        <div className="background-selector">
          <div className="background-header">
            <h3 className="background-title">Choose Background</h3>
            <button className="close-btn" onClick={() => setShowBackgroundSelector(false)}>×</button>
          </div>
          
          <div className="background-grid">
            {BACKGROUND_OPTIONS.map((bg, index) => (
              <div 
                key={index}
                className={`background-item ${bg.value === bgPreset ? 'selected' : ''}`}
                onClick={() => setBgPreset(bg.value)}
              >
                <img src={bg.preview} alt={bg.label} className="background-preview" />
                <div className="background-label">{bg.label}</div>
              </div>
            ))}
          </div>
          
          <div className="background-actions">
            <button className="reset-btn" onClick={() => setBgPreset('')}>Reset Background</button>
          </div>
        </div>
      )}

      {/* Only render the inspected items list when showInspected is true */}
      {fetchedItems.length > 0 && showInspected && (
        <div className="skin-list">
          <div className="skin-list-header">
            <span>Inspected Items</span>
            <button className="close-list" onClick={() => setShowInspected(false)} aria-label="Close inspected items">
              ×
            </button>
          </div>
          <div className="skin-items">
            {fetchedItems.map((item, index) => (
              <div
                key={index}
                className={`skin-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => setSelectedIndex(index)}
              >
                <img
                  src={item.imageurl || 'https://placehold.co/400'}
                  alt={item.full_item_name}
                  onError={e => { e.currentTarget.src = 'https://placehold.co/400'; }}
                />
                <div className="skin-name">{item.full_item_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fetchedItems[selectedIndex] && (
        <div className={`info-panel ${showInfoPanel ? 'show' : ''}`}>
          <div className="info-header">
            <h2 className="info-title">
              {fetchedItems[selectedIndex].full_item_name}
            </h2>
            <button
              className="close-info"
              onClick={() => setShowInfoPanel(false)}
              aria-label="Close info"
            >
              ×
            </button>
          </div>
          <div className="attributes-grid">
            <div className="attribute">
              <span className="attribute-label">Wear</span>
              <span className="attribute-value">
                {fetchedItems[selectedIndex].wear_name}
              </span>
            </div>
            <div className="attribute">
              <span className="attribute-label">Float</span>
              <span className="attribute-value">
                {fetchedItems[selectedIndex].floatvalue.toFixed(8)}
              </span>
            </div>
            <div className="attribute">
              <span className="attribute-label">Rarity</span>
              <span className="attribute-value">
                {fetchedItems[selectedIndex].rarity_name}
              </span>
            </div>
            <div className="attribute">
              <span className="attribute-label">Quality</span>
              <span className="attribute-value">
                {fetchedItems[selectedIndex].quality_name}
              </span>
            </div>
            {fetchedItems[selectedIndex].customname && (
              <div className="attribute">
                <span className="attribute-label">Nickname</span>
                <span className="attribute-value">
                  {fetchedItems[selectedIndex].customname}
                </span>
              </div>
            )}
            <div className="attribute">
              <span className="attribute-label">Paint Seed</span>
              <span className="attribute-value">
                {fetchedItems[selectedIndex].paintseed}
              </span>
            </div>
          </div>
        </div>
      )}

      {fetchedItems.length > 0 && fetchedItems[selectedIndex] && (
        <button className="toggle-info-btn" onClick={toggleInfoPanel}>
          {showInfoPanel ? 'Hide Details' : 'Show Details'}
        </button>
      )}
      {fetchedItems[selectedIndex]?.stickers?.length > 0 && (
        <div className="sticker-panel">
          <h3 className="info-title">Applied Stickers</h3>
          <div className="sticker-grid">
            {fetchedItems[selectedIndex].stickers.map((sticker, index) => (
              <div key={index} className="sticker-item">
                <img
                  src={sticker.imageurl || 'https://placehold.co/400'}
                  alt={sticker.name}
                  className="sticker-image"
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/400';
                  }}
                />
                <span className="sticker-name">{sticker.name}</span>
                <div className="sticker-metadata">
                  <span className="sticker-slot">Slot {sticker.slot + 1}</span>
                  {sticker.wear !== undefined && (
                    <span className="sticker-wear">
                      Wear: {sticker.wear.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;