import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, createSale, getUniqueCustomerNames } from '../lib/firestore';
import { useAuth } from '../context/AuthContextWrapper';
import { useAlert } from '../context/AlertContext';
import { RequirePermission } from './RoleComponents';
import receiptService from '../services/receiptService';
import ReceiptModal from './ReceiptModal';
import BarcodeScanner from './BarcodeScanner';
import { logActivity } from '../lib/auditLog';
import { parseProductQRCode, isProductQRCode } from '../utils/qrCodeGenerator';
import './Sales.css';
import { centsToAmount } from '../lib/money';

const Sales = () => {
  const { user } = useAuth();
  const { showSuccess } = useAlert();
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [deduction, setDeduction] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('none'); // 'none', 'deduction', 'roundoff'
  const [saleDate, setSaleDate] = useState(''); // Optional date for backdating
  const [saleTime, setSaleTime] = useState(''); // Optional time for backdating
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scanningMessage, setScanningMessage] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [allCustomerNames, setAllCustomerNames] = useState([]);
  
  // Multi-payment support
  const [enableMultiPayment, setEnableMultiPayment] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState({ cash: false, online: false, hutang: false });
  const [paymentAmounts, setPaymentAmounts] = useState({ cash: '', online: '', hutang: '' });

  useEffect(() => {
    loadCustomerNames();
  }, []);

  const loadProducts = async (searchQuery = '') => {
    // Only load products if there's a search query
    if (!searchQuery || searchQuery.trim().length === 0) {
      setProducts([]);
      return;
    }

    try {
      setLoading(true);
      const productsData = await getProducts();
      // Sort products alphabetically by name
      const sortedProducts = productsData.sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setProducts(sortedProducts);
      setLoading(false);
    } catch (error) {
      console.error('Error loading products:', error);
      setError('Failed to load products. Please try again.');
      setLoading(false);
    }
  };

  const loadCustomerNames = async () => {
    try {
      const names = await getUniqueCustomerNames();
      setAllCustomerNames(names);
    } catch (error) {
      console.error('Error loading customer names:', error);
    }
  };

  const handleCustomerNameChange = (value) => {
    setCustomerName(value);
    
    if (value.trim().length > 0) {
      const filtered = allCustomerNames.filter(name =>
        name.toLowerCase().includes(value.toLowerCase())
      );
      setCustomerSuggestions(filtered);
      setShowCustomerSuggestions(filtered.length > 0);
    } else {
      setCustomerSuggestions([]);
      setShowCustomerSuggestions(false);
    }
  };

  const selectCustomerName = (name) => {
    setCustomerName(name);
    setShowCustomerSuggestions(false);
    setCustomerSuggestions([]);
  };

  const handleCustomerBlur = () => {
    // Delay hiding to allow click on suggestion
    setTimeout(() => setShowCustomerSuggestions(false), 150);
  };

  const addProductToSale = (product) => {
    const existingItem = selectedProducts.find(item => item.productId === product.id);
    
    if (existingItem) {
      setError(`${product.name} is already in the cart. Please modify quantities instead of adding again.`);
      return;
    }

    const newItem = {
      productId: product.id,
      name: product.name,
      unitPrice: product.unitPrice,
      boxPrice: product.boxPrice || null,
      packPrice: product.packPrice || null,
      bigBulkQty: product.bigBulkQty || 1,
      smallBulkQty: product.smallBulkQty || 1,
      qtyBox: '', // Empty by default, no default 0
      qtyPack: '', // Empty by default, no default 0
      qtyLoose: '', // Empty by default, no default 0
      discountBoxPrice: '',
      discountPackPrice: '',
      discountUnitPrice: '',
      subtotal: 0
    };

    setSelectedProducts([...selectedProducts, newItem]);
    setError('');
  };

  // Barcode scanning functions
  const handleBarcodeScanned = async (barcode) => {
    setScanningMessage(`Scanned: ${barcode}`);
    
    // Need to fetch all products for barcode scanning
    let allProducts = products;
    if (allProducts.length === 0) {
      try {
        setLoading(true);
        allProducts = await getProducts();
        setProducts(allProducts);
        setLoading(false);
      } catch (error) {
        console.error('Error loading products for scanning:', error);
        setScanningMessage(`❌ Error loading products`);
        setTimeout(() => setScanningMessage(''), 5000);
        setLoading(false);
        return;
      }
    }
    
    let foundProduct = null;
    
    // Check if it's our product QR code format
    if (isProductQRCode(barcode)) {
      try {
        const productId = parseProductQRCode(barcode);
        foundProduct = allProducts.find(product => product.id === productId);
        
        if (foundProduct) {
          console.log('Found product via QR code:', foundProduct.name);
        }
      } catch (error) {
        console.error('Error parsing QR code:', error);
        setScanningMessage(`❌ Invalid QR code format`);
        setTimeout(() => setScanningMessage(''), 5000);
        return;
      }
    } else {
      // Look for product by traditional barcode, SKU, or ID
      foundProduct = allProducts.find(product => 
        product.barcode === barcode || 
        product.sku === barcode ||
        product.id === barcode
      );
    }

    if (foundProduct) {
      addProductToSale(foundProduct);
      setScanningMessage(`✅ Added: ${foundProduct.name}`);
      setShowBarcodeScanner(false);
      
      // Clear message after 3 seconds
      setTimeout(() => setScanningMessage(''), 3000);
    } else {
      const codeType = isProductQRCode(barcode) ? 'QR code' : 'barcode';
      setScanningMessage(`❌ Product not found for ${codeType}: ${barcode}`);
      
      // Clear message after 5 seconds
      setTimeout(() => setScanningMessage(''), 5000);
    }
  };

  const openBarcodeScanner = () => {
    setError('');
    setScanningMessage('');
    setShowBarcodeScanner(true);
  };

  const closeBarcodeScanner = () => {
    setShowBarcodeScanner(false);
    setScanningMessage('');
  };

  const updateProductQuantity = (index, field, value) => {
    const updatedProducts = [...selectedProducts];
    // Allow empty string, otherwise ensure non-negative number
    updatedProducts[index][field] = value === '' ? '' : Math.max(0, Number(value) || 0);
    
    // Calculate subtotal using different pricing logic
    const item = updatedProducts[index];
    let subtotal = 0;
    
    // Calculate box subtotal (use discount price if available, then boxPrice, otherwise unit price)
    if (item.qtyBox > 0) {
      const boxPrice = item.discountBoxPrice ? 
        Number(item.discountBoxPrice) : 
        (item.boxPrice || (item.unitPrice * item.bigBulkQty));
      subtotal += item.qtyBox * boxPrice;
    }
    
    // Calculate pack subtotal (use discount price if available, then packPrice, otherwise unit price)
    if (item.qtyPack > 0) {
      const packPrice = item.discountPackPrice ? 
        Number(item.discountPackPrice) : 
        (item.packPrice || (item.unitPrice * item.smallBulkQty));
      subtotal += item.qtyPack * packPrice;
    }
    
    // Calculate loose units subtotal (use discount price if available, otherwise unit price)
    if (item.qtyLoose > 0) {
      const unitPrice = item.discountUnitPrice ? 
        Number(item.discountUnitPrice) : 
        item.unitPrice;
      subtotal += item.qtyLoose * unitPrice;
    }
    
    item.subtotal = subtotal;
    setSelectedProducts(updatedProducts);
  };

  const updateDiscountPrice = (index, field, value) => {
    const updatedProducts = [...selectedProducts];
    updatedProducts[index][field] = value;
    
    // Recalculate subtotal with new discount price
    const item = updatedProducts[index];
    let subtotal = 0;
    
    // Calculate box subtotal (use discount price if available, then boxPrice, otherwise unit price)
    if (item.qtyBox > 0) {
      const boxPrice = item.discountBoxPrice ? 
        Number(item.discountBoxPrice) : 
        (item.boxPrice || (item.unitPrice * item.bigBulkQty));
      subtotal += item.qtyBox * boxPrice;
    }
    
    // Calculate pack subtotal (use discount price if available, then packPrice, otherwise unit price)
    if (item.qtyPack > 0) {
      const packPrice = item.discountPackPrice ? 
        Number(item.discountPackPrice) : 
        (item.packPrice || (item.unitPrice * item.smallBulkQty));
      subtotal += item.qtyPack * packPrice;
    }
    
    // Calculate loose units subtotal (use discount price if available, otherwise unit price)
    if (item.qtyLoose > 0) {
      const unitPrice = item.discountUnitPrice ? 
        Number(item.discountUnitPrice) : 
        item.unitPrice;
      subtotal += item.qtyLoose * unitPrice;
    }
    
    item.subtotal = subtotal;
    setSelectedProducts(updatedProducts);
  };

  const removeProductFromSale = (index) => {
    const updatedProducts = selectedProducts.filter((_, i) => i !== index);
    setSelectedProducts(updatedProducts);
  };

  const calculateSubtotal = () => {
    // Use cents to sum subtotals to avoid floating point errors
    const subtotalCents = selectedProducts.reduce((sum, item) => {
      return sum + Math.round((Number(item.subtotal) || 0) * 100);
    }, 0);
    return centsToAmount(subtotalCents);
  };

  const calculateTotal = () => {
    const subtotalCents = Math.round(calculateSubtotal() * 100);
    const adjustmentCents = Math.round((Number(deduction) || 0) * 100);
    
    if (adjustmentType === 'deduction') {
      // Discount: subtract from subtotal
      return centsToAmount(subtotalCents - adjustmentCents);
    } else if (adjustmentType === 'roundoff') {
      // Round off: add to subtotal
      return centsToAmount(subtotalCents + adjustmentCents);
    }
    
    // No adjustment
    return centsToAmount(subtotalCents);
  };

  const calculateRemaining = () => {
    const totalCents = Math.round(calculateTotal() * 100);
    let paidCents = 0;

    if (enableMultiPayment) {
      paidCents = Math.round((Number(paymentAmounts.cash) || 0) * 100) +
                   Math.round((Number(paymentAmounts.online) || 0) * 100) +
                   Math.round((Number(paymentAmounts.hutang) || 0) * 100);
    } else {
      paidCents = Math.round((Number(paidAmount) || 0) * 100);
    }

    const remainingCents = Math.max(0, totalCents - paidCents);
    return centsToAmount(remainingCents);
  };

  // Effect to automatically set payment method to hutang when needed
  React.useEffect(() => {
    const subtotal = selectedProducts.reduce((sum, product) => {
      const qty = Number(product.qty) || 0;
      const price = Number(product.price) || 0;
      return sum + (qty * price);
    }, 0);
    
    const deductionAmount = Number(deduction) || 0;
    const total = subtotal - deductionAmount;
    const paid = Number(paidAmount) || 0;
    const remaining = Math.max(0, total - paid);
    
    if (remaining > 0 && paymentMethod !== 'hutang') {
      setPaymentMethod('hutang');
    }
  }, [paidAmount, selectedProducts, deduction, paymentMethod]);

  const handleSubmitSale = async (e) => {
    // Prepare sale date and time
    let customDate = null;
    if (saleDate) {
      if (saleTime) {
        // Combine date and time
        const [year, month, day] = saleDate.split('-');
        const [hour = '08', minute = '00'] = saleTime.split(':');
        customDate = new Date(year, month - 1, day, hour, minute);
      } else {
        // Use date, default to 08:00
        const [year, month, day] = saleDate.split('-');
        customDate = new Date(year, month - 1, day, 8, 0);
      }
    } else {
      customDate = new Date();
    }
    e.preventDefault();
    
    if (selectedProducts.length === 0) {
      setError('Please add at least one product to the sale.');
      return;
    }

    const total = calculateTotal();
    const remaining = calculateRemaining();

    // Customer name validation for credit sales
    if (remaining > 0 && !customerName.trim()) {
      setError('Customer name is required for credit sales (when paid amount is less than total).');
      return;
    }

    // For single payment mode, ensure payment method is hutang for credit sales
    if (!enableMultiPayment && remaining > 0 && paymentMethod !== 'hutang') {
      setError('Payment method must be "Hutang (Credit)" when paid amount is less than total.');
      return;
    }
    
    // For multi-payment mode, ensure hutang is selected if there's remaining
    if (enableMultiPayment && remaining > 0 && !paymentMethods.hutang) {
      setError('Please select "Hutang (Credit)" payment method when paid amount is less than total.');
      return;
    }

    // Validate stock availability and quantities
    for (const item of selectedProducts) {
      const product = products.find(p => p.id === item.productId);
      const qtyBox = Number(item.qtyBox) || 0;
      const qtyPack = Number(item.qtyPack) || 0;
      const qtyLoose = Number(item.qtyLoose) || 0;
      const requiredUnits = (qtyBox * item.bigBulkQty) + 
                           (qtyPack * item.smallBulkQty) + 
                           qtyLoose;
      
      // Ensure at least one quantity is entered
      if (requiredUnits === 0) {
        setError(`Please enter a quantity for ${item.name}.`);
        return;
      }
      
      if (requiredUnits > product.stockBalance) {
        setError(`Insufficient stock for ${item.name}. Available: ${product.stockBalance} units, Required: ${requiredUnits} units`);
        return;
      }
    }

    // Check if online before creating sale
    if (!navigator.onLine) {
      setError('⚠️ No internet connection. Please connect to the internet to create sales. You may write this sale on paper and enter it later when online.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const subtotal = calculateSubtotal();
      
      // Calculate payment breakdown
      let paid, cashTotal, onlineTotal, hutangTotal, paymentTypeLabel;
      
      if (enableMultiPayment) {
        // Multi-payment mode (use cents for accuracy)
        const cashTotalCents = Math.round((Number(paymentAmounts.cash) || 0) * 100);
        const onlineTotalCents = Math.round((Number(paymentAmounts.online) || 0) * 100);
        const hutangTotalCents = Math.round((Number(paymentAmounts.hutang) || 0) * 100);
        
        // paidAmount = only cash + online (actual money received now)
        // hutangTotal = credit taken (NOT counted as paid)
        const paidCents = cashTotalCents + onlineTotalCents;

        cashTotal = centsToAmount(cashTotalCents);
        onlineTotal = centsToAmount(onlineTotalCents);
        hutangTotal = centsToAmount(hutangTotalCents);
        paid = centsToAmount(paidCents);

        // Build payment type label based on which payment method checkboxes were SELECTED
        // This shows the payment methods used in the sale, even if some amounts are 0
        const selectedMethods = [];
        if (paymentMethods.cash) selectedMethods.push('cash');
        if (paymentMethods.online) selectedMethods.push('online');
        if (paymentMethods.hutang) selectedMethods.push('hutang');
        paymentTypeLabel = selectedMethods.join(' + ') || 'cash'; // Default to 'cash' if nothing selected
      } else {
        // Single payment mode
        const paidCents = Math.round((Number(paidAmount) || 0) * 100);
        paid = centsToAmount(paidCents);
        
        // If payment method is 'hutang', paid should be 0 and hutang tracks the credit
        if (paymentMethod === 'hutang') {
          cashTotal = 0;
          onlineTotal = 0;
          hutangTotal = 0; // Don't pre-set hutang, let remaining track what's owed
          paymentTypeLabel = 'hutang';
        } else {
          paymentTypeLabel = paymentMethod;
          cashTotal = paymentMethod === 'cash' ? paid : 0;
          onlineTotal = paymentMethod === 'online' ? paid : 0;
          hutangTotal = 0;
        }
      }

      const saleData = {
        subtotal,
        roundOff: adjustmentType === 'roundoff' ? (Number(deduction) || 0) : 0,
        deduction: adjustmentType === 'deduction' ? (Number(deduction) || 0) : 0,
        adjustmentType: adjustmentType, // Store the type for reference
        total,
        paymentType: paymentTypeLabel,
        cashTotal,
        onlineTotal,
        hutangTotal: hutangTotal || 0,
        paidAmount: paid,
        remaining,
        status: remaining > 0 ? 'Hutang' : 'Paid',
        customerName: customerName.trim() || 'Walk In',
  customDate,
        createdBy: user?.email || 'Unknown',
        items: selectedProducts.map(item => ({
          productId: item.productId,
          name: item.name,
          qtyBox: Number(item.qtyBox) || 0,
          qtyPack: Number(item.qtyPack) || 0,
          qtyLoose: Number(item.qtyLoose) || 0,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal
        }))
      };

      // Create sale with timeout
      const createSalePromise = createSale(saleData);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout. Please check your internet connection.')), 15000)
      );
      
      await Promise.race([createSalePromise, timeoutPromise]);

      // Log the sale activity
      await logActivity(
        'sale_created',
        user.email || 'unknown_user',
        `Sale created for ${customerName || 'Walk In'} - Total: RM${total.toFixed(2)} (${paymentMethod}). Status: ${remaining > 0 ? 'Credit' : 'Paid'}`,
        'action',
        {
          customerName: customerName || 'Walk In',
          total: total,
          paymentType: paymentMethod,
          itemCount: selectedProducts.length,
          status: remaining > 0 ? 'Hutang' : 'Paid',
          paidAmount: paid,
          remaining: remaining
        }
      );

      // Generate receipt number and prepare receipt data
      const generatedReceiptNumber = receiptService.generateReceiptNumber(saleData.id || 'temp');
      const receiptData = {
        ...saleData,
        receiptNumber: generatedReceiptNumber,
        id: saleData.id || 'temp-' + Date.now()
      };

      // Show receipt modal for user actions
      setCompletedSale(receiptData);
      setReceiptNumber(generatedReceiptNumber);
      setShowReceiptModal(true);

      // Show receipt modal for WhatsApp sharing
      showSuccess('Sale recorded successfully! Use the receipt modal to share via WhatsApp.');

      // Reset form
      setSelectedProducts([]);
      setCustomerName('');
      setPaidAmount('');
      setDeduction('');
      setAdjustmentType('none');
  setSaleDate(''); // Reset sale date
  setSaleTime(''); // Reset sale time
      setPaymentMethod('cash');
      setEnableMultiPayment(false);
      setPaymentMethods({ cash: false, online: false, hutang: false });
      setPaymentAmounts({ cash: '', online: '', hutang: '' });
      
      // Reload products to get updated stock
      loadProducts();

    } catch (error) {
      console.error('Error creating sale:', error);
      
      // Better error messages for different scenarios
      if (error.message.includes('timeout') || error.message.includes('network')) {
        setError('⚠️ Connection timeout. Please check your internet connection and try again. You may write this sale on paper for now.');
      } else if (error.message.includes('Insufficient stock')) {
        setError(error.message);
      } else {
        setError(error.message || 'Failed to record sale. Please check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedProducts.find(item => item.productId === product.id)
  );

  return (
    <div className="sales-page">
      <div className="page-navigation">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
      </div>

      <div className="sales-header">
        <h1>🛒 New Sale</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="sales-container">
        {/* Product Selection */}
        <div className="product-selection">
          <h3>Select Products</h3>
          <div className="search-box">
            <div className="search-controls">
              <input
                type="text"
                placeholder="Type to search products..."
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  // Only load products when user types at least 2 characters
                  if (value.length >= 2) {
                    loadProducts(value);
                  } else {
                    setProducts([]);
                  }
                }}
                className="search-input"
              />
              <button
                type="button"
                onClick={openBarcodeScanner}
                className="barcode-scan-btn"
                title="Scan Barcode"
              >
                📷 Scan
              </button>
            </div>
            
            {scanningMessage && (
              <div className={`scanning-message ${scanningMessage.includes('✅') ? 'success' : scanningMessage.includes('❌') ? 'error' : 'info'}`}>
                {scanningMessage}
              </div>
            )}
          </div>
          
          <div className="products-list">
            {searchTerm.length === 0 ? (
              <div className="search-prompt">
                <p>💡 Type at least 2 characters to search for products</p>
              </div>
            ) : searchTerm.length < 2 ? (
              <div className="search-prompt">
                <p>Keep typing... (minimum 2 characters)</p>
              </div>
            ) : loading ? (
              <div className="search-prompt">
                <p>Loading products...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="search-prompt">
                <p>No products found for "{searchTerm}"</p>
              </div>
            ) : (
              filteredProducts.map(product => (
              <div key={product.id} className="product-item">
                <div className="product-info">
                  <h4>{product.name}</h4>
                  <div className="product-details">
                    <p>Unit: RM{Number(product.unitPrice).toFixed(2)}</p>
                    {product.boxPrice && <p>Box: RM{Number(product.boxPrice).toFixed(2)}</p>}
                    {product.packPrice && <p>Pack: RM{Number(product.packPrice).toFixed(2)}</p>}
                    <p>Stock: {product.stockBalance} units</p>
                  </div>
                </div>
                <button
                  onClick={() => addProductToSale(product)}
                  className="btn primary small"
                  disabled={product.stockBalance === 0}
                >
                  {product.stockBalance === 0 ? 'Out of Stock' : 'Add'}
                </button>
              </div>
            ))
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="sale-cart">
          <h3>Sale Items ({selectedProducts.length})</h3>
          
          {selectedProducts.length === 0 ? (
            <div className="empty-cart">
              <p>No items selected. Search and add products from the left.</p>
            </div>
          ) : (
            <>
              <div className="cart-items">
                {selectedProducts.map((item, index) => (
                  <div key={index} className="cart-item">
                    <div className="item-header">
                      <h4>{item.name}</h4>
                      <button
                        onClick={() => removeProductFromSale(index)}
                        className="remove-btn"
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="quantity-inputs">
                      <div className="qty-group">
                        <label>Boxes ({item.bigBulkQty} units each)</label>
                        <input
                          type="number"
                          value={item.qtyBox}
                          onChange={(e) => updateProductQuantity(index, 'qtyBox', e.target.value)}
                          min="0"
                        />
                      </div>
                      <div className="qty-group">
                        <label>Packs ({item.smallBulkQty} units each)</label>
                        <input
                          type="number"
                          value={item.qtyPack}
                          onChange={(e) => updateProductQuantity(index, 'qtyPack', e.target.value)}
                          min="0"
                        />
                      </div>
                      <div className="qty-group">
                        <label>Loose Units</label>
                        <input
                          type="number"
                          value={item.qtyLoose}
                          onChange={(e) => updateProductQuantity(index, 'qtyLoose', e.target.value)}
                          min="0"
                        />
                      </div>
                    </div>
                    
                    <div className="discount-prices">
                      <h5>🏷️ Discount Prices (Optional)</h5>
                      <div className="discount-inputs">
                        <div className="discount-group">
                          <label>Box Price (RM{(item.boxPrice || (item.unitPrice * item.bigBulkQty)).toFixed(2)})</label>
                          <input
                            type="number"
                            value={item.discountBoxPrice}
                            onChange={(e) => updateDiscountPrice(index, 'discountBoxPrice', e.target.value)}
                            placeholder={(item.boxPrice || (item.unitPrice * item.bigBulkQty)).toFixed(2)}
                            step="0.01"
                            min="0"
                          />
                        </div>
                        <div className="discount-group">
                          <label>Pack Price (RM{(item.packPrice || (item.unitPrice * item.smallBulkQty)).toFixed(2)})</label>
                          <input
                            type="number"
                            value={item.discountPackPrice}
                            onChange={(e) => updateDiscountPrice(index, 'discountPackPrice', e.target.value)}
                            placeholder={(item.packPrice || (item.unitPrice * item.smallBulkQty)).toFixed(2)}
                            step="0.01"
                            min="0"
                          />
                        </div>
                        <div className="discount-group">
                          <label>Unit Price (RM{item.unitPrice.toFixed(2)})</label>
                          <input
                            type="number"
                            value={item.discountUnitPrice}
                            onChange={(e) => updateDiscountPrice(index, 'discountUnitPrice', e.target.value)}
                            placeholder={item.unitPrice.toFixed(2)}
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="item-total">
                      <strong>Subtotal: RM{item.subtotal.toFixed(2)}</strong>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sale Summary and Payment */}
              <form onSubmit={handleSubmitSale} className="sale-summary">
                <div className="summary-section">
                  <h4>Sale Summary</h4>
                  <div className="summary-row">
                    <span>Subtotal:</span>
                    <span>RM{calculateSubtotal().toFixed(2)}</span>
                  </div>
                  
                  {/* Adjustment Type Selection */}
                  <div className="adjustment-section">
                    <label className="input-label">Adjustment:</label>
                    <div className="payment-options">
                      <button
                        type="button"
                        className={`payment-btn ${adjustmentType === 'none' ? 'active' : ''}`}
                        onClick={() => {
                          setAdjustmentType('none');
                          setDeduction('');
                        }}
                      >
                        No Adjustment
                      </button>
                      <button
                        type="button"
                        className={`payment-btn ${adjustmentType === 'deduction' ? 'active' : ''}`}
                        onClick={() => {
                          setAdjustmentType('deduction');
                          setDeduction('');
                        }}
                      >
                        Discount
                      </button>
                      <button
                        type="button"
                        className={`payment-btn ${adjustmentType === 'roundoff' ? 'active' : ''}`}
                        onClick={() => {
                          setAdjustmentType('roundoff');
                          setDeduction('');
                        }}
                      >
                        Round Off
                      </button>
                    </div>
                    
                    {adjustmentType !== 'none' && (
                      <div className="summary-row">
                        <span>{adjustmentType === 'deduction' ? 'Discount:' : 'Round Off:'}</span>
                        <input
                          type="number"
                          value={deduction}
                          onChange={(e) => setDeduction(e.target.value)}
                          step="0.01"
                          placeholder="0.00"
                          className="deduction-input"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="summary-row total">
                    <span>Total:</span>
                    <span>RM{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>

                <div className="payment-section">
                  <h4>Payment Details</h4>
                  
                  <div className="form-group">
                    <label>Customer Name (Optional)</label>
                    <div className="customer-input-container">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => handleCustomerNameChange(e.target.value)}
                        onBlur={handleCustomerBlur}
                        onFocus={() => {
                          if (customerName.trim().length > 0 && customerSuggestions.length > 0) {
                            setShowCustomerSuggestions(true);
                          }
                        }}
                        placeholder="Enter customer name"
                        autoComplete="off"
                      />
                      {showCustomerSuggestions && customerSuggestions.length > 0 && (
                        <div className="customer-suggestions">
                          {customerSuggestions.map((name, index) => (
                            <div
                              key={index}
                              className="customer-suggestion-item"
                              onClick={() => selectCustomerName(name)}
                            >
                              {name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Sale Date (Optional)</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="date"
                        value={saleDate}
                        onChange={(e) => setSaleDate(e.target.value)}
                        placeholder="Leave empty for current date"
                      />
                      <input
                        type="time"
                        value={saleTime}
                        onChange={(e) => setSaleTime(e.target.value)}
                        placeholder="Leave empty for current time"
                        style={{ minWidth: '120px' }}
                      />
                    </div>
                    <small className="form-help">Leave empty to use current date and time</small>
                  </div>



                  <div className="form-group">
                    <label>Payment Method</label>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.9em', fontWeight: 'normal', cursor: 'pointer', gap: '6px' }}>
                        <input 
                          type="checkbox"
                          className="multi-payment-checkbox"
                          checked={enableMultiPayment}
                          onChange={(e) => {
                            setEnableMultiPayment(e.target.checked);
                            if (!e.target.checked) {
                              // Reset to single payment
                              setPaymentMethods({ cash: false, online: false, hutang: false });
                              setPaymentAmounts({ cash: '', online: '', hutang: '' });
                              setPaymentMethod('cash');
                            }
                          }}
                        />
                        <span style={{ whiteSpace: 'nowrap' }}>Enable multiple payment methods</span>
                      </label>
                    </div>
                    
                    {!enableMultiPayment ? (
                      // Single payment method (original)
                      <div className="payment-method-buttons">
                        <button
                          type="button"
                          className={`payment-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                          onClick={() => setPaymentMethod('cash')}
                        >
                          💵 Cash
                        </button>
                        <button
                          type="button"
                          className={`payment-btn ${paymentMethod === 'online' ? 'active' : ''}`}
                          onClick={() => setPaymentMethod('online')}
                        >
                          💳 Online Transfer
                        </button>
                        <button
                          type="button"
                          className={`payment-btn ${paymentMethod === 'hutang' ? 'active' : ''}`}
                          onClick={() => setPaymentMethod('hutang')}
                        >
                          📋 Hutang (Credit)
                        </button>
                      </div>
                    ) : (
                      // Multi-payment method
                      <div className="multi-payment-container">
                        <div className="multi-payment-row">
                          <button
                            type="button"
                            className={`payment-btn ${paymentMethods.cash ? 'active' : ''}`}
                            onClick={() => setPaymentMethods(prev => ({ ...prev, cash: !prev.cash }))}
                            style={{ flex: 1 }}
                          >
                            💵 Cash
                          </button>
                          <input
                            type="number"
                            value={paymentAmounts.cash}
                            onChange={(e) => setPaymentAmounts(prev => ({ ...prev, cash: e.target.value }))}
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            disabled={!paymentMethods.cash}
                            style={{ 
                              flex: 1, 
                              marginLeft: '10px',
                              backgroundColor: paymentMethods.cash ? 'white' : '#e0e0e0',
                              cursor: paymentMethods.cash ? 'text' : 'not-allowed'
                            }}
                          />
                        </div>
                        <div className="multi-payment-row">
                          <button
                            type="button"
                            className={`payment-btn ${paymentMethods.online ? 'active' : ''}`}
                            onClick={() => setPaymentMethods(prev => ({ ...prev, online: !prev.online }))}
                            style={{ flex: 1 }}
                          >
                            💳 Online Transfer
                          </button>
                          <input
                            type="number"
                            value={paymentAmounts.online}
                            onChange={(e) => setPaymentAmounts(prev => ({ ...prev, online: e.target.value }))}
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            disabled={!paymentMethods.online}
                            style={{ 
                              flex: 1, 
                              marginLeft: '10px',
                              backgroundColor: paymentMethods.online ? 'white' : '#e0e0e0',
                              cursor: paymentMethods.online ? 'text' : 'not-allowed'
                            }}
                          />
                        </div>
                        <div className="multi-payment-row">
                          <button
                            type="button"
                            className={`payment-btn ${paymentMethods.hutang ? 'active' : ''}`}
                            onClick={() => setPaymentMethods(prev => ({ ...prev, hutang: !prev.hutang }))}
                            style={{ flex: 1 }}
                          >
                            📋 Hutang (Credit)
                          </button>
                          <input
                            type="number"
                            value={paymentAmounts.hutang}
                            onChange={(e) => setPaymentAmounts(prev => ({ ...prev, hutang: e.target.value }))}
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            disabled={!paymentMethods.hutang}
                            style={{ 
                              flex: 1, 
                              marginLeft: '10px',
                              backgroundColor: paymentMethods.hutang ? 'white' : '#e0e0e0',
                              cursor: paymentMethods.hutang ? 'text' : 'not-allowed'
                            }}
                          />
                        </div>
                        <small className="form-help" style={{ marginTop: '10px', display: 'block' }}>
                          Select payment methods and enter amounts for each
                        </small>
                      </div>
                    )}
                  </div>

                  {!enableMultiPayment && (
                    <div className="form-group">
                      <label>Amount Paid</label>
                      <input
                        type="number"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  )}

                  <div className="summary-row">
                    <span>Remaining:</span>
                    <span className={calculateRemaining() > 0 ? 'text-warning' : 'text-success'}>
                      RM{calculateRemaining().toFixed(2)}
                    </span>
                  </div>
                </div>

                <RequirePermission module="sales" action="create">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn primary large"
                  >
                    {submitting ? 'Processing...' : 'Complete Sale'}
                  </button>
                </RequirePermission>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        saleData={completedSale}
        receiptNumber={receiptNumber}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onScan={handleBarcodeScanned}
        onClose={closeBarcodeScanner}
      />
    </div>
  );
};

export default Sales;
