import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextWrapper';
import { useAlert } from '../context/AlertContext';
import { useNavigate } from 'react-router-dom';
import { subscribeUserRequests, createAdminRequest, subscribeProducts } from '../lib/firestore';
import { collection, query, where, orderBy as firestoreOrderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { logActivity } from '../lib/auditLog';
import './RequestChanges.css';

const RequestChanges = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useAlert();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [requestType, setRequestType] = useState('edit_sale');
  const [description, setDescription] = useState('');
  
  // Changes field state
  const [selectedDate, setSelectedDate] = useState('');
  const [sales, setSales] = useState([]);
  const [selectedSales, setSelectedSales] = useState([]);
  const [showSalesList, setShowSalesList] = useState(false);
  const [supplierInput, setSupplierInput] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [productFrom, setProductFrom] = useState('');
  const [productTo, setProductTo] = useState('');
  const [filteredProductsFrom, setFilteredProductsFrom] = useState([]);
  const [filteredProductsTo, setFilteredProductsTo] = useState([]);
  const [extraCashAmount, setExtraCashAmount] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (!user) return;

    console.log('[RequestChanges] Setting up subscription for user:', user.uid);
    const unsubscribe = subscribeUserRequests(user.uid, (data) => {
      console.log('[RequestChanges] Received requests:', data.length, 'requests');
      console.log('[RequestChanges] All requests:', data);
      // Filter only pending requests
      const pendingRequests = data.filter(req => req.status === 'pending');
      console.log('[RequestChanges] Pending requests:', pendingRequests.length);
      setRequests(pendingRequests);
    });

    return () => unsubscribe();
  }, [user]);

  // Load products for transfer
  useEffect(() => {
    const unsubscribe = subscribeProducts((productsData) => {
      setProducts(productsData);
    });
    return () => unsubscribe();
  }, []);

  // Load suppliers from purchases
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const purchasesRef = collection(db, 'purchases');
        const snapshot = await getDocs(purchasesRef);
        const uniqueSuppliers = [...new Set(snapshot.docs.map(doc => doc.data().supplierName).filter(Boolean))];
        setSuppliers(uniqueSuppliers.sort());
      } catch (error) {
        console.error('Error loading suppliers:', error);
      }
    };
    loadSuppliers();
  }, []);

  // Filter suppliers based on input
  useEffect(() => {
    if (supplierInput.trim()) {
      const filtered = suppliers.filter(s => 
        s.toLowerCase().includes(supplierInput.toLowerCase())
      );
      setFilteredSuppliers(filtered);
    } else {
      setFilteredSuppliers([]);
    }
  }, [supplierInput, suppliers]);

  // Filter products for "from" field
  useEffect(() => {
    if (productFrom.trim()) {
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(productFrom.toLowerCase())
      );
      setFilteredProductsFrom(filtered.slice(0, 5));
    } else {
      setFilteredProductsFrom([]);
    }
  }, [productFrom, products]);

  // Filter products for "to" field
  useEffect(() => {
    if (productTo.trim()) {
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(productTo.toLowerCase())
      );
      setFilteredProductsTo(filtered.slice(0, 5));
    } else {
      setFilteredProductsTo([]);
    }
  }, [productTo, products]);

  // Load sales for selected date
  useEffect(() => {
    if (selectedDate && (requestType === 'edit_sale' || requestType === 'delete_sale')) {
      const loadSales = async () => {
        try {
          const startDate = new Date(selectedDate);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(selectedDate);
          endDate.setHours(23, 59, 59, 999);

          const salesRef = collection(db, 'sales');
          const q = query(
            salesRef,
            where('createdAt', '>=', startDate),
            where('createdAt', '<=', endDate),
            firestoreOrderBy('createdAt', 'desc')
          );
          
          const snapshot = await getDocs(q);
          const salesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setSales(salesData);
          setShowSalesList(true); // Open the list when date changes
        } catch (error) {
          console.error('Error loading sales:', error);
          showError('Failed to load sales for selected date');
        }
      };
      loadSales();
    } else {
      setSales([]);
      setSelectedSales([]);
      setShowSalesList(false);
    }
  }, [selectedDate, requestType, showError]);

  const getTypeLabel = (type) => {
    const labels = {
      delete_sale: 'Delete Sale',
      edit_sale: 'Edit Sale',
      stock_in: 'Stock In',
      stock_out: 'Stock Out',
      transfer_product: 'Transfer Product',
      extra_cash: 'Extra Cash',
      other: 'Other'
    };
    return labels[type] || type;
  };

  const handleSaleSelection = (saleId) => {
    setSelectedSales(prev => {
      if (prev.includes(saleId)) {
        return prev.filter(id => id !== saleId);
      } else {
        return [...prev, saleId];
      }
    });
  };

  const calculateTotalUnits = (item) => {
    // If item already has a quantity field, use it (legacy support)
    if (item.quantity) return item.quantity;

    // Find the product to get bulk quantities
    const product = products.find(p => p.id === item.productId);
    if (!product) {
      // Fallback: just add quantities without conversion
      return (item.qtyBox || 0) + (item.qtyPack || 0) + (item.qtyLoose || 0);
    }

    // Calculate using conversion formula: Box×bigBulkQty + Pack×smallBulkQty + Loose
    const qtyBox = Number(item.qtyBox) || 0;
    const qtyPack = Number(item.qtyPack) || 0;
    const qtyLoose = Number(item.qtyLoose) || 0;
    const bigBulkQty = Number(product.bigBulkQty) || 1;
    const smallBulkQty = Number(product.smallBulkQty) || 1;
    
    return (qtyBox * bigBulkQty) + (qtyPack * smallBulkQty) + qtyLoose;
  };

  const resetChangesFields = () => {
    setSelectedDate('');
    setSales([]);
    setSelectedSales([]);
    setShowSalesList(false);
    setSupplierInput('');
    setProductFrom('');
    setProductTo('');
    setExtraCashAmount('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!description.trim()) {
      showError('Please provide a description of the issue.');
      return;
    }

    setLoading(true);

    try {
      // Build the changes object based on request type
      let changes = null;
      
      if ((requestType === 'edit_sale' || requestType === 'delete_sale') && selectedSales.length > 0) {
        changes = {
          date: selectedDate,
          saleIds: selectedSales
        };
      } else if ((requestType === 'stock_in' || requestType === 'stock_out') && supplierInput.trim()) {
        changes = {
          supplier: supplierInput.trim()
        };
      } else if (requestType === 'transfer_product' && productFrom.trim() && productTo.trim()) {
        changes = {
          fromProduct: productFrom.trim(),
          toProduct: productTo.trim()
        };
      } else if (requestType === 'extra_cash' && extraCashAmount) {
        changes = {
          amount: parseFloat(extraCashAmount)
        };
      }

      await createAdminRequest({
        type: requestType,
        changes,
        description: description.trim(),
        submittedBy: user.uid,
        submittedByEmail: user.email,
        status: 'pending'
      });

      await logActivity(
        'admin_request_created',
        user.email,
        `Request submitted: ${requestType} - ${description.substring(0, 50)}`,
        'action',
        { type: requestType, changes }
      );

      showSuccess('Request submitted successfully! Admin will be notified.');
      
      // Reset form
      setRequestType('edit_sale');
      setDescription('');
      resetChangesFields();
      setShowForm(false);

    } catch (error) {
      console.error('Error submitting request:', error);
      showError('Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Pending', class: 'status-pending' },
      completed: { text: 'Completed', class: 'status-completed' },
      rejected: { text: 'Rejected', class: 'status-rejected' }
    };
    const badge = badges[status] || badges.pending;
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="request-changes-page">
      <div className="page-header">
        <h1>Request Changes</h1>
        <p>Submit requests for data corrections or deletions to the admin</p>
      </div>

      <div className="request-actions">
        {!showForm ? (
          <button 
            onClick={() => setShowForm(true)} 
            className="btn-primary"
          >
            + New Request
          </button>
        ) : (
          <button 
            onClick={() => setShowForm(false)} 
            className="btn-secondary"
          >
            Cancel
          </button>
        )}
      </div>

      {showForm && (
        <div className="request-form-card">
          <h2>Submit New Request</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Request Type *</label>
              <select 
                value={requestType} 
                onChange={(e) => {
                  setRequestType(e.target.value);
                  resetChangesFields();
                }}
                required
              >
                <option value="edit_sale">Edit Sale</option>
                <option value="delete_sale">Delete Sale</option>
                <option value="stock_in">Stock In</option>
                <option value="stock_out">Stock Out</option>
                <option value="transfer_product">Transfer Product</option>
                <option value="extra_cash">Extra Cash</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Changes field - dynamic based on request type */}
            {(requestType === 'edit_sale' || requestType === 'delete_sale') && (
              <div className="form-group">
                <label>Changes (Optional)</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
                {sales.length > 0 && showSalesList && (
                  <>
                    <div className="sales-list-header">
                      <span className="selected-count">
                        {selectedSales.length} sale{selectedSales.length !== 1 ? 's' : ''} selected
                      </span>
                      <button
                        type="button"
                        className="btn-done"
                        onClick={() => setShowSalesList(false)}
                      >
                        Done
                      </button>
                    </div>
                    <div className="sales-list">
                      <p className="sales-hint">Select sales from {new Date(selectedDate).toLocaleDateString('en-MY')}:</p>
                      {sales.map(sale => {
                        const saleTime = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
                        const itemsText = (sale.items || []).map(item => 
                          `${item.name || 'Unknown'} ×${calculateTotalUnits(item)}`
                        ).join(', ');
                        return (
                          <label key={sale.id} className="sale-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedSales.includes(sale.id)}
                              onChange={() => handleSaleSelection(sale.id)}
                            />
                            <span className="sale-info">
                              <span className="sale-time">
                                {saleTime.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="sale-price">RM {(sale.total || 0).toFixed(2)}</span>
                              {sale.customerName && (
                                <span className="sale-customer">👤 {sale.customerName}</span>
                              )}
                              <span className="sale-items">{itemsText || 'No items'}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
                {sales.length > 0 && !showSalesList && selectedSales.length > 0 && (
                  <div className="sales-summary">
                    <span>{selectedSales.length} sale{selectedSales.length !== 1 ? 's' : ''} selected</span>
                    <button
                      type="button"
                      className="btn-edit"
                      onClick={() => setShowSalesList(true)}
                    >
                      Edit Selection
                    </button>
                  </div>
                )}
                <small>Select a date to see sales from that day</small>
              </div>
            )}

            {(requestType === 'stock_in' || requestType === 'stock_out') && (
              <div className="form-group autocomplete-group">
                <label>Changes (Optional)</label>
                <input
                  type="text"
                  value={supplierInput}
                  onChange={(e) => setSupplierInput(e.target.value)}
                  placeholder="Enter supplier name"
                />
                {filteredSuppliers.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {filteredSuppliers.map((supplier, idx) => (
                      <div
                        key={idx}
                        className="autocomplete-item"
                        onClick={() => {
                          setSupplierInput(supplier);
                          setFilteredSuppliers([]);
                        }}
                      >
                        {supplier}
                      </div>
                    ))}
                  </div>
                )}
                <small>Start typing to see supplier suggestions</small>
              </div>
            )}

            {requestType === 'transfer_product' && (
              <>
                <div className="form-group autocomplete-group">
                  <label>Changes - From Product (Optional)</label>
                  <input
                    type="text"
                    value={productFrom}
                    onChange={(e) => setProductFrom(e.target.value)}
                    placeholder="Enter product name to transfer from"
                  />
                  {filteredProductsFrom.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {filteredProductsFrom.map((product) => (
                        <div
                          key={product.id}
                          className="autocomplete-item"
                          onClick={() => {
                            setProductFrom(product.name);
                            setFilteredProductsFrom([]);
                          }}
                        >
                          {product.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group autocomplete-group">
                  <label>Changes - To Product (Optional)</label>
                  <input
                    type="text"
                    value={productTo}
                    onChange={(e) => setProductTo(e.target.value)}
                    placeholder="Enter product name to transfer to"
                  />
                  {filteredProductsTo.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {filteredProductsTo.map((product) => (
                        <div
                          key={product.id}
                          className="autocomplete-item"
                          onClick={() => {
                            setProductTo(product.name);
                            setFilteredProductsTo([]);
                          }}
                        >
                          {product.name}
                        </div>
                      ))}
                    </div>
                  )}
                  <small>Start typing to see product suggestions</small>
                </div>
              </>
            )}

            {requestType === 'extra_cash' && (
              <div className="form-group">
                <label>Changes - Amount (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={extraCashAmount}
                  onChange={(e) => setExtraCashAmount(e.target.value)}
                  placeholder="Enter amount (RM)"
                />
                <small>Enter the extra cash amount if known</small>
              </div>
            )}

            <div className="form-group">
              <label>Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe the issue or what needs to be changed..."
                rows="5"
                required
              />
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
              <button 
                type="button" 
                className="btn-back"
                onClick={() => navigate('/')}
              >
                Return to Dashboard
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="requests-section">
        <h2>My Requests (Pending)</h2>
        
        {requests.length === 0 ? (
          <div className="empty-state">
            <p>📋 No pending requests</p>
            <p className="empty-subtitle">All your requests have been reviewed or click "New Request" to submit</p>
          </div>
        ) : (
          <>
            <div className="requests-list">
              {requests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((request) => (
              <div key={request.id} className="request-card">
                <div className="request-header">
                  <div className="request-type">
                    <span className="type-badge">{getTypeLabel(request.type)}</span>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
                
                <div className="request-body">
                  {/* Display Changes field if present */}
                  {request.changes && (
                    <div className="request-changes">
                      <strong>Changes:</strong>
                      {request.changes.saleIds && (
                        <p>Selected {request.changes.saleIds.length} sale(s) from {new Date(request.changes.date).toLocaleDateString('en-MY')}</p>
                      )}
                      {request.changes.supplier && (
                        <p>Supplier: {request.changes.supplier}</p>
                      )}
                      {request.changes.fromProduct && request.changes.toProduct && (
                        <p>Transfer: {request.changes.fromProduct} → {request.changes.toProduct}</p>
                      )}
                      {request.changes.amount && (
                        <p>Amount: RM {request.changes.amount.toFixed(2)}</p>
                      )}
                    </div>
                  )}
                  
                  <p className="request-description"><strong>Description:</strong> {request.description}</p>
                  
                  {request.adminResponse && (
                    <div className="admin-response">
                      <strong>Admin Response:</strong>
                      <p>{request.adminResponse}</p>
                    </div>
                  )}
                </div>
                
                <div className="request-footer">
                  <span className="request-date">
                    Submitted: {formatDate(request.createdAt)}
                  </span>
                  {request.completedAt && (
                    <span className="request-date">
                      {request.status === 'completed' ? 'Completed' : 'Updated'}: {formatDate(request.completedAt)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            </div>
            
            {/* Pagination */}
            {requests.length > itemsPerPage && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {Math.ceil(requests.length / itemsPerPage)}
                </span>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(requests.length / itemsPerPage)))}
                  disabled={currentPage === Math.ceil(requests.length / itemsPerPage)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
        
        <div className="page-actions">
          <button 
            className="btn-back"
            onClick={() => navigate('/')}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestChanges;
