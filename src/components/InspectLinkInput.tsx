import React, { useState } from 'react';
import './InspectLinkInput.css';

interface InspectLinkInputProps {
  onSubmit: (link: string) => void;
  isLoading?: boolean;
}

const InspectLinkInput: React.FC<InspectLinkInputProps> = ({ 
  onSubmit,
  isLoading = false 
}) => {
  const [inspectLink, setInspectLink] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inspectLink.trim()) {
      onSubmit(inspectLink);
    }
  };

  return (
    <div className="inspect-link-input">
      <div className="inspect-link-container">
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
              disabled={isLoading}
              aria-label="CS:GO Inspect Link"
            />
          </div>
          <button 
            type="submit" 
            className="inspect-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="loading-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.07 4.93L16.24 7.76M19.07 19.07L16.24 16.24M4.93 19.07L7.76 16.24M4.93 4.93L7.76 7.76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="button-text">Inspect Item</span>
              </>
            ) : (
              <>
                <svg className="inspect-icon-button" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15.5 14.5L19.5 18.5M10.5 17C14.0899 17 17 14.0899 17 10.5C17 6.91015 14.0899 4 10.5 4C6.91015 4 4 6.91015 4 10.5C4 14.0899 6.91015 17 10.5 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="button-text">Inspect Item</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InspectLinkInput;
