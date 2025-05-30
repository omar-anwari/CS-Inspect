// This is the bar at the top and the controls at the bottom of the page

import React, { useState } from 'react';
import './ControlsBar.css';


// Toggling the info panel, screenshotting, and submitting the inspect links
interface ControlsBarProps {
  onSubmitInspectLink: (link: string) => void;
  onScreenshotClick?: () => void;
  onToggleInfoPanelClick?: () => void;
}


// The actual component. Handles the inspect link input, and submit..
const ControlsBar: React.FC<ControlsBarProps> = ({
  onSubmitInspectLink,
  onScreenshotClick,
  onToggleInfoPanelClick
}) => {
  // State for the inspect link input
  const [inspectLink, setInspectLink] = useState('');

  // Called when you try to submit the inspect link. If it works, great. If not, well, you tried.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inspectLink.trim()) {
      onSubmitInspectLink(inspectLink);
    }
  };

  return (
    <div className="controls-bar">
      <div className="controls-bar-content">
        <div className="logo">CS Inspect</div>
        
        {/* Inspect Link Form: Paste your inspect link and hope that CORs doesn't break it */}
        <form onSubmit={handleSubmit} className="inspect-form">
          <div className="inspect-input-wrapper">
            <svg className="inspect-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.5 14.5L19.5 18.5M10.5 17C14.0899 17 17 14.0899 17 10.5C17 6.91015 14.0899 4 10.5 4C6.91015 4 4 6.91015 4 10.5C4 14.0899 6.91015 17 10.5 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              type="text"
              value={inspectLink}
              onChange={(e) => setInspectLink(e.target.value)}
              placeholder="Paste inspect link here..."
              className="inspect-input"
            />
          </div>
          <button type="submit" className="inspect-button">
            Inspect Item
          </button>
        </form>

        {/* Screenshot and Info Panel toggles */}
        <div className="controls-actions">
          {onToggleInfoPanelClick && (
            <button 
              className="action-button"
              onClick={onToggleInfoPanelClick}
              title="Toggle Info Panel"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 16H12V12H11M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          
          {onScreenshotClick && (
            <button 
              className="action-button" 
              onClick={onScreenshotClick}
              title="Take Screenshot"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 8H15.01M3 6C3 4.89543 3.89543 4 5 4H7L9 7H15L17 4H19C20.1046 4 21 4.89543 21 6V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V6ZM12 17C14.2091 17 16 15.2091 16 13C16 10.7909 14.2091 9 12 9C9.79086 9 8 10.7909 8 13C8 15.2091 9.79086 17 12 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ControlsBar;
