import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { subscribeProducts, subscribePurchases, createPurchase, updatePurchase } from '../lib/firestore';
import { useAuth } from '../context/AuthContextWrapper';
import { useAlert } from '../context/AlertContext';
import { RequirePermission } from './RoleComponents';
import PurchaseDetailModal from './PurchaseDetailModal';
import '../styles/Purchases.css';

function Purchases() {
  const { showSuccess, showError } = useAlert();
  const { user } = useAuth();
  
  // State for forms and data
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [purchaseStatus, setPurchaseStatus] = useState('📦 Ordered');
  const [notes, setNotes] = useState('');
  const [transportationCost, setTransportationCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Subscribe to products and purchases
  useEffect(() => {
    const unsubscribeProducts = subscribeProducts((productsData) => {
      setProducts(productsData);
    });

    const unsubscribePurchases = subscribePurchases((purchasesData) => {
      setPurchases(purchasesData);
    });

    return () => {
      unsubscribeProducts();
      unsubscribePurchases();
    };
  }, []);

  // Filter products for selection
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add product to purchase
  const addProductToPurchase = (product) => {
    if (!selectedProducts.find(p => p.id === product.id)) {
      setSelectedProducts([...selectedProducts, {
        id: product.id,
        name: product.name,
        qty: 1,
        cost: product.unitPrice || 0,
        discountType: 'none', // 'none', 'percent', 'amount'
        discountValue: 0,
        currentStock: product.stockBalance || 0
      }]);
    }
  };

  // Remove product from purchase
  const removeProductFromPurchase = (productId) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  // Update product in purchase
  const updateProductInPurchase = (productId, field, value) => {
    setSelectedProducts(selectedProducts.map(product => {
      if (product.id === productId) {
        const updatedProduct = { ...product };
        
        if (field === 'discountType') {
          updatedProduct.discountType = value;
          // Reset discount value when changing type to 'none'
          if (value === 'none') {
            updatedProduct.discountValue = 0;
          }
        } else {
          updatedProduct[field] = Number(value) || 0;
        }
        
        return updatedProduct;
      }
      return product;
    }));
  };

  // Calculate item subtotal with discount
  const calculateItemSubtotal = (product) => {
    const baseSubtotal = product.qty * product.cost;
    
    if (product.discountType === 'percent' && product.discountValue > 0) {
      const discountAmount = (baseSubtotal * product.discountValue) / 100;
      return baseSubtotal - discountAmount;
    } else if (product.discountType === 'amount' && product.discountValue > 0) {
      return Math.max(0, baseSubtotal - product.discountValue);
    }
    
    return baseSubtotal;
  };

  // Calculate subtotal (before transportation)
  const calculateSubtotal = () => {
    return selectedProducts.reduce((sum, product) => {
      return sum + calculateItemSubtotal(product);
    }, 0);
  };

  // Calculate total cost (subtotal + transportation)
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const transportation = Number(transportationCost) || 0;
    return subtotal + transportation;
  };

  // Handle form submission
  const handleSubmitPurchase = async (e) => {
    e.preventDefault();
    setError('');

    if (!supplierName.trim()) {
      setError('Please enter a supplier name.');
      return;
    }

    if (selectedProducts.length === 0) {
      setError('Please add at least one product to the purchase.');
      return;
    }

    // Validate all products have valid quantities and costs
    const invalidProducts = selectedProducts.filter(p => 
      !p.qty || p.qty <= 0 || !p.cost || p.cost <= 0
    );

    if (invalidProducts.length > 0) {
      setError('All products must have valid quantities and costs greater than 0.');
      return;
    }

    setLoading(true);

    try {
      const purchaseData = {
        supplierName: supplierName.trim(),
        status: purchaseStatus,
        notes: notes.trim(),
        transportationCost: Number(transportationCost) || 0,
        items: selectedProducts.map(p => ({
          productId: p.id,
          name: p.name,
          qty: p.qty,
          cost: p.cost,
          discountType: p.discountType,
          discountValue: p.discountValue,
          subtotal: calculateItemSubtotal(p)
        })),
        subtotal: calculateSubtotal(),
        total: calculateTotal(),
        createdBy: user.uid,
        createdAt: new Date()
      };

      await createPurchase(purchaseData);

      // Reset form
      setSupplierName('');
      setPurchaseStatus('📦 Ordered');
      setNotes('');
      setTransportationCost('');
      setSelectedProducts([]);
      setShowForm(false);
      setSearchTerm('');
      
      // Show success message
      showSuccess(`Purchase order created successfully! Supplier: ${supplierName.trim()}, Total: RM${calculateTotal().toFixed(2)}`);

    } catch (error) {
      console.error('Error creating purchase:', error);
      showError(`Failed to create purchase: ${error.message || 'Please try again.'}`);
      setError(`Failed to create purchase: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSupplierName('');
    setPurchaseStatus('📦 Ordered');
    setNotes('');
    setTransportationCost('');
    setSelectedProducts([]);
    setShowForm(false);
    setSearchTerm('');
    setError('');
  };

  // Handle purchase detail view
  const handleViewDetails = (purchase) => {
    setSelectedPurchase(purchase);
    setShowDetailModal(true);
  };

  // Handle status change
  const handleStatusChange = async (purchaseId, newStatus) => {
    try {
      setLoading(true);
      await updatePurchase(purchaseId, { status: newStatus });
      
      if (newStatus === '✅ Received') {
        showSuccess('Purchase status updated to "Received"! Stock quantities have been updated.');
      } else {
        showSuccess(`Purchase status updated to "${newStatus}"`);
      }
      
      // Update the selected purchase for the modal
      setSelectedPurchase(prev => prev ? { ...prev, status: newStatus } : null);
      
    } catch (error) {
      console.error('Error updating purchase status:', error);
      showError(`Failed to update status: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    '📦 Ordered',
    '🚚 In Transit',
    '✅ Received',
    '❌ Cancelled'
  ];

  return (
    <div className="purchases-container">
      {/* Navigation Header */}
      <div className="nav-header">
        <Link to="/" className="nav-back-btn">
          ← Back to Dashboard
        </Link>
        <div className="nav-links">
          <Link to="/products" className="nav-link">Inventory</Link>
          <Link to="/sales" className="nav-link">Sales</Link>
          <Link to="/purchases" className="nav-link active">Purchases</Link>
        </div>
      </div>

      <div className="purchases-header">
        <h1>Purchase Management</h1>
        <RequirePermission module="purchases" action="create">
          <button 
            className="btn-primary"
            onClick={() => setShowForm(!showForm)}
            disabled={loading}
          >
            {showForm ? 'Cancel' : '+ New Purchase'}
          </button>
        </RequirePermission>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <div className="purchase-form-container">
          <h2>Create New Purchase</h2>
          
          <form onSubmit={handleSubmitPurchase} className="purchase-form">
            <div className="form-row">
              <div className="form-group">
                <label>Supplier Name:</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Enter supplier name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Status:</label>
                <select 
                  value={purchaseStatus} 
                  onChange={(e) => setPurchaseStatus(e.target.value)}
                >
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Notes (Optional):</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this purchase..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Transportation Cost (RM) - Optional:</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={transportationCost}
                onChange={(e) => setTransportationCost(e.target.value)}
                placeholder="Enter transportation cost if applicable"
              />
            </div>

            {/* Product Selection */}
            <div className="product-selection-section">
              <h3>Add Products</h3>
              <div className="search-container">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products to add..."
                  className="search-input"
                />
              </div>

              {searchTerm && (
                <div className="product-search-results">
                  {filteredProducts.slice(0, 5).map(product => (
                    <div key={product.id} className="product-search-item">
                      <div className="product-info">
                        <span className="product-name">{product.name}</span>
                        <span className="product-stock">Stock: {product.stockBalance || 0}</span>
                        <span className="product-price">RM {product.unitPrice?.toFixed(2) || '0.00'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => addProductToPurchase(product)}
                        className="btn-add-product"
                        disabled={selectedProducts.find(p => p.id === product.id)}
                      >
                        {selectedProducts.find(p => p.id === product.id) ? 'Added' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Products */}
            {selectedProducts.length > 0 && (
              <div className="selected-products-section">
                <h3>Purchase Items</h3>
                <div className="selected-products-list">
                  {selectedProducts.map(product => (
                    <div key={product.id} className="selected-product-item">
                      <div className="product-details">
                        <span className="product-name">{product.name}</span>
                        <span className="current-stock">Current Stock: {product.currentStock}</span>
                      </div>
                      <div className="product-inputs">
                        <div className="input-group">
                          <label>Qty:</label>
                          <input
                            type="number"
                            min="1"
                            value={product.qty}
                            onChange={(e) => updateProductInPurchase(product.id, 'qty', e.target.value)}
                          />
                        </div>
                        <div className="input-group">
                          <label>Cost (RM):</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={product.cost}
                            onChange={(e) => updateProductInPurchase(product.id, 'cost', e.target.value)}
                          />
                        </div>
                        <div className="input-group">
                          <label>Discount:</label>
                          <select
                            value={product.discountType}
                            onChange={(e) => updateProductInPurchase(product.id, 'discountType', e.target.value)}
                          >
                            <option value="none">No Discount</option>
                            <option value="percent">Percent (%)</option>
                            <option value="amount">Amount (RM)</option>
                          </select>
                        </div>
                        {product.discountType !== 'none' && (
                          <div className="input-group">
                            <label>{product.discountType === 'percent' ? 'Discount %:' : 'Discount RM:'}</label>
                            <input
                              type="number"
                              min="0"
                              step={product.discountType === 'percent' ? '0.01' : '0.01'}
                              max={product.discountType === 'percent' ? '100' : undefined}
                              value={product.discountValue}
                              onChange={(e) => updateProductInPurchase(product.id, 'discountValue', e.target.value)}
                              placeholder={product.discountType === 'percent' ? '0.00' : '0.00'}
                            />
                          </div>
                        )}
                        <div className="subtotal">
                          <div className="base-subtotal">Base: RM {(product.qty * product.cost).toFixed(2)}</div>
                          <div className="final-subtotal">Final: RM {calculateItemSubtotal(product).toFixed(2)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeProductFromPurchase(product.id)}
                          className="btn-remove-product"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="purchase-total">
                  <div className="total-breakdown">
                    <div className="subtotal-line">Subtotal: RM {calculateSubtotal().toFixed(2)}</div>
                    {transportationCost && Number(transportationCost) > 0 && (
                      <div className="transportation-line">Transportation: RM {Number(transportationCost).toFixed(2)}</div>
                    )}
                    <div className="total-line">
                      <strong>Total: RM {calculateTotal().toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
              <RequirePermission module="purchases" action="create">
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={loading || selectedProducts.length === 0}
                >
                  {loading ? 'Creating Purchase...' : 'Create Purchase'}
                </button>
              </RequirePermission>
            </div>
          </form>
        </div>
      )}

      {/* Purchase History */}
      <div className="purchase-history-section">
        <h2>Purchase History</h2>
        {purchases.length === 0 ? (
          <div className="no-purchases">
            <p>No purchases found. Create your first purchase to get started!</p>
          </div>
        ) : (
          <div className="purchases-list">
            {purchases.map(purchase => (
              <div key={purchase.id} className="purchase-item">
                <div className="purchase-header">
                  <h3>{purchase.supplierName}</h3>
                  <span className="purchase-status">{purchase.status}</span>
                </div>
                <div className="purchase-info">
                  <p>Date: {purchase.createdAt?.toDate().toLocaleDateString()}</p>
                  <p>Items: {purchase.items?.length || 0}</p>
                  <p>Total: RM {purchase.total?.toFixed(2) || '0.00'}</p>
                  {purchase.notes && <p>Notes: {purchase.notes}</p>}
                </div>
                <button
                  onClick={() => handleViewDetails(purchase)}
                  className="btn-view-details"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Purchase Detail Modal */}
      {showDetailModal && (
        <PurchaseDetailModal
          purchase={selectedPurchase}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPurchase(null);
          }}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

export default Purchases;
