const fs = require('fs');
const path = require('path');

// Simple PWA icon generator using Canvas (if available) or alternative approach
async function createPWAIcons() {
  console.log('Creating PWA icons from logo.png...');
  
  // For now, let's copy the logo to the required names
  // This will work as a fallback until proper sizing is done
  const logoPath = path.join(__dirname, 'public', 'logo.png');
  
  if (!fs.existsSync(logoPath)) {
    console.error('logo.png not found in public folder');
    return;
  }
  
  // Copy logo to required icon names as fallback
  const iconSizes = [
    { name: 'logo192.png', size: '192x192' },
    { name: 'logo512.png', size: '512x512' },
    { name: 'favicon.ico', size: '32x32' }
  ];
  
  iconSizes.forEach(icon => {
    const targetPath = path.join(__dirname, 'public', icon.name);
    if (icon.name !== 'favicon.ico') { // Skip favicon for now
      fs.copyFileSync(logoPath, targetPath);
      console.log(`Created ${icon.name} (${icon.size})`);
    }
  });
  
  console.log('Basic PWA icons created. For optimal results, resize them properly.');
  console.log('You can use online tools like: https://realfavicongenerator.net/');
}

createPWAIcons().catch(console.error);