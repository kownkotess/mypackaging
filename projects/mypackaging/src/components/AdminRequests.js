import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextWrapper';
import { useAlert } from '../context/AlertContext';
import { useNavigate } from 'react-router-dom';
import { subscribeAdminRequests, updateAdminRequest, subscribeProducts } from '../lib/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logActivity } from '../lib/auditLog';
import './AdminRequests.css';

const AdminRequests = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useAlert();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('pending'); // pending, completed, all
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [products, setProducts] = useState([]);
  const [salesDetails, setSalesDetails] = useState([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    const unsubscribe = subscribeAdminRequests((data) => {
      setRequests(data);
    });

    return () => unsubscribe();
  }, []);

  // Load products for calculating units
  useEffect(() => {
    const unsubscribe = subscribeProducts((productsData) => {
      setProducts(productsData);
    });
    return () => unsubscribe();
  }, []);

  // Fetch sale details when a request with saleIds is selected
  useEffect(() => {
    const fetchSalesDetails = async () => {
      if (selectedRequest?.changes?.saleIds) {
        try {
          const salesPromises = selectedRequest.changes.saleIds.map(saleId => 
            getDoc(doc(db, 'sales', saleId))
          );
          const salesDocs = await Promise.all(salesPromises);
          const salesData = salesDocs
            .filter(doc => doc.exists())
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
          setSalesDetails(salesData);
        } catch (error) {
          console.error('Error fetching sales details:', error);
        }
      } else {
        setSalesDetails([]);
      }
    };

    fetchSalesDetails();
  }, [selectedRequest]);

  const calculateTotalUnits = (item) => {
    if (item.quantity) return item.quantity;

    const product = products.find(p => p.id === item.productId);
    if (!product) {
      return (item.qtyBox || 0) + (item.qtyPack || 0) + (item.qtyLoose || 0);
    }

    const qtyBox = Number(item.qtyBox) || 0;
    const qtyPack = Number(item.qtyPack) || 0;
    const qtyLoose = Number(item.qtyLoose) || 0;
    const bigBulkQty = Number(product.bigBulkQty) || 1;
    const smallBulkQty = Number(product.smallBulkQty) || 1;
    
    return (qtyBox * bigBulkQty) + (qtyPack * smallBulkQty) + qtyLoose;
  };

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // Paginated requests
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  const handleUpdateStatus = async (requestId, newStatus) => {
    setLoading(true);
    try {
      await updateAdminRequest(requestId, {
        status: newStatus,
        adminResponse: adminResponse.trim() || null,
        completedAt: new Date(),
        completedBy: user.email
      });

      await logActivity(
        'admin_request_updated',
        user.email,
        `Request ${newStatus}: ${requestId.substring(0, 8)}`,
        'action',
        { requestId, status: newStatus }
      );

      showSuccess(`Request marked as ${newStatus}!`);
      setSelectedRequest(null);
      setAdminResponse('');
    } catch (error) {
      console.error('Error updating request:', error);
      showError('Failed to update request. Please try again.');
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

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="admin-requests-page">
      <div className="page-header">
        <h1>Admin Requests</h1>
        <p>Review and manage change requests from staff and managers</p>
      </div>

      <div className="filter-bar">
        <button 
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
        </button>
        <button 
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed
        </button>
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="empty-state">
          <p>📋 No {filter !== 'all' ? filter : ''} requests</p>
          <p className="empty-subtitle">
            {filter === 'pending' ? 'All caught up! No pending requests.' : 'No requests found.'}
          </p>
        </div>
      ) : (
        <>
          <div className="requests-list">
            {paginatedRequests.map((request) => (
            <div key={request.id} className="request-card">
              <div className="request-header">
                <div className="request-info">
                  <div className="request-meta">
                    <span className="type-badge">{getTypeLabel(request.type)}</span>
                  </div>
                  <span className="submitter">By: {request.submittedByEmail}</span>
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
                  <div className="admin-response-display">
                    <strong>Your Response:</strong>
                    <p>{request.adminResponse}</p>
                    {request.completedBy && (
                      <small>By {request.completedBy} on {formatDate(request.completedAt)}</small>
                    )}
                  </div>
                )}
              </div>
              
              <div className="request-footer">
                <span className="request-date">
                  Submitted: {formatDate(request.createdAt)}
                </span>
                
                {request.status === 'pending' && (
                  <div className="request-actions">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="btn-action"
                    >
                      Review
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
          
          {/* Pagination */}
          {filteredRequests.length > itemsPerPage && (
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Review Request</h2>
              <button 
                className="close-btn"
                onClick={() => setSelectedRequest(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="request-details">
                <div className="detail-row">
                  <strong>Type:</strong>
                  <span>{getTypeLabel(selectedRequest.type)}</span>
                </div>
                {selectedRequest.changes && (
                  <div className="detail-row">
                    <strong>Changes:</strong>
                    <div>
                      {selectedRequest.changes.saleIds && salesDetails.length > 0 && (
                        <div className="sales-details-list">
                          <p className="sales-count">{salesDetails.length} sale(s) from {new Date(selectedRequest.changes.date).toLocaleDateString('en-MY')}:</p>
                          {salesDetails.map(sale => {
                            const saleTime = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
                            const itemsText = (sale.items || []).map(item => 
                              `${item.name || 'Unknown'} ×${calculateTotalUnits(item)}`
                            ).join(', ');
                            return (
                              <div key={sale.id} className="sale-detail-item">
                                <div className="sale-detail-time">
                                  {saleTime.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="sale-detail-price">RM {(sale.total || 0).toFixed(2)}</div>
                                {sale.customerName && (
                                  <div className="sale-detail-customer">👤 {sale.customerName}</div>
                                )}
                                <div className="sale-detail-items">{itemsText || 'No items'}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {selectedRequest.changes.saleIds && salesDetails.length === 0 && (
                        <p>Selected {selectedRequest.changes.saleIds.length} sale(s) from {new Date(selectedRequest.changes.date).toLocaleDateString('en-MY')}</p>
                      )}
                      {selectedRequest.changes.supplier && (
                        <p>Supplier: {selectedRequest.changes.supplier}</p>
                      )}
                      {selectedRequest.changes.fromProduct && selectedRequest.changes.toProduct && (
                        <p>Transfer: {selectedRequest.changes.fromProduct} → {selectedRequest.changes.toProduct}</p>
                      )}
                      {selectedRequest.changes.amount && (
                        <p>Amount: RM {selectedRequest.changes.amount.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="detail-row">
                  <strong>Submitted by:</strong>
                  <span>{selectedRequest.submittedByEmail}</span>
                </div>
                <div className="detail-row">
                  <strong>Date:</strong>
                  <span>{formatDate(selectedRequest.createdAt)}</span>
                </div>
              </div>

              <div className="request-description-full">
                <strong>Description:</strong>
                <p>{selectedRequest.description}</p>
              </div>

              <div className="response-section">
                <label>Admin Response (Optional):</label>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Add a note or response..."
                  rows="4"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-reject"
                onClick={() => handleUpdateStatus(selectedRequest.id, 'rejected')}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Reject'}
              </button>
              <button
                className="btn-complete"
                onClick={() => handleUpdateStatus(selectedRequest.id, 'completed')}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Mark as Completed'}
              </button>
            </div>
          </div>
        </div>
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
  );
};

export default AdminRequests;
