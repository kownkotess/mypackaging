import React, { useState } from 'react';
import './PurchaseDetailModal.css';
import PartialDeliveryModal from './PartialDeliveryModal';

const PurchaseDetailModal = ({ purchase, onClose, onStatusChange }) => {
  const [showPartialModal, setShowPartialModal] = useState(false);
  
  if (!purchase) return null;

  const statusOptions = [
    '📦 Ordered',
    '🚚 In Transit', 
    '✅ Received',
    '📦❗ Received Partial',
    '❌ Cancelled'
  ];

  const handleStatusChange = (newStatus) => {
    if (newStatus === '📦❗ Received Partial') {
      setShowPartialModal(true);
    } else if (onStatusChange) {
      onStatusChange(purchase.id, newStatus);
    }
  };

  const handlePartialDeliveryConfirm = (updatedPurchase) => {
    if (onStatusChange) {
      onStatusChange(purchase.id, '📦❗ Received Partial', updatedPurchase.items);
    }
    setShowPartialModal(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content purchase-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Purchase Order Details</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="purchase-summary">
            <div className="info-row">
              <span className="label">Supplier:</span>
              <span className="value">{purchase.supplierName}</span>
            </div>
            {purchase.invoiceNumber && (
              <div className="info-row">
                <span className="label">Invoice Number:</span>
                <span className="value">{purchase.invoiceNumber}</span>
              </div>
            )}
            <div className="info-row">
              <span className="label">Date Created:</span>
              <span className="value">{purchase.createdAt?.toDate().toLocaleDateString()}</span>
            </div>
            <div className="info-row">
              <span className="label">Current Status:</span>
              <select 
                value={purchase.status} 
                onChange={(e) => handleStatusChange(e.target.value)}
                className="status-select"
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            {purchase.notes && (
              <div className="info-row">
                <span className="label">Notes:</span>
                <span className="value">{purchase.notes}</span>
              </div>
            )}
            {purchase.transportationCost > 0 && (
              <div className="info-row">
                <span className="label">Transportation:</span>
                <span className="value">RM {purchase.transportationCost.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="items-section">
            <h3>Items Ordered</h3>
            <div className="items-list">
              {purchase.items?.map((item, index) => (
                <div key={index} className="item-row">
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    <div className="item-quantities">
                      <span className="item-qty">Ordered: {item.qty}</span>
                      {purchase.status === '📦❗ Received Partial' && (
                        <span className="item-received">Received: {item.receivedQty || 0}</span>
                      )}
                    </div>
                  </div>
                  <div className="item-pricing">
                    <span className="item-cost">Cost: RM {item.cost.toFixed(2)}</span>
                    {item.discountValue > 0 && (
                      <span className="item-discount">
                        -{item.discountValue}{item.discountType === 'percent' ? '%' : ' RM'}
                      </span>
                    )}
                    <span className="item-subtotal">RM {item.subtotal.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="totals-section">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>RM {purchase.subtotal?.toFixed(2) || '0.00'}</span>
            </div>
            {purchase.transportationCost > 0 && (
              <div className="total-row">
                <span>Transportation:</span>
                <span>RM {purchase.transportationCost.toFixed(2)}</span>
              </div>
            )}
            <div className="total-row final-total">
              <span>Total:</span>
              <span>RM {purchase.total?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          {purchase.status === '✅ Received' && (
            <div className="status-info received-info">
              <p>✅ This order has been received and stock quantities have been updated.</p>
            </div>
          )}
          
          {purchase.status === '�❗ Received Partial' && (
            <div className="status-info partial-info">
              <p>📦❗ This order has been partially received. Only the received quantities have been added to stock.</p>
              <p>💡 You can update the status again when the remaining items arrive.</p>
            </div>
          )}
          
          {purchase.status === '�🚚 In Transit' && (
            <div className="status-info transit-info">
              <p>🚚 This order is currently in transit. Change status to "Received" when items arrive.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      
      <PartialDeliveryModal
        isOpen={showPartialModal}
        purchase={purchase}
        onClose={() => setShowPartialModal(false)}
        onConfirm={handlePartialDeliveryConfirm}
      />
    </div>
  );
};

export default PurchaseDetailModal;