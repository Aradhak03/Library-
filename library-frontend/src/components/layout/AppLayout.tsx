import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { TopBar } from './TopBar.tsx';
import { ModalHost } from '../modals/ModalHost.tsx';

export const AppLayout = () => {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Area: TopBar + Page Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        {/* Scrollable Main Content Container */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Modals Host */}
      <ModalHost />
    </div>
  );
};
