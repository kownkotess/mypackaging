import React from 'react';
import './PrintModal.css';

const PrintModal = ({ isOpen, onClose, products, selectedProductIds }) => {
  if (!isOpen) return null;

  const selectedProducts = products.filter(product => selectedProductIds.has(product.id));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print-modal-overlay">
      <div className="print-modal">
        <div className="print-modal-header">
          <h2>🖨️ Print Product Labels</h2>
          <div className="print-modal-controls">
            <button onClick={handlePrint} className="btn primary">
              🖨️ Print ({selectedProducts.length} items)
            </button>
            <button onClick={onClose} className="btn secondary">
              Cancel
            </button>
          </div>
        </div>

        <div className="print-preview">
          <div className="print-preview-info">
            <p>Preview of labels to be printed. Labels are optimized for cashier counter use with high contrast and scannable QR codes.</p>
          </div>

          <div className="print-content" id="print-content">
            <div className="print-labels-grid">
              {selectedProducts.map((product) => (
                <div key={product.id} className="print-label">
                  <div className="label-content">
                    <h3 className="product-name">{product.name}</h3>
                    
                    <div className="qr-section">
                      {product.qrCode ? (
                        <img 
                          src={product.qrCode} 
                          alt={`QR Code for ${product.name}`} 
                          className="print-qr-code"
                        />
                      ) : (
                        <div className="no-qr-placeholder">
                          <div className="no-qr-icon">📱</div>
                          <div className="no-qr-text">No QR</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="product-price">RM{Number(product.unitPrice || 0).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintModal;