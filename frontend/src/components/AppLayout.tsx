import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import '../App.css';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <nav className="app-nav">
          <Link to="/cars">Cars</Link>
          <Link to="/report">Report</Link>
          <button onClick={handleLogout} className="logout-btn">Log out</button>
        </nav>
        {user && <div className="user-info">{user.email}</div>}
      </header>
      <main className="app-main">
        {children}
      </main>
    </div>
  );
};
