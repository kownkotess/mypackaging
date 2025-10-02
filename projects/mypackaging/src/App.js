import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './components/Dashboard';
import Products from './components/Products';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <ProtectedRoute>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
            </Routes>
          </ProtectedRoute>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;