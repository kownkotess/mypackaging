import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { subscribeProducts, subscribePurchases, createPurchase, updatePurchase } from '../lib/firestore';
import { useAuth } from '../context/AuthContextWrapper';
import { useAlert } from '../context/AlertContext';
import { RequirePermission } from './RoleComponents';
import PurchaseDetailModal from './PurchaseDetailModal';
import ReturnToTop from './ReturnToTop';
import { logActivity } from '../lib/auditLog';
import { doc, deleteDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
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
  const [purchaseDate, setPurchaseDate] = useState(''); // Optional date for backdating
  
  // Overall discount states
  const [overallDiscountType, setOverallDiscountType] = useState('none');
  const [overallDiscountValue, setOverallDiscountValue] = useState('');
  
  // Invoice tracking
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  // Supplier auto-suggestion
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [uniqueSuppliers, setUniqueSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [deletingPurchase, setDeletingPurchase] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Show 10 purchases per page

  // Subscribe to products and purchases
  useEffect(() => {
    const unsubscribeProducts = subscribeProducts((productsData) => {
      // Sort products alphabetically by name
      const sortedProducts = productsData.sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setProducts(sortedProducts);
    });

    const unsubscribePurchases = subscribePurchases((purchasesData) => {
      setPurchases(purchasesData);
      
      // Extract unique supplier names for auto-suggestion
      const suppliers = purchasesData
        .map(p => p.supplierName)
        .filter(name => name && name.trim())
        .reduce((unique, name) => {
          const trimmedName = name.trim();
          if (!unique.find(s => s.toLowerCase() === trimmedName.toLowerCase())) {
            unique.push(trimmedName);
          }
          return unique;
        }, [])
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      
      setUniqueSuppliers(suppliers);
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

  // Filter purchases by date range
  const getFilteredPurchases = () => {
    if (dateFilter === 'all') return purchases;
    
    const now = new Date();
    let startDate;
    
    switch (dateFilter) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '4weeks':
        startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case '12months':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        return purchases;
    }
    
    return purchases.filter(purchase => {
      const purchaseDate = purchase.createdAt?.toDate();
      return purchaseDate && purchaseDate >= startDate;
    });
  };

  const filteredPurchases = getFilteredPurchases();

  // Pagination calculations
  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPurchases = filteredPurchases.slice(startIndex, endIndex);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  // Calculate total cost (subtotal - overall discount + transportation)
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    let afterDiscount = subtotal;
    
    // Apply overall discount
    if (overallDiscountType === 'percent' && overallDiscountValue) {
      const discountAmount = (subtotal * Number(overallDiscountValue)) / 100;
      afterDiscount = subtotal - discountAmount;
    } else if (overallDiscountType === 'amount' && overallDiscountValue) {
      afterDiscount = Math.max(0, subtotal - Number(overallDiscountValue));
    }
    
    const transportation = Number(transportationCost) || 0;
    return afterDiscount + transportation;
  };
  
  // Calculate overall discount amount for display
  const calculateOverallDiscount = () => {
    const subtotal = calculateSubtotal();
    if (overallDiscountType === 'percent' && overallDiscountValue) {
      return (subtotal * Number(overallDiscountValue)) / 100;
    } else if (overallDiscountType === 'amount' && overallDiscountValue) {
      return Math.min(Number(overallDiscountValue), subtotal);
    }
    return 0;
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
        invoiceNumber: invoiceNumber.trim() || null,
        status: purchaseStatus,
        notes: notes.trim(),
        transportationCost: Number(transportationCost) || 0,
        customDate: purchaseDate || null, // Add custom date if provided
        items: selectedProducts.map(p => ({
          productId: p.id,
          name: p.name,
          qty: p.qty,
          cost: p.cost,
          discountType: p.discountType,
          discountValue: p.discountValue,
          subtotal: calculateItemSubtotal(p)
        })),
        overallDiscountType,
        overallDiscountValue: Number(overallDiscountValue) || 0,
        subtotal: calculateSubtotal(),
        overallDiscount: calculateOverallDiscount(),
        total: calculateTotal(),
        createdBy: user.uid,
        createdAt: new Date()
      };

      await createPurchase(purchaseData);

      // Log the purchase activity
      await logActivity(
        'purchase_created',
        user.email || 'unknown_user',
        `Purchase order created for supplier ${supplierName.trim()} - Total: RM${calculateTotal().toFixed(2)}${calculateOverallDiscount() > 0 ? ` (Discount: RM${calculateOverallDiscount().toFixed(2)})` : ''} (${purchaseStatus})`,
        'action',
        {
          supplierName: supplierName.trim(),
          status: purchaseStatus,
          total: calculateTotal(),
          itemCount: selectedProducts.length,
          transportationCost: Number(transportationCost) || 0
        }
      );

      // Reset form
      setSupplierName('');
      setPurchaseStatus('📦 Ordered');
      setNotes('');
      setTransportationCost('');
      setPurchaseDate(''); // Reset purchase date
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

  // Handle supplier name input with auto-suggestion
  const handleSupplierNameChange = (value) => {
    setSupplierName(value);
    
    if (value.trim().length > 0) {
      const filtered = uniqueSuppliers.filter(supplier =>
        supplier.toLowerCase().includes(value.toLowerCase())
      );
      setSupplierSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSupplierSuggestions([]);
      setShowSuggestions(false);
    }
  };
  
  // Select supplier from suggestions
  const selectSupplier = (supplierName) => {
    setSupplierName(supplierName);
    setShowSuggestions(false);
    setSupplierSuggestions([]);
  };
  
  // Hide suggestions when clicking outside
  const handleSupplierBlur = () => {
    // Delay hiding to allow click on suggestion
    setTimeout(() => setShowSuggestions(false), 150);
  };

  // Reset form
  const resetForm = () => {
    setSupplierName('');
    setPurchaseStatus('📦 Ordered');
    setNotes('');
    setTransportationCost('');
    setOverallDiscountType('none');
    setOverallDiscountValue('');
    setInvoiceNumber('');
    setSelectedProducts([]);
    setShowForm(false);
    setSearchTerm('');
    setError('');
    setShowSuggestions(false);
    setSupplierSuggestions([]);
  };

  // Handle purchase detail view
  const handleViewDetails = (purchase) => {
    setSelectedPurchase(purchase);
    setShowDetailModal(true);
  };

  // Handle status change
  const handleStatusChange = async (purchaseId, newStatus, updatedItems = null) => {
    try {
      setLoading(true);
      
      // Find the purchase to get current status and supplier info
      const purchase = purchases.find(p => p.id === purchaseId);
      const oldStatus = purchase?.status || 'Unknown';
      
      // Prepare update data
      const updateData = { status: newStatus };
      if (updatedItems) {
        updateData.items = updatedItems;
      }
      
      await updatePurchase(purchaseId, updateData);
      
      // Log the status change activity
      await logActivity(
        'purchase_status_updated',
        user.email || 'unknown_user',
        `Purchase status changed from "${oldStatus}" to "${newStatus}" for supplier ${purchase?.supplierName || 'Unknown'}`,
        'action',
        {
          purchaseId,
          supplierName: purchase?.supplierName,
          oldStatus,
          newStatus,
          total: purchase?.total || 0
        }
      );
      
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

  // Handle delete purchase (admin only)
  const handleDeletePurchase = (purchase) => {
    if (user?.email !== 'admin@mypackaging.com') {
      showError('Only admin@mypackaging.com can delete purchases');
      return;
    }
    setPurchaseToDelete(purchase);
    setShowDeleteConfirmation(true);
  };

  // Confirm delete purchase with password verification
  const confirmDeletePurchase = async (e) => {
    e.preventDefault();
    if (!adminPassword) {
      showError('Please enter your password');
      return;
    }

    setDeletingPurchase(true);
    try {
      // Verify admin password
      await signInWithEmailAndPassword(auth, 'admin@mypackaging.com', adminPassword);
      
      // Delete the purchase from Firestore
      await deleteDoc(doc(db, 'purchases', purchaseToDelete.id));
      
      // Log the deletion activity
      await logActivity(
        'Purchase Deleted',
        user.email,
        `Deleted purchase from ${purchaseToDelete.supplierName} worth RM ${purchaseToDelete.total?.toFixed(2) || '0.00'}. Purchase ID: ${purchaseToDelete.id.substring(0, 8)}`,
        'purchases'
      );
      
      showSuccess(`Purchase from ${purchaseToDelete.supplierName} has been deleted successfully`);
      setShowDeleteConfirmation(false);
      setAdminPassword('');
      setPurchaseToDelete(null);
      
    } catch (error) {
      console.error('Error deleting purchase:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        showError('Invalid password. Please try again.');
      } else {
        showError('Failed to delete purchase. Please try again.');
      }
    } finally {
      setDeletingPurchase(false);
    }
  };

  const statusOptions = [
    '📦 Ordered',
    '🚚 In Transit',
    '✅ Received',
    '📦❗ Received Partial',
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
                <div className="supplier-input-container">
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => handleSupplierNameChange(e.target.value)}
                    onBlur={handleSupplierBlur}
                    onFocus={() => {
                      if (supplierName.trim().length > 0 && supplierSuggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    placeholder="Enter supplier name"
                    required
                    autoComplete="off"
                  />
                  {showSuggestions && supplierSuggestions.length > 0 && (
                    <div className="supplier-suggestions">
                      {supplierSuggestions.map((supplier, index) => (
                        <div
                          key={index}
                          className="supplier-suggestion-item"
                          onClick={() => selectSupplier(supplier)}
                        >
                          {supplier}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Invoice Number (Optional):</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Enter supplier invoice number"
                />
              </div>
            </div>

            <div className="form-row">
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
              <div className="form-group">
                <label>Purchase Date (Optional):</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  placeholder="Leave empty for current date"
                />
                <small className="form-help">Leave empty to use current date</small>
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

            {/* Overall Discount Section */}
            <div className="form-group">
              <label>Overall Discount - Optional:</label>
              <div className="discount-controls">
                <select
                  value={overallDiscountType}
                  onChange={(e) => {
                    setOverallDiscountType(e.target.value);
                    if (e.target.value === 'none') {
                      setOverallDiscountValue('');
                    }
                  }}
                  className="discount-type-select"
                >
                  <option value="none">No Discount</option>
                  <option value="percent">Percent (%)</option>
                  <option value="amount">Amount (RM)</option>
                </select>
                {overallDiscountType !== 'none' && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={overallDiscountType === 'percent' ? '100' : undefined}
                    value={overallDiscountValue}
                    onChange={(e) => setOverallDiscountValue(e.target.value)}
                    placeholder={overallDiscountType === 'percent' ? '0.00' : '0.00'}
                    className="discount-value-input"
                  />
                )}
              </div>
              <small>Apply an overall discount to the entire purchase subtotal</small>
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
                    {overallDiscountType !== 'none' && calculateOverallDiscount() > 0 && (
                      <div className="discount-line">
                        Overall Discount ({overallDiscountType === 'percent' ? `${overallDiscountValue}%` : 'Amount'}): 
                        -RM {calculateOverallDiscount().toFixed(2)}
                      </div>
                    )}
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
        <div className="history-header">
          <h2>Purchase History</h2>
          <div className="date-filter">
            <label htmlFor="dateFilter">Filter by:</label>
            <select 
              id="dateFilter"
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="4weeks">Last 4 Weeks</option>
              <option value="3months">Last 3 Months</option>
              <option value="6months">Last 6 Months</option>
              <option value="12months">Last 12 Months</option>
            </select>
          </div>
        </div>
        {filteredPurchases.length === 0 ? (
          <div className="no-purchases">
            {purchases.length === 0 ? (
              <p>No purchases found. Create your first purchase to get started!</p>
            ) : (
              <p>No purchases found for the selected time period.</p>
            )}
          </div>
        ) : (
          <>
            <div className="purchases-list">
              {currentPurchases.map(purchase => (
              <div key={purchase.id} className="purchase-item">
                <div className="purchase-header">
                  <h3>{purchase.supplierName}</h3>
                  <span className="purchase-status">{purchase.status}</span>
                </div>
                <div className="purchase-info">
                  <p>Date: {purchase.createdAt?.toDate().toLocaleDateString()}</p>
                  {purchase.invoiceNumber && (
                    <p>Invoice: {purchase.invoiceNumber}</p>
                  )}
                  <p>Items: {purchase.items?.length || 0}</p>
                  <p>Total: RM {purchase.total?.toFixed(2) || '0.00'}</p>
                  {purchase.notes && <p>Notes: {purchase.notes}</p>}
                </div>
                <div className="purchase-actions">
                  <button
                    onClick={() => handleViewDetails(purchase)}
                    className="btn-view-details"
                  >
                    View Details
                  </button>
                  {user?.email === 'admin@mypackaging.com' && (
                    <button
                      onClick={() => handleDeletePurchase(purchase)}
                      className="btn-delete-purchase"
                      title="Delete Purchase (Admin Only)"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <div className="pagination-info">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredPurchases.length)} of {filteredPurchases.length} purchases
                </div>
                <div className="pagination-controls">
                  <button 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="pagination-btn"
                  >
                    ‹ Previous
                  </button>
                  
                  {[...Array(totalPages)].map((_, index) => {
                    const pageNumber = index + 1;
                    const isCurrentPage = pageNumber === currentPage;
                    
                    // Show first page, last page, current page, and pages around current
                    if (
                      pageNumber === 1 || 
                      pageNumber === totalPages ||
                      (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className={`pagination-btn ${isCurrentPage ? 'active' : ''}`}
                        >
                          {pageNumber}
                        </button>
                      );
                    } else if (
                      pageNumber === currentPage - 2 || 
                      pageNumber === currentPage + 2
                    ) {
                      return <span key={pageNumber} className="pagination-ellipsis">...</span>;
                    }
                    return null;
                  })}
                  
                  <button 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="pagination-btn"
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Return to Top Button */}
      <ReturnToTop />
      
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && purchaseToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirmation(false)}>
          <div className="modal-content delete-confirmation-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Delete Purchase</h3>
              <button className="close-btn" onClick={() => setShowDeleteConfirmation(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="warning-message">
                <p><strong>⚠️ WARNING:</strong> This action will permanently delete the purchase and cannot be undone.</p>
                <p><strong>Purchase Details:</strong></p>
                <ul>
                  <li>Supplier: {purchaseToDelete.supplierName}</li>
                  <li>Total: RM {purchaseToDelete.total?.toFixed(2) || '0.00'}</li>
                  <li>Date: {purchaseToDelete.createdAt?.toDate().toLocaleDateString()}</li>
                  <li>Items: {purchaseToDelete.items?.length || 0}</li>
                </ul>
                <p>Please enter your admin password to confirm:</p>
              </div>
              <form onSubmit={confirmDeletePurchase} className="delete-form">
                <div className="form-group">
                  <label htmlFor="adminPassword">Admin Password:</label>
                  <input
                    type="password"
                    id="adminPassword"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    disabled={deletingPurchase}
                  />
                </div>
                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowDeleteConfirmation(false);
                      setAdminPassword('');
                      setPurchaseToDelete(null);
                    }}
                    disabled={deletingPurchase}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-danger"
                    disabled={deletingPurchase}
                  >
                    {deletingPurchase ? 'Deleting...' : 'Delete Purchase'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Purchases;
