import React, { useState, useEffect } from 'react';
import ModelViewer from './ModelViewer';
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

  // Fetch item data when inspectLink changes
  // Handle inspect link submission from the new top input component
  const handleInspectLinkSubmit = (link: string) => {
    setCurrentInspectLink(link);
    if (onInspectSubmit) {
      onInspectSubmit(link);
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

  // Handle error display
  if (error) {
    return (
      <div className="inspect-tool-error">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22ZM12 20C16.418 20 20 16.418 20 12C20 7.582 16.418 4 12 4C7.582 4 4 7.582 4 12C4 16.418 7.582 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z" fill="currentColor"/>
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
    );
  }

  // Render the 3D model viewer with the item data
  return (
    <div className="inspect-tool-container">
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
            <ModelViewer 
              itemData={itemData}
              backgroundColor={backgroundColor}
              showStats={false}
            />
            <div className="model-controls">
              <button className="control-button" title="Reset view">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 7.5L9 4.5M3 7.5L9 10.5M3 7.5V16.5M15 4.5L21 7.5M21 7.5L15 10.5M21 7.5V16.5M9 4.5L15 4.5M9 19.5H15M9 19.5L3 16.5M15 19.5L21 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
      
      {/* Info panel positioned on the right - only shown when itemData is available */}
      {itemData && (
        <div className="item-info-panel">
          <div className="item-info-header">
            <div className="item-full-name">{itemData.full_item_name}</div>
            <div className="item-type">{itemData.quality_name} • {itemData.rarity_name}</div>
            
            <div className="quality-bar">
              <div className="quality-fill" style={{width: `${Math.min(itemData.floatvalue * 100, 100)}%`}}></div>
              <div className="quality-marker" style={{left: `${Math.min(itemData.floatvalue * 100, 100)}%`}}></div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Float Value</span>
              <span className="detail-value">{itemData.floatvalue.toFixed(8)}</span>
            </div>
          </div>
        
        <div className="item-details">
          <p>
            <span>Wear Rating:</span> <span><span className="badge badge-primary">{itemData.wear_name}</span></span>
          </p>
          <p>
            <span>Pattern Index:</span> <span>{itemData.paintseed}</span>
          </p>
          <p>
            <span>Quality:</span> <span>{itemData.quality_name}</span>
          </p>
          <p>
            <span>Rarity:</span> {itemData.rarity_name}
          </p>
          <p>
            <span>Pattern ID:</span> {itemData.paintseed}
          </p>
          {itemData.customname && (
            <p>
              <span>Name Tag:</span> "{itemData.customname}"
            </p>
          )}
        </div>
        
        {itemData.stickers && itemData.stickers.length > 0 && (
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
        
        {itemData.keychains && itemData.keychains.length > 0 && (
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
        
        <div className="background-selector">
          <h3>3D View Background</h3>
          <div className="background-options">
            <button 
              onClick={() => setBackgroundColor('transparent')}
              className={backgroundColor === 'transparent' ? 'active' : ''}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 19.5L4.5 4.5M19.5 4.5L4.5 19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              None
            </button>
            <button 
              onClick={() => setBackgroundColor('var(--color-background-secondary)')}
              className={backgroundColor === 'var(--color-background-secondary)' ? 'active' : ''}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="currentColor"/>
              </svg>
              Dark
            </button>
            <button 
              onClick={() => setBackgroundColor('#f0f0f0')}
              className={backgroundColor === '#f0f0f0' ? 'active' : ''}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#f0f0f0" stroke="currentColor"/>
              </svg>
              Light
            </button>
            <button 
              onClick={() => setBackgroundColor('url(/backgrounds/bg1_1.png)')}
              className={backgroundColor.includes('bg1_1.png') ? 'active' : ''}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.33789 7L6.50023 10.1623L9.66257 7H3.33789Z" fill="currentColor"/>
                <path d="M3 16.6621L6.16234 13.4998L3 10.3374V16.6621Z" fill="currentColor"/>
                <path d="M10.3374 3L7.17508 6.16234L10.3374 9.32468V3Z" fill="currentColor"/>
                <path d="M17.6621 3H11.3374L14.4997 6.16234L17.6621 3Z" fill="currentColor"/>
                <path d="M21 10.3374L17.8377 7.17508L14.6753 10.3374H21Z" fill="currentColor"/>
                <path d="M21 11.3376H14.6753L17.8377 14.4999L21 11.3376Z" fill="currentColor"/>
                <path d="M13.6626 21L16.8249 17.8377L13.6626 14.6753V21Z" fill="currentColor"/>
                <path d="M6.33789 21H12.6626L9.50023 17.8377L6.33789 21Z" fill="currentColor"/>
                <path d="M3 13.6626L6.16234 16.8249L9.32468 13.6626H3Z" fill="currentColor"/>
                <path d="M10.3374 14.6753L7.17508 17.8377L10.3374 21V14.6753Z" fill="currentColor"/>
                <path d="M11.3376 3V9.32468L14.4999 6.16234L11.3376 3Z" fill="currentColor"/>
                <path d="M14.6753 11.3376L17.8377 14.4999L21 11.3376H14.6753Z" fill="currentColor"/>
              </svg>
              Game
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default InspectTool;
