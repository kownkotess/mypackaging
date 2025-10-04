import React, { useState, useEffect } from 'react';
import { useAlert } from '../context/AlertContext';
import emailService from '../services/emailService';
import './EmailSettings.css';

const EmailSettings = () => {
  const { showSuccess, showError } = useAlert();
  const [config, setConfig] = useState({
    serviceId: '',
    publicKey: '',
    templateIds: {
      stockAlert: '',
      receipt: '',
      passwordReset: '',
      lowStock: '',
      salesReport: ''
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  useEffect(() => {
    // Load current configuration
    const currentConfig = emailService.getConfiguration();
    setConfig({
      serviceId: currentConfig.serviceId,
      publicKey: currentConfig.publicKey || '',
      templateIds: currentConfig.templateIds
    });
  }, []);

  const handleConfigChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setConfig(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSaveConfiguration = async () => {
    setIsLoading(true);
    try {
      const updatedConfig = emailService.updateConfiguration(config);
      showSuccess('Email configuration updated successfully');
      
      // Update state with actual configuration
      setConfig(prevConfig => ({
        ...prevConfig,
        ...updatedConfig
      }));
    } catch (error) {
      showError('Failed to update email configuration');
      console.error('Email config update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      showError('Please enter a test email address');
      return;
    }

    if (!emailService.isValidEmail(testEmail)) {
      showError('Please enter a valid email address');
      return;
    }

    setIsTestingEmail(true);
    try {
      const success = await emailService.testEmailService();
      if (success) {
        showSuccess(`Test email sent successfully to ${testEmail}`);
      } else {
        showError('Test email failed. Check your configuration.');
      }
    } catch (error) {
      showError('Test email failed: ' + error.message);
      console.error('Test email error:', error);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleSendStockAlert = async () => {
    try {
      await emailService.sendStockAlert({
        productName: 'Test Product',
        currentStock: 2,
        reorderPoint: 10,
        type: 'warning',
        urgency: 'high',
        suggestedAction: 'immediate_reorder',
        message: 'This is a test stock alert from MyPackaging system'
      });
      showSuccess('Test stock alert sent successfully');
    } catch (error) {
      showError('Failed to send test stock alert: ' + error.message);
    }
  };

  const handleSendTestReceipt = async () => {
    if (!testEmail) {
      showError('Please enter a test email address');
      return;
    }

    try {
      await emailService.sendSalesReceipt({
        id: 'TEST001',
        customerName: 'Test Customer',
        createdAt: new Date(),
        total: 25.50,
        paymentType: 'Cash',
        status: 'Paid',
        items: [
          { name: 'Test Product 1', quantity: 2, price: 10.00 },
          { name: 'Test Product 2', quantity: 1, price: 5.50 }
        ]
      }, testEmail);
      showSuccess('Test receipt sent successfully');
    } catch (error) {
      showError('Failed to send test receipt: ' + error.message);
    }
  };

  return (
    <div className="email-settings">
      <div className="settings-header">
        <h2>📧 Email Service Configuration</h2>
        <p>Configure EmailJS settings for automated notifications and receipts</p>
      </div>

      {/* Configuration Status */}
      <div className="config-status">
        <div className="status-item">
          <span className="status-label">Service Status:</span>
          <span className={`status-value ${config.serviceId ? 'active' : 'inactive'}`}>
            {config.serviceId ? 'Configured' : 'Not Configured'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Queue Status:</span>
          <span className="status-value">
            {emailService.getConfiguration().queueLength} emails pending
          </span>
        </div>
      </div>

      {/* Basic Configuration */}
      <div className="config-section">
        <h3>Basic Configuration</h3>
        <div className="config-grid">
          <div className="form-group">
            <label htmlFor="serviceId">EmailJS Service ID</label>
            <input
              type="text"
              id="serviceId"
              value={config.serviceId}
              onChange={(e) => handleConfigChange('serviceId', e.target.value)}
              placeholder="service_xxxxxxx"
              className="form-control"
            />
            <small>Your EmailJS service identifier</small>
          </div>

          <div className="form-group">
            <label htmlFor="publicKey">EmailJS Public Key</label>
            <input
              type="text"
              id="publicKey"
              value={config.publicKey}
              onChange={(e) => handleConfigChange('publicKey', e.target.value)}
              placeholder="Your public key"
              className="form-control"
            />
            <small>Your EmailJS public key for authentication</small>
          </div>
        </div>
      </div>

      {/* Template Configuration */}
      <div className="config-section">
        <h3>Email Templates</h3>
        <div className="config-grid">
          <div className="form-group">
            <label htmlFor="stockAlert">Stock Alert Template</label>
            <input
              type="text"
              id="stockAlert"
              value={config.templateIds.stockAlert}
              onChange={(e) => handleConfigChange('templateIds.stockAlert', e.target.value)}
              placeholder="template_xxxxxxx"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="receipt">Receipt Template</label>
            <input
              type="text"
              id="receipt"
              value={config.templateIds.receipt}
              onChange={(e) => handleConfigChange('templateIds.receipt', e.target.value)}
              placeholder="template_xxxxxxx"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="lowStock">Low Stock Template</label>
            <input
              type="text"
              id="lowStock"
              value={config.templateIds.lowStock}
              onChange={(e) => handleConfigChange('templateIds.lowStock', e.target.value)}
              placeholder="template_xxxxxxx"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="salesReport">Sales Report Template</label>
            <input
              type="text"
              id="salesReport"
              value={config.templateIds.salesReport}
              onChange={(e) => handleConfigChange('templateIds.salesReport', e.target.value)}
              placeholder="template_xxxxxxx"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="passwordReset">Password Reset Template</label>
            <input
              type="text"
              id="passwordReset"
              value={config.templateIds.passwordReset}
              onChange={(e) => handleConfigChange('templateIds.passwordReset', e.target.value)}
              placeholder="template_xxxxxxx"
              className="form-control"
            />
          </div>
        </div>
      </div>

      {/* Save Configuration */}
      <div className="config-actions">
        <button 
          className="btn primary"
          onClick={handleSaveConfiguration}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Testing Section */}
      <div className="testing-section">
        <h3>Email Testing</h3>
        <div className="test-controls">
          <div className="form-group">
            <label htmlFor="testEmail">Test Email Address</label>
            <input
              type="email"
              id="testEmail"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="form-control"
            />
          </div>

          <div className="test-buttons">
            <button 
              className="btn secondary"
              onClick={handleTestEmail}
              disabled={isTestingEmail || !testEmail}
            >
              {isTestingEmail ? 'Testing...' : 'Test Email Service'}
            </button>

            <button 
              className="btn info"
              onClick={handleSendStockAlert}
              disabled={!config.serviceId}
            >
              Send Test Stock Alert
            </button>

            <button 
              className="btn success"
              onClick={handleSendTestReceipt}
              disabled={!config.serviceId || !testEmail}
            >
              Send Test Receipt
            </button>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="setup-instructions">
        <h3>📋 Setup Instructions</h3>
        <div className="instructions-content">
          <ol>
            <li>
              <strong>Create EmailJS Account:</strong>
              <p>Sign up at <a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer">emailjs.com</a></p>
            </li>
            <li>
              <strong>Create Email Service:</strong>
              <p>Add your email provider (Gmail, Outlook, etc.) to EmailJS</p>
            </li>
            <li>
              <strong>Create Email Templates:</strong>
              <p>Create templates for each notification type using the template IDs above</p>
            </li>
            <li>
              <strong>Configure Templates:</strong>
              <p>Use these variables in your templates:</p>
              <div className="template-variables">
                <h4>Stock Alert Template Variables:</h4>
                <code>{'{{to_name}}, {{product_name}}, {{current_stock}}, {{reorder_point}}, {{message}}'}</code>
                
                <h4>Receipt Template Variables:</h4>
                <code>{'{{to_name}}, {{receipt_number}}, {{customer_name}}, {{items}}, {{total}}, {{payment_method}}'}</code>
                
                <h4>Low Stock Report Variables:</h4>
                <code>{'{{to_name}}, {{report_date}}, {{low_stock_count}}, {{low_stock_items}}'}</code>
              </div>
            </li>
            <li>
              <strong>Test Configuration:</strong>
              <p>Use the testing tools above to verify your setup</p>
            </li>
          </ol>
        </div>
      </div>

      {/* Environment Variables Notice */}
      <div className="env-notice">
        <h4>🔧 Environment Variables</h4>
        <p>For production, set these environment variables in your .env file:</p>
        <div className="env-vars">
          <code>REACT_APP_EMAILJS_SERVICE_ID=your_service_id</code><br/>
          <code>REACT_APP_EMAILJS_PUBLIC_KEY=your_public_key</code><br/>
          <code>REACT_APP_EMAILJS_TEMPLATE_STOCK_ALERT=template_id</code><br/>
          <code>REACT_APP_EMAILJS_TEMPLATE_RECEIPT=template_id</code><br/>
          <code>REACT_APP_EMAILJS_TEMPLATE_LOW_STOCK=template_id</code><br/>
          <code>REACT_APP_EMAILJS_TEMPLATE_SALES_REPORT=template_id</code><br/>
          <code>REACT_APP_EMAILJS_TEMPLATE_PASSWORD_RESET=template_id</code>
        </div>
      </div>
    </div>
  );
};

export default EmailSettings;