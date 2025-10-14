import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { subscribeProducts, subscribePurchases, createPurchase, updatePurchase, subscribeReturns, createReturn, deleteReturn } from '../lib/firestore';
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
  const { user, userRole } = useAuth();
  const location = useLocation();
  
  // Tab management - Check URL query params for initial tab
  const getInitialTab = () => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') === 'returns' ? 'returns' : 'purchases';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab()); // 'purchases' or 'returns'
  
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

  // ===== RETURNS STATE (Task 1) =====
  const [returns, setReturns] = useState([]);
  const [returnProducts, setReturnProducts] = useState([]);
  const [returnSupplierName, setReturnSupplierName] = useState('');
  const [returnReferenceNumber, setReturnReferenceNumber] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showReturnDetailModal, setShowReturnDetailModal] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState(null);
  const [showReturnDeleteConfirmation, setShowReturnDeleteConfirmation] = useState(false);
  const [deletingReturn, setDeletingReturn] = useState(false);
  const [returnSearchTerm, setReturnSearchTerm] = useState('');
  const [returnSupplierSuggestions, setReturnSupplierSuggestions] = useState([]);
  const [showReturnSuggestions, setShowReturnSuggestions] = useState(false);

  // Subscribe to products, purchases, and returns
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

    const unsubscribeReturns = subscribeReturns((returnsData) => {
      setReturns(returnsData);
    });

    return () => {
      unsubscribeProducts();
      unsubscribePurchases();
      unsubscribeReturns();
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

  // ============================================
  // RETURNS HELPER FUNCTIONS
  // ============================================

  // Add product to return
  const addProductToReturn = (product) => {
    if (!returnProducts.find(p => p.id === product.id)) {
      setReturnProducts([...returnProducts, {
        id: product.id,
        name: product.name,
        qty: 1,
        currentStock: product.stockBalance || 0
      }]);
    }
  };

  // Remove product from return
  const removeProductFromReturn = (productId) => {
    setReturnProducts(returnProducts.filter(p => p.id !== productId));
  };

  // Update product in return
  const updateProductInReturn = (productId, field, value) => {
    setReturnProducts(returnProducts.map(product => {
      if (product.id === productId) {
        return { ...product, [field]: Number(value) || 0 };
      }
      return product;
    }));
  };

  // Handle supplier name input for returns
  const handleReturnSupplierNameChange = (value) => {
    setReturnSupplierName(value);
    
    if (value.trim().length > 0) {
      const filtered = uniqueSuppliers.filter(supplier =>
        supplier.toLowerCase().includes(value.toLowerCase())
      );
      setReturnSupplierSuggestions(filtered);
      setShowReturnSuggestions(filtered.length > 0);
    } else {
      setReturnSupplierSuggestions([]);
      setShowReturnSuggestions(false);
    }
  };

  // Select supplier for return
  const selectReturnSupplier = (supplierName) => {
    setReturnSupplierName(supplierName);
    setShowReturnSuggestions(false);
    setReturnSupplierSuggestions([]);
  };

  // Hide return suggestions
  const handleReturnSupplierBlur = () => {
    setTimeout(() => setShowReturnSuggestions(false), 150);
  };

  // Reset return form
  const resetReturnForm = () => {
    setReturnSupplierName('');
    setReturnReferenceNumber('');
    setReturnNotes('');
    setReturnDate('');
    setReturnProducts([]);
    setShowReturnForm(false);
    setReturnSearchTerm('');
    setError('');
    setShowReturnSuggestions(false);
    setReturnSupplierSuggestions([]);
  };

  // Handle return form submission
  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    setError('');

    // Check if online
    if (!navigator.onLine) {
      setError('⚠️ No internet connection. Please connect to the internet to create returns.');
      return;
    }

    if (!returnSupplierName.trim()) {
      setError('Please enter a supplier name.');
      return;
    }

    if (returnProducts.length === 0) {
      setError('Please add at least one product to the return.');
      return;
    }

    // Validate all products have valid quantities
    const invalidProducts = returnProducts.filter(p => 
      !p.qty || p.qty <= 0
    );

    if (invalidProducts.length > 0) {
      setError('All products must have valid quantities greater than 0.');
      return;
    }

    setLoading(true);

    try {
      const totalQty = returnProducts.reduce((sum, p) => sum + p.qty, 0);

      const returnData = {
        supplierName: returnSupplierName.trim(),
        referenceNumber: returnReferenceNumber.trim() || null,
        notes: returnNotes.trim(),
        customDate: returnDate || null,
        items: returnProducts.map(p => ({
          productId: p.id,
          name: p.name,
          qty: p.qty
        })),
        totalQty: totalQty,
        createdBy: user.uid,
        createdAt: new Date()
      };

      await createReturn(returnData);

      // Log the return activity
      await logActivity(
        'return_created',
        user.email || 'unknown_user',
        `Return created for supplier ${returnSupplierName.trim()} - ${totalQty} item(s)${returnReferenceNumber.trim() ? ` (Ref: ${returnReferenceNumber.trim()})` : ''}`,
        'action',
        {
          supplierName: returnSupplierName.trim(),
          referenceNumber: returnReferenceNumber.trim() || null,
          totalQty: totalQty,
          itemCount: returnProducts.length
        }
      );

      // Reset form
      resetReturnForm();
      
      // Show success message
      showSuccess(`Return created successfully! Supplier: ${returnSupplierName.trim()}, ${totalQty} item(s) returned`);

    } catch (error) {
      console.error('Error creating return:', error);
      showError(`Failed to create return: ${error.message || 'Please try again.'}`);
      setError(`Failed to create return: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle return detail view
  const handleViewReturnDetails = (returnItem) => {
    setSelectedReturn(returnItem);
    setShowReturnDetailModal(true);
  };

  // Handle delete return (admin only)
  const handleDeleteReturn = (returnItem) => {
    if (user?.email !== 'admin@mypackaging.com') {
      showError('Only admin@mypackaging.com can delete returns');
      return;
    }
    setReturnToDelete(returnItem);
    setShowReturnDeleteConfirmation(true);
  };

  // Confirm delete return with password verification
  const confirmDeleteReturn = async (e) => {
    e.preventDefault();
    if (!adminPassword) {
      showError('Please enter your password');
      return;
    }

    setDeletingReturn(true);
    try {
      // Verify admin password
      await signInWithEmailAndPassword(auth, 'admin@mypackaging.com', adminPassword);
      
      // Delete the return (this will also remove stock that was added back)
      await deleteReturn(returnToDelete.id);
      
      // Log the deletion activity
      await logActivity(
        'return_deleted',
        user.email,
        `Deleted return from ${returnToDelete.supplierName} worth RM ${returnToDelete.total?.toFixed(2) || '0.00'}. Return ID: ${returnToDelete.id.substring(0, 8)}. Reference: ${returnToDelete.referenceNumber || 'N/A'}`,
        'critical',
        {
          returnId: returnToDelete.id,
          supplierName: returnToDelete.supplierName,
          referenceNumber: returnToDelete.referenceNumber,
          total: returnToDelete.total,
          itemCount: returnToDelete.items?.length || 0
        }
      );
      
      showSuccess(`Return from ${returnToDelete.supplierName} has been deleted successfully. Stock has been adjusted.`);
      setShowReturnDeleteConfirmation(false);
      setAdminPassword('');
      setReturnToDelete(null);
      
    } catch (error) {
      console.error('Error deleting return:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        showError('Invalid password. Please try again.');
      } else {
        showError('Failed to delete return. Please try again.');
      }
    } finally {
      setDeletingReturn(false);
    }
  };

  // Filter products for return selection
  const filteredReturnProducts = products.filter(product =>
    product.name.toLowerCase().includes(returnSearchTerm.toLowerCase())
  );

  // ============================================
  // PURCHASE FORM SUBMISSION
  // ============================================

  // Handle form submission
  const handleSubmitPurchase = async (e) => {
    e.preventDefault();
    setError('');

    // Check if online
    if (!navigator.onLine) {
      setError('⚠️ No internet connection. Please connect to the internet to create purchases.');
      return;
    }

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
      
      // Update the selected purchase for the modal with new status and items
      setSelectedPurchase(prev => {
        if (!prev) return null;
        const updates = { ...prev, status: newStatus };
        if (updatedItems) {
          updates.items = updatedItems;
        }
        return updates;
      });
      
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
      
      // CRITICAL: If purchase was received, revert stock before deleting
      if ((purchaseToDelete.status === '✅ Received' || purchaseToDelete.status === '📦❗ Received Partial') 
          && purchaseToDelete.items && purchaseToDelete.items.length > 0) {
        
        // First change status to remove stock (this will trigger stock reversion)
        await updatePurchase(purchaseToDelete.id, { status: '❌ Cancelled' });
        
        // Log stock reversion
        await logActivity(
          'purchase_stock_reverted',
          user.email,
          `Stock reverted before deleting purchase from ${purchaseToDelete.supplierName}. Status was: ${purchaseToDelete.status}`,
          'action',
          {
            purchaseId: purchaseToDelete.id,
            supplierName: purchaseToDelete.supplierName,
            previousStatus: purchaseToDelete.status,
            itemCount: purchaseToDelete.items.length
          }
        );
      }
      
      // Delete the purchase from Firestore
      await deleteDoc(doc(db, 'purchases', purchaseToDelete.id));
      
      // Log the deletion activity
      await logActivity(
        'purchase_deleted',
        user.email,
        `Deleted purchase from ${purchaseToDelete.supplierName} worth RM ${purchaseToDelete.total?.toFixed(2) || '0.00'}. Purchase ID: ${purchaseToDelete.id.substring(0, 8)}. Previous status: ${purchaseToDelete.status}`,
        'critical',
        {
          purchaseId: purchaseToDelete.id,
          supplierName: purchaseToDelete.supplierName,
          status: purchaseToDelete.status,
          total: purchaseToDelete.total,
          itemCount: purchaseToDelete.items?.length || 0
        }
      );
      
      showSuccess(`Purchase from ${purchaseToDelete.supplierName} has been deleted successfully. Stock has been adjusted if needed.`);
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
          <Link to="/purchases" className="nav-link active">Purchases & Returns</Link>
        </div>
      </div>

      <div className="purchases-header">
        <h1>Purchases & Returns Management</h1>
        <RequirePermission module="purchases" action="create">
          <button 
            className="btn-primary"
            onClick={() => activeTab === 'purchases' ? setShowForm(!showForm) : setShowReturnForm(!showReturnForm)}
            disabled={loading}
          >
            {(activeTab === 'purchases' && showForm) || (activeTab === 'returns' && showReturnForm) 
              ? 'Cancel' 
              : activeTab === 'purchases' ? '+ New Purchase' : '+ New Return'}
          </button>
        </RequirePermission>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'purchases' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchases')}
        >
          📦 Purchases
        </button>
        <button 
          className={`tab-btn ${activeTab === 'returns' ? 'active' : ''}`}
          onClick={() => setActiveTab('returns')}
        >
          ↩️ Returns
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* ============================================ */}
      {/* PURCHASES TAB CONTENT */}
      {/* ============================================ */}
      {activeTab === 'purchases' && (
        <>
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
        </>
      )}

      {/* ============================================ */}
      {/* RETURNS TAB CONTENT - Admin and Manager Only */}
      {/* ============================================ */}
      {activeTab === 'returns' && (userRole === 'admin' || userRole === 'manager') && (
        <>
          {showReturnForm && (
            <div className="purchase-form-container">
              <h2>Create New Return</h2>
              
              <form onSubmit={handleSubmitReturn} className="purchase-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Supplier Name:</label>
                    <div className="supplier-input-container">
                      <input
                        type="text"
                        value={returnSupplierName}
                        onChange={(e) => handleReturnSupplierNameChange(e.target.value)}
                        onBlur={handleReturnSupplierBlur}
                        onFocus={() => {
                          if (returnSupplierName.trim().length > 0 && returnSupplierSuggestions.length > 0) {
                            setShowReturnSuggestions(true);
                          }
                        }}
                        placeholder="Enter supplier name"
                        required
                        autoComplete="off"
                      />
                      {showReturnSuggestions && returnSupplierSuggestions.length > 0 && (
                        <div className="supplier-suggestions">
                          {returnSupplierSuggestions.map((supplier, index) => (
                            <div
                              key={index}
                              className="supplier-suggestion-item"
                              onClick={() => selectReturnSupplier(supplier)}
                            >
                              {supplier}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Reference Number (Optional):</label>
                    <input
                      type="text"
                      value={returnReferenceNumber}
                      onChange={(e) => setReturnReferenceNumber(e.target.value)}
                      placeholder="Enter return reference/tracking number"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Return Date (Optional):</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    placeholder="Leave empty for current date"
                  />
                  <small className="form-help">Leave empty to use current date</small>
                </div>

                <div className="form-group">
                  <label>Notes (Optional):</label>
                  <textarea
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Add any notes about this return (reason, condition, etc.)..."
                    rows={3}
                  />
                </div>

                {/* Product Selection */}
                <div className="product-selection-section">
                  <h3>Add Products to Return</h3>
                  <div className="search-container">
                    <input
                      type="text"
                      value={returnSearchTerm}
                      onChange={(e) => setReturnSearchTerm(e.target.value)}
                      placeholder="Search products to return..."
                      className="search-input"
                    />
                  </div>

                  {returnSearchTerm && (
                    <div className="product-search-results">
                      {filteredReturnProducts.slice(0, 5).map(product => (
                        <div key={product.id} className="product-search-item">
                          <div className="product-info">
                            <span className="product-name">{product.name}</span>
                            <span className="product-stock">Stock: {product.stockBalance || 0}</span>
                            <span className="product-price">RM {product.unitPrice?.toFixed(2) || '0.00'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => addProductToReturn(product)}
                            className="btn-add-product"
                            disabled={returnProducts.find(p => p.id === product.id)}
                          >
                            {returnProducts.find(p => p.id === product.id) ? 'Added' : 'Add'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Products */}
                {returnProducts.length > 0 && (
                  <div className="selected-products-section">
                    <h3>Return Items</h3>
                    <div className="selected-products-list">
                      {returnProducts.map(product => (
                        <div key={product.id} className="selected-product-item">
                          <div className="product-details">
                            <span className="product-name">{product.name}</span>
                            <span className="current-stock">Current Stock: {product.currentStock}</span>
                          </div>
                          <div className="product-inputs">
                            <div className="input-group">
                              <label>Quantity to Return:</label>
                              <input
                                type="number"
                                min="1"
                                value={product.qty}
                                onChange={(e) => updateProductInReturn(product.id, 'qty', e.target.value)}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProductFromReturn(product.id)}
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
                        <div className="total-line"><strong>Total Items: {returnProducts.reduce((sum, p) => sum + p.qty, 0)}</strong></div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-actions">
                  <button type="button" onClick={resetReturnForm} className="btn-secondary">
                    Cancel
                  </button>
                  <RequirePermission module="purchases" action="create">
                    <button 
                      type="submit" 
                      className="btn-primary"
                      disabled={loading || returnProducts.length === 0}
                    >
                      {loading ? 'Creating Return...' : 'Create Return'}
                    </button>
                  </RequirePermission>
                </div>
              </form>
            </div>
          )}

          {/* Returns History */}
          <div className="purchase-history-section">
            <div className="history-header">
              <h2>Returns History</h2>
            </div>
            {returns.length === 0 ? (
              <div className="no-purchases">
                <p>No returns found. Create your first return to get started!</p>
              </div>
            ) : (
              <div className="purchases-list">
                {returns.map(returnItem => (
                  <div key={returnItem.id} className="purchase-item">
                    <div className="purchase-header">
                      <h3>{returnItem.supplierName}</h3>
                      <span className="purchase-status return-status">↩️ Returned</span>
                    </div>
                    <div className="purchase-info">
                      <p>Date: {returnItem.createdAt?.toDate().toLocaleDateString()}</p>
                      {returnItem.referenceNumber && (
                        <p>Reference: {returnItem.referenceNumber}</p>
                      )}
                      <p>Items: {returnItem.items?.length || 0}</p>
                      <p>Total Qty: {returnItem.totalQty || returnItem.items?.reduce((sum, item) => sum + item.qty, 0) || 0}</p>
                      {returnItem.notes && <p>Notes: {returnItem.notes}</p>}
                    </div>
                    <div className="purchase-actions">
                      <button
                        onClick={() => handleViewReturnDetails(returnItem)}
                        className="btn-view-details"
                      >
                        View Details
                      </button>
                      {user?.email === 'admin@mypackaging.com' && (
                        <button
                          onClick={() => handleDeleteReturn(returnItem)}
                          className="btn-delete-purchase"
                          title="Delete Return (Admin Only)"
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

          {/* Return to Top Button */}
          <ReturnToTop />

          {/* Return Detail Modal */}
          {showReturnDetailModal && selectedReturn && (
            <div className="modal-overlay" onClick={() => setShowReturnDetailModal(false)}>
              <div className="modal-content purchase-detail-modal return-detail-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>↩️ Return Order Details</h2>
                  <button className="modal-close" onClick={() => setShowReturnDetailModal(false)}>×</button>
                </div>
                <div className="modal-body">
                  <div className="purchase-summary">
                    <div className="info-row">
                      <span className="label">Supplier:</span>
                      <span className="value">{selectedReturn.supplierName}</span>
                    </div>
                    {selectedReturn.referenceNumber && (
                      <div className="info-row">
                        <span className="label">Reference Number:</span>
                        <span className="value">{selectedReturn.referenceNumber}</span>
                      </div>
                    )}
                    <div className="info-row">
                      <span className="label">Date Created:</span>
                      <span className="value">{selectedReturn.createdAt?.toDate().toLocaleDateString()}</span>
                    </div>
                    {selectedReturn.notes && (
                      <div className="info-row">
                        <span className="label">Notes:</span>
                        <span className="value">{selectedReturn.notes}</span>
                      </div>
                    )}
                  </div>

                  <div className="items-section">
                    <h3>Items Returned</h3>
                    <div className="items-list">
                      {selectedReturn.items?.map((item, index) => (
                        <div key={index} className="item-row">
                          <div className="item-info">
                            <span className="item-name">{item.name}</span>
                            <div className="item-quantities">
                              <span className="item-qty">Quantity Returned: {item.qty}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="totals-section">
                    <div className="total-row final-total">
                      <span>Total Quantity Returned:</span>
                      <span>{selectedReturn.totalQty || selectedReturn.items?.reduce((sum, item) => sum + item.qty, 0) || 0}</span>
                    </div>
                  </div>

                  <div className="status-info return-info">
                    <p>↩️ These items have been returned to the supplier and stock has been adjusted accordingly.</p>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowReturnDetailModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Return Confirmation Modal */}
          {showReturnDeleteConfirmation && returnToDelete && (
            <div className="modal-overlay" onClick={() => setShowReturnDeleteConfirmation(false)}>
              <div className="modal-content delete-confirmation-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>⚠️ Delete Return</h3>
                  <button className="close-btn" onClick={() => setShowReturnDeleteConfirmation(false)}>×</button>
                </div>
                <div className="modal-body">
                  <div className="warning-message">
                    <p><strong>⚠️ WARNING:</strong> This action will permanently delete the return and remove the stock that was added back.</p>
                    <p><strong>Return Details:</strong></p>
                    <ul>
                      <li>Supplier: {returnToDelete.supplierName}</li>
                      <li>Total: RM {returnToDelete.total?.toFixed(2) || '0.00'}</li>
                      <li>Date: {returnToDelete.createdAt?.toDate().toLocaleDateString()}</li>
                      <li>Items: {returnToDelete.items?.length || 0}</li>
                      {returnToDelete.referenceNumber && (
                        <li>Reference: {returnToDelete.referenceNumber}</li>
                      )}
                    </ul>
                    <p>Please enter your admin password to confirm:</p>
                  </div>
                  <form onSubmit={confirmDeleteReturn} className="delete-form">
                    <div className="form-group">
                      <label htmlFor="adminPasswordReturn">Admin Password:</label>
                      <input
                        type="password"
                        id="adminPasswordReturn"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        autoComplete="current-password"
                        disabled={deletingReturn}
                      />
                    </div>
                    <div className="form-actions">
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowReturnDeleteConfirmation(false);
                          setAdminPassword('');
                          setReturnToDelete(null);
                        }}
                        disabled={deletingReturn}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-danger"
                        disabled={deletingReturn}
                      >
                        {deletingReturn ? 'Deleting...' : 'Delete Return'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Purchases;
