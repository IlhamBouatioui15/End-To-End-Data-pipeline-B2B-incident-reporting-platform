// ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';

const RouteProtection = ({ children }) => {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/" replace />;  // renvoie à la page login
  }
  return children;  // affiche la page demandée si connecté
};

export default RouteProtection;
