import React from 'react';
import './ReportExpandModal.css';

const ReportExpandModal = ({ isOpen, onClose, title, children, icon }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="report-expand-overlay" onClick={handleBackdropClick}>
      <div className="report-expand-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {icon && <span className="modal-icon">{icon}</span>}
            {title}
          </h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="modal-body">
          {children}
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportExpandModal;