
import React from 'react';
import { Home, LayoutGrid, Trophy, User } from 'lucide-react';
import { AppView } from '../types.ts';

interface BottomNavProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: AppView.HOME, label: 'Home', icon: Home },
    { id: AppView.AGORA, label: 'Agora', icon: LayoutGrid },
    { id: AppView.SYMPOSIUM, label: 'Symposium', icon: Trophy },
    { id: AppView.PROFILE, label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-stone-50 border-t border-stone-200 pb-safe z-40">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] uppercase tracking-widest font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
