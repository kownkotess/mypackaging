import './App.css';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Hutang from './pages/Hutang';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #eee' }}>
          <Link to="/">Dashboard</Link>
          <Link to="/products">Products</Link>
          <Link to="/sales">Sales</Link>
          <Link to="/purchases">Purchases</Link>
          <Link to="/hutang">Credit</Link>
          <div style={{ marginLeft: 'auto' }}>
            <Link to="/login">Login</Link>
          </div>
        </nav>
        <main style={{ padding: 16 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/hutang" element={<Hutang />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
