import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import {
  subscribeProducts,
  createShopUse,
  subscribeShopUses,
  deleteShopUse,
  createTransfer,
  subscribeTransfers,
  deleteTransfer,
  createStockAudit,
  subscribeStockAudits
} from '../lib/firestore';
import { logActivity } from '../lib/auditLog';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import '../styles/Shop.css';

function Shop() {
  const { user, userRole } = useAuth();
  const { showSuccess, showError } = useAlert();

  // Tab state
  const [activeTab, setActiveTab] = useState('shopUse');

  // Common state
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Shop Use state
  const [shopUses, setShopUses] = useState([]);
  const [showShopUseForm, setShowShopUseForm] = useState(false);
  const [shopUseDate, setShopUseDate] = useState('');
  const [shopUseProducts, setShopUseProducts] = useState([]);
  const [shopUseReason, setShopUseReason] = useState('');
  const [shopUseNotes, setShopUseNotes] = useState('');
  const [selectedShopUse, setSelectedShopUse] = useState(null);
  const [showShopUseDetail, setShowShopUseDetail] = useState(false);
  const [shopUseToDelete, setShopUseToDelete] = useState(null);
  const [showShopUseDeleteConfirm, setShowShopUseDeleteConfirm] = useState(false);
  const [deletingShopUse, setDeletingShopUse] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // Transfer state
  const [transfers, setTransfers] = useState([]);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferDate, setTransferDate] = useState('');
  const [sourceProduct, setSourceProduct] = useState('');
  const [targetProduct, setTargetProduct] = useState('');
  const [sourceQty, setSourceQty] = useState('');
  const [targetQty, setTargetQty] = useState('');
  const [conversionRate, setConversionRate] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [showTransferDetail, setShowTransferDetail] = useState(false);
  const [transferToDelete, setTransferToDelete] = useState(null);
  const [showTransferDeleteConfirm, setShowTransferDeleteConfirm] = useState(false);
  const [deletingTransfer, setDeletingTransfer] = useState(false);

  // Stock Audit state
  const [stockAudits, setStockAudits] = useState([]);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [auditProduct, setAuditProduct] = useState('');
  const [auditActualStock, setAuditActualStock] = useState('');
  const [auditReason, setAuditReason] = useState('');
  const [auditPassword, setAuditPassword] = useState('');
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [showAuditDetail, setShowAuditDetail] = useState(false);

  // Subscribe to products
  useEffect(() => {
    const unsubscribe = subscribeProducts((productsData) => {
      const sortedProducts = productsData.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setProducts(sortedProducts);
    });
    return unsubscribe;
  }, []);

  // Subscribe to shop uses
  useEffect(() => {
    const unsubscribe = subscribeShopUses((data) => {
      setShopUses(data);
    });
    return unsubscribe;
  }, []);

  // Subscribe to transfers
  useEffect(() => {
    const unsubscribe = subscribeTransfers((data) => {
      setTransfers(data);
    });
    return unsubscribe;
  }, []);

  // Subscribe to stock audits
  useEffect(() => {
    const unsubscribe = subscribeStockAudits((data) => {
      setStockAudits(data);
    });
    return unsubscribe;
  }, []);

  // ============================================
  // SHOP USE FUNCTIONS
  // ============================================

  const addProductToShopUse = (product) => {
    if (!shopUseProducts.find(p => p.id === product.id)) {
      setShopUseProducts([...shopUseProducts, {
        id: product.id,
        name: product.name,
        qty: 1,
        currentStock: product.stockBalance || 0
      }]);
    }
  };

  const removeProductFromShopUse = (productId) => {
    setShopUseProducts(shopUseProducts.filter(p => p.id !== productId));
  };

  const updateProductInShopUse = (productId, qty) => {
    setShopUseProducts(shopUseProducts.map(p =>
      p.id === productId ? { ...p, qty: Number(qty) || 0 } : p
    ));
  };

  const handleSubmitShopUse = async (e) => {
    e.preventDefault();

    if (shopUseProducts.length === 0) {
      showError('Please add at least one product.');
      return;
    }

    if (!shopUseReason.trim()) {
      showError('Please provide a reason for shop use.');
      return;
    }

    const invalidProducts = shopUseProducts.filter(p => !p.qty || p.qty <= 0);
    if (invalidProducts.length > 0) {
      showError('All products must have valid quantities greater than 0.');
      return;
    }

    setLoading(true);

    try {
      const totalQty = shopUseProducts.reduce((sum, p) => sum + p.qty, 0);

      const shopUseData = {
        reason: shopUseReason.trim(),
        notes: shopUseNotes.trim(),
        customDate: shopUseDate || null,
        items: shopUseProducts.map(p => ({
          productId: p.id,
          name: p.name,
          qty: p.qty
        })),
        totalQty: totalQty,
        createdBy: user.uid,
        createdAt: new Date()
      };

      await createShopUse(shopUseData);

      await logActivity(
        'shop_use_created',
        user.email || 'unknown_user',
        `Shop use created: ${shopUseReason.trim()} - ${totalQty} item(s)`,
        'action',
        {
          reason: shopUseReason.trim(),
          totalQty: totalQty,
          itemCount: shopUseProducts.length
        }
      );

      resetShopUseForm();
      showSuccess(`Shop use recorded successfully! ${totalQty} item(s) used.`);

    } catch (error) {
      console.error('Error creating shop use:', error);
      showError(`Failed to create shop use: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetShopUseForm = () => {
    setShopUseDate('');
    setShopUseProducts([]);
    setShopUseReason('');
    setShopUseNotes('');
    setShowShopUseForm(false);
    setSearchTerm('');
  };

  const handleDeleteShopUse = (shopUse) => {
    setShopUseToDelete(shopUse);
    setShowShopUseDeleteConfirm(true);
  };

  const confirmDeleteShopUse = async (e) => {
    e.preventDefault();
    if (!adminPassword) {
      showError('Please enter your admin password.');
      return;
    }

    setDeletingShopUse(true);

    try {
      await signInWithEmailAndPassword(auth, user.email, adminPassword);
      await deleteShopUse(shopUseToDelete.id, shopUseToDelete);

      await logActivity(
        'shop_use_deleted',
        user.email || 'unknown_user',
        `Shop use deleted: ${shopUseToDelete.reason}`,
        'action',
        { shopUseId: shopUseToDelete.id }
      );

      showSuccess('Shop use deleted successfully!');
      setShowShopUseDeleteConfirm(false);
      setShopUseToDelete(null);
      setAdminPassword('');
    } catch (error) {
      console.error('Error deleting shop use:', error);
      showError(error.code === 'auth/wrong-password'
        ? 'Incorrect password. Please try again.'
        : `Failed to delete shop use: ${error.message}`);
    } finally {
      setDeletingShopUse(false);
    }
  };

  // ============================================
  // TRANSFER FUNCTIONS
  // ============================================

  const calculateTargetQty = () => {
    if (sourceQty && conversionRate) {
      const calculated = Number(sourceQty) * Number(conversionRate);
      setTargetQty(calculated.toString());
    }
  };

  useEffect(() => {
    calculateTargetQty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceQty, conversionRate]);

  const handleSubmitTransfer = async (e) => {
    e.preventDefault();

    if (!sourceProduct || !targetProduct) {
      showError('Please select both source and target products.');
      return;
    }

    if (sourceProduct === targetProduct) {
      showError('Source and target products must be different.');
      return;
    }

    if (!sourceQty || Number(sourceQty) <= 0) {
      showError('Source quantity must be greater than 0.');
      return;
    }

    if (!conversionRate || Number(conversionRate) <= 0) {
      showError('Conversion rate must be greater than 0.');
      return;
    }

    setLoading(true);

    try {
      const sourceProductData = products.find(p => p.id === sourceProduct);
      const targetProductData = products.find(p => p.id === targetProduct);

      const transferData = {
        sourceProductId: sourceProduct,
        sourceProductName: sourceProductData.name,
        targetProductId: targetProduct,
        targetProductName: targetProductData.name,
        sourceQty: Number(sourceQty),
        targetQty: Number(targetQty),
        conversionRate: Number(conversionRate),
        notes: transferNotes.trim(),
        customDate: transferDate || null,
        createdBy: user.uid,
        createdAt: new Date()
      };

      await createTransfer(transferData);

      await logActivity(
        'transfer_created',
        user.email || 'unknown_user',
        `Transfer: ${sourceProductData.name} → ${targetProductData.name} (${sourceQty} → ${targetQty})`,
        'action',
        {
          sourceProduct: sourceProductData.name,
          targetProduct: targetProductData.name,
          sourceQty: Number(sourceQty),
          targetQty: Number(targetQty)
        }
      );

      resetTransferForm();
      showSuccess('Transfer completed successfully!');

    } catch (error) {
      console.error('Error creating transfer:', error);
      showError(`Failed to create transfer: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetTransferForm = () => {
    setTransferDate('');
    setSourceProduct('');
    setTargetProduct('');
    setSourceQty('');
    setTargetQty('');
    setConversionRate('');
    setTransferNotes('');
    setShowTransferForm(false);
  };

  const handleDeleteTransfer = (transfer) => {
    setTransferToDelete(transfer);
    setShowTransferDeleteConfirm(true);
  };

  const confirmDeleteTransfer = async (e) => {
    e.preventDefault();
    if (!adminPassword) {
      showError('Please enter your admin password.');
      return;
    }

    setDeletingTransfer(true);

    try {
      await signInWithEmailAndPassword(auth, user.email, adminPassword);
      await deleteTransfer(transferToDelete.id, transferToDelete);

      await logActivity(
        'transfer_deleted',
        user.email || 'unknown_user',
        `Transfer deleted: ${transferToDelete.sourceProductName} → ${transferToDelete.targetProductName}`,
        'action',
        { transferId: transferToDelete.id }
      );

      showSuccess('Transfer deleted successfully!');
      setShowTransferDeleteConfirm(false);
      setTransferToDelete(null);
      setAdminPassword('');
    } catch (error) {
      console.error('Error deleting transfer:', error);
      showError(error.code === 'auth/wrong-password'
        ? 'Incorrect password. Please try again.'
        : `Failed to delete transfer: ${error.message}`);
    } finally {
      setDeletingTransfer(false);
    }
  };

  // ============================================
  // STOCK AUDIT FUNCTIONS
  // ============================================

  const handleSubmitAudit = async (e) => {
    e.preventDefault();

    if (!auditProduct) {
      showError('Please select a product.');
      return;
    }

    if (!auditActualStock || Number(auditActualStock) < 0) {
      showError('Please enter a valid actual stock count.');
      return;
    }

    if (!auditReason.trim()) {
      showError('Please provide a reason for the audit.');
      return;
    }

    if (!auditPassword) {
      showError('Please enter your admin password.');
      return;
    }

    setLoading(true);

    try {
      // Verify admin password
      await signInWithEmailAndPassword(auth, user.email, auditPassword);

      const productData = products.find(p => p.id === auditProduct);

      const auditData = {
        productId: auditProduct,
        productName: productData.name,
        actualStock: Number(auditActualStock),
        reason: auditReason.trim(),
        createdBy: user.uid,
        createdByEmail: user.email
      };

      await createStockAudit(auditData);

      const difference = Number(auditActualStock) - (productData.stockBalance || 0);

      await logActivity(
        'stock_audit_created',
        user.email || 'unknown_user',
        `Stock audit: ${productData.name} - Difference: ${difference > 0 ? '+' : ''}${difference}`,
        'action',
        {
          productName: productData.name,
          oldStock: productData.stockBalance || 0,
          newStock: Number(auditActualStock),
          difference: difference,
          reason: auditReason.trim()
        }
      );

      resetAuditForm();
      showSuccess('Stock audit completed successfully!');

    } catch (error) {
      console.error('Error creating stock audit:', error);
      if (error.code === 'auth/wrong-password') {
        showError('Incorrect password. Please try again.');
      } else {
        showError(`Failed to create audit: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetAuditForm = () => {
    setAuditProduct('');
    setAuditActualStock('');
    setAuditReason('');
    setAuditPassword('');
    setShowAuditForm(false);
  };

  // Filter products for search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get current product stock for audit
  const auditProductData = auditProduct ? products.find(p => p.id === auditProduct) : null;

  if (!user) {
    return <div className="shop-container"><p>Please log in to access this page.</p></div>;
  }

  return (
    <div className="shop-container">
      <div className="shop-header">
        <div className="header-content">
          <div>
            <h1>🏪 Shop Management</h1>
            <p>Manage shop usage, transfers, and stock audits</p>
          </div>
          <Link to="/" className="back-button">← Back to Dashboard</Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'shopUse' ? 'active' : ''}`}
          onClick={() => setActiveTab('shopUse')}
        >
          Shop Use
        </button>
        <button
          className={`tab-btn ${activeTab === 'transfer' ? 'active' : ''}`}
          onClick={() => setActiveTab('transfer')}
        >
          Transfer
        </button>
        {userRole === 'admin' && (
          <button
            className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            Stock Audit
          </button>
        )}
      </div>

      {/* SHOP USE TAB */}
      {activeTab === 'shopUse' && (
        <>
          <div className="tab-actions">
            {!showShopUseForm && (
              <button onClick={() => setShowShopUseForm(true)} className="btn-primary">
                + New Shop Use
              </button>
            )}
          </div>

          {showShopUseForm && (
            <div className="form-container">
              <h2>Record Shop Use</h2>
              <form onSubmit={handleSubmitShopUse} className="shop-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Date (Optional):</label>
                    <input
                      type="date"
                      value={shopUseDate}
                      onChange={(e) => setShopUseDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Reason: *</label>
                    <select
                      value={shopUseReason}
                      onChange={(e) => setShopUseReason(e.target.value)}
                      required
                    >
                      <option value="">Select reason...</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Sample">Sample</option>
                      <option value="Personal Use">Personal Use</option>
                      <option value="Testing">Testing</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes:</label>
                  <textarea
                    value={shopUseNotes}
                    onChange={(e) => setShopUseNotes(e.target.value)}
                    placeholder="Additional notes..."
                    rows="3"
                  />
                </div>

                {/* Product Search */}
                <div className="form-group">
                  <label>Search Products:</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by product name..."
                  />
                </div>

                {searchTerm && (
                  <div className="product-search-results">
                    {filteredProducts.map(product => (
                      <div key={product.id} className="product-search-item">
                        <div>
                          <strong>{product.name}</strong>
                          <span className="stock-info">Stock: {product.stockBalance}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addProductToShopUse(product)}
                          className="btn-add-product"
                          disabled={shopUseProducts.find(p => p.id === product.id)}
                        >
                          {shopUseProducts.find(p => p.id === product.id) ? 'Added' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Products */}
                {shopUseProducts.length > 0 && (
                  <div className="selected-products-section">
                    <h3>Selected Products</h3>
                    <div className="selected-products-list">
                      {shopUseProducts.map(product => (
                        <div key={product.id} className="selected-product-item">
                          <div className="product-details">
                            <span className="product-name">{product.name}</span>
                            <span className="current-stock">Stock: {product.currentStock}</span>
                          </div>
                          <div className="product-inputs">
                            <input
                              type="number"
                              min="1"
                              value={product.qty}
                              onChange={(e) => updateProductInShopUse(product.id, e.target.value)}
                              placeholder="Qty"
                            />
                            <button
                              type="button"
                              onClick={() => removeProductFromShopUse(product.id)}
                              className="btn-remove-product"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="total-section">
                      <strong>Total Items: {shopUseProducts.reduce((sum, p) => sum + p.qty, 0)}</strong>
                    </div>
                  </div>
                )}

                <div className="form-actions">
                  <button type="button" onClick={resetShopUseForm} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Recording...' : 'Record Shop Use'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Shop Use List */}
          <div className="list-container">
            <h2>Shop Use History</h2>
            {shopUses.length === 0 ? (
              <p className="empty-message">No shop use records yet.</p>
            ) : (
              <div className="items-grid">
                {shopUses.map(shopUse => (
                  <div key={shopUse.id} className="item-card">
                    <div className="item-header">
                      <strong>{shopUse.reason}</strong>
                      <span className="item-date">
                        {shopUse.createdAt?.toDate().toLocaleDateString()}
                      </span>
                    </div>
                    <div className="item-body">
                      <p>Items: {shopUse.items?.length || 0}</p>
                      <p>Total Qty: {shopUse.totalQty || 0}</p>
                      {shopUse.notes && <p>Notes: {shopUse.notes}</p>}
                    </div>
                    <div className="item-actions">
                      <button
                        onClick={() => {
                          setSelectedShopUse(shopUse);
                          setShowShopUseDetail(true);
                        }}
                        className="btn-view"
                      >
                        View Details
                      </button>
                      {userRole === 'admin' && (
                        <button
                          onClick={() => handleDeleteShopUse(shopUse)}
                          className="btn-delete"
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* TRANSFER TAB */}
      {activeTab === 'transfer' && (
        <>
          <div className="tab-actions">
            {!showTransferForm && (
              <button onClick={() => setShowTransferForm(true)} className="btn-primary">
                + New Transfer
              </button>
            )}
          </div>

          {showTransferForm && (
            <div className="form-container">
              <h2>Create Transfer</h2>
              <form onSubmit={handleSubmitTransfer} className="shop-form">
                <div className="form-group">
                  <label>Date (Optional):</label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                  />
                </div>

                <div className="transfer-section">
                  <h3>From (Source)</h3>
                  <div className="form-group">
                    <label>Source Product: *</label>
                    <select
                      value={sourceProduct}
                      onChange={(e) => setSourceProduct(e.target.value)}
                      required
                    >
                      <option value="">Select product...</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} (Stock: {product.stockBalance})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Source Quantity: *</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={sourceQty}
                      onChange={(e) => setSourceQty(e.target.value)}
                      required
                      placeholder="e.g., 1 (roll)"
                    />
                  </div>
                </div>

                <div className="conversion-section">
                  <h3>Conversion</h3>
                  <div className="form-group">
                    <label>Conversion Rate: *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={conversionRate}
                      onChange={(e) => setConversionRate(e.target.value)}
                      required
                      placeholder="e.g., 100 (1 roll = 100 meters)"
                    />
                    <small>How many target units per source unit?</small>
                  </div>
                </div>

                <div className="transfer-section">
                  <h3>To (Target)</h3>
                  <div className="form-group">
                    <label>Target Product: *</label>
                    <select
                      value={targetProduct}
                      onChange={(e) => setTargetProduct(e.target.value)}
                      required
                    >
                      <option value="">Select product...</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} (Stock: {product.stockBalance})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Target Quantity:</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={targetQty}
                      readOnly
                      placeholder="Auto-calculated"
                    />
                    <small>Calculated: {sourceQty} × {conversionRate} = {targetQty}</small>
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes:</label>
                  <textarea
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="Additional notes..."
                    rows="3"
                  />
                </div>

                <div className="form-actions">
                  <button type="button" onClick={resetTransferForm} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Transfer'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Transfer List */}
          <div className="list-container">
            <h2>Transfer History</h2>
            {transfers.length === 0 ? (
              <p className="empty-message">No transfers yet.</p>
            ) : (
              <div className="items-grid">
                {transfers.map(transfer => (
                  <div key={transfer.id} className="item-card">
                    <div className="item-header">
                      <strong>Transfer</strong>
                      <span className="item-date">
                        {transfer.createdAt?.toDate().toLocaleDateString()}
                      </span>
                    </div>
                    <div className="item-body">
                      <p><strong>From:</strong> {transfer.sourceProductName} ({transfer.sourceQty})</p>
                      <p><strong>To:</strong> {transfer.targetProductName} ({transfer.targetQty})</p>
                      <p><strong>Rate:</strong> 1 : {transfer.conversionRate}</p>
                      {transfer.notes && <p>Notes: {transfer.notes}</p>}
                    </div>
                    <div className="item-actions">
                      <button
                        onClick={() => {
                          setSelectedTransfer(transfer);
                          setShowTransferDetail(true);
                        }}
                        className="btn-view"
                      >
                        View Details
                      </button>
                      {userRole === 'admin' && (
                        <button
                          onClick={() => handleDeleteTransfer(transfer)}
                          className="btn-delete"
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* STOCK AUDIT TAB - Admin Only */}
      {activeTab === 'audit' && userRole === 'admin' && (
        <>
          <div className="tab-actions">
            {!showAuditForm && (
              <button onClick={() => setShowAuditForm(true)} className="btn-primary">
                + New Stock Audit
              </button>
            )}
          </div>

          {showAuditForm && (
            <div className="form-container">
              <h2>Stock Audit</h2>
              <form onSubmit={handleSubmitAudit} className="shop-form">
                <div className="form-group">
                  <label>Product: *</label>
                  <select
                    value={auditProduct}
                    onChange={(e) => setAuditProduct(e.target.value)}
                    required
                  >
                    <option value="">Select product...</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} (Current: {product.stockBalance})
                      </option>
                    ))}
                  </select>
                </div>

                {auditProductData && (
                  <div className="audit-info">
                    <p><strong>Current Stock (System):</strong> {auditProductData.stockBalance}</p>
                  </div>
                )}

                <div className="form-group">
                  <label>Actual Stock Count: *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={auditActualStock}
                    onChange={(e) => setAuditActualStock(e.target.value)}
                    required
                    placeholder="Physical count"
                  />
                  {auditProductData && auditActualStock && (
                    <small className={
                      Number(auditActualStock) - auditProductData.stockBalance >= 0
                        ? 'text-success'
                        : 'text-danger'
                    }>
                      Difference: {Number(auditActualStock) - auditProductData.stockBalance > 0 ? '+' : ''}
                      {Number(auditActualStock) - auditProductData.stockBalance}
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Reason: *</label>
                  <textarea
                    value={auditReason}
                    onChange={(e) => setAuditReason(e.target.value)}
                    required
                    placeholder="Explain the reason for this audit..."
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>Admin Password: *</label>
                  <input
                    type="password"
                    value={auditPassword}
                    onChange={(e) => setAuditPassword(e.target.value)}
                    required
                    placeholder="Enter your password to confirm"
                    autoComplete="current-password"
                  />
                </div>

                <div className="form-actions">
                  <button type="button" onClick={resetAuditForm} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Processing...' : 'Complete Audit'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Stock Audit List */}
          <div className="list-container">
            <h2>Audit History</h2>
            {stockAudits.length === 0 ? (
              <p className="empty-message">No audits yet.</p>
            ) : (
              <div className="items-grid">
                {stockAudits.map(audit => (
                  <div key={audit.id} className="item-card">
                    <div className="item-header">
                      <strong>{audit.productName}</strong>
                      <span className="item-date">
                        {audit.createdAt?.toDate().toLocaleDateString()}
                      </span>
                    </div>
                    <div className="item-body">
                      <p><strong>Previous:</strong> {audit.currentStock}</p>
                      <p><strong>Actual:</strong> {audit.actualStock}</p>
                      <p className={audit.difference >= 0 ? 'text-success' : 'text-danger'}>
                        <strong>Difference:</strong> {audit.difference > 0 ? '+' : ''}{audit.difference}
                      </p>
                      <p><strong>Reason:</strong> {audit.reason}</p>
                      <p><small>By: {audit.createdByEmail}</small></p>
                    </div>
                    <div className="item-actions">
                      <button
                        onClick={() => {
                          setSelectedAudit(audit);
                          setShowAuditDetail(true);
                        }}
                        className="btn-view"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Shop Use Detail Modal */}
      {showShopUseDetail && selectedShopUse && (
        <div className="modal-overlay" onClick={() => setShowShopUseDetail(false)}>
          <div className="modal-content shop-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Shop Use Details</h2>
              <button className="modal-close" onClick={() => setShowShopUseDetail(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <p><strong>Reason:</strong> {selectedShopUse.reason}</p>
                <p><strong>Date:</strong> {selectedShopUse.createdAt?.toDate().toLocaleString()}</p>
                {selectedShopUse.notes && <p><strong>Notes:</strong> {selectedShopUse.notes}</p>}
              </div>
              <div className="detail-section">
                <h3>Items Used</h3>
                {selectedShopUse.items?.map((item, index) => (
                  <div key={index} className="detail-item">
                    <span>{item.name}</span>
                    <span>Qty: {item.qty}</span>
                  </div>
                ))}
              </div>
              <div className="detail-total">
                <strong>Total Quantity:</strong> {selectedShopUse.totalQty}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowShopUseDetail(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Detail Modal */}
      {showTransferDetail && selectedTransfer && (
        <div className="modal-overlay" onClick={() => setShowTransferDetail(false)}>
          <div className="modal-content shop-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Transfer Details</h2>
              <button className="modal-close" onClick={() => setShowTransferDetail(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <p><strong>Date:</strong> {selectedTransfer.createdAt?.toDate().toLocaleString()}</p>
                <p><strong>From:</strong> {selectedTransfer.sourceProductName}</p>
                <p><strong>Quantity:</strong> {selectedTransfer.sourceQty}</p>
              </div>
              <div className="detail-section">
                <p><strong>To:</strong> {selectedTransfer.targetProductName}</p>
                <p><strong>Quantity:</strong> {selectedTransfer.targetQty}</p>
                <p><strong>Conversion Rate:</strong> 1 : {selectedTransfer.conversionRate}</p>
              </div>
              {selectedTransfer.notes && (
                <div className="detail-section">
                  <p><strong>Notes:</strong> {selectedTransfer.notes}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowTransferDetail(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Audit Detail Modal */}
      {showAuditDetail && selectedAudit && (
        <div className="modal-overlay" onClick={() => setShowAuditDetail(false)}>
          <div className="modal-content shop-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Audit Details</h2>
              <button className="modal-close" onClick={() => setShowAuditDetail(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <p><strong>Product:</strong> {selectedAudit.productName}</p>
                <p><strong>Date:</strong> {selectedAudit.createdAt?.toDate().toLocaleString()}</p>
                <p><strong>Audited By:</strong> {selectedAudit.createdByEmail}</p>
              </div>
              <div className="detail-section">
                <p><strong>System Stock:</strong> {selectedAudit.currentStock}</p>
                <p><strong>Actual Count:</strong> {selectedAudit.actualStock}</p>
                <p className={selectedAudit.difference >= 0 ? 'text-success' : 'text-danger'}>
                  <strong>Difference:</strong> {selectedAudit.difference > 0 ? '+' : ''}{selectedAudit.difference}
                </p>
              </div>
              <div className="detail-section">
                <p><strong>Reason:</strong> {selectedAudit.reason}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAuditDetail(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shop Use Confirmation Modal */}
      {showShopUseDeleteConfirm && shopUseToDelete && (
        <div className="modal-overlay" onClick={() => setShowShopUseDeleteConfirm(false)}>
          <div className="modal-content delete-confirmation-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Delete Shop Use</h3>
              <button className="close-btn" onClick={() => setShowShopUseDeleteConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p><strong>⚠️ WARNING:</strong> This will restore stock for all items in this shop use record.</p>
              <p><strong>Reason:</strong> {shopUseToDelete.reason}</p>
              <p><strong>Items:</strong> {shopUseToDelete.items?.length}</p>
              <form onSubmit={confirmDeleteShopUse}>
                <div className="form-group">
                  <label>Admin Password:</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={deletingShopUse}
                  />
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowShopUseDeleteConfirm(false);
                      setAdminPassword('');
                    }}
                    disabled={deletingShopUse}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-danger" disabled={deletingShopUse}>
                    {deletingShopUse ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Transfer Confirmation Modal */}
      {showTransferDeleteConfirm && transferToDelete && (
        <div className="modal-overlay" onClick={() => setShowTransferDeleteConfirm(false)}>
          <div className="modal-content delete-confirmation-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Delete Transfer</h3>
              <button className="close-btn" onClick={() => setShowTransferDeleteConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p><strong>⚠️ WARNING:</strong> This will reverse the transfer.</p>
              <p><strong>From:</strong> {transferToDelete.sourceProductName}</p>
              <p><strong>To:</strong> {transferToDelete.targetProductName}</p>
              <form onSubmit={confirmDeleteTransfer}>
                <div className="form-group">
                  <label>Admin Password:</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={deletingTransfer}
                  />
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowTransferDeleteConfirm(false);
                      setAdminPassword('');
                    }}
                    disabled={deletingTransfer}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-danger" disabled={deletingTransfer}>
                    {deletingTransfer ? 'Deleting...' : 'Delete'}
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

export default Shop;
