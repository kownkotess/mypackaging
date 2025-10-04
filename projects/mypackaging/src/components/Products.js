import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { subscribeProducts, deleteProduct } from '../lib/firestore';
import { useAlert } from '../context/AlertContext';
import { RequirePermission } from './RoleComponents';
import ProductForm from './ProductForm';
import './Products.css';

const Products = () => {
  const { showConfirm } = useAlert();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeProducts((productsData) => {
      setProducts(productsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowAddForm(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setShowAddForm(true);
  };

  const handleDeleteProduct = async (productId, productName) => {
    showConfirm(
      `Are you sure you want to delete "${productName}"? This action cannot be undone.`,
      async () => {
        try {
          await deleteProduct(productId);
          setError('');
        } catch (error) {
          console.error('Error deleting product:', error);
          setError('Failed to delete product. Please try again.');
        }
      }
    );
  };

  const handleFormClose = () => {
    setShowAddForm(false);
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatus = (product) => {
    const stockBalance = Number(product.stockBalance) || 0;
    const reorderPoint = Number(product.reorderPoint) || 0;
    
    if (stockBalance === 0) return 'out-of-stock';
    if (stockBalance <= reorderPoint) return 'low-stock';
    return 'in-stock';
  };

  const getStockStatusText = (status) => {
    switch (status) {
      case 'out-of-stock': return 'Out of Stock';
      case 'low-stock': return 'Low Stock';
      case 'in-stock': return 'In Stock';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="products-page">
        <div className="loading">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="products-page">
      <div className="page-navigation">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
      </div>
      
      <div className="products-header">
        <h1>📦 Product Management</h1>
        <RequirePermission module="products" action="create">
          <button onClick={handleAddProduct} className="btn primary">
            + Add New Product
          </button>
        </RequirePermission>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="products-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="products-count">
          {filteredProducts.length} of {products.length} products
        </div>
      </div>

      <div className="products-list">
        {filteredProducts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No products found</h3>
            <p>
              {searchTerm 
                ? `No products match "${searchTerm}"`
                : "Start by adding your first product to the inventory"
              }
            </p>
            {!searchTerm && (
              <button onClick={handleAddProduct} className="btn primary">
                Add Your First Product
              </button>
            )}
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product) => {
              const stockStatus = getStockStatus(product);
              return (
                <div key={product.id} className={`product-card ${stockStatus}`}>
                  <div className="product-header">
                    <h3>{product.name}</h3>
                    <div className={`stock-badge ${stockStatus}`}>
                      {getStockStatusText(stockStatus)}
                    </div>
                  </div>
                  
                  <div className="product-details">
                    <div className="detail-row">
                      <span>Unit Price:</span>
                      <span className="price">RM{Number(product.unitPrice || 0).toFixed(2)}</span>
                    </div>
                    {product.boxPrice && (
                      <div className="detail-row">
                        <span>Box Price:</span>
                        <span className="price">RM{Number(product.boxPrice).toFixed(2)}</span>
                      </div>
                    )}
                    {product.packPrice && (
                      <div className="detail-row">
                        <span>Pack Price:</span>
                        <span className="price">RM{Number(product.packPrice).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span>Stock Balance:</span>
                      <span className="stock">{Number(product.stockBalance || 0)} units</span>
                    </div>
                    <div className="detail-row">
                      <span>Box Qty:</span>
                      <span>{Number(product.bigBulkQty || 0)} units</span>
                    </div>
                    <div className="detail-row">
                      <span>Pack Qty:</span>
                      <span>{Number(product.smallBulkQty || 0)} units</span>
                    </div>
                    <div className="detail-row">
                      <span>Reorder Point:</span>
                      <span>{Number(product.reorderPoint || 0)} units</span>
                    </div>
                  </div>

                  <div className="product-actions">
                    <RequirePermission module="products" action="edit">
                      <button 
                        onClick={() => handleEditProduct(product)}
                        className="btn secondary small"
                      >
                        Edit
                      </button>
                    </RequirePermission>
                    <RequirePermission module="products" action="delete">
                      <button 
                        onClick={() => handleDeleteProduct(product.id, product.name)}
                        className="btn danger small"
                      >
                        Delete
                      </button>
                    </RequirePermission>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddForm && (
        <ProductForm
          product={editingProduct}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};

export default Products;
