import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextWrapper';
import { useAlert } from '../context/AlertContext';
import { subscribeUserRequests, createAdminRequest } from '../lib/firestore';
import { logActivity } from '../lib/auditLog';
import './RequestChanges.css';

const RequestChanges = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useAlert();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [requestType, setRequestType] = useState('delete_sale');
  const [saleId, setSaleId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeUserRequests(user.uid, (data) => {
      setRequests(data);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!description.trim()) {
      showError('Please provide a description of the issue.');
      return;
    }

    setLoading(true);

    try {
      await createAdminRequest({
        type: requestType,
        saleId: saleId.trim() || null,
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
        { type: requestType, saleId: saleId.trim() }
      );

      showSuccess('Request submitted successfully! Admin will be notified.');
      
      // Reset form
      setRequestType('delete_sale');
      setSaleId('');
      setDescription('');
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

  const getTypeLabel = (type) => {
    const labels = {
      delete_sale: 'Delete Sale',
      edit_sale: 'Edit Sale',
      other: 'Other Issue'
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
                onChange={(e) => setRequestType(e.target.value)}
                required
              >
                <option value="delete_sale">Delete Sale</option>
                <option value="edit_sale">Edit Sale</option>
                <option value="other">Other Issue</option>
              </select>
            </div>

            {(requestType === 'delete_sale' || requestType === 'edit_sale') && (
              <div className="form-group">
                <label>Sale ID (Optional)</label>
                <input
                  type="text"
                  value={saleId}
                  onChange={(e) => setSaleId(e.target.value)}
                  placeholder="Enter sale ID if known"
                />
                <small>You can find the Sale ID in Reports → Sales Recorded</small>
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
            </div>
          </form>
        </div>
      )}

      <div className="requests-section">
        <h2>My Requests</h2>
        
        {requests.length === 0 ? (
          <div className="empty-state">
            <p>📋 No requests submitted yet</p>
            <p className="empty-subtitle">Click "New Request" to submit your first request</p>
          </div>
        ) : (
          <div className="requests-list">
            {requests.map((request) => (
              <div key={request.id} className="request-card">
                <div className="request-header">
                  <div className="request-type">
                    <span className="type-badge">{getTypeLabel(request.type)}</span>
                    {request.saleId && (
                      <span className="sale-id">Sale: {request.saleId.substring(0, 8)}...</span>
                    )}
                  </div>
                  {getStatusBadge(request.status)}
                </div>
                
                <div className="request-body">
                  <p className="request-description">{request.description}</p>
                  
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
        )}
      </div>
    </div>
  );
};

export default RequestChanges;
