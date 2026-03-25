import logo from './logo.svg';
import './App.css';

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import ProtectedPage from './Protected';
import Membres from './Components/Members';
import Excels from './Components/rapp/excels';
import ExcelPage from './Components/fichiers-excel';
import RouteProtection from './RouteProtection'
function App() {
  
  return (
    <Router>
      <Routes>
      <Route path="/Members" element={ <RouteProtection> <Membres /> </RouteProtection>} />
      <Route path="/" element={<Login />} />
      <Route path="/protected" element={<RouteProtection><ProtectedPage /></RouteProtection>} />
      <Route path="/excels" element={<RouteProtection><Excels /> </RouteProtection>} />
      <Route path="/fichiers-excel" element={ <RouteProtection><ExcelPage /> </RouteProtection>  } />
      </Routes>
    </Router>
  );
}

export default App;