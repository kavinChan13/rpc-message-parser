import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FileDetailPage from './pages/FileDetailPage';
import RPCMessagesPage from './pages/RPCMessagesPage';
import ErrorsPage from './pages/ErrorsPage';
import CarriersPage from './pages/CarriersPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="file/:fileId" element={<FileDetailPage />} />
        <Route path="file/:fileId/rpc" element={<RPCMessagesPage />} />
        <Route path="file/:fileId/errors" element={<ErrorsPage />} />
        <Route path="file/:fileId/carriers" element={<CarriersPage />} />
      </Route>
    </Routes>
  );
}

export default App;
