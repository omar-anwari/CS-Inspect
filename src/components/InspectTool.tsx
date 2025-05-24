import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import ModelViewer from './ModelViewer';
import InspectLinkInput from './InspectLinkInput';
import './InspectTool.css';
import html2canvas from 'html2canvas';

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
  const modelViewerRef = useRef<any>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const [itemData, setItemData] = useState<ItemInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>('transparent');
  const [currentInspectLink, setCurrentInspectLink] = useState<string | undefined>(inspectLink);
  const [inspectHistory, setInspectHistory] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState<boolean>(true);
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(false);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState<boolean>(false);
  const [showBackgroundSelector, setShowBackgroundSelector] = useState(false);
  const [pendingBackground, setPendingBackground] = useState<string | null>(null);

  // Default background options (should match App.tsx)
  const BACKGROUND_OPTIONS = [
    { label: 'None', value: 'transparent', preview: '/backgrounds/none.jpg' },
    { label: 'Main', value: 'url(/backgrounds/bg1_1.png)', preview: '/backgrounds/bg1_1.png' },
    { label: 'Siege', value: 'url(/backgrounds/bg1_2.png)', preview: '/backgrounds/bg1_2.png' },
    { label: 'Orange', value: 'url(/backgrounds/bg1_3.png)', preview: '/backgrounds/bg1_3.png' },
    { label: 'Purple', value: 'url(/backgrounds/bg1_4.png)', preview: '/backgrounds/bg1_4.png' },
    { label: 'Blue', value: 'url(/backgrounds/bg1_5.png)', preview: '/backgrounds/bg1_5.png' },
  ];

  // Handle inspect link submission from the new top input component
  const handleInspectLinkSubmit = (link: string) => {
    if (link && !inspectHistory.includes(link)) {
      setInspectHistory(prev => [...prev.filter(item => item !== link), link].slice(-10));
    }
    setCurrentInspectLink(link);
    if (onInspectSubmit) {
      onInspectSubmit(link);
    }
  };

  // Handle selecting an item from history
  const handleHistorySelect = (link: string) => {
    setCurrentInspectLink(link);
    if (onInspectSubmit) {
      onInspectSubmit(link);
    }
  };

  // Reset view to default camera position
  const handleResetView = () => {
    if (modelViewerRef.current) {
      modelViewerRef.current.resetView();
    }
  };

  // Toggle auto-rotation
  const toggleAutoRotate = () => {
    setIsAutoRotate(!isAutoRotate);
  };

  // Take screenshot
  const takeScreenshot = async () => {
    if (!screenshotRef.current) return;

    setIsTakingScreenshot(true);

    // Hide UI elements temporarily
    document.body.classList.add('hide-ui');

    try {
      const canvas = await html2canvas(screenshotRef.current, {
        backgroundColor: null,
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `${itemData ? itemData.full_item_name.replace(/\s+/g, '_').toLowerCase() : 'weapon'}-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Screenshot error:', err);
    } finally {
      // Restore UI elements
      setTimeout(() => {
        document.body.classList.remove('hide-ui');
        setIsTakingScreenshot(false);
      }, 100);
    }
  };

  useEffect(() => {
    if (inspectLink !== currentInspectLink) {
      setCurrentInspectLink(inspectLink);
    }
  }, [inspectLink]);

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

  // Handle error display
  if (error) {
    return (
      <div className="inspect-tool-error">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22ZM12 20C16.418 20 20 16.418 20 12C20 7.582 16.418 4 12 4C7.582 4 4 7.582 4 12C4 16.418 7.582 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z" fill="currentColor" />
        </svg>
        <h3>Error fetching item data</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Show loading indicator
  if (isLoading) {
    return (
      <div className="inspect-tool-loading">
        <svg width="38" height="38" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
          <g fill="none" fillRule="evenodd">
            <g transform="translate(1 1)" strokeWidth="2">
              <circle strokeOpacity=".5" cx="18" cy="18" r="18" />
              <path d="M36 18c0-9.94-8.06-18-18-18">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 18 18"
                  to="360 18 18"
                  dur="1s"
                  repeatCount="indefinite" />
              </path>
            </g>
          </g>
        </svg>
        <p>Loading weapon data...</p>
      </div>
    );
  }

  // Render the 3D model viewer with the item data
  return (
    <div
      className="inspect-tool-container"
      ref={screenshotRef}
    >
      {/* Top inspect link input */}
      <InspectLinkInput
        onSubmit={handleInspectLinkSubmit}
        isLoading={isLoading}
      />

      {/* Main model container */}
      <div className="model-container">
        {isLoading ? (
          <div className="inspect-tool-loading">
            <svg width="38" height="38" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
              <g fill="none" fillRule="evenodd">
                <g transform="translate(1 1)" strokeWidth="2">
                  <circle strokeOpacity=".5" cx="18" cy="18" r="18" />
                  <path d="M36 18c0-9.94-8.06-18-18-18">
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 18 18"
                      to="360 18 18"
                      dur="1s"
                      repeatCount="indefinite" />
                  </path>
                </g>
              </g>
            </svg>
            <p>Loading weapon data...</p>
          </div>
        ) : error ? (
          <div className="inspect-tool-error">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22ZM12 20C16.418 20 20 16.418 20 12C20 7.582 16.418 4 12 4C7.582 4 4 7.582 4 12C4 16.418 7.582 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z" fill="currentColor" />
            </svg>
            <h3>Error fetching item data</h3>
            <p>{error}</p>
          </div>
        ) : !itemData ? (
          <div className="inspect-tool-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 13V17.5C20 20.5577 16 20.5 12 20.5C8 20.5 4 20.5577 4 17.5V13M12 3L12 17M12 3L16 7M12 3L8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p>Enter an inspect link to view a weapon</p>
          </div>
        ) : (
          <>
            <ModelViewer
              ref={modelViewerRef}
              itemData={itemData}
              backgroundColor={backgroundColor}
              showStats={false}
              autoRotate={isAutoRotate}
            />
            <div className="model-controls">
              {/* Reset View Button */}
              <button className="control-button" title="Reset view" onClick={handleResetView}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 7.5L9 4.5M3 7.5L9 10.5M3 7.5V16.5M15 4.5L21 7.5M21 7.5L15 10.5M21 7.5V16.5M9 4.5L15 4.5M9 19.5H15M9 19.5L3 16.5M15 19.5L21 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Auto-Rotate Button */}
              <button
                className={`control-button ${isAutoRotate ? 'active' : ''}`}
                title="Toggle auto-rotate"
                onClick={toggleAutoRotate}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.734 16.06a8.923 8.923 0 0 1-3.915 3.978 8.706 8.706 0 0 1-5.471.941 8.859 8.859 0 0 1-4.887-2.843 9.217 9.217 0 0 1-2.129-5.174 9.194 9.194 0 0 1 1.65-5.375 8.86 8.86 0 0 1 4.642-3.306 8.704 8.704 0 0 1 5.504.095 8.92 8.92 0 0 1 4.23 3.61" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21.026 9.678h-4.722V4.956" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Screenshot Button */}
              <button
                className="control-button"
                title="Take screenshot"
                onClick={takeScreenshot}
                disabled={isTakingScreenshot}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.5 8.5L8 9H8.5V8.5ZM15.5 8.5V9H16L15.5 8.5ZM14 16H10V18H14V16ZM8 14V10H6V14H8ZM10 8H14V6H10V8ZM16 10V14H18V10H16ZM14 8V6.5H12V8H14ZM10 8H12V6.5H10V8ZM15.5 8L15.5 6.5H14V8H15.5ZM8.5 8H10V6.5H8.5V8ZM15.5 8H16V6.5H15.5V8ZM8.5 8V6.5H8L8.5 8ZM10 16V18H8.5C8.22386 18 8 17.7761 8 17.5V16H10ZM14 16H16V17.5C16 17.7761 15.7761 18 15.5 18H14V16ZM10 10V14H12V10H10ZM14 10H12V14H14V10ZM10 10H8V8.5C8 8.22386 8.22386 8 8.5 8V10H10ZM14 10V8H15.5C15.7761 8 16 8.22386 16 8.5V10H14Z" fill="currentColor" />
                  <path d="M2 8.5H6.5M21 8.5H17.5M12 2V6.5M12 21V17.5M4.5 4.5L7.5 7.5M19.5 4.5L16.5 7.5M4.5 19.5L7.5 16.5M19.5 19.5L16.5 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* Background Selector Button */}
              <button
                className="control-button"
                title="Change background"
                onClick={() => setShowBackgroundSelector(true)}
                aria-label="Change 3D view background"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="8" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M3 19L8.5 13.5C9.32843 12.6716 10.6716 12.6716 11.5 13.5L17 19" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>

              {/* Toggle Details Button */}
              <button
                className={`control-button ${showDetails ? 'active' : ''}`}
                title="Toggle details"
                onClick={() => setShowDetails(!showDetails)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 10H16M8 14H16M8 18H12M20 6.5V17.5C20 18.3284 19.3284 19 18.5 19H5.5C4.67157 19 4 18.3284 4 17.5V6.5C4 5.67157 4.67157 5 5.5 5H18.5C19.3284 5 20 5.67157 20 6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* History panel */}
      {inspectHistory.length > 0 && (
        <div className="history-panel">
          <h3>Recent Items</h3>
          <ul className="history-list">
            {inspectHistory.slice().reverse().map((link, index) => (
              <li key={`history-${index}`}>
                <button
                  onClick={() => handleHistorySelect(link)}
                  className={currentInspectLink === link ? 'active' : ''}
                >
                  Weapon #{inspectHistory.length - index}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Info panel positioned on the right - only shown when itemData is available and details are toggled on */}
      {itemData && showDetails && (
        <div className="item-info-panel active">
          <div className="item-info-header">
            <button 
              className="close-info-btn" 
              onClick={() => setShowDetails(false)}
              aria-label="Close item details"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="item-full-name">{itemData.full_item_name}</div>
            <div className="item-float-value">{itemData.floatvalue.toFixed(8)}</div>

            <div className="wear-section">
              <div className="wear-label">Wear Rating:</div>
              <div className="wear-value">{itemData.wear_name}</div>
            </div>

            {/* Wear/float bar with indicator */}
            <div className="quality-bar" style={{ position: 'relative' }}>
              <div className="quality-fill" style={{ width: `${Math.min(itemData.floatvalue * 100, 100)}%` }}></div>
              {/* Indicator marker */}
              <div
                className="quality-marker"
                style={{
                  left: `calc(${Math.min(itemData.floatvalue * 100, 100)}%)`,
                  position: 'absolute',
                  top: 0,
                  height: '100%',
                  width: '3px',
                  background: 'white',
                  borderRadius: '2px',
                  transform: 'translateX(-50%)',
                  boxShadow: '0 0 4px 1px rgba(0,0,0,0.25)'
                }}
              />
            </div>
          </div>

      {/* Background Selector Modal rendered in a React Portal for true viewport overlay */}
      {showBackgroundSelector && ReactDOM.createPortal(
        <div className="background-selector-modal" style={{zIndex: 2000}}>
          <div className="modal-content" style={{maxWidth: 400, width: '95vw', padding: 0}}>
            <div className="modal-header" style={{padding: '1rem'}}>
              <h3 style={{margin: 0, fontSize: '1.1rem'}}>Choose 3D View Background</h3>
              <button className="close-btn" onClick={() => setShowBackgroundSelector(false)} aria-label="Close background selector">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="background-grid" style={{padding: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 16}}>
              {BACKGROUND_OPTIONS.map((bg, idx) => (
                <div
                  key={idx}
                  className={`background-item ${bg.value === backgroundColor ? 'selected' : ''}`}
                  tabIndex={0}
                  style={{width: '100%', maxWidth: 140, margin: '0 auto', outline: 'none'}}
                  onClick={() => setBackgroundColor(bg.value)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setBackgroundColor(bg.value); }}
                  aria-label={`Set background: ${bg.label}`}
                >
                  <div
                    className="background-preview"
                    style={{
                      backgroundColor: bg.value === 'transparent' || bg.value === '' ? 'transparent' : undefined,
                      backgroundImage: bg.value && bg.value !== 'transparent' ? bg.value : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      width: '100%',
                      height: 70,
                      borderRadius: 8,
                      border: bg.value === backgroundColor ? '2px solid #fff' : '1px solid #444',
                      marginBottom: 8,
                      boxSizing: 'border-box',
                      transition: 'border 0.2s'
                    }}
                  />
                  <span className="background-label" style={{fontSize: 14}}>{bg.label}</span>
                </div>
              ))}
            </div>
            <div style={{padding: '0 1rem 1rem', display: 'flex', justifyContent: 'flex-end'}}>
              <button className="reset-btn" style={{marginRight: 8}} onClick={() => setBackgroundColor('transparent')}>Reset</button>
              <button className="close-btn" onClick={() => setShowBackgroundSelector(false)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

          <div className="item-details clean-list">
            <div className="detail-row">
              <span className="detail-label">Pattern Index:</span>
              <span className="detail-value">{itemData.paintseed}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Quality:</span>
              <span className="detail-value">{itemData.quality_name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Rarity:</span>
              <span className="detail-value">{itemData.rarity_name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Pattern ID:</span>
              <span className="detail-value">{itemData.paintseed}</span>
            </div>
            {itemData.customname && (
              <div className="detail-row">
                <span className="detail-label">Name Tag:</span>
                <span className="detail-value">"{itemData.customname}"</span>
              </div>
            )}
          </div>

          {itemData.stickers && itemData.stickers.length > 0 && (
            <div className="stickers-container">
              <h3>Applied Stickers</h3>
              <div className="stickers-grid">
                {itemData.stickers.map((sticker) => (
                  <div key={`sticker-${sticker.slot}`} className="sticker-item">
                    <img src={sticker.imageurl} alt={sticker.name} />
                    <span>{sticker.name}</span>
                    {sticker.wear !== undefined && (
                      <span className="sticker-wear">
                        <div className="wear-indicator">
                          <div className="wear-bar" style={{ width: `${sticker.wear * 100}%` }}></div>
                        </div>
                        {(sticker.wear * 100).toFixed(1)}% worn
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InspectTool;
