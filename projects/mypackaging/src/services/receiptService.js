import jsPDF from 'jspdf';
import { format } from 'date-fns';
import businessInfoService from './businessInfoService';
import { downloadPDF } from '../utils/pdfDownload';

class ReceiptService {
  constructor() {
    // Cache for business info to avoid multiple fetches
    this.businessInfoCache = null;
    this.cacheExpiry = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get business information with caching
   */
  async getBusinessInfo() {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.businessInfoCache && this.cacheExpiry && now < this.cacheExpiry) {
      return this.businessInfoCache;
    }

    try {
      // Fetch fresh business info
      this.businessInfoCache = await businessInfoService.getReceiptBusinessInfo();
      this.cacheExpiry = now + this.cacheTimeout;
      return this.businessInfoCache;
    } catch (error) {
      console.error('Error fetching business info for receipt:', error);
      // Return fallback data
      return {
        name: 'MyPackaging Store',
        tagline: 'Your Packaging Solutions Partner',
        address: [
          '123 Business Street',
          'Kuala Lumpur, 50000',
          'Malaysia'
        ],
        phone: '+60 3-1234 5678',
        email: 'info@mypackaging.com',
        website: 'www.mypackaging.com',
        registrationNumber: ''
      };
    }
  }

  /**
   * Clear business info cache (call when business info is updated)
   */
  clearCache() {
    this.businessInfoCache = null;
    this.cacheExpiry = null;
  }

  /**
   * Generate a professional PDF receipt
   * @param {Object} saleData - The sale transaction data
   * @param {string} receiptNumber - Unique receipt number
   * @returns {jsPDF} - PDF document instance
   */
  async generateReceipt(saleData, receiptNumber) {
    // Get fresh business information
    const companyInfo = await this.getBusinessInfo();
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPosition = 15; // Start higher to fit more content

    // Helper function to add centered text
    const addCenteredText = (text, y, fontSize = 12, style = 'normal') => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', style);
      const textWidth = doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor;
      const x = (pageWidth - textWidth) / 2;
      doc.text(text, x, y);
      return y + (fontSize * 0.35); // Reduced spacing
    };

