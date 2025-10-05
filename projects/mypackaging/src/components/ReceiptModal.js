import React, { useState } from 'react';
import receiptService from '../services/receiptService';
import emailService from '../services/emailService';
import { useAlert } from '../context/AlertContext';
import './ReceiptModal.css';

const ReceiptModal = ({ isOpen, onClose, saleData, receiptNumber }) => {
  const { showSuccess, showError } = useAlert();
  const [emailAddress, setEmailAddress] = useState(saleData?.customerEmail || '');
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  if (!isOpen || !saleData) return null;

  const handleDownloadPDF = async () => {
    try {
      const filename = `receipt-${receiptNumber}.pdf`;
      await receiptService.downloadReceipt(saleData, receiptNumber, filename);
      showSuccess('Receipt downloaded successfully!');
    } catch (error) {
      console.error('Failed to download receipt:', error);
      showError('Failed to download receipt. Please try again.');
    }
  };

  const handlePreviewPDF = async () => {
    try {
      await receiptService.previewReceipt(saleData, receiptNumber);
    } catch (error) {
      console.error('Failed to preview receipt:', error);
      showError('Failed to preview receipt. Please try again.');
    }
  };

  const handleEmailReceipt = async () => {
    // Check if email service is configured
    if (!emailService.isConfigured()) {
      showError('Email service is not configured. Please set up EmailJS in Settings → Email Service first.');
      return;
    }

    if (!emailAddress || !emailService.isValidEmail(emailAddress)) {
      showError('Please enter a valid email address.');
      return;
    }

    setIsEmailSending(true);
    try {
      const enhancedSaleData = {
        ...saleData,
        receiptNumber
      };

      await emailService.sendReceiptEmailAndDownloadPDF(enhancedSaleData, emailAddress);
      showSuccess(`Receipt sent to ${emailAddress} and PDF downloaded for WhatsApp sharing!`);
      setShowEmailForm(false);
    } catch (error) {
      console.error('Failed to send receipt email:', error);
      if (error.message.includes('not configured')) {
        showError('Email service not configured. Please set up EmailJS in Settings → Email Service.');
      } else {
        showError('Failed to send receipt email. Please check your email configuration and try again.');
      }
    } finally {
      setIsEmailSending(false);
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      // Download PDF first
      await handleDownloadPDF();
      
      // Generate WhatsApp message
      const message = receiptService.generateWhatsAppMessage(saleData, receiptNumber);
      const whatsappUrl = `https://wa.me/?text=${message}`;
      
      // Open WhatsApp
      window.open(whatsappUrl, '_blank');
      
      showSuccess('PDF downloaded and WhatsApp opened! Attach the downloaded PDF to your message.');
    } catch (error) {
      console.error('Failed to prepare WhatsApp share:', error);
      showError('Failed to prepare WhatsApp message. Please try again.');
    }
  };

  const formatCurrency = (amount) => {
    return `RM${(amount || 0).toFixed(2)}`;
  };

  const formatPaymentMethod = (method) => {
    const methods = {
      'cash': 'Cash',
      'online': 'Online Transfer',
      'hutang': 'Credit (Hutang)'
    };
    return methods[method] || method;
  };

  return (
    <div className="receipt-modal-overlay">
      <div className="receipt-modal">
        <div className="receipt-modal-header">
          <h2>📄 Receipt Generated</h2>
          <button 
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="receipt-modal-content">
          {/* Receipt Summary */}
          <div className="receipt-summary">
            <div className="receipt-info">
              <h3>Receipt Details</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Receipt Number:</label>
                  <span className="receipt-number">{receiptNumber}</span>
                </div>
                <div className="info-item">
                  <label>Customer:</label>
                  <span>{saleData.customerName || 'Walk In'}</span>
                </div>
                <div className="info-item">
                  <label>Total Amount:</label>
                  <span className="amount">{formatCurrency(saleData.total)}</span>
                </div>
                <div className="info-item">
                  <label>Payment Method:</label>
                  <span>{formatPaymentMethod(saleData.paymentType)}</span>
                </div>
                <div className="info-item">
                  <label>Status:</label>
                  <span className={`status ${saleData.status?.toLowerCase()}`}>
                    {saleData.status || 'Paid'}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Summary */}
            <div className="items-summary">
              <h4>Items ({saleData.items?.length || 0})</h4>
              <div className="items-list">
                {saleData.items?.map((item, index) => (
                  <div key={index} className="item-row">
                    <span className="item-name">{item.name}</span>
                    <span className="item-total">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="receipt-actions">
            <button 
              className="btn primary"
              onClick={handlePreviewPDF}
            >
              👁️ Preview PDF
            </button>

            <button 
              className="btn secondary"
              onClick={handleDownloadPDF}
            >
              💾 Download PDF
            </button>

            <button 
              className="btn success"
              onClick={handleWhatsAppShare}
              title="Download PDF and open WhatsApp to send to customer"
            >
              📱 WhatsApp Share
            </button>

            <button 
              className="btn outline"
              onClick={() => setShowEmailForm(!showEmailForm)}
              disabled={!emailService.isConfigured()}
              title={!emailService.isConfigured() ? 'Email service not configured. Go to Settings → Email Service to set up.' : 'Email Receipt'}
            >
              📧 Email Receipt
            </button>
          </div>

          {/* Email Form */}
          {showEmailForm && (
            <div className="email-form">
              <h4>📧 Email Receipt</h4>
              {!emailService.isConfigured() && (
                <div className="email-warning">
                  <p><strong>⚠️ Email service not configured</strong></p>
                  <p>To send emails, please set up EmailJS in <strong>Settings → Email Service</strong> first.</p>
                </div>
              )}
              <div className="form-group">
                <label>Email Address:</label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="customer@example.com"
                  disabled={isEmailSending || !emailService.isConfigured()}
                />
              </div>
              <div className="email-actions">
                <button 
                  className="btn primary"
                  onClick={handleEmailReceipt}
                  disabled={isEmailSending || !emailAddress || !emailService.isConfigured()}
                >
                  {isEmailSending ? 'Sending...' : 'Send Receipt'}
                </button>
                <button 
                  className="btn secondary"
                  onClick={() => setShowEmailForm(false)}
                  disabled={isEmailSending}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Receipt Note */}
          <div className="receipt-note">
            <p>
              <strong>Note:</strong> This receipt has been automatically generated and 
              can be downloaded as PDF or emailed to your customer.
            </p>
          </div>
        </div>

        <div className="receipt-modal-footer">
          <button 
            className="btn large primary"
            onClick={onClose}
          >
            ✅ Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;