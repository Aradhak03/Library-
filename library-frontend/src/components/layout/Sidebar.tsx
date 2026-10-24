import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Grid3X3,
  Users,
  Receipt,
  Armchair,
  BookOpen,
} from 'lucide-react';

const navItems = [
  {
    name: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
  },
  {
    name: '48-Seat Floor Map',
    path: '/seats',
    icon: Grid3X3,
  },
  {
    name: 'Students Directory',
    path: '/students',
    icon: Users,
  },
  {
    name: 'Payments & Revenue',
    path: '/payments',
    icon: Receipt,
  },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base tracking-tight leading-tight">
            Library Desk
          </h1>
          <p className="text-xs text-slate-400 font-medium">48-Seat Study Room</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1.5 flex-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Library Capacity Badge */}
      <div className="p-4 border-t border-slate-800 m-3 rounded-xl bg-slate-800/40 border">
        <div className="flex items-center gap-2.5 text-xs text-slate-400 mb-1">
          <Armchair className="w-4 h-4 text-blue-400" />
          <span className="font-medium text-slate-300">Room Capacity</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xl font-bold text-white">48 Seats</span>
          <span className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Flexible Hours
          </span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/60 text-[11px] text-slate-400 text-center">
        Library Management System v1.0
      </div>
    </aside>
  );
};
