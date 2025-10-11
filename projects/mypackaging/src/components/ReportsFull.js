import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContextWrapper';
import { useAlert } from '../context/AlertContext';
import { RequirePermission } from './RoleComponents';
import ReturnToTop from './ReturnToTop';
import ReportExpandModal from './ReportExpandModal';
import { logActivity } from '../lib/auditLog';
import { 
  collection, 
  query, 
  onSnapshot,
  orderBy,
  doc,
  runTransaction
} from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { format, subDays, isToday, getHours } from 'date-fns';
import { db } from '../firebase';
import '../styles/Reports.css';
import receiptService from '../services/receiptService';
import emailService from '../services/emailService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

const Reports = () => {
  const { showSuccess, showError, showConfirm } = useAlert();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('financial');
  const [dateRange, setDateRange] = useState('month');
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const componentRef = useRef();

  // Financial Data
  const [profitLoss, setProfitLoss] = useState({});
  const [cashFlow, setCashFlow] = useState([]);
  const [hutangAging, setHutangAging] = useState([]);
  const [taxSummary, setTaxSummary] = useState({});

  // Business Insights
  const [customerPatterns, setCustomerPatterns] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [seasonalTrends, setSeasonalTrends] = useState([]);
  const [roiData, setRoiData] = useState([]);

  // Inventory Intelligence
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [stockMovementAnalysis, setStockMovementAnalysis] = useState([]);
  const [productPerformance, setProductPerformance] = useState([]);
  const [deadStock, setDeadStock] = useState([]);

  // Pagination for sales
  const [salesCurrentPage, setSalesCurrentPage] = useState(1);
  const [salesItemsPerPage] = useState(15); // Show 15 sales per page

  // Enhanced date filtering for Sales Recorded tab
  const [customDateRange, setCustomDateRange] = useState({
    filterType: 'preset', // 'preset' or 'custom'
    startDate: '',
    endDate: '',
    singleDate: ''
  });

  // Modal states for expanded views
  const [expandedModal, setExpandedModal] = useState({
    isOpen: false,
    title: '',
    content: null,
    icon: ''
  });

  // Subscribe to data
  useEffect(() => {
    const unsubscribes = [];

    try {
      // Sales data
      const salesQuery = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(salesQuery, (snapshot) => {
        const salesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setSales(salesData);
      }));

      // Products data
      const productsQuery = query(collection(db, 'products'));
      unsubscribes.push(onSnapshot(productsQuery, (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Sort products alphabetically by name
        const sortedProducts = productsData.sort((a, b) => 
          a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );
        setProducts(sortedProducts);
      }));

      // Purchases data
      const purchasesQuery = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(purchasesQuery, (snapshot) => {
        const purchasesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setPurchases(purchasesData);
      }));

      // Payments data (hutang repayments)
      const paymentsQuery = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(paymentsQuery, (snapshot) => {
        const paymentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setPayments(paymentsData);
      }));

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // Calculate reports when data changes
  const calculateFinancialReports = useCallback(() => {
    // DEBUG: Show purchase items and quantities
    console.log('DEBUG: Purchases for financial report:', purchases);
    purchases.forEach(purchase => {
      if (purchase.items) {
        purchase.items.forEach(item => {
          console.log(`DEBUG: Purchase item - cost: ${item.cost}, quantity: ${item.quantity}`);
        });
      }
    });
    if (!sales.length && !products.length) return;

    const now = new Date();
    const periodStart = dateRange === 'week' ? subDays(now, 7) : 
                       dateRange === 'month' ? subDays(now, 30) :
                       dateRange === 'quarter' ? subDays(now, 90) :
                       subDays(now, 365);

    const periodSales = sales.filter(sale => sale.createdAt >= periodStart);
    const periodPurchases = purchases.filter(purchase => purchase.createdAt >= periodStart);

    // Profit & Loss
    const totalRevenue = periodSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalCosts = periodPurchases.reduce((sum, purchase) => {
  return sum + (purchase.items?.reduce((itemSum, item) => itemSum + ((item.cost || 0) * (item.qty || 1)), 0) || 0);
    }, 0);
    const grossProfit = totalRevenue - totalCosts;
    const netProfit = grossProfit;

    setProfitLoss({
      revenue: totalRevenue,
      costs: totalCosts,
      grossProfit,
      netProfit,
      margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    });

    // Cash Flow Analysis
    const cashFlowData = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i);
      const daySales = sales.filter(sale => 
        sale.createdAt && 
        isToday(date) ? isToday(sale.createdAt) : 
        sale.createdAt.toDateString() === date.toDateString()
      );
      const dayPurchases = purchases.filter(purchase => 
        purchase.createdAt && 
        isToday(date) ? isToday(purchase.createdAt) : 
        purchase.createdAt.toDateString() === date.toDateString()
      );

      const inflow = daySales.reduce((sum, sale) => sum + (sale.paidAmount || 0), 0);
      const outflow = dayPurchases.reduce((sum, purchase) => {
        return sum + (purchase.items?.reduce((itemSum, item) => itemSum + (item.cost || 0), 0) || 0);
      }, 0);

      cashFlowData.push({
        date: format(date, 'MMM dd'),
        inflow,
        outflow,
        net: inflow - outflow
      });
    }
    setCashFlow(cashFlowData);

    // Hutang Aging
    const hutangSales = sales.filter(sale => sale.status === 'Hutang');
    const aging = { current: 0, days30: 0, days60: 0, days90: 0 };

    hutangSales.forEach(sale => {
      const daysDiff = Math.floor((now - sale.createdAt) / (1000 * 60 * 60 * 24));
      const remaining = sale.remaining || 0;

      if (daysDiff <= 30) aging.current += remaining;
      else if (daysDiff <= 60) aging.days30 += remaining;
      else if (daysDiff <= 90) aging.days60 += remaining;
      else aging.days90 += remaining;
    });

    setHutangAging([
      { name: '0-30 days', value: aging.current, color: '#8884d8' },
      { name: '31-60 days', value: aging.days30, color: '#82ca9d' },
      { name: '61-90 days', value: aging.days60, color: '#ffc658' },
      { name: '90+ days', value: aging.days90, color: '#ff7c7c' }
    ].filter(item => item.value > 0));

    // Tax Summary
    const totalTaxableAmount = periodSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const gstAmount = totalTaxableAmount * 0.06;

    setTaxSummary({
      totalSales: totalTaxableAmount,
      gstCollected: gstAmount,
      netSales: totalTaxableAmount - gstAmount,
      period: `${format(periodStart, 'MMM dd')} - ${format(now, 'MMM dd, yyyy')}`
    });
  }, [sales, products, purchases, dateRange]);

  const calculateBusinessInsights = useCallback(() => {
    if (!sales.length) return;

    // Customer Patterns
    const customerData = {};
    sales.forEach(sale => {
      const customer = sale.customerName || 'Walk-in Customer';
      if (!customerData[customer]) {
        customerData[customer] = {
          name: customer,
          totalSpent: 0,
          visits: 0,
          avgOrderValue: 0,
          lastVisit: null
        };
      }
      customerData[customer].totalSpent += sale.total || 0;
      customerData[customer].visits += 1;
      customerData[customer].lastVisit = sale.createdAt;
    });

    Object.values(customerData).forEach(customer => {
      customer.avgOrderValue = customer.totalSpent / customer.visits;
    });

    setCustomerPatterns(Object.values(customerData).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10));

    // Peak Hours Analysis
    const hourData = Array.from({ length: 24 }, (_, i) => ({ hour: i, sales: 0, revenue: 0 }));
    sales.forEach(sale => {
      if (sale.createdAt) {
        const hour = getHours(sale.createdAt);
        hourData[hour].sales += 1;
        hourData[hour].revenue += sale.total || 0;
      }
    });

    setPeakHours(hourData.filter(h => h.sales > 0));

    // Seasonal Trends (monthly)
    const monthlyData = {};
    sales.forEach(sale => {
      if (sale.createdAt) {
        const monthKey = format(sale.createdAt, 'MMM yyyy');
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { month: monthKey, sales: 0, revenue: 0 };
        }
        monthlyData[monthKey].sales += 1;
        monthlyData[monthKey].revenue += sale.total || 0;
      }
    });

    setSeasonalTrends(Object.values(monthlyData).sort((a, b) => new Date(a.month) - new Date(b.month)));

    // ROI Analysis
    const productROI = products.map(product => {
      const productSales = sales.filter(sale => 
        sale.items?.some(item => item.productId === product.id)
      );
      
      const totalRevenue = productSales.reduce((sum, sale) => {
        const productItems = sale.items?.filter(item => item.productId === product.id) || [];
        return sum + productItems.reduce((itemSum, item) => itemSum + (item.subtotal || 0), 0);
      }, 0);

      const totalCost = (product.totalPurchased || 0) * (product.unitPrice || 0) * 0.7;
      const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;

      return {
        name: product.name,
        revenue: totalRevenue,
        cost: totalCost,
        roi: roi,
        profit: totalRevenue - totalCost
      };
    }).sort((a, b) => b.roi - a.roi);

    setRoiData(productROI.slice(0, 10));
  }, [sales, products]);

  const calculateInventoryIntelligence = useCallback(() => {
    if (!products.length) return;

    // Low Stock Alerts
    const lowStock = products.filter(product => {
      const stockBalance = product.stockBalance || 0;
      const reorderPoint = product.reorderPoint || 10;
      return stockBalance <= reorderPoint;
    }).sort((a, b) => (a.stockBalance || 0) - (b.stockBalance || 0));

    setLowStockAlerts(lowStock);

    // Stock Movement Analysis
    const movement = products.map(product => {
      const daysInStock = 30;
      const turnoverRate = product.stockBalance > 0 ? 
        (product.quantitySold || 0) / (product.stockBalance || 1) : 0;
      
      return {
        name: product.name,
        stock: product.stockBalance || 0,
        sold: product.quantitySold || 0,
        purchased: product.totalPurchased || 0,
        turnover: turnoverRate,
        daysOfStock: turnoverRate > 0 ? daysInStock / turnoverRate : 999
      };
    }).sort((a, b) => b.turnover - a.turnover);

    setStockMovementAnalysis(movement);

    // Product Performance
    const performance = products.map(product => {
      const productSales = sales.filter(sale => 
        sale.items?.some(item => item.productId === product.id)
      );
      
      const revenue = productSales.reduce((sum, sale) => {
        const productItems = sale.items?.filter(item => item.productId === product.id) || [];
        return sum + productItems.reduce((itemSum, item) => itemSum + (item.subtotal || 0), 0);
      }, 0);

      const quantity = productSales.reduce((sum, sale) => {
        const productItems = sale.items?.filter(item => item.productId === product.id) || [];
        return sum + productItems.reduce((itemSum, item) => {
          // Calculate total quantity from qtyBox, qtyPack, and qtyLoose
          const totalQty = (item.qtyBox || 0) + (item.qtyPack || 0) + (item.qtyLoose || 0);
          return itemSum + totalQty;
        }, 0);
      }, 0);

      return {
        name: product.name,
        revenue,
        quantity,
        avgPrice: quantity > 0 ? revenue / quantity : 0,
        performance: revenue > 0 ? 'Active' : 'Inactive'
      };
    }).sort((a, b) => b.revenue - a.revenue);

    setProductPerformance(performance);

    // Dead Stock (no sales in 60 days)
    const sixtyDaysAgo = subDays(new Date(), 60);
    const dead = products.filter(product => {
      const recentSales = sales.filter(sale => 
        sale.createdAt >= sixtyDaysAgo &&
        sale.items?.some(item => item.productId === product.id)
      );
      
      return recentSales.length === 0 && (product.stockBalance || 0) > 0;
    });

    setDeadStock(dead);
  }, [products, sales]);

  useEffect(() => {
    if (sales.length > 0 || products.length > 0) {
      calculateFinancialReports();
      calculateBusinessInsights();
      calculateInventoryIntelligence();
    }
  }, [sales, products, purchases, dateRange, calculateFinancialReports, calculateBusinessInsights, calculateInventoryIntelligence]);

  const handlePrint = () => {
    window.print();
  };

  const exportToPDF = async () => {
    try {
      console.log('Starting PDF export...');
      const element = componentRef.current;
      if (!element) {
        console.error('Report element not found');
        showError('Report content not found. Please try again.');
        return;
      }

      console.log('Element found, capturing with html2canvas...');
      // Show loading state
      const originalButton = document.querySelector('.export-btn');
      if (originalButton) originalButton.textContent = 'Generating PDF...';
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      console.log('Canvas created, generating PDF...');
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      console.log('Saving PDF...');
      pdf.save(`MyPackaging-Report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      console.log('PDF export successful!');
      
      // Reset button text
      if (originalButton) originalButton.textContent = '📄 PDF';
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError('PDF export failed. Error: ' + error.message);
      
      // Reset button text
      const originalButton = document.querySelector('.export-btn');
      if (originalButton) originalButton.textContent = '📄 PDF';
    }
  };

  const exportToExcel = async () => {
    try {
      console.log('Starting Excel export...');
      // Show loading state
      const originalButton = document.querySelectorAll('.export-btn')[1];
      if (originalButton) originalButton.textContent = 'Generating Excel...';
      
      console.log('Creating workbook...');
      const wb = XLSX.utils.book_new();
      
      console.log('Processing sales data...', sales.length, 'sales');
      // Sales Data
      const salesData = sales.map(sale => ({
        Date: sale.createdAt ? format(
          sale.createdAt.toDate ? sale.createdAt.toDate() : sale.createdAt, 
          'yyyy-MM-dd HH:mm'
        ) : '',
        Customer: sale.customerName || 'Walk-in',
        Total: `RM ${sale.total || 0}`,
        Payment: sale.paymentType || 'cash',
        Status: sale.status === 'Hutang' ? 'Hutang' : (sale.paymentType === 'cash' ? 'Cash' : (sale.paymentType === 'online' ? 'Online' : 'Paid'))
      }));
      
      const salesWS = XLSX.utils.json_to_sheet(salesData);
      XLSX.utils.book_append_sheet(wb, salesWS, 'Sales');
      
      console.log('Processing products data...', products.length, 'products');
      // Products Data
      const productsData = products.map(product => ({
        Name: product.name,
        Stock: product.stockBalance || 0,
        'Unit Price': `RM ${product.unitPrice || 0}`,
        'Qty Sold': product.quantitySold || 0,
        'Reorder Point': product.reorderPoint || 0
      }));
      
      const productsWS = XLSX.utils.json_to_sheet(productsData);
      XLSX.utils.book_append_sheet(wb, productsWS, 'Products');
      
      console.log('Processing financial data...', profitLoss);
      // Financial Summary
      const financialData = [
        { Metric: 'Total Revenue', Value: `RM ${profitLoss.revenue || 0}` },
        { Metric: 'Total Costs', Value: `RM ${profitLoss.costs || 0}` },
        { Metric: 'Gross Profit', Value: `RM ${profitLoss.grossProfit || 0}` },
        { Metric: 'Profit Margin %', Value: `${profitLoss.margin || 0}%` }
      ];
      
      const financialWS = XLSX.utils.json_to_sheet(financialData);
      XLSX.utils.book_append_sheet(wb, financialWS, 'Financial Summary');
      
      console.log('Writing Excel file...');
      XLSX.writeFile(wb, `MyPackaging-Data-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      console.log('Excel export successful!');
      
      // Reset button text
      if (originalButton) originalButton.textContent = '📊 Excel';
      
    } catch (error) {
      console.error('Error generating Excel:', error);
      showError('Excel export failed. Error: ' + error.message);
      
      // Reset button text
      const originalButton = document.querySelectorAll('.export-btn')[1];
      if (originalButton) originalButton.textContent = '📊 Excel';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR'
    }).format(amount || 0);
  };

  // Helper functions for Sales Recorded tab
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'dd/MM/yyyy');
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'HH:mm');
  };

  const getFilteredSalesData = () => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    // Handle custom date filtering
    if (customDateRange.filterType === 'custom') {
      if (customDateRange.singleDate) {
        // Single date filter
        const selectedDate = new Date(customDateRange.singleDate);
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0);
        endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
      } else if (customDateRange.startDate && customDateRange.endDate) {
        // Date range filter
        startDate = new Date(customDateRange.startDate);
        endDate = new Date(customDateRange.endDate);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
      } else {
        // Fallback to all time if custom dates are incomplete
        startDate = new Date(0);
        endDate = now;
      }
    } else {
      // Handle preset date ranges
      endDate = now;
      switch (dateRange) {
        case 'week':
          startDate = subDays(now, 7);
          break;
        case 'month':
          startDate = subDays(now, 30);
          break;
        case 'quarter':
          startDate = subDays(now, 90);
          break;
        case 'year':
          startDate = subDays(now, 365);
          break;
        case 'all':
        default:
          startDate = new Date(0);
          break;
      }
    }

    return sales.filter(sale => {
      const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
      return saleDate >= startDate && saleDate <= endDate;
    }).sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB - dateA; // Most recent first
    });
  };

  // Calculate payment method totals for filtered sales including repayments
  const getPaymentMethodTotals = () => {
    const filteredSales = getFilteredSalesData();
    
    // Get date range using the same logic as getFilteredSalesData
    const now = new Date();
    let startDate, endDate;

    if (customDateRange.filterType === 'custom') {
      if (customDateRange.startDate && customDateRange.endDate) {
        startDate = new Date(customDateRange.startDate);
        endDate = new Date(customDateRange.endDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(0);
        endDate = now;
      }
    } else {
      endDate = now;
      switch (dateRange) {
        case 'week':
          startDate = subDays(now, 7);
          break;
        case 'month':
          startDate = subDays(now, 30);
          break;
        case 'quarter':
          startDate = subDays(now, 90);
          break;
        case 'year':
          startDate = subDays(now, 365);
          break;
        case 'all':
        default:
          startDate = new Date(0);
          break;
      }
    }
    
    // Filter payments within the same date range
    const filteredPayments = payments.filter(payment => {
      const paymentDate = payment.createdAt;
      const isInRange = paymentDate >= startDate && paymentDate <= endDate;
      return isInRange;
    });

    const totals = {
      cash: 0,           // Original cash sales only
      online: 0,         // Original online sales only
      hutangOriginal: 0, // Original hutang sales
      hutangOutstanding: 0, // Outstanding after repayments
      overall: 0,        // Total of all original sales
      repayments: {
        cash: 0,
        online: 0,
        total: 0
      }
    };

    // Process original sales
    filteredSales.forEach(sale => {
      const amount = parseFloat(sale.total || 0);
      totals.overall += amount;

      // Categorize by payment status
      if (sale.status === 'Hutang') {
        totals.hutangOriginal += amount;
      } else if (sale.paymentType === 'online') {
        totals.online += amount;
      } else if (sale.paymentType === 'cash') {
        totals.cash += amount;
      }
    });

    // Process repayments (hutang payments) - these are separate from original sales
    filteredPayments.forEach(payment => {
      const amount = parseFloat(payment.amount || 0);
      totals.repayments.total += amount;

      if (payment.paymentMethod === 'cash') {
        totals.repayments.cash += amount;
      } else if (payment.paymentMethod === 'online') {
        totals.repayments.online += amount;
      }

    });

    // Calculate outstanding hutang (original hutang minus repayments)
    totals.hutangOutstanding = totals.hutangOriginal - totals.repayments.total;

    return totals;
  };

  // Get paginated sales data
  const getPaginatedSalesData = () => {
    const filteredSales = getFilteredSalesData();
    const startIndex = (salesCurrentPage - 1) * salesItemsPerPage;
    const endIndex = startIndex + salesItemsPerPage;
    return filteredSales.slice(startIndex, endIndex);
  };

  // Sales pagination calculations
  const totalSalesPages = Math.ceil(getFilteredSalesData().length / salesItemsPerPage);

  // Reset sales pagination when date filter changes
  useEffect(() => {
    setSalesCurrentPage(1);
  }, [dateRange, customDateRange]);

  const handleSalesPageChange = (pageNumber) => {
    setSalesCurrentPage(pageNumber);
    // Scroll to sales section
    const salesSection = document.querySelector('.sales-table-container');
    if (salesSection) {
      salesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Modal handler functions
  const openExpandModal = (title, content, icon) => {
    setExpandedModal({
      isOpen: true,
      title,
      content,
      icon
    });
  };

  const closeExpandModal = () => {
    setExpandedModal({
      isOpen: false,
      title: '',
      content: null,
      icon: ''
    });
  };

  const handleDeleteSale = async (sale) => {
    showConfirm(
      `Are you sure you want to delete this sale? This will restore the stock for all products in this transaction.\n\nCustomer: ${sale.customerName}\nTotal: RM ${(sale.total || 0).toFixed(2)}\n\nThis action cannot be undone.`,
      async () => {
        try {
          let productUpdates = [];
          
          // Run transaction to delete sale and restore stock
          await runTransaction(db, async (transaction) => {
            // Get current product data to update stock
        
        // Check if products exist before processing
        if (sale.products && Array.isArray(sale.products)) {
          for (const saleProduct of sale.products) {
            const productRef = doc(db, 'products', saleProduct.id);
            const productDoc = await transaction.get(productRef);
            
            if (productDoc.exists()) {
              const currentStock = productDoc.data().stockBalance || 0;
              const newStock = currentStock + (saleProduct.quantity || 0);
              
              transaction.update(productRef, {
                stockBalance: newStock
              });
              
              productUpdates.push({
                name: saleProduct.name || 'Unknown Product',
                restored: saleProduct.quantity || 0,
                newStock: newStock
              });
            }
          }
        }

        // Delete the sale
        const saleRef = doc(db, 'sales', sale.id);
        transaction.delete(saleRef);

        console.log('Sale deleted and stock restored:', productUpdates);
      });

      // Log the sale deletion activity
      await logActivity(
        'Sale Deleted',
        user.email,
        `Deleted sale for ${sale.customerName} worth RM ${(sale.total || 0).toFixed(2)}. Sale ID: ${sale.id.substring(0, 8)}. Stock restored for ${productUpdates.length} products.`,
        'sales'
      );

      showSuccess('Sale deleted successfully! Stock has been restored for all products.');
      
    } catch (error) {
      console.error('Error deleting sale:', error);
      showError('Failed to delete sale. Please try again.');
    }
      }
    );
  };

  const handleGenerateReceipt = async (sale) => {
    try {
      const receiptNumber = receiptService.generateReceiptNumber(sale.id);
      await receiptService.downloadReceipt(sale, receiptNumber);
      showSuccess('Receipt downloaded successfully!');
    } catch (error) {
      console.error('Error generating receipt:', error);
      showError('Failed to generate receipt. Please try again.');
    }
  };

  const handleEmailReceipt = async (sale) => {
    const email = prompt('Enter customer email address:');
    if (!email || !emailService.isValidEmail(email)) {
      showError('Please enter a valid email address.');
      return;
    }

    try {
      const receiptNumber = receiptService.generateReceiptNumber(sale.id);
      const enhancedSaleData = {
        ...sale,
        receiptNumber
      };
      
      await emailService.sendReceiptEmailAndDownloadPDF(enhancedSaleData, email);
      showSuccess(`Receipt sent successfully to ${email}!`);
    } catch (error) {
      console.error('Error sending receipt:', error);
      showError('Failed to send receipt. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="reports-container">
        <div className="loading">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="reports-container">
      <div className="reports-header">
        <div className="header-content">
          <h1>📊 Business Reports</h1>
          <div className="header-controls">
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="date-range-selector"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
              <option value="year">Last Year</option>
            </select>
            <button onClick={handlePrint} className="export-btn">
              🖨️ Print
            </button>
            <React.Suspense fallback={<span>Loading...</span>}>
              <button onClick={exportToPDF} className="export-btn">
                📄 PDF
              </button>
              <button onClick={exportToExcel} className="export-btn">
                📊 Excel
              </button>
            </React.Suspense>
            <Link to="/" className="back-button">← Dashboard</Link>
          </div>
        </div>
      </div>

      <div className="reports-tabs">
        <button 
          className={`tab-btn ${activeTab === 'financial' ? 'active' : ''}`}
          onClick={() => setActiveTab('financial')}
        >
          💰 Financial Reports
        </button>
        <button 
          className={`tab-btn ${activeTab === 'business' ? 'active' : ''}`}
          onClick={() => setActiveTab('business')}
        >
          📈 Business Insights
        </button>
        <button 
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          📦 Inventory Intelligence
        </button>
        <RequirePermission module="reports" action="edit">
          <button 
            className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            🛒 Sales Recorded
          </button>
        </RequirePermission>
      </div>

      <div ref={componentRef} className="reports-content">
        {activeTab === 'financial' && (
          <div className="financial-reports">
            {/* Profit & Loss */}
            <div className="report-card full-width">
              <h3>💹 Profit & Loss Statement</h3>
              <div className="pl-summary">
                <div className="pl-item">
                  <span>Total Revenue:</span>
                  <span className="revenue">{formatCurrency(profitLoss.revenue)}</span>
                </div>
                <div className="pl-item">
                  <span>Total Costs:</span>
                  <span className="cost">{formatCurrency(profitLoss.costs)}</span>
                </div>
                <div className="pl-item">
                  <span>Gross Profit:</span>
                  <span className={profitLoss.grossProfit >= 0 ? 'profit' : 'loss'}>
                    {formatCurrency(profitLoss.grossProfit)}
                  </span>
                </div>
                <div className="pl-item">
                  <span>Profit Margin:</span>
                  <span className={profitLoss.margin >= 0 ? 'profit' : 'loss'}>
                    {profitLoss.margin?.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Cash Flow */}
            <div className="report-card full-width">
              <h3>
                <span className="report-card-title">💸 Cash Flow Analysis</span>
                <button 
                  className="expand-icon" 
                  onClick={() => openExpandModal(
                    'Cash Flow Analysis', 
                    <div className="expanded-chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cashFlow}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis tickFormatter={(value) => `RM ${value}`} />
                          <Tooltip formatter={(value) => [formatCurrency(value)]} />
                          <Legend />
                          <Area type="monotone" dataKey="inflow" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Cash In" />
                          <Area type="monotone" dataKey="outflow" stackId="2" stroke="#ff7c7c" fill="#ff7c7c" name="Cash Out" />
                          <Line type="monotone" dataKey="net" stroke="#8884d8" strokeWidth={3} name="Net Cash" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>,
                    '💸'
                  )}
                  title="Expand view"
                >
                  ↗️
                </button>
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={cashFlow}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => `RM ${value}`} />
                  <Tooltip formatter={(value) => [formatCurrency(value)]} />
                  <Legend />
                  <Area type="monotone" dataKey="inflow" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Cash In" />
                  <Area type="monotone" dataKey="outflow" stackId="2" stroke="#ff7c7c" fill="#ff7c7c" name="Cash Out" />
                  <Line type="monotone" dataKey="net" stroke="#8884d8" strokeWidth={3} name="Net Cash" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Hutang Aging & Tax Summary */}
            <div className="report-card">
              <h3>
                <span className="report-card-title">⏰ Hutang Aging Analysis</span>
                <button 
                  className="expand-icon" 
                  onClick={() => openExpandModal(
                    'Hutang Aging Analysis', 
                    <div className="expanded-chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={hutangAging}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent, value }) => `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(1)}%)`}
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {hutangAging.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>,
                    '⏰'
                  )}
                  title="Expand view"
                >
                  ↗️
                </button>
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={hutangAging}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {hutangAging.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="report-card">
              <h3>
                <span className="report-card-title">🧾 Tax Summary</span>
                <button 
                  className="expand-icon" 
                  onClick={() => openExpandModal(
                    'Tax Summary', 
                    <div className="expanded-tax-summary">
                      <div className="tax-details">
                        <div className="tax-section">
                          <h4>📋 Period Summary</h4>
                          <div className="tax-item large">
                            <span>Period:</span>
                            <span>{taxSummary.period}</span>
                          </div>
                        </div>
                        <div className="tax-section">
                          <h4>💰 Revenue Details</h4>
                          <div className="tax-item large">
                            <span>Total Sales:</span>
                            <span>{formatCurrency(taxSummary.totalSales)}</span>
                          </div>
                          <div className="tax-item large">
                            <span>GST Collected (6%):</span>
                            <span>{formatCurrency(taxSummary.gstCollected)}</span>
                          </div>
                          <div className="tax-item large">
                            <span>Total Tax Liability:</span>
                            <span>{formatCurrency(taxSummary.totalTax)}</span>
                          </div>
                        </div>
                      </div>
                    </div>,
                    '🧾'
                  )}
                  title="Expand view"
                >
                  ↗️
                </button>
              </h3>
              <div className="tax-summary">
                <div className="tax-item">
                  <span>Period:</span>
                  <span>{taxSummary.period}</span>
                </div>
                <div className="tax-item">
                  <span>Total Sales:</span>
                  <span>{formatCurrency(taxSummary.totalSales)}</span>
                </div>
                <div className="tax-item">
                  <span>GST Collected (6%):</span>
                  <span>{formatCurrency(taxSummary.gstCollected)}</span>
                </div>
                <div className="tax-item">
                  <span>Net Sales:</span>
                  <span>{formatCurrency(taxSummary.netSales)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'business' && (
          <div className="business-insights">
            {/* Customer Patterns */}
            <div className="report-card">
              <h3>
                <span className="report-card-title">👥 Top Customers</span>
                <button 
                  className="expand-icon" 
                  onClick={() => openExpandModal(
                    'Top Customers', 
                    <div className="expanded-table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Customer</th>
                            <th>Total Spent</th>
                            <th>Visits</th>
                            <th>Avg Order</th>
                            <th>Last Visit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerPatterns.map((customer, index) => (
                            <tr key={index}>
                              <td>#{index + 1}</td>
                              <td>{customer.name}</td>
                              <td>{formatCurrency(customer.totalSpent)}</td>
                              <td>{customer.visits}</td>
                              <td>{formatCurrency(customer.avgOrderValue)}</td>
                              <td>{customer.lastVisit || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>,
                    '👥'
                  )}
                  title="Expand view"
                >
                  ↗️
                </button>
              </h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Total Spent</th>
                      <th>Visits</th>
                      <th>Avg Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerPatterns.slice(0, 10).map((customer, index) => (
                      <tr key={index}>
                        <td>{customer.name}</td>
                        <td>{formatCurrency(customer.totalSpent)}</td>
                        <td>{customer.visits}</td>
                        <td>{formatCurrency(customer.avgOrderValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Peak Hours */}
            <div className="report-card">
              <h3>
                <span className="report-card-title">🕐 Peak Sales Hours</span>
                <button 
                  className="expand-icon" 
                  onClick={() => openExpandModal(
                    'Peak Sales Hours', 
                    <div className="expanded-chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={peakHours}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(hour) => `${hour}:00`}
                            formatter={(value, name) => [name === 'sales' ? `${value} sales` : formatCurrency(value), name]}
                          />
                          <Legend />
                          <Bar dataKey="sales" fill="#8884d8" name="Sales Count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>,
                    '🕐'
                  )}
                  title="Expand view"
                >
                  ↗️
                </button>
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={peakHours}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(hour) => `${hour}:00`}
                    formatter={(value, name) => [name === 'sales' ? `${value} sales` : formatCurrency(value), name]}
                  />
                  <Bar dataKey="sales" fill="#8884d8" name="Sales Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Seasonal Trends */}
            <div className="report-card full-width">
              <h3>
                <span className="report-card-title">📅 Seasonal Trends</span>
                <button 
                  className="expand-icon" 
                  onClick={() => openExpandModal(
                    'Seasonal Trends', 
                    <div className="expanded-chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={seasonalTrends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis yAxisId="left" tickFormatter={(value) => `RM ${value}`} />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip formatter={(value, name) => [name === 'sales' ? `${value} sales` : formatCurrency(value), name]} />
                          <Legend />
                          <Bar yAxisId="left" dataKey="revenue" fill="#82ca9d" name="Revenue" />
                          <Line yAxisId="right" type="monotone" dataKey="sales" stroke="#8884d8" name="Sales Count" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>,
                    '📅'
                  )}
                  title="Expand view"
                >
                  ↗️
                </button>
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={seasonalTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" tickFormatter={(value) => `RM ${value}`} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value, name) => [name === 'sales' ? `${value} sales` : formatCurrency(value), name]} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="revenue" fill="#82ca9d" name="Revenue" />
                  <Line yAxisId="right" type="monotone" dataKey="sales" stroke="#8884d8" name="Sales Count" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* ROI Analysis */}
            <div className="report-card">
              <h3>
                <span className="report-card-title">💎 Product ROI</span>
                <button 
                  className="expand-icon" 
                  onClick={() => openExpandModal(
                    'Product ROI Analysis', 
                    <div className="expanded-table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Product</th>
                            <th>Revenue</th>
                            <th>ROI %</th>
                            <th>Profit</th>
                            <th>Margin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roiData.map((product, index) => (
                            <tr key={index}>
                              <td>#{index + 1}</td>
                              <td>{product.name}</td>
                              <td>{formatCurrency(product.revenue)}</td>
                              <td className={product.roi >= 0 ? 'profit' : 'loss'}>
                                {product.roi.toFixed(1)}%
                              </td>
                              <td className={product.profit >= 0 ? 'profit' : 'loss'}>
                                {formatCurrency(product.profit)}
                              </td>
                              <td className={product.roi >= 20 ? 'profit' : product.roi >= 10 ? 'warning' : 'loss'}>
                                {((product.profit / product.revenue) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>,
                    '💎'
                  )}
                  title="Expand view"
                >
                  ↗️
                </button>
              </h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Revenue</th>
                      <th>ROI %</th>
                      <th>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roiData.slice(0, 10).map((product, index) => (
                      <tr key={index}>
                        <td>{product.name}</td>
                        <td>{formatCurrency(product.revenue)}</td>
                        <td className={product.roi >= 0 ? 'profit' : 'loss'}>
                          {product.roi.toFixed(1)}%
                        </td>
                        <td className={product.profit >= 0 ? 'profit' : 'loss'}>
                          {formatCurrency(product.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="inventory-intelligence">
            {/* Low Stock Alerts */}
            <div className="report-card">
              <h3>
                <span className="report-card-title">⚠️ Low Stock Alerts</span>
                <button 
                  className="expand-icon" 
                  onClick={() => openExpandModal(
                    'Low Stock Alerts', 
                    <div className="expanded-table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Priority</th>
                            <th>Product</th>
                            <th>Current Stock</th>
                            <th>Reorder Point</th>
                            <th>Status</th>
                            <th>Days Out</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lowStockAlerts.map((product, index) => (
                            <tr key={product.id}>
                              <td>
                                <span className={product.stockBalance <= 0 ? 'priority-critical' : 'priority-high'}>
                                  {product.stockBalance <= 0 ? '🔴 Critical' : '🟡 High'}
                                </span>
                              </td>
                              <td>{product.name}</td>
                              <td className={product.stockBalance <= 0 ? 'danger' : 'warning'}>
                                {product.stockBalance} units
                              </td>
                              <td>{product.reorderPoint} units</td>
                              <td>
                                <span className={product.stockBalance <= 0 ? 'status-danger' : 'status-warning'}>
                                  {product.stockBalance <= 0 ? 'Out of Stock' : 'Low Stock'}
                                </span>
                              </td>
                              <td>{product.stockBalance <= 0 ? Math.abs(product.stockBalance) : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>,
                    '⚠️'
                  )}
                  title="Expand view"
                >
                  ↗️
                </button>
              </h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Current Stock</th>
                      <th>Reorder Point</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockAlerts.map(product => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td className={product.stockBalance <= 0 ? 'danger' : 'warning'}>
                          {product.stockBalance} units
                        </td>
                        <td>{product.reorderPoint} units</td>
                        <td>
                          <span className={product.stockBalance <= 0 ? 'status-danger' : 'status-warning'}>
                            {product.stockBalance <= 0 ? 'Out of Stock' : 'Low Stock'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stock Movement */}
            <div className="report-card">
              <h3>
                <span className="report-card-title">📊 Stock Turnover Analysis</span>
                <button 
                  className="expand-icon" 
                  onClick={() => openExpandModal(
                    'Stock Turnover Analysis', 
                    <div className="expanded-chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stockMovementAnalysis}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
                          <YAxis />
                          <Tooltip formatter={(value) => [`${value.toFixed(2)} times/year`, 'Turnover Rate']} />
                          <Legend />
                          <Bar dataKey="turnover" fill="#ffc658" name="Turnover Rate" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>,
                    '📊'
                  )}
                  title="Expand view"
                >
                  ↗️
                </button>
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stockMovementAnalysis.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="turnover" fill="#ffc658" name="Turnover Rate" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Product Performance */}
            <div className="report-card">
              <h3>
                <span className="report-card-title">🏆 Product Performance</span>
                <button 
                  className="expand-icon" 
                  onClick={() => openExpandModal(
                    'Product Performance', 
                    <div className="expanded-table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Product</th>
                            <th>Revenue</th>
                            <th>Qty Sold</th>
                            <th>Avg Price</th>
                            <th>Status</th>
                            <th>Growth</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productPerformance.map((product, index) => (
                            <tr key={index}>
                              <td>#{index + 1}</td>
                              <td>{product.name}</td>
                              <td>{formatCurrency(product.revenue)}</td>
                              <td>{product.quantity}</td>
                              <td>{formatCurrency(product.avgPrice)}</td>
                              <td>
                                <span className={`status-${product.performance.toLowerCase()}`}>
                                  {product.performance}
                                </span>
                              </td>
                              <td className={product.revenue > 1000 ? 'profit' : 'warning'}>
                                {product.revenue > 1000 ? '↗️ Growing' : '→ Stable'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>,
                    '🏆'
                  )}
                  title="Expand view"
                >
                  ↗️
                </button>
              </h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Revenue</th>
                      <th>Qty Sold</th>
                      <th>Avg Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productPerformance.slice(0, 10).map((product, index) => (
                      <tr key={index}>
                        <td>{product.name}</td>
                        <td>{formatCurrency(product.revenue)}</td>
                        <td>{product.quantity}</td>
                        <td>{formatCurrency(product.avgPrice)}</td>
                        <td>
                          <span className={`status-${product.performance.toLowerCase()}`}>
                            {product.performance}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dead Stock */}
            <div className="report-card">
              <h3>
                <span className="report-card-title">💀 Dead Stock Analysis</span>
                <button 
                  className="expand-icon" 
                  onClick={() => openExpandModal(
                    'Dead Stock Analysis', 
                    <div className="expanded-table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Stock Balance</th>
                            <th>Unit Price</th>
                            <th>Total Value</th>
                            <th>Days Since Sale</th>
                            <th>Risk Level</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deadStock.map(product => (
                            <tr key={product.id}>
                              <td>{product.name}</td>
                              <td className="warning">{product.stockBalance} units</td>
                              <td>{formatCurrency(product.unitPrice)}</td>
                              <td className="danger">{formatCurrency(product.value)}</td>
                              <td>60+ days</td>
                              <td>
                                <span className="status-danger">
                                  🔴 High Risk
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="dead-stock-summary">
                        <h4>💰 Summary</h4>
                        <p>Total Dead Stock Value: <strong>{formatCurrency(deadStock.reduce((sum, product) => sum + product.value, 0))}</strong></p>
                        <p>Items at Risk: <strong>{deadStock.length} products</strong></p>
                      </div>
                    </div>,
                    '💀'
                  )}
                  title="Expand view"
                >
                  ↗️
                </button>
              </h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Stock Balance</th>
                      <th>Unit Price</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadStock.map(product => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.stockBalance} units</td>
                        <td>{formatCurrency(product.unitPrice)}</td>
                        <td>{formatCurrency((product.stockBalance || 0) * (product.unitPrice || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <RequirePermission module="reports" action="edit">
            <div className="sales-recorded">
              <div className="report-card full-width">
                <div className="card-header">
                  <h3>🛒 Sales Recorded</h3>
                  <p>View and manage recorded sales transactions. Deleting a sale will restore stock balances.</p>
                  <div className="access-note">
                    <small>🔒 Manager/Admin access only - Staff cannot view or modify sales records</small>
                  </div>
                </div>
              
              <div className="sales-controls">
                <div className="enhanced-date-filter">
                  <div className="filter-mode-selector">
                    <label>Filter Type:</label>
                    <select 
                      value={customDateRange.filterType} 
                      onChange={(e) => setCustomDateRange(prev => ({
                        ...prev,
                        filterType: e.target.value,
                        startDate: '',
                        endDate: '',
                        singleDate: ''
                      }))}
                      className="filter-type-selector"
                    >
                      <option value="preset">Quick Ranges</option>
                      <option value="custom">Custom Date</option>
                    </select>
                  </div>

                  {customDateRange.filterType === 'preset' ? (
                    <div className="date-filter">
                      <label>Date Range:</label>
                      <select 
                        value={dateRange} 
                        onChange={(e) => setDateRange(e.target.value)}
                        className="date-selector"
                      >
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                        <option value="quarter">Last 90 Days</option>
                        <option value="year">Last Year</option>
                        <option value="all">All Time</option>
                      </select>
                    </div>
                  ) : (
                    <div className="custom-date-controls">
                      <div className="date-input-group">
                        <label>
                          <input 
                            type="radio" 
                            name="dateMode" 
                            checked={!customDateRange.startDate || !customDateRange.endDate}
                            onChange={() => setCustomDateRange(prev => ({
                              ...prev,
                              startDate: '',
                              endDate: ''
                            }))}
                          />
                          Single Date:
                        </label>
                        <input 
                          type="date" 
                          value={customDateRange.singleDate}
                          onChange={(e) => setCustomDateRange(prev => ({
                            ...prev,
                            singleDate: e.target.value,
                            startDate: '',
                            endDate: ''
                          }))}
                          className="date-input"
                        />
                      </div>
                      
                      <div className="date-input-group">
                        <label>
                          <input 
                            type="radio" 
                            name="dateMode" 
                            checked={customDateRange.startDate && customDateRange.endDate}
                            onChange={() => setCustomDateRange(prev => ({
                              ...prev,
                              singleDate: ''
                            }))}
                          />
                          Date Range:
                        </label>
                        <div className="date-range-inputs">
                          <input 
                            type="date" 
                            value={customDateRange.startDate}
                            onChange={(e) => setCustomDateRange(prev => ({
                              ...prev,
                              startDate: e.target.value,
                              singleDate: ''
                            }))}
                            className="date-input"
                            placeholder="From"
                          />
                          <span className="date-separator">to</span>
                          <input 
                            type="date" 
                            value={customDateRange.endDate}
                            onChange={(e) => setCustomDateRange(prev => ({
                              ...prev,
                              endDate: e.target.value,
                              singleDate: ''
                            }))}
                            className="date-input"
                            placeholder="To"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method Totals Display */}
              <div className="payment-totals-summary">
                <h4>💰 Payment Method Breakdown</h4>
                <div className="totals-grid">
                  <div className="total-card cash">
                    <div className="total-icon">💵</div>
                    <div className="total-info">
                      <span className="total-label">Cash</span>
                      <span className="total-amount">{formatCurrency(getPaymentMethodTotals().cash)}</span>
                      {getPaymentMethodTotals().repayments.cash > 0 && (
                        <small className="repayment-note">Repayments: {formatCurrency(getPaymentMethodTotals().repayments.cash)}</small>
                      )}
                    </div>
                  </div>
                  <div className="total-card online">
                    <div className="total-icon">💳</div>
                    <div className="total-info">
                      <span className="total-label">Online</span>
                      <span className="total-amount">{formatCurrency(getPaymentMethodTotals().online)}</span>
                      {getPaymentMethodTotals().repayments.online > 0 && (
                        <small className="repayment-note">Repayments: {formatCurrency(getPaymentMethodTotals().repayments.online)}</small>
                      )}
                    </div>
                  </div>
                  <div className="total-card hutang">
                    <div className="total-icon">📝</div>
                    <div className="total-info">
                      <span className="total-label">Hutang Outstanding</span>
                      <span className="total-amount">{formatCurrency(getPaymentMethodTotals().hutangOutstanding)}</span>
                    </div>
                  </div>
                  {getPaymentMethodTotals().repayments.total > 0 && (
                    <div className="total-card repayments">
                      <div className="total-icon">🔄</div>
                      <div className="total-info">
                        <span className="total-label">Total Repayments</span>
                        <span className="total-amount">{formatCurrency(getPaymentMethodTotals().repayments.total)}</span>
                      </div>
                    </div>
                  )}
                  <div className="total-card overall">
                    <div className="total-icon">🏆</div>
                    <div className="total-info">
                      <span className="total-label">Overall Total</span>
                      <span className="total-amount">{formatCurrency(getPaymentMethodTotals().overall)}</span>
                    </div>
                  </div>
                </div>
                <div className="totals-info">
                  <small>💡 Showing totals for {getFilteredSalesData().length} sales records in selected period</small>
                  {getPaymentMethodTotals().repayments.total > 0 && (
                    <small className="repayments-info">📋 Hutang shows outstanding balance after repayments</small>
                  )}
                </div>
              </div>

              <div className="sales-list">
                {loading ? (
                  <div className="loading-state">Loading sales data...</div>
                ) : (
                  <div className="sales-table-container">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Customer</th>
                          <th>Products</th>
                          <th>Total Amount</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPaginatedSalesData().map(sale => (
                          <tr key={sale.id}>
                            <td>
                              <div className="date-info">
                                <span className="date">{formatDate(sale.createdAt)}</span>
                                <span className="time">{formatTime(sale.createdAt)}</span>
                              </div>
                            </td>
                            <td>
                              <div className="customer-info">
                                <strong>{sale.customerName}</strong>
                                {sale.status === 'Hutang' && (
                                  <span className="credit-badge">Credit</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="products-list">
                                {(sale.items || []).map((item, index) => (
                                  <div key={index} className="product-item">
                                    <span className="product-name">{item.name || 'Unknown Product'}</span>
                                    <span className="product-quantity">×{item.quantity || (item.qtyBox || 0) + (item.qtyPack || 0) + (item.qtyLoose || 0)}</span>
                                    <span className="product-price">RM {(item.unitPrice || 0).toFixed(2)}</span>
                                  </div>
                                ))}
                                {(!sale.items || sale.items.length === 0) && (
                                  <div className="no-products">No products found</div>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="amount-info">
                                <strong className="total-amount">RM {(sale.total || 0).toFixed(2)}</strong>
                                {sale.status === 'Hutang' && (sale.remaining || 0) > 0 && (
                                  <span className="remaining-amount">
                                    Outstanding: RM {(sale.remaining || 0).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`status-badge ${sale.status.toLowerCase()}`}>
                                {sale.status === 'Hutang'
                                  ? 'Hutang'
                                  : sale.paymentType === 'cash'
                                    ? 'Cash'
                                    : sale.paymentType === 'online'
                                      ? 'Online'
                                      : sale.status}
                              </span>
                            </td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  onClick={() => handleGenerateReceipt(sale)}
                                  className="btn-receipt"
                                  title="Download PDF Receipt"
                                >
                                  📄 Receipt
                                </button>
                                <button
                                  onClick={() => handleEmailReceipt(sale)}
                                  className="btn-email"
                                  title="Email Receipt"
                                >
                                  📧 Email
                                </button>
                                <button
                                  onClick={() => handleDeleteSale(sale)}
                                  className="btn-delete-sale"
                                  title="Delete sale and restore stock"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {getFilteredSalesData().length === 0 && (
                      <div className="empty-state">
                        <p>No sales found for the selected date range.</p>
                      </div>
                    )}

                    {/* Sales Pagination Controls */}
                    {totalSalesPages > 1 && (
                      <div className="pagination-container">
                        <div className="pagination-info">
                          Showing {((salesCurrentPage - 1) * salesItemsPerPage) + 1}-{Math.min(salesCurrentPage * salesItemsPerPage, getFilteredSalesData().length)} of {getFilteredSalesData().length} sales
                        </div>
                        <div className="pagination-controls">
                          <button 
                            onClick={() => handleSalesPageChange(salesCurrentPage - 1)}
                            disabled={salesCurrentPage === 1}
                            className="pagination-btn"
                          >
                            ‹ Previous
                          </button>
                          
                          {[...Array(totalSalesPages)].map((_, index) => {
                            const pageNumber = index + 1;
                            const isCurrentPage = pageNumber === salesCurrentPage;
                            
                            // Show first page, last page, current page, and pages around current
                            if (
                              pageNumber === 1 || 
                              pageNumber === totalSalesPages ||
                              (pageNumber >= salesCurrentPage - 1 && pageNumber <= salesCurrentPage + 1)
                            ) {
                              return (
                                <button
                                  key={pageNumber}
                                  onClick={() => handleSalesPageChange(pageNumber)}
                                  className={`pagination-btn ${isCurrentPage ? 'active' : ''}`}
                                >
                                  {pageNumber}
                                </button>
                              );
                            } else if (
                              pageNumber === salesCurrentPage - 2 || 
                              pageNumber === salesCurrentPage + 2
                            ) {
                              return <span key={pageNumber} className="pagination-ellipsis">...</span>;
                            }
                            return null;
                          })}
                          
                          <button 
                            onClick={() => handleSalesPageChange(salesCurrentPage + 1)}
                            disabled={salesCurrentPage === totalSalesPages}
                            className="pagination-btn"
                          >
                            Next ›
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="sales-summary">
                <div className="summary-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Sales</span>
                    <span className="stat-value">{getFilteredSalesData().length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Revenue</span>
                    <span className="stat-value">
                      RM {getFilteredSalesData().reduce((sum, sale) => sum + (sale.total || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg Sale Value</span>
                    <span className="stat-value">
                      RM {getFilteredSalesData().length > 0 
                        ? (getFilteredSalesData().reduce((sum, sale) => sum + (sale.total || 0), 0) / getFilteredSalesData().length).toFixed(2)
                        : '0.00'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </RequirePermission>
        )}
      </div>
      
      {/* Return to Top Button */}
      <ReturnToTop />
      
      {/* Expanded View Modal */}
      <ReportExpandModal
        isOpen={expandedModal.isOpen}
        onClose={closeExpandModal}
        title={expandedModal.title}
        icon={expandedModal.icon}
      >
        {expandedModal.content}
      </ReportExpandModal>
    </div>
  );
};

export default Reports;
