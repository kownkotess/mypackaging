import React from 'react';
import { useAuth } from '../context/AuthContext';
import SignIn from './SignIn';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  
  return user ? children : <SignIn />;
};

export default ProtectedRoute;