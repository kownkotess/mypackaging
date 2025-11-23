import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { subscribeProducts, deleteProduct, generateQRCodeForProduct, generateQRCodesForAllProducts } from '../lib/firestore';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContextWrapper';
import { RequirePermission } from './RoleComponents';
import { logActivity } from '../lib/auditLog';
import ProductForm from './ProductForm';
import PrintModal from './PrintModal';
import ReturnToTop from './ReturnToTop';
import './Products.css';

const Products = () => {
  const { showConfirm, showSuccess, showError, showWarning } = useAlert();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [generatingQR, setGeneratingQR] = useState(false);
  const [generatingQRAll, setGeneratingQRAll] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12); // Show 12 products per page

  useEffect(() => {
    const unsubscribe = subscribeProducts((productsData) => {
      // Sort products alphabetically by name
      const sortedProducts = productsData.sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setProducts(sortedProducts);
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
    // Check if online
    if (!navigator.onLine) {
      setError('⚠️ No internet connection. Please connect to the internet to delete products.');
      return;
    }

    showConfirm(
      `Are you sure you want to delete "${productName}"? This action cannot be undone.`,
      async () => {
        try {
          // Delete with timeout
          const deletePromise = deleteProduct(productId);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 15000)
          );
          await Promise.race([deletePromise, timeoutPromise]);
          
          // Log the deletion
          await logActivity(
            'product_deleted',
            user?.email || 'unknown_user',
            `Product "${productName}" was deleted`,
            'action',
            {
              productId,
              productName,
              deletedBy: user?.email
            }
          );
          
          setError('');
        } catch (error) {
          console.error('Error deleting product:', error);
          if (error.message.includes('timeout')) {
            setError('⚠️ Connection timeout. Please check your internet connection and try again.');
          } else {
            setError('Failed to delete product. Please try again.');
          }
        }
      }
    );
  };

  const handleFormClose = () => {
    setShowAddForm(false);
    setEditingProduct(null);
  };

  const handleGenerateQRCode = async (productId, productName) => {
    setGeneratingQR(productId);
    try {
      await generateQRCodeForProduct(productId, productName);
      showSuccess(`QR code generated successfully for ${productName}`);
      
      await logActivity(
        'qr_code_generated',
        user?.email || 'unknown_user',
        `QR code generated for product "${productName}"`,
        'action',
        {
          productId,
          productName,
          generatedBy: user?.email
        }
      );
    } catch (error) {
      console.error('Error generating QR code:', error);
      showError(`Failed to generate QR code for ${productName}. Please try again.`);
    } finally {
      setGeneratingQR(false);
    }
  };

  const handleGenerateAllQRCodes = async () => {
    setGeneratingQRAll(true);
    try {
      const results = await generateQRCodesForAllProducts();
      
      if (results.failed > 0) {
        showWarning(
          `QR codes generated: ${results.success}/${results.total} successful. ${results.failed} failed.`
        );
      } else {
        showSuccess(
          `All QR codes generated successfully! (${results.success}/${results.total})`
        );
      }
      
      await logActivity(
        'bulk_qr_generation',
        user?.email || 'unknown_user',
        `Bulk QR code generation: ${results.success}/${results.total} successful`,
        'action',
        {
          totalProducts: results.total,
          successCount: results.success,
          failedCount: results.failed,
          generatedBy: user?.email
        }
      );
    } catch (error) {
      console.error('Error generating QR codes:', error);
      showError('Failed to generate QR codes. Please try again.');
    } finally {
      setGeneratingQRAll(false);
    }
  };

  // Product selection handlers
  const handleProductSelect = (productId) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handlePrint = () => {
    if (selectedProducts.size === 0) {
      showWarning('Please select at least one product to print.');
      return;
    }
    setShowPrintModal(true);
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) {
      showWarning('Please select at least one product to delete.');
      return;
    }

    // Check if online
    if (!navigator.onLine) {
      showError('⚠️ No internet connection. Please connect to the internet to delete products.');
      return;
    }

    const selectedCount = selectedProducts.size;
    const selectedProductNames = products
      .filter(p => selectedProducts.has(p.id))
      .map(p => p.name)
      .join(', ');

    showConfirm(
      `Are you sure you want to delete ${selectedCount} selected product(s)? This action cannot be undone.\n\nProducts: ${selectedProductNames}`,
      async () => {
        try {
          setLoading(true);
          let successCount = 0;
          let failCount = 0;
          
          // Delete all selected products
          for (const productId of selectedProducts) {
            try {
              const product = products.find(p => p.id === productId);
              const deletePromise = deleteProduct(productId);
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout')), 15000)
              );
              await Promise.race([deletePromise, timeoutPromise]);
              
              // Log the deletion
              await logActivity(
                'product_deleted',
                user?.email || 'unknown_user',
                `Product "${product?.name}" was deleted (bulk delete)`,
                'action',
                {
                  productId,
                  productName: product?.name,
                  deletedBy: user?.email,
                  bulkDelete: true
                }
              );
              
              successCount++;
            } catch (error) {
              console.error(`Error deleting product ${productId}:`, error);
              failCount++;
            }
          }
          
          // Clear selection
          setSelectedProducts(new Set());
          
          // Show result
          if (failCount === 0) {
            showSuccess(`Successfully deleted ${successCount} product(s)`);
          } else {
            showWarning(`Deleted ${successCount} product(s), ${failCount} failed`);
          }
          
          setError('');
        } catch (error) {
          console.error('Error in bulk delete:', error);
          showError('Failed to delete products. Please try again.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        <div className="header-buttons">
          <RequirePermission module="products" action="create">
            <button onClick={handleAddProduct} className="btn primary">
              + Add New Product
            </button>
          </RequirePermission>
          <RequirePermission module="products" action="edit">
            <button 
              onClick={handleGenerateAllQRCodes} 
              className="btn secondary"
              disabled={generatingQRAll || products.length === 0}
            >
              {generatingQRAll ? '⏳ Generating...' : '📱 Generate All QR Codes'}
            </button>
          </RequirePermission>
          <RequirePermission module="products" action="view">
            <button 
              onClick={handlePrint} 
              className="btn success"
              disabled={selectedProducts.size === 0}
            >
              🖨️ Print Selected ({selectedProducts.size})
            </button>
          </RequirePermission>
          <RequirePermission module="products" action="delete">
            <button 
              onClick={handleBulkDelete} 
              className="btn danger"
              disabled={selectedProducts.size === 0 || loading}
            >
              {loading ? '⏳ Deleting...' : `🗑️ Delete Selected (${selectedProducts.size})`}
            </button>
          </RequirePermission>
        </div>
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
        <div className="selection-controls">
          <RequirePermission module="products" action="view">
            <label className="select-all-checkbox">
              <input
                type="checkbox"
                checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                onChange={handleSelectAll}
              />
              <span className="checkmark"></span>
              Select All ({selectedProducts.size} selected)
            </label>
          </RequirePermission>
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
          <>
            <div className="products-grid">
              {currentProducts.map((product) => {
              const stockStatus = getStockStatus(product);
              return (
                <div key={product.id} className={`product-card ${stockStatus}`}>
                  <div className="product-header">
                    <RequirePermission module="products" action="view">
                      <div className="product-select-checkbox">
                        <label className="product-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => handleProductSelect(product.id)}
                          />
                          <span className="checkmark"></span>
                        </label>
                      </div>
                    </RequirePermission>
                    <h3>{product.name}</h3>
                    <div className={`stock-badge ${stockStatus}`}>
                      {getStockStatusText(stockStatus)}
                    </div>
                  </div>
                  
                  {product.description && (
                    <div className="product-description">
                      {product.description}
                    </div>
                  )}
                  
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

                  {/* QR Code Section */}
                  <div className="product-qr-section">
                    {product.qrCode ? (
                      <div className="qr-code-display">
                        <img 
                          src={product.qrCode} 
                          alt={`QR Code for ${product.name}`} 
                          className="qr-code-image"
                          title="QR Code for this product"
                        />
                        <div className="qr-code-info">
                          <span className="qr-status success">✓ QR Code Ready</span>
                        </div>
                      </div>
                    ) : (
                      <div className="qr-code-placeholder">
                        <div className="qr-placeholder-icon">📱</div>
                        <span className="qr-status">No QR Code</span>
                      </div>
                    )}
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
                    {!product.qrCode && (
                      <RequirePermission module="products" action="edit">
                        <button 
                          onClick={() => handleGenerateQRCode(product.id, product.name)}
                          className="btn primary small"
                          disabled={generatingQR === product.id}
                        >
                          {generatingQR === product.id ? '⏳' : '📱 Generate QR'}
                        </button>
                      </RequirePermission>
                    )}
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
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <div className="pagination-info">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
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

      {showAddForm && (
        <ProductForm
          product={editingProduct}
          onClose={handleFormClose}
        />
      )}

      <PrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        products={products}
        selectedProductIds={selectedProducts}
      />
    </div>
  );
};

export default Products;
