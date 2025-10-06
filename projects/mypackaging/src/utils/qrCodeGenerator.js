import QRCode from 'qrcode';

/**
 * Generate QR code for a product
 * @param {string} productId - The product ID
 * @param {string} productName - The product name
 * @returns {Promise<string>} - Base64 encoded QR code image
 */
export const generateProductQRCode = async (productId, productName) => {
  try {
    // Create QR code data - using product ID as the primary identifier
    const qrData = `PRODUCT:${productId}`;
    
    // Generate QR code with options
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate QR code as canvas element for better control
 * @param {string} productId - The product ID
 * @param {string} productName - The product name
 * @param {HTMLCanvasElement} canvas - Canvas element to render to
 */
export const generateProductQRCodeToCanvas = async (productId, productName, canvas) => {
  try {
    const qrData = `PRODUCT:${productId}`;
    
    await QRCode.toCanvas(canvas, qrData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error('Error generating QR code to canvas:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Parse QR code data to extract product ID
 * @param {string} qrData - The scanned QR code data
 * @returns {string|null} - Product ID if valid, null otherwise
 */
export const parseProductQRCode = (qrData) => {
  try {
    if (qrData.startsWith('PRODUCT:')) {
      return qrData.replace('PRODUCT:', '');
    }
    return null;
  } catch (error) {
    console.error('Error parsing QR code:', error);
    return null;
  }
};

/**
 * Check if scanned data is a product QR code
 * @param {string} qrData - The scanned data
 * @returns {boolean} - True if it's a product QR code
 */
export const isProductQRCode = (qrData) => {
  return qrData.startsWith('PRODUCT:');
};