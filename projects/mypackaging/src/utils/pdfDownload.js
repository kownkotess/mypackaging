import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

/**
 * Download a PDF file to device storage
 * Works on both web and native (Android/iOS)
 * 
 * @param {jsPDF} doc - The jsPDF document instance
 * @param {string} filename - The filename for the PDF
 * @param {boolean} showAlert - Whether to show success alert (default: true)
 * @returns {Promise<string>} The file URI on native, undefined on web
 */
export async function downloadPDF(doc, filename, showAlert = true) {
  const platform = Capacitor.getPlatform();
  console.log('downloadPDF called - Platform:', platform);
  console.log('downloadPDF called - Filename:', filename);
  
  if (platform === 'web') {
    // Web: Use normal jsPDF save
    console.log('Using web download (doc.save)');
    doc.save(filename);
    return;
  }
  
  // Native (Android/iOS): Save to filesystem WITHOUT share dialog
  console.log('Using NATIVE download (Filesystem API) - NO SHARE DIALOG');
  try {
    // Get PDF as base64 string
    const pdfOutput = doc.output('datauristring');
    const base64Data = pdfOutput.split(',')[1]; // Remove data:application/pdf;base64, prefix
    
    // Save to MyPackaging folder in Documents
    const savedFile = await Filesystem.writeFile({
      path: `MyPackaging/${filename}`,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true
    });
    
    console.log('PDF saved to:', savedFile.uri);
    
    // Show success alert without opening share dialog
    if (showAlert) {
      alert(`✅ PDF saved to Documents/MyPackaging/${filename}`);
    }
    
    return savedFile.uri;
  } catch (error) {
    console.error('Error saving PDF:', error);
    throw new Error(`Failed to save PDF: ${error.message}`);
  }
}

/**
 * Check if storage permissions are granted (Android 13+)
 * This is automatically handled by Capacitor, but you can use this for custom checks
 */
export async function checkStoragePermissions() {
  const platform = Capacitor.getPlatform();
  
  if (platform === 'web') {
    return true; // No permissions needed on web
  }
  
  try {
    // Capacitor Filesystem automatically requests permissions when needed
    // We can test by checking if we can write
    await Filesystem.writeFile({
      path: 'test.txt',
      data: 'test',
      directory: Directory.Documents
    });
    
    // Clean up test file
    await Filesystem.deleteFile({
      path: 'test.txt',
      directory: Directory.Documents
    });
    
    return true;
  } catch (error) {
    console.error('Storage permission error:', error);
    return false;
  }
}
