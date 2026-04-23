// ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';

const RouteProtection = ({ children, allowedRoles }) => {
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");

  if (!token) {
    return <Navigate to="/" replace />;  // renvoie à la page login
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/excels" replace />; // redirige vers le dashboard si rôle insuffisant
  }

  return children;  // affiche la page demandée si autorisé
};

export default RouteProtection;
