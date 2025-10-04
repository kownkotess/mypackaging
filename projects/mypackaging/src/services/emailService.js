import emailjs from '@emailjs/browser';

// EmailJS Configuration
const EMAILJS_CONFIG = {
  serviceId: process.env.REACT_APP_EMAILJS_SERVICE_ID || 'service_mypackaging',
  templateIds: {
    stockAlert: process.env.REACT_APP_EMAILJS_TEMPLATE_STOCK_ALERT || 'template_stock_alert',
    receipt: process.env.REACT_APP_EMAILJS_TEMPLATE_RECEIPT || 'template_receipt',
    passwordReset: process.env.REACT_APP_EMAILJS_TEMPLATE_PASSWORD_RESET || 'template_password_reset',
    lowStock: process.env.REACT_APP_EMAILJS_TEMPLATE_LOW_STOCK || 'template_low_stock',
    salesReport: process.env.REACT_APP_EMAILJS_TEMPLATE_SALES_REPORT || 'template_sales_report'
  },
  publicKey: process.env.REACT_APP_EMAILJS_PUBLIC_KEY || 'your_public_key_here'
};

// Initialize EmailJS
const initializeEmailJS = () => {
  try {
    emailjs.init(EMAILJS_CONFIG.publicKey);
    console.log('EmailJS initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize EmailJS:', error);
    return false;
  }
};

class EmailService {
  constructor() {
    this.isInitialized = initializeEmailJS();
    this.emailQueue = [];
    this.isProcessing = false;
    this.retryAttempts = 3;
    this.retryDelay = 2000; // 2 seconds
  }

  async sendEmail(templateId, templateParams, options = {}) {
    if (!this.isInitialized) {
      throw new Error('EmailJS is not properly initialized. Check your configuration.');
    }

    const emailData = {
      templateId,
      templateParams: {
        ...templateParams,
        timestamp: new Date().toLocaleString(),
        company_name: 'MyPackaging',
        company_address: 'Belle Store, Malaysia',
        company_email: 'info@mypackaging.com'
      },
      options: {
        retries: this.retryAttempts,
        priority: 'normal',
        ...options
      }
    };

    // Add to queue for processing
    return this.addToQueue(emailData);
  }

  async addToQueue(emailData) {
    return new Promise((resolve, reject) => {
      this.emailQueue.push({
        ...emailData,
        resolve,
        reject,
        attempts: 0,
        createdAt: Date.now()
      });

      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.isProcessing || this.emailQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.emailQueue.length > 0) {
      // Sort by priority (high -> normal -> low)
      this.emailQueue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.options.priority] - priorityOrder[b.options.priority];
      });

      const emailTask = this.emailQueue.shift();
      
      try {
        const result = await this.sendEmailDirectly(emailTask);
        emailTask.resolve(result);
      } catch (error) {
        emailTask.attempts++;
        
        if (emailTask.attempts < emailTask.options.retries) {
          // Retry with exponential backoff
          const delay = this.retryDelay * Math.pow(2, emailTask.attempts - 1);
          console.log(`Retrying email send in ${delay}ms (attempt ${emailTask.attempts}/${emailTask.options.retries})`);
          
          setTimeout(() => {
            this.emailQueue.unshift(emailTask); // Add back to front of queue
          }, delay);
        } else {
          console.error('Failed to send email after all retries:', error);
          emailTask.reject(error);
        }
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.isProcessing = false;
  }

  async sendEmailDirectly(emailTask) {
    const { templateId, templateParams } = emailTask;
    
    const result = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      templateId,
      templateParams
    );

