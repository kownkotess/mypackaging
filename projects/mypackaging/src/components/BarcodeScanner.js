import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import './BarcodeScanner.css';

const BarcodeScanner = ({ onScan, onClose, isOpen }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState([]);
  const html5QrcodeRef = useRef(null);
  const isInitializedRef = useRef(false);

  const stopScanning = useCallback(async () => {
    if (html5QrcodeRef.current && isInitializedRef.current) {
      try {
        await html5QrcodeRef.current.stop();
        isInitializedRef.current = false;
        console.log('Scanner stopped successfully');
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  }, []);

  const initializeScanner = useCallback(async () => {
    try {
      setError('');
      setIsScanning(true);

      // Create Html5Qrcode instance
      html5QrcodeRef.current = new Html5Qrcode("qr-reader");

      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      setCameras(devices);
      
      if (devices.length === 0) {
        setError('No cameras found on this device');
        setIsScanning(false);
        return;
      }

      // Prefer back camera
      let selectedCamera = devices[0];
      for (let device of devices) {
        if (device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('rear') || 
            device.label.toLowerCase().includes('environment')) {
          selectedCamera = device;
          break;
        }
      }

      // Configuration for scanning
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        supportedScanTypes: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR
        ]
      };

      // Success callback
      const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        console.log('Barcode scanned:', decodedText);
        onScan(decodedText);
        stopScanning();
      };

      // Error callback (just for scanning, not initialization)
      const qrCodeErrorCallback = (errorMessage) => {
        // Most errors are just "no code found" - ignore these
        if (!errorMessage.includes('NotFoundException') && 
            !errorMessage.includes('No MultiFormat Readers') &&
            !errorMessage.includes('No barcode or QR code detected')) {
          console.warn('Scan error:', errorMessage);
        }
      };

      // Start scanning
      await html5QrcodeRef.current.start(
        selectedCamera.id,
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );

      isInitializedRef.current = true;
      setIsScanning(true);
      console.log('Scanner initialized successfully');

    } catch (err) {
      console.error('Scanner initialization error:', err);
      setError(`Failed to initialize camera: ${err.message}`);
      setIsScanning(false);
      isInitializedRef.current = false;
    }
  }, [onScan, stopScanning]);

  useEffect(() => {
    if (isOpen && !isInitializedRef.current) {
      initializeScanner();
    } else if (!isOpen && isInitializedRef.current) {
      stopScanning();
    }

    return () => {
      if (isInitializedRef.current) {
        stopScanning();
      }
    };
  }, [isOpen, initializeScanner, stopScanning]);

  const requestCameraPermission = async () => {
    try {
      setError('Requesting camera permission...');
      
      // Request camera permission explicitly
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
      
      setError('Permission granted, initializing scanner...');
      
      // Wait a moment then reinitialize
      setTimeout(() => {
        initializeScanner();
      }, 1000);
      
    } catch (err) {
      console.error('Permission request error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else {
        setError('Failed to request camera permission. Please check your browser settings.');
      }
      setIsScanning(false);
    }
  };

  const handleManualEntry = () => {
    const code = prompt('Enter barcode manually:');
    if (code && code.trim()) {
      onScan(code.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="barcode-scanner-overlay">
      <div className="barcode-scanner-modal">
        <div className="scanner-header">
          <h3>Scan Product Barcode</h3>
          <button 
            className="close-btn"
            onClick={onClose}
            aria-label="Close scanner"
          >
            ✕
          </button>
        </div>

        <div className="scanner-body">
          {error ? (
            <div className="scanner-error">
              <div className="error-icon">📷</div>
              <p>{error}</p>
              <div className="permission-help">
                <p><strong>Camera Access Help:</strong></p>
                <ul>
                  <li>Ensure camera permission is allowed in browser settings</li>
                  <li>Close other apps that might be using the camera</li>
                  <li>Try refreshing the page if issues persist</li>
                  <li>On mobile: Check if camera works in other apps</li>
                </ul>
              </div>
              <div className="error-actions">
                <button 
                  className="btn btn-success"
                  onClick={requestCameraPermission}
                >
                  🔓 Request Camera Access
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={initializeScanner}
                >
                  Try Again
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={handleManualEntry}
                >
                  Enter Manually
                </button>
              </div>
            </div>
          ) : (
            <div className="scanner-container">
              <div id="qr-reader" style={{ width: "100%" }}></div>
              {!isScanning && (
                <div className="scanner-loading">
                  <div className="spinner"></div>
                  <p>Initializing camera...</p>
                </div>
              )}
              {cameras.length > 1 && (
                <div className="camera-info">
                  <small>📷 {cameras.length} cameras available</small>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="scanner-footer">
          <button 
            className="btn btn-secondary"
            onClick={handleManualEntry}
          >
            Manual Entry
          </button>
          <button 
            className="btn btn-primary"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;