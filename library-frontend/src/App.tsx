import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ModalProvider } from './context/ModalContext.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import Dashboard from './pages/Dashboard.tsx';
import SeatFloorMap from './pages/SeatFloorMap.tsx';
import StudentsDirectory from './pages/StudentsDirectory.tsx';
import PaymentsHub from './pages/PaymentsHub.tsx';

function App() {
  return (
    <BrowserRouter>
      <ModalProvider>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="seats" element={<SeatFloorMap />} />
            <Route path="students" element={<StudentsDirectory />} />
            <Route path="payments" element={<PaymentsHub />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ModalProvider>
    </BrowserRouter>
  );
}

export default App;
