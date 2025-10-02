import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, createSale } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import './Sales.css';

const Sales = () => {
  const { user } = useAuth();
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

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading products:', error);
      setError('Failed to load products. Please refresh the page.');
      setLoading(false);
    }
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
      qtyBox: 0,
      qtyPack: 0,
      qtyLoose: 0,
      subtotal: 0
    };

    setSelectedProducts([...selectedProducts, newItem]);
    setError('');
  };

  const updateProductQuantity = (index, field, value) => {
    const updatedProducts = [...selectedProducts];
    updatedProducts[index][field] = Math.max(0, Number(value) || 0);
    
    // Calculate subtotal using different pricing logic
    const item = updatedProducts[index];
    let subtotal = 0;
    
    // Calculate box subtotal (use boxPrice if available, otherwise unit price)
    if (item.qtyBox > 0) {
      const boxPrice = item.boxPrice || (item.unitPrice * item.bigBulkQty);
      subtotal += item.qtyBox * boxPrice;
    }
    
    // Calculate pack subtotal (use packPrice if available, otherwise unit price)
    if (item.qtyPack > 0) {
      const packPrice = item.packPrice || (item.unitPrice * item.smallBulkQty);
      subtotal += item.qtyPack * packPrice;
    }
    
    // Calculate loose units subtotal (always use unit price)
    if (item.qtyLoose > 0) {
      subtotal += item.qtyLoose * item.unitPrice;
    }
    
    item.subtotal = subtotal;
    setSelectedProducts(updatedProducts);
  };

  const removeProductFromSale = (index) => {
    const updatedProducts = selectedProducts.filter((_, i) => i !== index);
    setSelectedProducts(updatedProducts);
  };

  const calculateSubtotal = () => {
    return selectedProducts.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const deductionAmount = Number(deduction) || 0;
    return subtotal - deductionAmount;
  };

  const calculateRemaining = () => {
    const total = calculateTotal();
    const paid = Number(paidAmount) || 0;
    return Math.max(0, total - paid);
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
    e.preventDefault();
    
    if (selectedProducts.length === 0) {
      setError('Please add at least one product to the sale.');
      return;
    }

    const total = calculateTotal();
    const paid = Number(paidAmount) || 0;
    const remaining = calculateRemaining();

    // Customer name validation for credit sales
    if (remaining > 0 && !customerName.trim()) {
      setError('Customer name is required for credit sales (when paid amount is less than total).');
      return;
    }

    // Ensure payment method is hutang for credit sales
    if (remaining > 0 && paymentMethod !== 'hutang') {
      setError('Payment method must be "Hutang (Credit)" when paid amount is less than total.');
      return;
    }

    // Validate stock availability
    for (const item of selectedProducts) {
      const product = products.find(p => p.id === item.productId);
      const requiredUnits = (item.qtyBox * item.bigBulkQty) + 
                           (item.qtyPack * item.smallBulkQty) + 
                           item.qtyLoose;
      
      if (requiredUnits > product.stockBalance) {
        setError(`Insufficient stock for ${item.name}. Available: ${product.stockBalance} units, Required: ${requiredUnits} units`);
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const subtotal = calculateSubtotal();

      const saleData = {
        subtotal,
        roundOff: -(Number(deduction) || 0), // Store as negative for deduction
        total,
        paymentType: paymentMethod,
        cashTotal: paymentMethod === 'cash' ? paid : 0,
        onlineTotal: paymentMethod === 'online' ? paid : 0,
        paidAmount: paid,
        remaining,
        status: remaining > 0 ? 'Hutang' : 'Paid',
        customerName: customerName.trim() || 'Walk In',
        createdBy: user?.email || 'Unknown',
        items: selectedProducts.map(item => ({
          productId: item.productId,
          name: item.name,
          qtyBox: item.qtyBox,
          qtyPack: item.qtyPack,
          qtyLoose: item.qtyLoose,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal
        }))
      };

      await createSale(saleData);

      // Reset form
      setSelectedProducts([]);
      setCustomerName('');
      setPaidAmount('');
      setDeduction('');
      setPaymentMethod('cash');
      
      alert('Sale recorded successfully!');
      
      // Reload products to get updated stock
      loadProducts();

    } catch (error) {
      console.error('Error creating sale:', error);
      setError(error.message || 'Failed to record sale. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedProducts.find(item => item.productId === product.id)
  );

  if (loading) {
    return (
      <div className="sales-page">
        <div className="loading">Loading products...</div>
      </div>
    );
  }

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
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="products-list">
            {filteredProducts.map(product => (
              <div key={product.id} className="product-item">
                <div className="product-info">
                  <h4>{product.name}</h4>
                  <p>Unit: RM{Number(product.unitPrice).toFixed(2)}</p>
                  {product.boxPrice && <p>Box: RM{Number(product.boxPrice).toFixed(2)}</p>}
                  {product.packPrice && <p>Pack: RM{Number(product.packPrice).toFixed(2)}</p>}
                  <p>Stock: {product.stockBalance} units</p>
                </div>
                <button
                  onClick={() => addProductToSale(product)}
                  className="btn primary small"
                  disabled={product.stockBalance === 0}
                >
                  {product.stockBalance === 0 ? 'Out of Stock' : 'Add'}
                </button>
              </div>
            ))}
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
                  <div className="summary-row">
                    <span>Deduction:</span>
                    <input
                      type="number"
                      value={deduction}
                      onChange={(e) => setDeduction(e.target.value)}
                      step="0.01"
                      placeholder="0.00"
                      className="deduction-input"
                    />
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
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="online">Online Transfer</option>
                      <option value="hutang">Hutang (Credit)</option>
                    </select>
                  </div>

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

                  <div className="summary-row">
                    <span>Remaining:</span>
                    <span className={calculateRemaining() > 0 ? 'text-warning' : 'text-success'}>
                      RM{calculateRemaining().toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn primary large"
                >
                  {submitting ? 'Processing...' : 'Complete Sale'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sales;