import React, { useState, useEffect } from 'react';
import { addProduct, updateProduct } from '../lib/firestore';
import './ProductForm.css';

const ProductForm = ({ product, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    unitPrice: '',
    boxPrice: '',
    packPrice: '',
    bigBulkQty: '',
    smallBulkQty: '',
    startingStock: '',
    reorderPoint: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        unitPrice: product.unitPrice || '',
        boxPrice: product.boxPrice || '',
        packPrice: product.packPrice || '',
        bigBulkQty: product.bigBulkQty || '',
        smallBulkQty: product.smallBulkQty || '',
        startingStock: product.stockBalance || '',
        reorderPoint: product.reorderPoint || ''
      });
    }
  }, [product]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!formData.name.trim()) {
        throw new Error('Product name is required');
      }
      if (!formData.unitPrice || Number(formData.unitPrice) <= 0) {
        throw new Error('Valid unit price is required');
      }

      const productData = {
        name: formData.name.trim(),
        unitPrice: Number(formData.unitPrice),
        boxPrice: Number(formData.boxPrice) || null,
        packPrice: Number(formData.packPrice) || null,
        bigBulkQty: Number(formData.bigBulkQty) || 1,
        smallBulkQty: Number(formData.smallBulkQty) || 1,
        reorderPoint: Number(formData.reorderPoint) || 0
      };

      if (product) {
        // Editing existing product
        await updateProduct(product.id, productData);
      } else {
        // Adding new product
        productData.startingStock = Number(formData.startingStock) || 0;
        await addProduct(productData);
      }

      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
      setError(error.message || 'Failed to save product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="product-form-modal">
        <div className="modal-header">
          <h2>{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <form onSubmit={handleSubmit} className="product-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Product Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter product name"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="unitPrice">Unit Price * (RM)</label>
              <input
                type="number"
                id="unitPrice"
                name="unitPrice"
                value={formData.unitPrice}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
              />
              <small>Price per individual unit</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="boxPrice">Box Price (RM)</label>
              <input
                type="number"
                id="boxPrice"
                name="boxPrice"
                value={formData.boxPrice}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="Optional - Leave empty to use unit price"
              />
              <small>Special price for selling by box (optional)</small>
            </div>
            <div className="form-group">
              <label htmlFor="packPrice">Pack Price (RM)</label>
              <input
                type="number"
                id="packPrice"
                name="packPrice"
                value={formData.packPrice}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="Optional - Leave empty to use unit price"
              />
              <small>Special price for selling by pack (optional)</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="bigBulkQty">Box Quantity (units per box)</label>
              <input
                type="number"
                id="bigBulkQty"
                name="bigBulkQty"
                value={formData.bigBulkQty}
                onChange={handleChange}
                min="1"
                placeholder="1"
              />
              <small>How many units are in one box</small>
            </div>
            <div className="form-group">
              <label htmlFor="smallBulkQty">Pack Quantity (units per pack)</label>
              <input
                type="number"
                id="smallBulkQty"
                name="smallBulkQty"
                value={formData.smallBulkQty}
                onChange={handleChange}
                min="1"
                placeholder="1"
              />
              <small>How many units are in one pack</small>
            </div>
          </div>

          {!product && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startingStock">Starting Stock (units)</label>
                <input
                  type="number"
                  id="startingStock"
                  name="startingStock"
                  value={formData.startingStock}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                />
                <small>Initial stock quantity</small>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reorderPoint">Reorder Point (units)</label>
              <input
                type="number"
                id="reorderPoint"
                name="reorderPoint"
                value={formData.reorderPoint}
                onChange={handleChange}
                min="0"
                placeholder="0"
              />
              <small>Alert when stock reaches this level</small>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn primary">
              {loading ? 'Saving...' : (product ? 'Update Product' : 'Add Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