    console.log('Email sent successfully:', result);
    return result;
  }

  // Stock Alert Email
  async sendStockAlert(alertData, recipientEmail = 'manager@mypackaging.com') {
    const templateParams = {
      to_email: recipientEmail,
      to_name: 'Store Manager',
      product_name: alertData.productName,
      current_stock: alertData.currentStock,
      reorder_point: alertData.reorderPoint,
      alert_type: alertData.type,
      urgency: alertData.urgency,
      suggested_action: alertData.suggestedAction,
      message: alertData.message
    };

    return this.sendEmail(
      EMAILJS_CONFIG.templateIds.stockAlert,
      templateParams,
      { priority: alertData.urgency === 'immediate' ? 'high' : 'normal' }
    );
  }

  // Sales Receipt Email
  async sendSalesReceipt(saleData, customerEmail) {
    if (!customerEmail || !this.isValidEmail(customerEmail)) {
      throw new Error('Valid customer email is required for receipt');
    }

    const templateParams = {
      to_email: customerEmail,
      to_name: saleData.customerName || 'Valued Customer',
      receipt_number: saleData.id,
      sale_date: saleData.createdAt ? new Date(saleData.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
      customer_name: saleData.customerName || 'Walk-in Customer',
      items: this.formatItemsForEmail(saleData.items || saleData.products),
      subtotal: (saleData.total || 0).toFixed(2),
      total: (saleData.total || 0).toFixed(2),
      payment_method: saleData.paymentType || 'Cash',
      payment_status: saleData.status || 'Paid'
    };

    return this.sendEmail(
      EMAILJS_CONFIG.templateIds.receipt,
      templateParams,
      { priority: 'normal' }
    );
  }

  // Low Stock Report Email
  async sendLowStockReport(stockData, recipientEmail = 'manager@mypackaging.com') {
    const lowStockItems = stockData.filter(product => 
      (product.stockBalance || 0) <= (product.reorderPoint || 10)
    );

    if (lowStockItems.length === 0) {
      console.log('No low stock items to report');
      return;
    }

    const templateParams = {
      to_email: recipientEmail,
      to_name: 'Store Manager',
      report_date: new Date().toLocaleDateString(),
      low_stock_count: lowStockItems.length,
      low_stock_items: this.formatLowStockForEmail(lowStockItems),
      total_products: stockData.length,
      report_type: 'Low Stock Alert'
    };

    return this.sendEmail(
      EMAILJS_CONFIG.templateIds.lowStock,
      templateParams,
      { priority: 'high' }
    );
  }

  // Daily Sales Report Email
  async sendDailySalesReport(salesData, date = new Date(), recipientEmail = 'manager@mypackaging.com') {
    const dailySales = salesData.filter(sale => {
      const saleDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
      return saleDate.toDateString() === date.toDateString();
    });

    const totalRevenue = dailySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalTransactions = dailySales.length;

    const templateParams = {
      to_email: recipientEmail,
      to_name: 'Store Manager',
      report_date: date.toLocaleDateString(),
      total_sales: totalRevenue.toFixed(2),
      total_transactions: totalTransactions,
      average_sale: totalTransactions > 0 ? (totalRevenue / totalTransactions).toFixed(2) : '0.00',
      top_products: this.getTopProductsFromSales(dailySales),
      sales_summary: this.formatSalesForEmail(dailySales.slice(0, 10)) // Top 10 sales
    };

    return this.sendEmail(
      EMAILJS_CONFIG.templateIds.salesReport,
      templateParams,
      { priority: 'low' }
    );
  }

  // Password Reset Email
  async sendPasswordResetNotification(userData, adminEmail = 'admin@mypackaging.com') {
    const templateParams = {
      to_email: adminEmail,
      to_name: 'System Administrator',
      user_email: userData.email,
      user_role: userData.role,
      request_time: new Date().toLocaleString(),
      message: `Password reset request from ${userData.email} (${userData.role})`
    };

    return this.sendEmail(
      EMAILJS_CONFIG.templateIds.passwordReset,
      templateParams,
      { priority: 'high' }
    );
  }

  // Utility Methods
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  formatItemsForEmail(items) {
    if (!Array.isArray(items)) return 'No items';
    
    return items.map(item => 
      `${item.name || item.productName} - ${item.quantity} x RM${(item.price || item.unitPrice || 0).toFixed(2)} = RM${((item.quantity || 0) * (item.price || item.unitPrice || 0)).toFixed(2)}`
    ).join('\n');
  }

  formatLowStockForEmail(items) {
    return items.map(item => 
      `${item.name} - Current: ${item.stockBalance || 0} units (Reorder: ${item.reorderPoint || 10} units)`
    ).join('\n');
  }

  formatSalesForEmail(sales) {
    return sales.map(sale => 
      `${sale.customerName || 'Walk-in'} - RM${(sale.total || 0).toFixed(2)} (${sale.paymentType || 'Cash'})`
    ).join('\n');
  }

  getTopProductsFromSales(sales) {
    const productSales = {};
    
    sales.forEach(sale => {
      const items = sale.items || sale.products || [];
      items.forEach(item => {
        const productName = item.name || item.productName;
        if (productName) {
          productSales[productName] = (productSales[productName] || 0) + (item.quantity || 0);
        }
      });
    });

    return Object.entries(productSales)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, quantity]) => `${name}: ${quantity} units`)
      .join('\n');
  }

  // Test email functionality
  async testEmailService() {
    try {
      const testParams = {
        to_email: 'test@example.com',
        to_name: 'Test User',
        message: 'This is a test email from MyPackaging system',
        test_time: new Date().toLocaleString()
      };

      console.log('Testing email service...');
      const result = await this.sendEmail(
        EMAILJS_CONFIG.templateIds.stockAlert, // Use stock alert template for testing
        testParams,
        { priority: 'low' }
      );
      
      console.log('Email service test successful:', result);
      return true;
    } catch (error) {
      console.error('Email service test failed:', error);
      return false;
    }
  }

  // Configuration methods
  getConfiguration() {
    return {
      serviceId: EMAILJS_CONFIG.serviceId,
      templateIds: EMAILJS_CONFIG.templateIds,
      isInitialized: this.isInitialized,
      queueLength: this.emailQueue.length,
      isProcessing: this.isProcessing
    };
  }

  updateConfiguration(newConfig) {
    Object.assign(EMAILJS_CONFIG, newConfig);
    this.isInitialized = initializeEmailJS();
    return this.getConfiguration();
  }
}

// Create singleton instance
const emailService = new EmailService();

export default emailService;

// Named exports for convenience
export const {
  sendStockAlert,
  sendSalesReceipt,
  sendLowStockReport,
  sendDailySalesReport,
  sendPasswordResetNotification,
  testEmailService
} = emailService;