// Business Information Service
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const BUSINESS_INFO_COLLECTION = 'businessInfo';
const BUSINESS_INFO_DOC = 'main';

class BusinessInfoService {
  constructor() {
    this.cache = null;
    this.cacheExpiry = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  // Cache management
  clearCache() {
    this.cache = null;
    this.cacheExpiry = null;
  }

  isCacheValid() {
    return this.cache && this.cacheExpiry && Date.now() < this.cacheExpiry;
  }

  setCache(data) {
    this.cache = data;
    this.cacheExpiry = Date.now() + this.CACHE_DURATION;
  }
  // Default business information
  getDefaultBusinessInfo() {
    return {
      shopName: 'MyPackaging Store',
      address: '123 Business Street\nKuala Lumpur, 50000\nMalaysia',
      phone: '+60 3-1234 5678',
      email: 'info@mypackaging.com',
      registrationNumber: 'SSM-1234567890',
      website: 'www.mypackaging.com',
      tagline: 'Your Packaging Solutions Partner',
      currency: 'MYR',
      taxRate: 6.00,
      dateFormat: 'DD/MM/YYYY',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Get business information
  async getBusinessInfo() {
    try {
      // Return cached data if valid
      if (this.isCacheValid()) {
        console.log('Returning cached business info');
        return this.cache;
      }

      console.log('Fetching business info from Firestore');
      const docRef = doc(db, BUSINESS_INFO_COLLECTION, BUSINESS_INFO_DOC);
      const docSnap = await getDoc(docRef);
      
      let businessInfo;
      
      if (docSnap.exists()) {
        businessInfo = {
          id: docSnap.id,
          ...docSnap.data()
        };
      } else {
        // Create default business info if doesn't exist
        console.log('Creating default business info');
        const defaultInfo = this.getDefaultBusinessInfo();
        await setDoc(docRef, defaultInfo);
        businessInfo = {
          id: BUSINESS_INFO_DOC,
          ...defaultInfo
        };
      }
      
      // Cache the result
      this.setCache(businessInfo);
      return businessInfo;
      
    } catch (error) {
      console.error('Error getting business info:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Return default info on error
      const defaultInfo = {
        id: BUSINESS_INFO_DOC,
        ...this.getDefaultBusinessInfo()
      };
      
      return defaultInfo;
    }
  }

  // Update business information
  async updateBusinessInfo(businessInfo) {
    try {
      console.log('Attempting to update business info:', businessInfo);
      
      const docRef = doc(db, BUSINESS_INFO_COLLECTION, BUSINESS_INFO_DOC);
      const updateData = {
        ...businessInfo,
        updatedAt: new Date()
      };
      
      // Remove any undefined or null values that might cause issues
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === null) {
          delete updateData[key];
        }
      });
      
      console.log('Processed update data:', updateData);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      console.log('Document exists:', docSnap.exists());
      
      if (docSnap.exists()) {
        console.log('Updating existing document...');
        await updateDoc(docRef, updateData);
        console.log('Document updated successfully');
      } else {
        console.log('Creating new document...');
        const newDocData = {
          ...this.getDefaultBusinessInfo(),
          ...updateData,
          createdAt: new Date()
        };
        await setDoc(docRef, newDocData);
        console.log('Document created successfully');
      }
      
      // Clear cache after successful update
      this.clearCache();
      
      return true;
    } catch (error) {
      console.error('Error updating business info:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Provide more specific error messages
      if (error.code === 'permission-denied') {
        throw new Error('Permission denied. Please check your user permissions.');
      } else if (error.code === 'unavailable') {
        throw new Error('Firebase service is currently unavailable. Please try again.');
      } else if (error.code === 'failed-precondition') {
        throw new Error('Database operation failed. Please refresh and try again.');
      } else {
        throw new Error(`Failed to save business information: ${error.message}`);
      }
    }
  }

  // Get formatted address array
  getFormattedAddress(businessInfo) {
    if (!businessInfo?.address) return [];
    return businessInfo.address.split('\n').filter(line => line.trim());
  }

  // Get business info for receipts
  async getReceiptBusinessInfo() {
    const businessInfo = await this.getBusinessInfo();
    return {
      name: businessInfo.shopName || 'MyPackaging Store',
      tagline: businessInfo.tagline || 'Your Packaging Solutions Partner',
      address: this.getFormattedAddress(businessInfo),
      phone: businessInfo.phone || '+60 3-1234 5678',
      email: businessInfo.email || 'info@mypackaging.com',
      website: businessInfo.website || 'www.mypackaging.com',
      registrationNumber: businessInfo.registrationNumber || ''
    };
  }
}

// Export singleton instance
const businessInfoService = new BusinessInfoService();
export default businessInfoService;