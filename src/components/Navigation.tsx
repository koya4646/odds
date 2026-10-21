import React from 'react';
import { Trophy, History, Layers, BookmarkCheck, Calendar, Flame } from 'lucide-react';

export type MainTab = 'events' | 'betting' | 'settlement' | 'ranking' | 'history' | 'templates';

interface NavigationProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  isHost: boolean;
  hasActiveEvent: boolean;
  activeEventTitle?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  isHost,
  hasActiveEvent,
}) => {
  const tabs = [
    { id: 'events' as MainTab, label: '開催一覧', icon: Calendar },
    { id: 'betting' as MainTab, label: '予想・投票', icon: Flame, disabled: !hasActiveEvent },
    { id: 'settlement' as MainTab, label: '結果・精算', icon: Trophy, disabled: !hasActiveEvent },
    { id: 'ranking' as MainTab, label: '順位', icon: Layers },
    { id: 'history' as MainTab, label: '履歴', icon: History },
  ];

  if (isHost) {
    tabs.push({ id: 'templates' as MainTab, label: '設定雛形', icon: BookmarkCheck, disabled: false });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 pb-[env(safe-area-inset-bottom)] sm:static sm:bg-slate-900/50 sm:border-y sm:border-slate-800/80">
      <div className="max-w-4xl mx-auto px-2 flex justify-around sm:justify-center sm:gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          const isDisabled = tab.disabled;

          return (
            <button
              key={tab.id}
              disabled={isDisabled}
              onClick={() => onSelectTab(tab.id)}
              className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-2 px-2 sm:px-4 text-xs font-semibold rounded-xl transition-all ${
                isDisabled
                  ? 'opacity-30 cursor-not-allowed text-slate-500'
                  : isActive
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className={`w-5 h-5 sm:w-4 sm:h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[11px] sm:text-xs">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
