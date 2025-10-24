import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  collection, 
  query, 
  onSnapshot
} from 'firebase/firestore';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { db } from '../firebase';
import ReportExpandModal from './ReportExpandModal';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';
import '../styles/Analytics.css';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week'); // day, week, month, year
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);

  // Analytics state
  const [salesTrends, setSalesTrends] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [profitData, setProfitData] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [stockMovement, setStockMovement] = useState([]);
  const [customerInsights, setCustomerInsights] = useState([]);
  const [hutangAging, setHutangAging] = useState([]);

  // Modal state
  const [expandedModal, setExpandedModal] = useState({
    isOpen: false,
    title: '',
    content: null,
    icon: ''
  });

  // Subscribe to all data
  useEffect(() => {
    const unsubscribes = [];

    // Sales data
    const salesQuery = query(collection(db, 'sales'));
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
    const purchasesQuery = query(collection(db, 'purchases'));
    unsubscribes.push(onSnapshot(purchasesQuery, (snapshot) => {
      const purchasesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      setPurchases(purchasesData);
    }));

    setLoading(false);

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // Calculate analytics when data changes
  useEffect(() => {
    if (sales.length > 0 && products.length > 0) {
      calculateSalesTrends();
      calculateTopProducts();
      calculatePaymentBreakdown();
      calculateProfitData();
      calculateLowStockProducts();
      calculateStockMovement();
      calculateCustomerInsights();
      calculateHutangAging();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, products, purchases, timeRange]);

  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case 'day':
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(subDays(now, 28)), end: endOfWeek(now) };
      case 'month':
        return { start: startOfMonth(subDays(now, 365)), end: endOfMonth(now) };
      case 'year':
        return { start: new Date(now.getFullYear() - 1, 0, 1), end: now };
      default:
        return { start: startOfWeek(subDays(now, 28)), end: endOfWeek(now) };
    }
  };

  const calculateSalesTrends = () => {
    const { start, end } = getDateRange();
    const filteredSales = sales.filter(sale => 
      sale.createdAt && sale.createdAt >= start && sale.createdAt <= end
    );

    const trends = {};
    filteredSales.forEach(sale => {
      let dateKey;
      switch (timeRange) {
        case 'day':
          dateKey = format(sale.createdAt, 'MMM dd');
          break;
        case 'week':
          dateKey = format(sale.createdAt, 'MMM dd');
          break;
        case 'month':
          dateKey = format(sale.createdAt, 'MMM yyyy');
          break;
        case 'year':
          dateKey = format(sale.createdAt, 'MMM yyyy');
          break;
        default:
          dateKey = format(sale.createdAt, 'MMM dd');
      }

      if (!trends[dateKey]) {
        trends[dateKey] = { date: dateKey, sales: 0, revenue: 0, transactions: 0 };
      }
      trends[dateKey].sales += sale.total || 0;
      trends[dateKey].revenue += sale.total || 0;
      trends[dateKey].transactions += 1;
    });

    setSalesTrends(Object.values(trends).sort((a, b) => new Date(a.date) - new Date(b.date)));
  };

  const calculateTopProducts = () => {
    const productSales = {};
    
    sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (!productSales[item.productId]) {
            productSales[item.productId] = {
              productId: item.productId,
              name: item.name,
              quantitySold: 0,
              revenue: 0
            };
          }
          productSales[item.productId].quantitySold += item.quantity || 0;
          productSales[item.productId].revenue += item.subtotal || 0;
        });
      }
    });

    const topProductsArray = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    setTopProducts(topProductsArray);
  };

  const calculatePaymentBreakdown = () => {
    const breakdown = { cash: 0, online: 0, hutang: 0 };
    
    sales.forEach(sale => {
      const paymentType = sale.paymentType?.toLowerCase() || 'cash';
      breakdown[paymentType] = (breakdown[paymentType] || 0) + (sale.total || 0);
    });

    const chartData = [
      { name: 'Cash', value: breakdown.cash, color: '#8884d8' },
      { name: 'Online', value: breakdown.online, color: '#82ca9d' },
      { name: 'Hutang', value: breakdown.hutang, color: '#ffc658' }
    ].filter(item => item.value > 0);

    setPaymentBreakdown(chartData);
  };

  const calculateProfitData = () => {
    const { start, end } = getDateRange();
    const filteredSales = sales.filter(sale => 
      sale.createdAt && sale.createdAt >= start && sale.createdAt <= end
    );
    const filteredPurchases = purchases.filter(purchase => 
      purchase.createdAt && purchase.createdAt >= start && purchase.createdAt <= end
    );

    const profitByDate = {};
    
    // Calculate revenue from sales
    filteredSales.forEach(sale => {
      const dateKey = format(sale.createdAt, 'MMM dd');
      if (!profitByDate[dateKey]) {
        profitByDate[dateKey] = { date: dateKey, revenue: 0, costs: 0, profit: 0 };
      }
      profitByDate[dateKey].revenue += sale.total || 0;
    });

    // Calculate costs from purchases
    filteredPurchases.forEach(purchase => {
      const dateKey = format(purchase.createdAt, 'MMM dd');
      if (!profitByDate[dateKey]) {
        profitByDate[dateKey] = { date: dateKey, revenue: 0, costs: 0, profit: 0 };
      }
      // Calculate total cost from line items (cost × quantity)
      if (purchase.items && Array.isArray(purchase.items)) {
        const totalCost = purchase.items.reduce((sum, item) => {
          const itemCost = (item.cost || 0) * (item.quantity || 0);
          return sum + itemCost;
        }, 0);
        profitByDate[dateKey].costs += totalCost;
      }
    });

    // Calculate profit
    Object.values(profitByDate).forEach(day => {
      day.profit = day.revenue - day.costs;
    });

    setProfitData(Object.values(profitByDate).sort((a, b) => new Date(a.date) - new Date(b.date)));
  };

  const calculateLowStockProducts = () => {
    const lowStock = products.filter(product => {
      const stockBalance = product.stockBalance || 0;
      const reorderPoint = product.reorderPoint || 10;
      return stockBalance <= reorderPoint;
    }).sort((a, b) => (a.stockBalance || 0) - (b.stockBalance || 0));

    setLowStockProducts(lowStock);
  };

  const calculateStockMovement = () => {
    const movement = products.map(product => ({
      name: product.name,
      stock: product.stockBalance || 0,
      sold: product.quantitySold || 0,
      purchased: product.totalPurchased || 0,
      turnover: product.stockBalance > 0 ? (product.quantitySold || 0) / (product.stockBalance || 1) : 0
    })).sort((a, b) => b.turnover - a.turnover);

    setStockMovement(movement.slice(0, 10));
  };

  const calculateCustomerInsights = () => {
    const customerData = {};
    
    sales.forEach(sale => {
      const customer = sale.customerName || 'Walk-in Customer';
      if (!customerData[customer]) {
        customerData[customer] = {
          name: customer,
          totalSpent: 0,
          visits: 0,
          avgSpent: 0,
          lastVisit: null
        };
      }
      customerData[customer].totalSpent += sale.total || 0;
      customerData[customer].visits += 1;
      customerData[customer].lastVisit = sale.createdAt;
    });

    Object.values(customerData).forEach(customer => {
      customer.avgSpent = customer.totalSpent / customer.visits;
    });

    const insights = Object.values(customerData)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    setCustomerInsights(insights);
  };

  const calculateHutangAging = () => {
    const hutangSales = sales.filter(sale => sale.status === 'Hutang');
    const now = new Date();
    
    const aging = {
      current: 0,     // 0-30 days
      days30: 0,      // 31-60 days
      days60: 0,      // 61-90 days
      days90: 0       // 90+ days
    };

    hutangSales.forEach(sale => {
      const daysDiff = Math.floor((now - sale.createdAt) / (1000 * 60 * 60 * 24));
      const remaining = sale.remaining || 0;

      if (daysDiff <= 30) {
        aging.current += remaining;
      } else if (daysDiff <= 60) {
        aging.days30 += remaining;
      } else if (daysDiff <= 90) {
        aging.days60 += remaining;
      } else {
        aging.days90 += remaining;
      }
    });

    const agingData = [
      { name: '0-30 days', value: aging.current, color: '#8884d8' },
      { name: '31-60 days', value: aging.days30, color: '#82ca9d' },
      { name: '61-90 days', value: aging.days60, color: '#ffc658' },
      { name: '90+ days', value: aging.days90, color: '#ff7c7c' }
    ].filter(item => item.value > 0);

    setHutangAging(agingData);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR'
    }).format(amount || 0);
  };

  // Modal handler functions
  const openExpandModal = async (title, content, icon) => {
    // Check if this is a chart modal (ones that should be landscape)
    const chartModals = [
      'Sales Trends',
      'Top Products',
      'Profit Analysis',
      'Stock Turnover Analysis'
    ];
    
    const isChartModal = chartModals.includes(title);
    
    // Show modal first
    setExpandedModal({
      isOpen: true,
      title,
      content,
      icon
    });
    
    // Lock to landscape for chart modals on mobile/tablet
    if (isChartModal && Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.lock({ orientation: 'landscape' });
      } catch (error) {
        console.log('Could not lock orientation:', error);
      }
    }
  };

  const closeExpandModal = async () => {
    // Unlock orientation back to portrait when closing
    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.lock({ orientation: 'portrait' });
      } catch (error) {
        console.log('Could not unlock orientation:', error);
      }
    }
    
    setExpandedModal({
      isOpen: false,
      title: '',
      content: null,
      icon: ''
    });
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading">Loading analytics...</div>
      </div>
    );
  }

  const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
  const totalTransactions = sales.length;
  const avgTransactionValue = totalRevenue / totalTransactions || 0;
  const totalHutang = sales.filter(s => s.status === 'Hutang').reduce((sum, sale) => sum + (sale.remaining || 0), 0);

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div className="header-content">
          <h1>📊 Analytics Dashboard</h1>
          <div className="header-controls">
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="time-range-selector"
            >
              <option value="day">Last 7 Days</option>
              <option value="week">Last 4 Weeks</option>
              <option value="month">Last 12 Months</option>
              <option value="year">Last 2 Years</option>
            </select>
            <Link to="/" className="back-button">← Back to Dashboard</Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-cards">
        <div className="kpi-card">
          <div className="kpi-icon">💰</div>
          <div className="kpi-content">
            <h3>Total Revenue</h3>
            <p className="kpi-value">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">🛒</div>
          <div className="kpi-content">
            <h3>Total Transactions</h3>
            <p className="kpi-value">{totalTransactions}</p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">📈</div>
          <div className="kpi-content">
            <h3>Avg Transaction</h3>
            <p className="kpi-value">{formatCurrency(avgTransactionValue)}</p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">⚠️</div>
          <div className="kpi-content">
            <h3>Total Hutang</h3>
            <p className="kpi-value">{formatCurrency(totalHutang)}</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Sales Trends */}
        <div className="chart-card full-width">
          <h3>
            <span className="report-card-title">📈 Sales Trends</span>
            <button 
              className="expand-icon" 
              onClick={() => openExpandModal(
                'Sales Trends', 
                <div className="expanded-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => `RM ${value}`} />
                      <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>,
                '📈'
              )}
              title="Expand view"
            >
              ↗️
            </button>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={salesTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `RM ${value}`} />
              <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="chart-card">
          <h3>
            <span className="report-card-title">🏆 Top Products</span>
            <button 
              className="expand-icon" 
              onClick={() => openExpandModal(
                'Top Products', 
                <div className="expanded-chart-container">
                  {topProducts.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(value) => `RM ${value}`} />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
                        <Legend />
                        <Bar dataKey="revenue" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>
                      <p>No product sales data available yet.</p>
                      <p>Start making sales to see top products!</p>
                    </div>
                  )}
                </div>,
                '🏆'
              )}
              title="Expand view"
            >
              ↗️
            </button>
          </h3>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts.slice(0, 5)} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `RM ${value}`} />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
                <Bar dataKey="revenue" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>
              <p>No product sales data yet</p>
            </div>
          )}
        </div>

        {/* Payment Breakdown */}
        <div className="chart-card">
          <h3>
            <span className="report-card-title">💳 Payment Methods</span>
            <button 
              className="expand-icon" 
              onClick={() => openExpandModal(
                'Payment Methods Breakdown', 
                <div className="expanded-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent, value }) => `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(1)}%)`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>,
                '💳'
              )}
              title="Expand view"
            >
              ↗️
            </button>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Profit Analysis */}
        <div className="chart-card full-width">
          <h3>
            <span className="report-card-title">💹 Profit Analysis</span>
            <button 
              className="expand-icon" 
              onClick={() => openExpandModal(
                'Profit Analysis', 
                <div className="expanded-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={profitData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => `RM ${value}`} />
                      <Tooltip formatter={(value) => [formatCurrency(value)]} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue" strokeWidth={2} />
                      <Line type="monotone" dataKey="costs" stroke="#ff7c7c" name="Costs" strokeWidth={2} />
                      <Line type="monotone" dataKey="profit" stroke="#82ca9d" name="Profit" strokeWidth={4} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>,
                '💹'
              )}
              title="Expand view"
            >
              ↗️
            </button>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={profitData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `RM ${value}`} />
              <Tooltip formatter={(value) => [formatCurrency(value)]} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue" />
              <Line type="monotone" dataKey="costs" stroke="#ff7c7c" name="Costs" />
              <Line type="monotone" dataKey="profit" stroke="#82ca9d" name="Profit" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stock Movement */}
        <div className="chart-card">
          <h3>
            <span className="report-card-title">📦 Stock Turnover</span>
            <button 
              className="expand-icon" 
              onClick={() => openExpandModal(
                'Stock Turnover Analysis', 
                <div className="expanded-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stockMovement}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value.toFixed(2)} times/year`, 'Turnover Rate']} />
                      <Legend />
                      <Bar dataKey="turnover" fill="#ffc658" name="Turnover Rate" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>,
                '📦'
              )}
              title="Expand view"
            >
              ↗️
            </button>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stockMovement.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="turnover" fill="#ffc658" name="Turnover Rate" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hutang Aging */}
        <div className="chart-card">
          <h3>
            <span className="report-card-title">⏰ Hutang Aging</span>
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
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
      </div>

      {/* Data Tables */}
      <div className="tables-grid">
        {/* Low Stock Alert */}
        <div className="table-card">
          <h3>
            <span className="report-card-title">⚠️ Low Stock Alert</span>
            <button 
              className="expand-icon" 
              onClick={() => openExpandModal(
                'Low Stock Alert', 
                <div className="expanded-table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Current Stock</th>
                        <th>Reorder Point</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockProducts.map(product => (
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
                          <td>
                            <Link to="/purchases" className="action-button">
                              Reorder
                            </Link>
                          </td>
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.slice(0, 5).map(product => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td className={product.stockBalance <= 0 ? 'danger' : 'warning'}>
                      {product.stockBalance} units
                    </td>
                    <td>{product.reorderPoint} units</td>
                    <td>
                      <Link to="/purchases" className="action-button">
                        Reorder
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Customers */}
        <div className="table-card">
          <h3>
            <span className="report-card-title">👥 Top Customers</span>
            <button 
              className="expand-icon" 
              onClick={() => openExpandModal(
                'Top Customers Analysis', 
                <div className="expanded-table-container">
                  {customerInsights.length > 0 ? (
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
                        {customerInsights.map((customer, index) => (
                          <tr key={index}>
                            <td>#{index + 1}</td>
                            <td>{customer.name}</td>
                            <td>{formatCurrency(customer.totalSpent)}</td>
                            <td>{customer.visits}</td>
                            <td>{formatCurrency(customer.avgSpent)}</td>
                            <td>{customer.lastVisit ? format(customer.lastVisit, 'MMM dd, yyyy') : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>
                      <p>No customer data available yet.</p>
                      <p>Start making sales to see customer insights!</p>
                    </div>
                  )}
                </div>,
                '👥'
              )}
              title="Expand view"
            >
              ↗️
            </button>
          </h3>
          <div className="table-container">
            {customerInsights.length > 0 ? (
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
                  {customerInsights.slice(0, 5).map((customer, index) => (
                    <tr key={index}>
                      <td>{customer.name}</td>
                      <td>{formatCurrency(customer.totalSpent)}</td>
                      <td>{customer.visits}</td>
                      <td>{formatCurrency(customer.avgSpent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                <p>No customer data yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

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

export default Analytics;
