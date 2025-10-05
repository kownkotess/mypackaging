import React, { useState } from 'react';
import './PartialDeliveryModal.css';

const PartialDeliveryModal = ({ isOpen, onClose, purchase, onConfirm }) => {
  const [receivedQuantities, setReceivedQuantities] = useState(
    purchase?.items?.reduce((acc, item, index) => {
      acc[index] = item.receivedQty || 0;
      return acc;
    }, {}) || {}
  );

  const handleQuantityChange = (index, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    const maxValue = purchase.items[index].qty;
    
    setReceivedQuantities(prev => ({
      ...prev,
      [index]: Math.min(numValue, maxValue)
    }));
  };

  const handleInputClick = (e) => {
    e.stopPropagation();
  };

  const handleConfirm = () => {
    // Update the purchase items with received quantities
    const updatedItems = purchase.items.map((item, index) => ({
      ...item,
      receivedQty: receivedQuantities[index] || 0
    }));

    onConfirm({
      ...purchase,
      items: updatedItems
    });
  };

  const getTotalReceived = () => {
    return Object.values(receivedQuantities).reduce((sum, qty) => sum + (qty || 0), 0);
  };

  const getTotalOrdered = () => {
    return purchase?.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
  };

  if (!isOpen || !purchase) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="partial-delivery-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📦❗ Mark as Received Partial</h3>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="delivery-summary">
            <p><strong>Purchase Order:</strong> {purchase.supplier} - {new Date(purchase.createdAt?.toDate()).toLocaleDateString()}</p>
            <p><strong>Total Ordered:</strong> {getTotalOrdered()} items</p>
            <p><strong>Total Received:</strong> {getTotalReceived()} items</p>
          </div>

          <div className="items-list">
            <h4>Enter Received Quantities:</h4>
            {purchase.items?.map((item, index) => (
              <div key={index} className="item-row" onClick={handleInputClick}>
                <div className="item-info">
                  <span className="product-name">{item.productName}</span>
                  <span className="ordered-qty">Ordered: {item.qty}</span>
                </div>
                <div className="quantity-input">
                  <label>Received:</label>
                  <input
                    type="number"
                    min="0"
                    max={item.qty}
                    value={receivedQuantities[index] || 0}
                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                    onClick={handleInputClick}
                    className="received-qty-input"
                  />
                  <span className="max-qty">/ {item.qty}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="delivery-notes">
            <p className="info-text">
              💡 <strong>Note:</strong> Only the received quantities will be added to your inventory. 
              You can update this purchase later when the remaining items arrive.
            </p>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="confirm-button" 
            onClick={handleConfirm}
            disabled={getTotalReceived() === 0}
          >
            Confirm Partial Delivery
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartialDeliveryModal;