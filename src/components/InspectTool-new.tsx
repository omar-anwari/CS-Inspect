import React, { useState, useEffect } from 'react';
import ModelViewer from './ModelViewer';
// import { ModelPreloader } from '../utils/modelPathResolver';
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
}

/**
 * Main component for the CS:GO skin inspect tool
 */
const InspectTool: React.FC<InspectToolProps> = ({ 
  inspectLink,
  onError
}) => {
  const [itemData, setItemData] = useState<ItemInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>('transparent');
  const [isRotating, setIsRotating] = useState<boolean>(true);

  // Fetch item data when inspectLink changes
  useEffect(() => {
    if (!inspectLink) {
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
          `https://cstool.omaranwari.com/?url=${encodeURIComponent(inspectLink)}`
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
  }, [inspectLink, onError]);

  // Handle error display
  if (error) {
    return (
      <div className="inspect-tool-error stripe-card">
        <h3>Error fetching item data</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Show loading indicator
  if (isLoading) {
    return (
      <div className="inspect-tool-loading">
        <div className="stripe-loader"></div>
        <p>Loading weapon data...</p>
      </div>
    );
  }

  // If no data yet, show empty state
  if (!itemData) {
    return (
      <div className="inspect-tool-empty">
        <p>Enter an inspect link above to view a weapon</p>
      </div>
    );
  }

  // Calculate wear percentage for visual display
  const wearPercentage = itemData.floatvalue * 100;

  // Render the 3D model viewer with the item data
  return (
    <div className="inspect-tool-container">
      <div className="model-container">
        <ModelViewer 
          itemData={itemData}
          backgroundColor={backgroundColor}
          showStats={false}
          autoRotate={isRotating}
        />
        <div className="model-controls">
          <button 
            className="stripe-button-secondary" 
            onClick={() => setIsRotating(!isRotating)}
          >
            {isRotating ? "Stop Rotation" : "Start Rotation"}
          </button>
          <button 
            className="stripe-button-secondary"
            onClick={() => {
              const el = document.querySelector(".model-container");
              if (el) {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  el.requestFullscreen();
                }
              }
            }}
          >
            Fullscreen
          </button>
        </div>
      </div>
      
      <div className="item-info-panel">
        <div className="panel-section">
          <h2 className="weapon-name">{itemData.full_item_name}</h2>
          
          <div className="wear-container">
            <div className="property-item">
              <span className="property-label">Wear:</span>
              <span className="property-value">{itemData.wear_name}</span>
            </div>
            <div className="wear-indicator">
              <div 
                className="wear-value" 
                style={{ width: `${Math.min(wearPercentage, 100)}%` }}
              ></div>
              <div 
                className="wear-marker" 
                style={{ left: `${Math.min(wearPercentage, 100)}%` }}
              ></div>
            </div>
            <div className="property-item">
              <span className="property-label">Float Value:</span>
              <span className="property-value">{itemData.floatvalue.toFixed(8)}</span>
            </div>
          </div>
        </div>
        
        <div className="panel-section">
          <h3 className="stripe-subheading">Properties</h3>
          <div className="property-list">
            <div className="property-item">
              <span className="property-label">Rarity:</span>
              <span className="property-value">{itemData.rarity_name}</span>
            </div>
            <div className="property-item">
              <span className="property-label">Quality:</span>
              <span className="property-value">{itemData.quality_name}</span>
            </div>
            <div className="property-item">
              <span className="property-label">Pattern ID:</span>
              <span className="property-value">{itemData.paintseed}</span>
            </div>
            {itemData.customname && (
              <div className="property-item">
                <span className="property-label">Name Tag:</span>
                <span className="property-value">"{itemData.customname}"</span>
              </div>
            )}
          </div>
        </div>
        
        {itemData.stickers && itemData.stickers.length > 0 && (
          <div className="panel-section">
            <h3 className="stripe-subheading">Applied Stickers</h3>
            <div className="sticker-grid">
              {itemData.stickers.map((sticker) => (
                <div key={`sticker-${sticker.slot}`} className="sticker-item">
                  <img 
                    src={sticker.imageurl || 'https://placehold.co/400'} 
                    alt={sticker.name} 
                    className="sticker-image"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/400';
                    }}
                  />
                  <span className="sticker-name">{sticker.name}</span>
                  {sticker.wear !== undefined && (
                    <span className="sticker-wear">
                      Wear: {(sticker.wear * 100).toFixed(2)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {itemData.keychains && itemData.keychains.length > 0 && (
          <div className="panel-section">
            <h3 className="stripe-subheading">Keychain</h3>
            {itemData.keychains.map((keychain) => (
              <div key={`keychain-${keychain.slot}`} className="keychain-item">
                <span>{keychain.name}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="panel-section">
          <h3 className="stripe-subheading">Background</h3>
          <div className="background-selector-grid">
            <button 
              onClick={() => setBackgroundColor('transparent')}
              className={`stripe-button-secondary ${backgroundColor === 'transparent' ? 'active' : ''}`}
            >
              None
            </button>
            <button 
              onClick={() => setBackgroundColor('#0a0e17')}
              className={`stripe-button-secondary ${backgroundColor === '#0a0e17' ? 'active' : ''}`}
            >
              Dark
            </button>
            <button 
              onClick={() => setBackgroundColor('#f0f0f0')}
              className={`stripe-button-secondary ${backgroundColor === '#f0f0f0' ? 'active' : ''}`}
            >
              Light
            </button>
            <button 
              onClick={() => setBackgroundColor('url(/backgrounds/bg1_1.png)')}
              className={`stripe-button-secondary ${backgroundColor.includes('bg1_1.png') ? 'active' : ''}`}
            >
              CS:GO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InspectTool;
