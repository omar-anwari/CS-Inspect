import React, { useState, useEffect, useRef } from 'react';
import ModernModelViewer from './ModernModelViewer';
// import { ModelPreloader } from '../utils/modelPathResolver';
import InspectLinkInput from './InspectLinkInput';
import './InspectTool.css';

interface Sticker {
  slot: number;
  stickerId: number;
  name: string;
  codename: string;
  imageurl: string;
  rotation?: number;
  offset_x?: number;
  offset_y?: number;
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
  paintindex?: number;
  imageurl: string;
  keychains: Keychain[];
}

// Interface for history item
interface HistoryItem {
  id: string;
  full_item_name: string;
  floatvalue: number;
  imageurl: string;
  inspectLink: string;
  timestamp: number;
}

interface InspectToolProps {
  inspectLink?: string;
  onError?: (error: string) => void;
  onInspectSubmit?: (link: string) => void;
}

/**
 * Main component for the CS:GO skin inspect tool
 */
const InspectTool: React.FC<InspectToolProps> = ({ 
  inspectLink,
  onError,
  onInspectSubmit
}) => {
  const [itemData, setItemData] = useState<ItemInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>('transparent');
  const [currentInspectLink, setCurrentInspectLink] = useState<string | undefined>(inspectLink);
  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showBackgroundSelector, setShowBackgroundSelector] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    // Load history from localStorage if available
    const savedHistory = localStorage.getItem('cs-inspect-history');
    return savedHistory ? JSON.parse(savedHistory) : [];
  });
  const [showHistory, setShowHistory] = useState<boolean>(false);
  // Note: ModelViewer ref functionality removed as ModernModelViewer doesn't support it
  
  // Background options for the selector
  const BACKGROUND_OPTIONS = [
    { label: 'None', value: 'transparent', preview: '/backgrounds/none.jpg' },
    { label: 'Main', value: 'url(/backgrounds/bg1_1.png)', preview: '/backgrounds/bg1_1.png' },
    { label: 'Siege', value: 'url(/backgrounds/bg1_2.png)', preview: '/backgrounds/bg1_2.png' },
    { label: 'Orange', value: 'url(/backgrounds/bg1_3.png)', preview: '/backgrounds/bg1_3.png' },
    { label: 'Purple', value: 'url(/backgrounds/bg1_4.png)', preview: '/backgrounds/bg1_4.png' },
    { label: 'Blue', value: 'url(/backgrounds/bg1_5.png)', preview: '/backgrounds/bg1_5.png' },
  ];

  // Handle inspect link submission from the input component
  const handleInspectLinkSubmit = (link: string) => {
    setCurrentInspectLink(link);
    if (onInspectSubmit) {
      onInspectSubmit(link);
    }
  };

  // Toggle info panel visibility
  const toggleInfoPanel = () => {
    setShowInfoPanel(!showInfoPanel);
  };
  
  // Toggle background selector visibility
  const toggleBackgroundSelector = () => {
    setShowBackgroundSelector(!showBackgroundSelector);
  };

  // Toggle history panel visibility
  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  // Add item to history
  const addToHistory = (item: ItemInfo, inspectLink: string) => {
    // Check if item already exists in history
    const existingItem = history.find(h => h.inspectLink === inspectLink);
    
    // If item already exists, don't change order
    if (existingItem) {
      return;
    }
    
    // Create a new history item for a new skin
    const newHistoryItem: HistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      full_item_name: item.full_item_name,
      floatvalue: item.floatvalue,
      imageurl: item.imageurl,
      inspectLink,
      timestamp: Date.now()
    };
    
    // Add to beginning of history, limit to 50 items, but only for new items
    const updatedHistory = [newHistoryItem, ...history].slice(0, 50);
    setHistory(updatedHistory);
    
    // Save to localStorage
    localStorage.setItem('cs-inspect-history', JSON.stringify(updatedHistory));
  };
  
  // Remove item from history
  const removeFromHistory = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('cs-inspect-history', JSON.stringify(updatedHistory));
  };

  // Handle reset view button click
  const handleResetView = () => {
    // Note: Reset view functionality not available with ModernModelViewer
    console.log('Reset view requested - not implemented for ModernModelViewer');
  };
  
  // Take a screenshot of the current view
  const takeScreenshot = async () => {
    try {
      // Find canvas element directly since ModernModelViewer doesn't expose ref methods
      const canvasElements = document.querySelectorAll('canvas');
      let modelCanvas: HTMLCanvasElement | null = null;
      
      if (canvasElements.length > 0) {
        modelCanvas = canvasElements[0] as HTMLCanvasElement;
      }
      
      if (!modelCanvas) {
        console.error('Could not find model canvas for screenshot');
        return;
      }

      console.log('Taking screenshot with canvas dimensions:', modelCanvas.width, 'x', modelCanvas.height);

      // Temporarily hide UI elements
      document.body.classList.add('hide-ui-for-screenshot');
      
      // Small delay to ensure UI is hidden before taking screenshot
      setTimeout(async () => {
        try {
          // Ensure modelCanvas is not null before proceeding
          if (!modelCanvas) {
            throw new Error('Model canvas is null, cannot create screenshot');
          }
          
          // Create a new canvas with higher resolution (4x the original size for much better quality)
          const scaleFactor = 8; // Higher resolution for better quality
          const finalCanvas = document.createElement('canvas');
          finalCanvas.width = modelCanvas.width * scaleFactor;
          finalCanvas.height = modelCanvas.height * scaleFactor;
          const ctx = finalCanvas.getContext('2d');
          
          if (!ctx) {
            throw new Error('Could not get 2D context');
          }
          
          // Set high quality image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // If there's a background, draw it first
          if (backgroundColor !== 'transparent') {
            try {
              // Create a temporary image to draw the background
              const bgImg = new Image();
              bgImg.crossOrigin = 'anonymous';
              
              // Convert URL background to an actual image URL (strip the url() part)
              const bgUrl = backgroundColor.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
              console.log('Loading background image from URL:', bgUrl);
              
              await new Promise<void>((resolve, reject) => {
                bgImg.onload = () => resolve();
                bgImg.onerror = (e) => {
                  console.error('Error loading background image:', e);
                  reject(e);
                };
                bgImg.src = bgUrl;
              });
              
              // Draw background first (stretched to fill)
              ctx.drawImage(bgImg, 0, 0, finalCanvas.width, finalCanvas.height);
              console.log('Background image drawn successfully');
            } catch (bgErr) {
              console.error('Failed to draw background:', bgErr);
              // If background fails to load, continue with transparent background
            }
          }
          
          // Draw the WebGL content on top (modelCanvas is guaranteed to be non-null here)
          try {
            if (modelCanvas.width > 0 && modelCanvas.height > 0) {
              // Draw the canvas with high quality scaling
              ctx.drawImage(modelCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
              console.log('Model drawn successfully at size:', finalCanvas.width, 'x', finalCanvas.height);
            } else {
              throw new Error('Model canvas has invalid dimensions');
            }
          } catch (drawErr) {
            console.error('Error drawing model to canvas:', drawErr);
            // If we failed drawing the model, continue with just the background
          }
          
          // Create download link with higher quality PNG
          const link = document.createElement('a');
          link.download = `cs-skin-${itemData?.full_item_name || 'screenshot'}.png`;
          link.href = finalCanvas.toDataURL('image/png', 1.0); // Use max quality
          console.log('Screenshot created, triggering download');
          link.click();
        } catch (err) {
          console.error('Error during screenshot creation:', err);
        } finally {
          document.body.classList.remove('hide-ui-for-screenshot');
        }
      }, 100);
    } catch (err) {
      console.error('Error taking screenshot:', err);
    }
  };

  // Update current inspect link when prop changes
  useEffect(() => {
    if (inspectLink !== currentInspectLink) {
      setCurrentInspectLink(inspectLink);
    }
  }, [inspectLink, currentInspectLink]);

  // Fetch item data when inspectLink changes
  useEffect(() => {
    if (!currentInspectLink) {
      setItemData(null);
      setError(null);
      return;
    }

    const fetchItemData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch item data from the API
        const response = await fetch(
          `https://cstool.omaranwari.com/?url=${encodeURIComponent(currentInspectLink)}`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch item data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.iteminfo) {
          throw new Error('Invalid response format: missing iteminfo');
        }
        
        // Update state with the fetched item data
        setItemData(data.iteminfo);
        
        // Add to history
        addToHistory(data.iteminfo, currentInspectLink);
        
        // Do not preload the model
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        if (onError) {
          onError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchItemData();
  }, [currentInspectLink, onError]);

  return (
    <div className="inspect-tool-container">
      {/* Top inspect link input */}
      <InspectLinkInput 
        onSubmit={handleInspectLinkSubmit}
        isLoading={isLoading}
      />
      
      {/* Main model container - always present */}
      <div className="model-container">
        {isLoading ? (
          <div className="inspect-tool-loading">
            <svg width="38" height="38" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
              <g fill="none" fillRule="evenodd">
                <g transform="translate(1 1)" strokeWidth="2">
                  <circle strokeOpacity=".5" cx="18" cy="18" r="18"/>
                  <path d="M36 18c0-9.94-8.06-18-18-18">
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 18 18"
                      to="360 18 18"
                      dur="1s"
                      repeatCount="indefinite"/>
                  </path>
                </g>
              </g>
            </svg>
            <p>Loading weapon data...</p>
          </div>
        ) : error ? (
          <div className="inspect-tool-error">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22ZM12 20C16.418 20 20 16.418 20 12C20 7.582 16.418 4 12 4C7.582 4 4 7.582 4 12C4 16.418 7.582 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z" fill="currentColor"/>
            </svg>
            <h3>Error fetching item data</h3>
            <p>{error}</p>
          </div>
        ) : !itemData ? (
          <div className="inspect-tool-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 13V17.5C20 20.5577 16 20.5 12 20.5C8 20.5 4 20.5577 4 17.5V13M12 3L12 17M12 3L16 7M12 3L8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p>Enter an inspect link to view a weapon</p>
          </div>
        ) : (
          <>
            <ModernModelViewer 
              modelPath={`/models/weapons/${itemData.full_item_name.toLowerCase().replace(/\s+/g, '_')}.glb`}
              itemData={itemData}
              onModelLoad={() => console.log('Model loaded successfully')}
            />
            <div className="model-controls">
              <button className="control-button" title="Reset view" onClick={handleResetView}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 7.5L9 4.5M3 7.5L9 10.5M3 7.5V16.5M15 4.5L21 7.5M21 7.5L15 10.5M21 7.5V16.5M9 4.5L15 4.5M9 19.5H15M9 19.5L3 16.5M15 19.5L21 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              <button 
                className={`control-button ${autoRotate ? 'active' : ''}`}
                title={autoRotate ? "Stop rotation" : "Auto rotate"}
                onClick={() => setAutoRotate(!autoRotate)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d={autoRotate 
                    ? "M9 14L12 11V22M12 11L15 14M21 3H3M18 6H6M3 17L3 21L7 21M21 17V21H17M21 7L21 3L17 3M7 3L3 3L3 7" 
                    : "M9 10L12 7V18M12 7L15 10M21 19.5V15.5M21 8.5V4.5M16.5 21H12.5M11.5 3H7.5M4.5 8.5V4.5M4.5 19.5V15.5M7.5 21H11.5M16.5 3H12.5"} 
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              <button 
                className="control-button" 
                title="Take screenshot" 
                onClick={takeScreenshot}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.5 8.5L8.5 8.5M12 17.85L16.5 13.35M12 17.85L7.5 13.35M12 17.85V11.85M7.8 20.85H16.2C17.8802 20.85 18.7202 20.85 19.362 20.513C19.9265 20.2165 20.3835 19.7595 20.68 19.195C21.017 18.5532 21.017 17.7132 21.017 16.033V8.967C21.017 7.28681 21.017 6.44672 20.68 5.80494C20.3835 5.24046 19.9265 4.78351 19.362 4.487C18.7202 4.15 17.8802 4.15 16.2 4.15H7.8C6.11984 4.15 5.27976 4.15 4.63799 4.487C4.07351 4.78351 3.61656 5.24046 3.32005 5.80494C2.983 6.44672 2.983 7.28681 2.983 8.967V16.033C2.983 17.7132 2.983 18.5532 3.32005 19.195C3.61656 19.7595 4.07351 20.2165 4.63799 20.513C5.27976 20.85 6.11984 20.85 7.8 20.85Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              <button 
                className="control-button" 
                title="Change background" 
                onClick={toggleBackgroundSelector}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="16" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2.5 15.5L7 11.5C7.82843 10.7292 9.17157 10.7292 10 11.5L14.5 15.5C15.3284 16.2708 16.6716 16.2708 17.5 15.5L21.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              
              <button 
                className="control-button" 
                title="View History" 
                onClick={toggleHistory}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Toggle button for info panel */}
            <button className="toggle-info-btn" onClick={toggleInfoPanel} aria-label={showInfoPanel ? 'Hide Details' : 'Show Details'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                {showInfoPanel ? (
                  <path d="M15 5L9 12L15 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                ) : (
                  <path d="M9 5L15 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                )}
              </svg>
              <span className="button-text">{showInfoPanel ? 'Hide Details' : 'Show Details'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d={showInfoPanel ? "M9 6L15 12L9 18" : "M15 6L9 12L15 18"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </>
        )}
      </div>
      
      {/* Info panel positioned on the right - only show if we have data */}
      {/* Background Selector Modal - outside of the condition to be always accessible */}
      {showBackgroundSelector && (
        <div className="background-selector-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Choose Background</h3>
              <button className="close-btn" onClick={toggleBackgroundSelector} aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="background-grid">
              {BACKGROUND_OPTIONS.map((bg, idx) => (
                <div 
                  key={idx}
                  className={`background-item ${bg.value === backgroundColor ? 'selected' : ''}`}
                  onClick={() => setBackgroundColor(bg.value)}
                >
                  <div className="background-preview" style={{ 
                    backgroundColor: bg.value === 'transparent' ? 'transparent' : undefined,
                    backgroundImage: bg.value !== 'transparent' ? bg.value : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}></div>
                  <span className="background-label">{bg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History Panel - shows previously inspected skins */}
      {showHistory && (
        <div className="history-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Inspection History</h3>
              <button className="close-btn" onClick={toggleHistory} aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            
            <div className="history-list">
              {history.length === 0 ? (
                <div className="empty-history">
                  <p>No inspection history</p>
                  <p className="empty-history-subtext">Items you inspect will appear here</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="history-item">
                    <div 
                      className="history-item-image" 
                      onClick={() => handleInspectLinkSubmit(item.inspectLink)}
                      style={{ backgroundImage: `url(${item.imageurl})` }}
                    ></div>
                    <div 
                      className="history-item-info"
                      onClick={() => handleInspectLinkSubmit(item.inspectLink)}
                    >
                      <div className="history-item-name">{item.full_item_name}</div>
                      <div className="history-item-float">Float: {item.floatvalue.toFixed(8)}</div>
                      <div className="history-item-time">{new Date(item.timestamp).toLocaleString()}</div>
                    </div>
                    <button 
                      className="history-item-delete" 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromHistory(item.id);
                      }}
                      aria-label="Remove from history"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
      {itemData && (
        
        <div className={`item-info-panel ${showInfoPanel ? 'active' : ''}`}>
          <div className="item-info-header">
            <div className="info-header-content">
              <div className="item-full-name">{itemData?.full_item_name}</div>
              <div className="item-type">{itemData?.quality_name} • {itemData?.rarity_name}</div>
            </div>
            <button className="close-info-btn" onClick={toggleInfoPanel} aria-label="Close panel">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            
            <div className="quality-bar">
              <div className="quality-fill" style={{width: `100%`}}></div>
              {/* <div className="quality-fill" style={{width: `${Math.min((itemData?.floatvalue || 0) * 100, 100)}%`}}></div> */}
              <div className="quality-marker" style={{left: `${Math.min((itemData?.floatvalue || 0) * 100, 100)}%`}}></div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Float Value</span>
              <span className="detail-value">{itemData?.floatvalue.toFixed(8)}</span>
            </div>
          </div>
          
          <div className="item-details">
            <p>
              <span>Wear Rating:</span> <span><span className="badge badge-primary">{itemData?.wear_name}</span></span>
            </p>
            <p>
              <span>Pattern Index:</span> <span>{itemData?.paintseed}</span>
            </p>
            <p>
              <span>Quality:</span> <span>{itemData?.quality_name}</span>
            </p>
            <p>
              <span>Rarity:</span> <span>{itemData?.rarity_name}</span>
            </p>
            <p>
              <span>Pattern ID:</span> <span>{itemData?.paintseed}</span>
            </p>
            {itemData?.customname && (
              <p>
                <span>Name Tag:</span> <span>"{itemData.customname}"</span>
              </p>
            )}
          </div>
          
          {itemData?.stickers && itemData.stickers.length > 0 && (
            <div className="stickers-container">
              <h3>Applied Stickers</h3>
              <div className="stickers-grid">
                {itemData.stickers.map((sticker) => (
                  <div key={`sticker-${sticker.slot}`} className="sticker-item">
                    <img 
                      src={sticker.imageurl || 'https://placehold.co/400'} 
                      alt={sticker.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/400';
                      }}
                    />
                    <span>{sticker.name}</span>
                    {sticker.wear !== undefined && (
                      <span className="sticker-wear">
                        <div className="wear-indicator">
                          <div className="wear-bar" style={{width: `${sticker.wear * 100}%`}}></div>
                        </div>
                        {(sticker.wear * 100).toFixed(1)}% worn
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {itemData?.keychains && itemData.keychains.length > 0 && (
            <div className="keychains-container">
              <h3>Applied Keychain</h3>
              {itemData.keychains.map((keychain) => (
                <div key={`keychain-${keychain.slot}`} className="keychain-item">
                  <div className="keychain-name">{keychain.name}</div>
                  {keychain.pattern && <div className="keychain-pattern">Pattern: {keychain.pattern}</div>}
                </div>
              ))}
            </div>
          )}
          
          {/* Removed redundant background selector */}
        </div>
      )}
    </div>
  );
};

export default InspectTool;
