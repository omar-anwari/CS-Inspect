import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import './theme-dark.css'; // Import our new dark theme
import html2canvas from 'html2canvas';
// Import the original InspectTool component
import InspectTool from './components/InspectTool';
import ControlsBar from './components/ControlsBar';
import TextureLoadingTest from './components/TextureLoadingTest';

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

const BACKGROUND_OPTIONS = [
  { label: 'None', value: '', preview: '/backgrounds/none.jpg' },
  { label: 'Main', value: 'url(/backgrounds/bg1_1.png)', preview: '/backgrounds/bg1_1.png' },
  { label: 'Siege', value: 'url(/backgrounds/bg1_2.png)', preview: '/backgrounds/bg1_2.png' },
  { label: 'Orange', value: 'url(/backgrounds/bg1_3.png)', preview: '/backgrounds/bg1_3.png' },
  { label: 'Purple', value: 'url(/backgrounds/bg1_4.png)', preview: '/backgrounds/bg1_4.png' },
  { label: 'Blue', value: 'url(/backgrounds/bg1_5.png)', preview: '/backgrounds/bg1_5.png' },
];

const MainApp: React.FC = () => {
  const [inspectLink, setInspectLink] = useState('');
  
  const handleInspectSubmit = (link: string) => {
    console.log("Inspect link submitted:", link);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>CS Inspect</h1>
        <p>Inspect CS:GO weapon skins in 3D</p>
        <Link to="/texture-test" className="test-link">Texture Loading Test</Link>
      </header>
      <div className="App-content">
        <InspectTool 
          inspectLink={inspectLink} 
          onInspectSubmit={handleInspectSubmit}
        />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [inspectLink, setInspectLink] = useState('');
  const [fetchedItems, setFetchedItems] = useState<ItemInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [bgPreset, setBgPreset] = useState('');
  const [showInspected, setShowInspected] = useState(true);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showBackgroundSelector, setShowBackgroundSelector] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const corsProxy = document.createElement('iframe');
    corsProxy.style.display = 'none';
    corsProxy.src = 'https://cstool.omaranwari.com/';
    document.body.appendChild(corsProxy);
    corsProxy.onload = () => {
      setIsInitialized(true);
      
      // Validate models to see what exists
      setTimeout(async () => {
        console.log('Running model validation...');
      }, 2000);
    };
    
    return () => {
      document.body.removeChild(corsProxy);
    };
  }, []);

  const handleFetchItem = async () => {
    if (!inspectLink) return;
    setErrorMessage(null);
    
    // The InspectTool component will handle the actual API call and 3D model loading
    // Just reset any existing errors so the InspectTool can show its own loading state
    setErrorMessage(null);
    
    // For backward compatibility, we keep the data fetching here too
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
        // Use ModelPreloader to pre-load the model
        const baseWeaponName = data.iteminfo.full_item_name.split('|')[0].trim();
        try {
          const { ModelPreloader } = require('./utils/modelPathResolver');
          ModelPreloader.getInstance().preloadModel(baseWeaponName);
        } catch (err) {
          console.warn('Model preloading failed:', err);
        }
        
        // Update the fetched items
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
        userMessage = 'Encountered a CORS error—please try clicking "Inspect Item" a few times until it works.';
      }
      setErrorMessage(userMessage);
    }
  };

  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  const toggleInspected = () => setShowInspected(prev => !prev);
  const toggleInfoPanel = () => setShowInfoPanel(prev => !prev);

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
                  src={item.imageurl}
                  alt={item.full_item_name}
                  onError={e => { e.currentTarget.src = 'https://placehold.co/48x36?text=No+Image'; }}
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
                  src={sticker.imageurl}
                  alt={sticker.name}
                  className="sticker-image"
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/64?text=No+Image';
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