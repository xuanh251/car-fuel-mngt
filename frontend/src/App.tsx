import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Cars } from './pages/Cars';
import { CarForm } from './pages/CarForm';
import { Refuelings } from './pages/Refuelings';
import { RefuelingForm } from './pages/RefuelingForm';
import { Report } from './pages/Report';
import { GuestOnly } from './auth/GuestOnly';
import './App.css';

function App() {
  // Commit route changes synchronously. In a transition the previous page stays
  // mounted, so input typed right after a link click lands in a form that is
  // then replaced (Login -> Register lost the typed values).
  return (
    <AuthProvider>
      <BrowserRouter useTransitions={false}>
        <Routes>
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AppLayout>
                  <Routes>
                    <Route path="/cars" element={<Cars />} />
                    <Route path="/cars/new" element={<CarForm />} />
                    <Route path="/cars/:carId/edit" element={<CarForm />} />
                    <Route path="/cars/:carId/refuelings" element={<Refuelings />} />
                    <Route path="/cars/:carId/refuelings/new" element={<RefuelingForm />} />
                    <Route path="/cars/:carId/refuelings/:refuelingId/edit" element={<RefuelingForm />} />
                    <Route path="/report" element={<Report />} />
                    <Route path="*" element={<Navigate to="/cars" replace />} />
                  </Routes>
                </AppLayout>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