    // Helper function to add left-aligned text
    const addText = (text, x, y, fontSize = 10, style = 'normal') => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', style);
      doc.text(text, x, y);
      return y + (fontSize * 0.3); // Reduced spacing
    };

    // Try to add logo if available
    try {
      // Load logo from assets folder
      const logoImage = new Image();
      logoImage.crossOrigin = 'anonymous';
      
      // Create a promise to handle image loading
      const logoPromise = new Promise((resolve) => {
        logoImage.onload = () => {
          try {
            // Add logo at top center
            const logoWidth = 30;
            const logoHeight = 20;
            const logoX = (pageWidth - logoWidth) / 2;
            doc.addImage(logoImage, 'PNG', logoX, yPosition, logoWidth, logoHeight);
            yPosition += logoHeight + 5;
            resolve();
          } catch (error) {
            console.log('Could not add logo to receipt:', error);
            resolve();
          }
        };
        logoImage.onerror = () => {
          console.log('Logo not found, proceeding without logo');
          resolve();
        };
        // Try to load logo from assets
        logoImage.src = '/logo.png'; // Public folder
      });

      await logoPromise;
    } catch (error) {
      console.log('Logo loading failed, proceeding without logo:', error);
    }

    // Header Section - Compact layout
    yPosition = addCenteredText(companyInfo.name, yPosition, 16, 'bold'); // Reduced size
    yPosition = addCenteredText(companyInfo.tagline, yPosition + 3, 9, 'italic'); // Reduced spacing
    
    // Company details - Compact
    companyInfo.address.forEach(line => {
      yPosition = addCenteredText(line, yPosition + 3, 8); // Smaller font and spacing
    });
    yPosition = addCenteredText(`Tel: ${companyInfo.phone}`, yPosition + 3, 8);
    yPosition = addCenteredText(`Email: ${companyInfo.email}`, yPosition + 3, 8);
    
    // Add registration number if available
    if (companyInfo.registrationNumber) {
      yPosition = addCenteredText(`Reg No: ${companyInfo.registrationNumber}`, yPosition + 3, 8);
    }

    // Separator line
    yPosition += 8; // Reduced spacing
    doc.setLineWidth(0.5);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 8;

    // Receipt Title and Number - Compact
    yPosition = addCenteredText('SALES RECEIPT', yPosition, 14, 'bold'); // Reduced size
    yPosition = addCenteredText(`Receipt #: ${receiptNumber}`, yPosition + 6, 9, 'bold');

    // Transaction details - Compact
    yPosition += 8;
    const currentDate = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
    yPosition = addText(`Date: ${currentDate}`, 20, yPosition, 9);
    yPosition = addText(`Customer: ${saleData.customerName || 'Walk In'}`, 20, yPosition + 3, 9);
    yPosition = addText(`Payment: ${this.formatPaymentMethod(saleData.paymentType)}`, 20, yPosition + 3, 9);
    yPosition = addText(`Served by: ${saleData.createdBy}`, 20, yPosition + 3, 9);

    // Items header - Compact
    yPosition += 10;
    doc.setLineWidth(0.3);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 6;

    // Table headers - Smaller font
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Item', 20, yPosition);
    doc.text('Qty', 120, yPosition);
    doc.text('Price', 140, yPosition);
    doc.text('Total', 170, yPosition);
    
    yPosition += 4;
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 5;

    // Items list - Compact
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8); // Smaller font for items
    saleData.items.forEach(item => {
      const itemDescription = this.formatItemDescription(item);
      const unitPrice = `RM${item.unitPrice.toFixed(2)}`;
      const total = `RM${item.subtotal.toFixed(2)}`;

      // Handle long item names with smaller font
      if (itemDescription.length > 35) {
        const lines = doc.splitTextToSize(itemDescription, 90);
        lines.forEach((line, index) => {
          doc.text(line, 20, yPosition + (index * 3)); // Reduced line spacing
        });
        yPosition += lines.length * 3;
      } else {
        doc.text(itemDescription, 20, yPosition);
        yPosition += 3;
      }

      // Align quantities, prices and totals
      const totalQty = (item.qtyBox || 0) + (item.qtyPack || 0) + (item.qtyLoose || 0);
      doc.text(totalQty.toString(), 120, yPosition - 3);
      doc.text(unitPrice, 140, yPosition - 3);
      doc.text(total, 170, yPosition - 3);
      
      yPosition += 4; // Reduced spacing between items
    });

    // Totals section - Compact
    yPosition += 3;
    doc.setLineWidth(0.3);
    doc.line(120, yPosition, pageWidth - 20, yPosition);
    yPosition += 6;

    // Summary calculations
    const subtotal = saleData.subtotal || 0;
    const deduction = Math.abs(saleData.roundOff || 0);
    const total = saleData.total || 0;
    const paid = saleData.paidAmount || 0;
    const remaining = saleData.remaining || 0;

    // Subtotal - Smaller font
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Subtotal:', 120, yPosition);
    doc.text(`RM${subtotal.toFixed(2)}`, 170, yPosition);
    yPosition += 5;

    // Deduction (if any)
    if (deduction > 0) {
      doc.text('Deduction:', 120, yPosition);
      doc.text(`-RM${deduction.toFixed(2)}`, 170, yPosition);
      yPosition += 5;
    }

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Total:', 120, yPosition);
    doc.text(`RM${total.toFixed(2)}`, 170, yPosition);
    yPosition += 6;

    // Payment details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Amount Paid:', 120, yPosition);
    doc.text(`RM${paid.toFixed(2)}`, 170, yPosition);
    yPosition += 5;

    if (remaining > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Outstanding:', 120, yPosition);
      doc.text(`RM${remaining.toFixed(2)}`, 170, yPosition);
      yPosition += 5;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.text('PAID IN FULL', 120, yPosition);
      yPosition += 5;
    }

    // Footer - Compact and only if space available
    yPosition += 10;
    
    // Check if we have space for footer, if not, make it minimal
    if (yPosition < pageHeight - 30) {
      doc.setLineWidth(0.3);
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 8;

      // Thank you message - Smaller
      yPosition = addCenteredText('Thank you for your business!', yPosition, 10, 'bold');
      yPosition = addCenteredText('Please keep this receipt for your records', yPosition + 4, 8);
      
      // Contact info footer - Only if space
      if (yPosition < pageHeight - 15) {
        yPosition += 8;
        yPosition = addCenteredText(`Visit us: ${companyInfo.website}`, yPosition, 7);
      }
    } else {
      // Minimal footer if running out of space
      yPosition = addCenteredText('Thank you for your business!', yPosition, 9, 'bold');
    }

    return doc;
  }

  /**
   * Format item description with quantities
   */
  formatItemDescription(item) {
    const parts = [item.name];
    
    if (item.qtyBox > 0) {
      parts.push(`${item.qtyBox} Box(es)`);
    }
    if (item.qtyPack > 0) {
      parts.push(`${item.qtyPack} Pack(s)`);
    }
    if (item.qtyLoose > 0) {
      parts.push(`${item.qtyLoose} Unit(s)`);
    }

    return parts.join(' - ');
  }

  /**
   * Format payment method for display
   */
  formatPaymentMethod(method) {
    const methods = {
      'cash': 'Cash',
      'online': 'Online Transfer',
      'hutang': 'Credit (Hutang)'
    };
    return methods[method] || method;
  }

  /**
   * Generate receipt number based on current date and sale ID
   */
  generateReceiptNumber(saleId) {
    const now = new Date();
    const dateStr = format(now, 'yyyyMMdd');
    const timeStr = format(now, 'HHmmss');
    return `RCP-${dateStr}-${timeStr}-${saleId.slice(-4).toUpperCase()}`;
  }

  /**
   * Download PDF receipt with enhanced filename
   * Works on both web and native (Android/iOS)
   */
  async downloadReceipt(saleData, receiptNumber, customFilename = null) {
    const doc = await this.generateReceipt(saleData, receiptNumber);
    
    let filename;
    if (customFilename) {
      filename = customFilename;
    } else {
      const customerName = saleData.customerName || 'Customer';
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const cleanCustomerName = customerName.replace(/[^a-zA-Z0-9]/g, '');
      filename = `Receipt_${receiptNumber}_${cleanCustomerName}_${dateStr}.pdf`;
    }
    
    // Use the native-compatible download function
    await downloadPDF(doc, filename, true);
    console.log(`Receipt downloaded: ${filename}`);
    return filename;
  }

  /**
   * Generate WhatsApp message with receipt info
   */
  generateWhatsAppMessage(saleData, receiptNumber) {
    const customerName = saleData.customerName || 'Valued Customer';
    const total = (saleData.total || 0).toFixed(2);
    const date = saleData.createdAt ? new Date(saleData.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
    
    const message = `Hi ${customerName}! 👋

Thank you for your purchase at MyPackaging! 🛍️

Receipt Details:
📋 Receipt Number: ${receiptNumber}
📅 Date: ${date}
💰 Total: RM${total}
✅ Status: Paid

Your receipt PDF has been prepared and can be shared with you. Thank you for choosing MyPackaging! 🙏`;

    return encodeURIComponent(message);
  }

  /**
   * Get PDF as blob for email attachment
   */
  async getReceiptBlob(saleData, receiptNumber) {
    const doc = await this.generateReceipt(saleData, receiptNumber);
    return doc.output('blob');
  }

  /**
   * Get receipt as base64 string
   */
  async getReceiptBase64(saleData, receiptNumber) {
    const doc = await this.generateReceipt(saleData, receiptNumber);
    return doc.output('datauristring');
  }

  /**
   * Share receipt via native share sheet (WhatsApp, etc.)
   * Works on both web and mobile (Capacitor)
   */
  async shareReceipt(saleData, receiptNumber, message = '') {
    try {
      const { Capacitor } = await import('@capacitor/core');
      const isNative = Capacitor.isNativePlatform();
      
      // Generate the PDF document
      const doc = await this.generateReceipt(saleData, receiptNumber);
      
      // Decode URL-encoded message
      const decodedMessage = message ? decodeURIComponent(message) : '';
      
      if (isNative) {
        // Native mobile share (Android/iOS)
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        
        // Convert PDF to base64
        const base64Data = doc.output('datauristring').split(',')[1];
        
        // Save to cache directory for sharing
        const filename = `Receipt-${receiptNumber}.pdf`;
        
        try {
          const result = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.Cache
          });
          
          console.log('PDF saved to cache for sharing:', result.uri);
          
          // Share with native share sheet
          await Share.share({
            title: `Receipt ${receiptNumber}`,
            text: decodedMessage,
            url: result.uri,
            dialogTitle: 'Share Receipt'
          });
          
          console.log('Share completed successfully');
          return { success: true };
        } catch (fileError) {
          console.error('Filesystem or Share error:', fileError);
          throw new Error(`Failed to save or share PDF: ${fileError.message}`);
        }
      } else {
        // Web fallback - download PDF and open share if available
        const pdfBlob = doc.output('blob');
        
        if (navigator.share) {
          // Web Share API (if supported)
          const file = new File([pdfBlob], `Receipt-${receiptNumber}.pdf`, { type: 'application/pdf' });
          await navigator.share({
            title: `Receipt ${receiptNumber}`,
            text: decodedMessage,
            files: [file]
          });
          return { success: true };
        } else {
          // Fallback - just download
          doc.save(`Receipt-${receiptNumber}.pdf`);
          alert('PDF downloaded. Please manually share via WhatsApp.');
          return { success: true };
        }
      }
    } catch (error) {
      console.error('Share receipt error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Preview receipt in new window
   */
  async previewReceipt(saleData, receiptNumber) {
    const doc = await this.generateReceipt(saleData, receiptNumber);
    const pdfUrl = doc.output('bloburl');
    window.open(pdfUrl, '_blank');
  }
}

// Export singleton instance
const receiptService = new ReceiptService();
export default receiptService;