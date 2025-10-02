import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  serverTimestamp,
  runTransaction,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContextWrapper';
import { RequirePermission } from './RoleComponents';
import '../styles/Hutang.css';

function Hutang() {
  // State management
  const [creditSales, setCreditSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, overdue, recent
  const [sortBy, setSortBy] = useState('date'); // date, amount, customer
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [creditLimits] = useState({});
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { user } = useAuth();

  // Subscribe to credit sales (Hutang sales)
  useEffect(() => {
    const salesRef = collection(db, 'sales');
    // Start with a simpler query to avoid index issues
    const q = query(
      salesRef, 
      where('status', '==', 'Hutang')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sales = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort in memory instead of Firestore
      sales.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA; // desc order
      });
      
      setCreditSales(sales);
      
      // Extract unique customers
      const uniqueCustomers = [...new Set(sales.map(sale => sale.customerName))];
      setCustomers(uniqueCustomers.map(name => ({ name, creditUsed: 0, totalCredit: 0 })));
      
      setLoading(false);
    }, (error) => {
      console.error('Error loading credit sales:', error);
      setError('Failed to load credit sales. Please refresh the page.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Calculate statistics
  const calculateStats = () => {
    const totalOutstanding = creditSales.reduce((sum, sale) => sum + (sale.remaining || 0), 0);
    const totalCustomers = customers.length;
    const overdueCount = creditSales.filter(sale => {
      const saleDate = sale.createdAt?.toDate();
      const daysSince = saleDate ? Math.floor((new Date() - saleDate) / (1000 * 60 * 60 * 24)) : 0;
      return daysSince > 30 && sale.remaining > 0;
    }).length;

    return { totalOutstanding, totalCustomers, overdueCount };
  };

  // Filter and sort sales
  const getFilteredSales = () => {
    let filtered = creditSales.filter(sale => {
      const matchesSearch = sale.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           sale.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (filterStatus === 'overdue') {
        const saleDate = sale.createdAt?.toDate();
        const daysSince = saleDate ? Math.floor((new Date() - saleDate) / (1000 * 60 * 60 * 24)) : 0;
        return daysSince > 30 && sale.remaining > 0;
      } else if (filterStatus === 'recent') {
        const saleDate = sale.createdAt?.toDate();
        const daysSince = saleDate ? Math.floor((new Date() - saleDate) / (1000 * 60 * 60 * 24)) : 0;
        return daysSince <= 7;
      }
      
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return (b.remaining || 0) - (a.remaining || 0);
        case 'customer':
          return a.customerName.localeCompare(b.customerName);
        case 'date':
        default:
          return (b.createdAt?.toDate() || new Date()) - (a.createdAt?.toDate() || new Date());
      }
    });

    return filtered;
  };

  // Record payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedSale || !paymentAmount) return;

    setLoading(true);
    setError('');

    try {
      const amount = Number(paymentAmount);
      const remaining = selectedSale.remaining || 0;

      if (amount <= 0) {
        setError('Payment amount must be greater than 0');
        return;
      }

      if (amount > remaining) {
        setError('Payment amount cannot exceed remaining balance');
        return;
      }

      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', selectedSale.id);
        const saleDoc = await transaction.get(saleRef);
        
        if (!saleDoc.exists()) {
          throw new Error('Sale not found');
        }

        const currentData = saleDoc.data();
        const newRemaining = (currentData.remaining || 0) - amount;
        const newPaidAmount = (currentData.paidAmount || 0) + amount;
        const newStatus = newRemaining <= 0 ? 'Paid' : 'Hutang';

        // Update sale
        transaction.update(saleRef, {
          remaining: newRemaining,
          paidAmount: newPaidAmount,
          status: newStatus,
          updatedAt: serverTimestamp()
        });

        // Add payment record
        const paymentsRef = collection(db, 'sales', selectedSale.id, 'payments');
        transaction.set(doc(paymentsRef), {
          amount: amount,
          paymentMethod: paymentMethod,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });

        // Add to top-level payments collection for reporting
        const topPaymentsRef = collection(db, 'payments');
        transaction.set(doc(topPaymentsRef), {
          saleId: selectedSale.id,
          customerName: selectedSale.customerName,
          amount: amount,
          paymentMethod: paymentMethod,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
      });

      // Reset form
      setShowPaymentModal(false);
      setSelectedSale(null);
      setPaymentAmount('');
      setPaymentMethod('cash');
      
      console.log('Payment recorded successfully for customer:', selectedSale.customerName);
      
      // If payment history modal is open for this customer, refresh it
      if (showCustomerModal && selectedCustomer === selectedSale.customerName) {
        console.log('Refreshing payment history for open modal');
        await fetchPaymentHistory(selectedSale.customerName);
      }

    } catch (error) {
      console.error('Error recording payment:', error);
      setError('Failed to record payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get customer statistics
  const getCustomerStats = (customerName) => {
    const customerSales = creditSales.filter(sale => sale.customerName === customerName);
    const totalCredit = customerSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalRemaining = customerSales.reduce((sum, sale) => sum + (sale.remaining || 0), 0);
    const totalPaid = customerSales.reduce((sum, sale) => sum + (sale.paidAmount || 0), 0);
    
    return { totalCredit, totalRemaining, totalPaid, salesCount: customerSales.length };
  };



  // Fetch payment history for a customer
  const fetchPaymentHistory = async (customerName) => {
    setLoadingHistory(true);
    try {
      console.log('Fetching payment history for:', customerName);
      
      const paymentsRef = collection(db, 'payments');
      
      // First, let's check all payments to debug
      const allPaymentsQuery = query(paymentsRef);
      const allSnapshot = await getDocs(allPaymentsQuery);
      const allPayments = allSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('All payments in database:', allPayments);
      console.log('Looking for customerName:', customerName);
      
      // Now query for specific customer
      const q = query(
        paymentsRef,
        where('customerName', '==', customerName)
      );
      
      const snapshot = await getDocs(q);
      let payments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Found payments for customer:', payments);
      
      // Sort in memory by createdAt
      payments.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA; // Most recent first
      });
      
      setPaymentHistory(payments);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setPaymentHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle view payment history
  const handleViewHistory = async (customerName) => {
    setSelectedCustomer(customerName);
    setShowCustomerModal(true);
    await fetchPaymentHistory(customerName);
  };

  const stats = calculateStats();
  const filteredSales = getFilteredSales();

  if (loading && creditSales.length === 0) {
    return (
      <div className="hutang-container">
        <div className="loading-message">Loading credit sales...</div>
      </div>
    );
  }

  return (
    <div className="hutang-container">
      {/* Navigation Header */}
      <div className="nav-header">
        <Link to="/" className="nav-back-btn">
          ← Back to Dashboard
        </Link>
        <div className="nav-links">
          <Link to="/products" className="nav-link">Inventory</Link>
          <Link to="/sales" className="nav-link">Sales</Link>
          <Link to="/purchases" className="nav-link">Purchases</Link>
          <Link to="/hutang" className="nav-link active">Hutang</Link>
        </div>
      </div>

      {/* Header */}
      <div className="hutang-header">
        <h1>💳 Credit Management (Hutang)</h1>
        <div className="header-actions">
          <Link to="/sales" className="btn-primary">
            + Create Credit Sale
          </Link>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card outstanding">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>RM {stats.totalOutstanding.toFixed(2)}</h3>
            <p>Total Outstanding</p>
          </div>
        </div>
        <div className="stat-card customers">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{stats.totalCustomers}</h3>
            <p>Credit Customers</p>
          </div>
        </div>
        <div className="stat-card overdue">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>{stats.overdueCount}</h3>
            <p>Overdue Accounts</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="hutang-controls">
        <div className="search-filters">
          <input
            type="text"
            placeholder="Search by customer name or sale ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Credits</option>
            <option value="overdue">Overdue (30+ days)</option>
            <option value="recent">Recent (7 days)</option>
          </select>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="customer">Sort by Customer</option>
          </select>
        </div>
      </div>

      {/* Credit Sales List */}
      <div className="credit-sales-section">
        <h2>Credit Sales ({filteredSales.length})</h2>
        
        {filteredSales.length === 0 ? (
          <div className="no-credits">
            <p>No credit sales found matching your criteria.</p>
            <Link to="/sales" className="btn-secondary">Create First Credit Sale</Link>
          </div>
        ) : (
          <div className="credit-sales-list">
            {filteredSales.map(sale => {
              const saleDate = sale.createdAt?.toDate();
              const daysSince = saleDate ? Math.floor((new Date() - saleDate) / (1000 * 60 * 60 * 24)) : 0;
              const isOverdue = daysSince > 30 && sale.remaining > 0;
              
              return (
                <div key={sale.id} className={`credit-sale-card ${isOverdue ? 'overdue' : ''}`}>
                  <div className="sale-header">
                    <div className="sale-info">
                      <h3>{sale.customerName}</h3>
                      <span className="sale-id">#{sale.id.substring(0, 8)}</span>
                      {isOverdue && <span className="overdue-badge">Overdue</span>}
                    </div>
                    <div className="sale-date">
                      {saleDate?.toLocaleDateString()} ({daysSince} days ago)
                    </div>
                  </div>
                  
                  <div className="sale-amounts">
                    <div className="amount-row">
                      <span>Total:</span>
                      <span>RM {sale.total?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="amount-row">
                      <span>Paid:</span>
                      <span>RM {sale.paidAmount?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="amount-row remaining">
                      <span>Remaining:</span>
                      <span>RM {sale.remaining?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                  
                  <div className="sale-actions">
                    <RequirePermission module="hutang" action="edit">
                      <button
                        onClick={() => {
                          setSelectedSale(sale);
                          setShowPaymentModal(true);
                        }}
                        className="btn-record-payment"
                        disabled={!sale.remaining || sale.remaining <= 0}
                      >
                        Record Payment
                      </button>
                    </RequirePermission>
                    <button
                      onClick={() => handleViewHistory(sale.customerName)}
                      className="btn-view-history"
                    >
                      View History
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Customer Summary */}
      <div className="customers-section">
        <h2>Customer Summary</h2>
        <div className="customers-grid">
          {customers.map(customer => {
            const stats = getCustomerStats(customer.name);
            const creditLimit = creditLimits[customer.name] || 0;
            const isNearLimit = creditLimit > 0 && stats.totalRemaining > creditLimit * 0.8;
            
            return (
              <div key={customer.name} className={`customer-card ${isNearLimit ? 'near-limit' : ''}`}>
                <div className="customer-header">
                  <h3>{customer.name}</h3>
                  <div className="customer-actions">
                    <button
                      onClick={() => {
                        setSelectedCustomer(customer.name);
                        setShowCustomerModal(true);
                      }}
                      className="btn-set-limit"
                    >
                      Set Limit
                    </button>
                  </div>
                </div>
                <div className="customer-stats">
                  <div className="stat-row">
                    <span>Total Sales:</span>
                    <span>{stats.salesCount}</span>
                  </div>
                  <div className="stat-row">
                    <span>Total Credit:</span>
                    <span>RM {stats.totalCredit.toFixed(2)}</span>
                  </div>
                  <div className="stat-row">
                    <span>Outstanding:</span>
                    <span>RM {stats.totalRemaining.toFixed(2)}</span>
                  </div>
                  {creditLimit > 0 && (
                    <div className="stat-row">
                      <span>Credit Limit:</span>
                      <span>RM {creditLimit.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedSale && (
        <div className="modal-overlay">
          <div className="payment-modal">
            <div className="modal-header">
              <h3>Record Payment</h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="modal-close"
              >
                ✕
              </button>
            </div>
            
            <div className="payment-details">
              <p><strong>Customer:</strong> {selectedSale.customerName}</p>
              <p><strong>Sale ID:</strong> #{selectedSale.id.substring(0, 8)}</p>
              <p><strong>Remaining:</strong> RM {selectedSale.remaining?.toFixed(2) || '0.00'}</p>
            </div>
            
            <form onSubmit={handleRecordPayment} className="payment-form">
              <div className="form-group">
                <label>Payment Amount (RM):</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selectedSale.remaining || 0}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter payment amount"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Payment Method:</label>
                <select 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="online">Online Transfer</option>
                </select>
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <RequirePermission module="hutang" action="edit">
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Recording...' : 'Record Payment'}
                  </button>
                </RequirePermission>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {showCustomerModal && selectedCustomer && (
        <div className="modal-overlay">
          <div className="payment-history-modal">
            <div className="modal-header">
              <h3>💰 Payment History - {selectedCustomer}</h3>
              <button 
                onClick={() => setShowCustomerModal(false)}
                className="modal-close"
              >
                ✕
              </button>
            </div>
            
            <div className="customer-summary">
              <div className="summary-card">
                <h4>Customer Summary</h4>
                <p><strong>Current Outstanding:</strong> RM {getCustomerStats(selectedCustomer).totalRemaining.toFixed(2)}</p>
                <p><strong>Total Credit Sales:</strong> {getCustomerStats(selectedCustomer).totalSales}</p>
                <p><strong>Total Paid:</strong> RM {getCustomerStats(selectedCustomer).totalPaid.toFixed(2)}</p>
              </div>
            </div>

            <div className="payment-history-content">
              <div className="payment-history-header">
                <h4>Payment Records</h4>
                <div className="history-controls">
                  <button 
                    onClick={() => fetchPaymentHistory(selectedCustomer)}
                    className="btn-refresh-history"
                    disabled={loadingHistory}
                  >
                    {loadingHistory ? '🔄 Loading...' : '🔄 Refresh'}
                  </button>
                </div>
              </div>
              {loadingHistory ? (
                <div className="loading-payments">Loading payment history...</div>
              ) : paymentHistory.length > 0 ? (
                <div className="payments-list">
                  {paymentHistory.map(payment => (
                    <div key={payment.id} className="payment-record">
                      <div className="payment-date">
                        <strong>{payment.createdAt?.toDate ? 
                          payment.createdAt.toDate().toLocaleDateString() : 
                          'Unknown Date'
                        }</strong>
                        <span className="payment-time">
                          {payment.createdAt?.toDate ? 
                            payment.createdAt.toDate().toLocaleTimeString() : 
                            'Unknown Time'
                          }
                        </span>
                      </div>
                      <div className="payment-details">
                        <div className="payment-amount">
                          <span className="amount">RM {payment.amount?.toFixed(2) || '0.00'}</span>
                          <span className="method">via {payment.paymentMethod || 'Unknown'}</span>
                        </div>
                        <div className="payment-note">
                          {payment.saleId && (
                            <small>Sale ID: {payment.saleId}</small>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-payments">
                  <p>No payment records found for this customer.</p>
                  <small>Payments will appear here once the customer makes repayments on their credit sales.</small>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button 
                onClick={() => setShowCustomerModal(false)} 
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Hutang;
