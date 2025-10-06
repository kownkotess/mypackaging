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
                    <div className="label-header">
                      <h3 className="product-name">{product.name}</h3>
                      <div className="product-price">RM{Number(product.unitPrice || 0).toFixed(2)}</div>
                    </div>
                    
                    <div className="label-body">
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
                            <div className="no-qr-text">No QR Code</div>
                          </div>
                        )}
                      </div>
                      
                      <div className="product-info">
                        <div className="info-row">
                          <span className="label-text">ID:</span>
                          <span className="label-value">{product.id}</span>
                        </div>
                        <div className="info-row">
                          <span className="label-text">Stock:</span>
                          <span className="label-value">{Number(product.stockBalance || 0)} units</span>
                        </div>
                        {product.boxPrice && (
                          <div className="info-row">
                            <span className="label-text">Box:</span>
                            <span className="label-value">RM{Number(product.boxPrice).toFixed(2)}</span>
                          </div>
                        )}
                        {product.packPrice && (
                          <div className="info-row">
                            <span className="label-text">Pack:</span>
                            <span className="label-value">RM{Number(product.packPrice).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="label-footer">
                      <div className="scan-instruction">Scan QR Code for Quick Add</div>
                    </div>
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