import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Navigation, MainTab } from './components/Navigation';
import { ToastContainer, ToastMessage } from './components/Toast';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { ParticipantsModal } from './components/ParticipantsModal';
import { QrModal } from './components/QrModal';

import { HomeView } from './views/HomeView';
import { RoomDashboardView } from './views/RoomDashboardView';
import { CreateEventView } from './views/CreateEventView';
import { ForecastView } from './views/ForecastView';
import { ForecastListView } from './views/ForecastListView';
import { BettingView } from './views/BettingView';
import { HostControlView } from './views/HostControlView';
import { ResultView } from './views/ResultView';
import { RankingView } from './views/RankingView';
import { HistoryView } from './views/HistoryView';
import { TemplatesView } from './views/TemplatesView';

import { 
  BetTicket, 
  EventTemplate, 
  ForecastSubmission, 
  GameEvent, 
  Participant, 
  PointTransaction, 
  Room 
} from './types';
import { 
  getEvents, 
  getForecasts, 
  getRoom, 
  getStoredUserSession, 
  getTickets, 
  getTransactions, 
  saveUserSession, 
  subscribeToSync, 
  updateEvent,
  deleteRoom
} from './utils/storage';
import { calculateInitialOdds, calculateLiveOdds } from './utils/oddsCalculator';

export const App: React.FC = () => {
  // 基本状態
  const [room, setRoom] = useState<Room | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // ナビゲーション・UI
  const [currentTab, setCurrentTab] = useState<MainTab>('events');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [isShowingForecastList, setIsShowingForecastList] = useState(false);
  const [isHostSettling, setIsHostSettling] = useState(false);

  // モーダル
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // データキャッシュ
  const [tickets, setTickets] = useState<BetTicket[]>([]);
  const [allRoomTickets, setAllRoomTickets] = useState<BetTicket[]>([]);
  const [forecasts, setForecasts] = useState<ForecastSubmission[]>([]);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // トースト表示
  const addToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // 全体データ再読込
  const refreshData = useCallback(async () => {
    if (!room) return;

    // ルーム再取得
    const updatedRoom = await getRoom(room.id);
    if (updatedRoom) {
      setRoom(updatedRoom);
      if (currentParticipant) {
        const updatedPart = updatedRoom.participants[currentParticipant.id];
        if (updatedPart) setCurrentParticipant(updatedPart);
      }
    }

    // 開催レース一覧再取得
    const updatedEvents = await getEvents(room.id);
    setEvents(updatedEvents);

    // 選択中レースがあれば関連データ更新
    const targetEventId = selectedEventId || (updatedEvents.length > 0 ? updatedEvents[0].id : null);
    if (targetEventId) {
      if (!selectedEventId) setSelectedEventId(targetEventId);

      const [evTickets, evForecasts] = await Promise.all([
        getTickets(targetEventId),
        getForecasts(targetEventId)
      ]);
      setTickets(evTickets);
      setForecasts(evForecasts);
    }

    // 全チケット取得（ランキング用）
    const allTixPromises = updatedEvents.map(ev => getTickets(ev.id));
    const allTixArrays = await Promise.all(allTixPromises);
    setAllRoomTickets(allTixArrays.flat());

    // トランザクション
    const txs = await getTransactions(room.id);
    setTransactions(txs);
  }, [room?.id, currentParticipant?.id, selectedEventId]);

  // 初期ロード＆セッション復元
  useEffect(() => {
    const session = getStoredUserSession();
    if (session && session.roomId) {
      getRoom(session.roomId).then(r => {
        if (r && r.participants[session.participantId]) {
          setRoom(r);
          setCurrentParticipant(r.participants[session.participantId]);
        }
      });
    }
  }, []);

  // ルーム設定時の初回読み込み & 購読
  useEffect(() => {
    if (room) {
      refreshData();
      const unsubscribe = subscribeToSync(() => {
        refreshData();
      });
      return () => unsubscribe();
    }
  }, [room?.id]);

  // 選択中レースの切り替え時の読み込み
  useEffect(() => {
    if (selectedEventId) {
      Promise.all([
        getTickets(selectedEventId),
        getForecasts(selectedEventId)
      ]).then(([t, f]) => {
        setTickets(t);
        setForecasts(f);
      });
    }
  }, [selectedEventId]);

  // 選択中イベント
  const activeEvent = events.find(e => e.id === selectedEventId) || null;
  const isHost = currentParticipant?.role === 'host';

  // オッズ計算
  // 1. 事前予想初期オッズ
  const initialOdds = activeEvent 
    ? calculateInitialOdds(activeEvent.choices, forecasts, activeEvent.takeoutRate, activeEvent.allowedBetTypes)
    : {};

  // 2. 投票リアルタイムオッズ（投票受付中の場合）
  const liveOddsCalc = activeEvent
    ? calculateLiveOdds(tickets, activeEvent.takeoutRate, initialOdds)
    : { odds: {}, betTotals: {}, totalPool: 0 };

  // 締切済みの場合は lockedOdds を優先
  const displayOdds = (activeEvent?.status === 'CLOSED' || activeEvent?.status === 'SETTLED')
    ? (activeEvent.lockedOdds && Object.keys(activeEvent.lockedOdds).length > 0 ? activeEvent.lockedOdds : liveOddsCalc.odds)
    : (activeEvent?.status === 'BETTING' ? liveOddsCalc.odds : initialOdds);

  // ルーム参加ハンドラ
  const handleRoomJoined = (joinedRoom: Room, participant: Participant) => {
    setRoom(joinedRoom);
    setCurrentParticipant(participant);
    saveUserSession({ participantId: participant.id, name: participant.name, roomId: joinedRoom.id });
    addToast(`「${joinedRoom.name}」へようこそ！`, 'success');
  };

  // 退出ハンドラ
  const handleLeaveRoom = () => {
    if (confirm('現在のルームから退出しますか？')) {
      localStorage.removeItem('odds_party_current_user');
      setRoom(null);
      setCurrentParticipant(null);
      setSelectedEventId(null);
      setEvents([]);
      addToast('ルームを退出しました。', 'info');
    }
  };

  // ホスト専用: ルーム削除（解散）ハンドラ
  const handleDeleteRoom = async () => {
    if (!room || !isHost) return;
    const confirmMessage = `本当にルーム「${room.name}」を削除（解散）しますか？\nこの操作は取り消せず、全レース・予想・投票チケット・ランキング履歴がすべて削除されます。`;
    if (confirm(confirmMessage)) {
      try {
        await deleteRoom(room.id);
        localStorage.removeItem('odds_party_current_user');
        setRoom(null);
        setCurrentParticipant(null);
        setSelectedEventId(null);
        setEvents([]);
        addToast(`ルーム「${room.name}」を削除しました。`, 'info');
      } catch (err: any) {
        addToast(err.message || 'ルームの削除に失敗しました。', 'error');
      }
    }
  };

  // レース選択
  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    const ev = events.find(e => e.id === eventId);
    if (ev) {
      if (ev.status === 'SETTLED') {
        setCurrentTab('settlement');
      } else {
        setCurrentTab('betting');
      }
    }
  };

  // 事前予想から本番投票へ進行（ホスト）
  const handleAdvanceToBetting = async () => {
    if (!activeEvent || !isHost) return;
    try {
      // 算出された初期オッズを記録してステータス更新
      const updated: GameEvent = {
        ...activeEvent,
        status: 'BETTING',
        initialOdds
      };
      await updateEvent(updated);
      addToast('事前予想を締め切り、本番投票を開始しました！', 'success');
      refreshData();
    } catch (err: any) {
      addToast(err.message || '更新に失敗しました', 'error');
    }
  };

  // 投票締切（ホスト）
  const handleAdvanceToClose = async () => {
    if (!activeEvent || !isHost) return;
    if (confirm('投票を締め切りますか？オッズが確定し、新規投票はできなくなります。')) {
      try {
        // 現在の投票オッズをスナップショットとして固定
        const updated: GameEvent = {
          ...activeEvent,
          status: 'CLOSED',
          lockedOdds: liveOddsCalc.odds
        };
        await updateEvent(updated);
        addToast('投票を締め切りました。オッズが確定しました。', 'success');
        refreshData();
      } catch (err: any) {
        addToast(err.message || '更新に失敗しました', 'error');
      }
    }
  };

  // テンプレートからレース作成
  const handleUseTemplate = (template: EventTemplate) => {
    setCurrentTab('events');
    setIsCreatingEvent(true);
    // テンプレート適用通知
    addToast(`「${template.name}」を選択しました。設定を確認して作成してください。`, 'info');
  };

  // ルーム未参加時の表示
  if (!room || !currentParticipant) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
        <HomeView onRoomJoined={handleRoomJoined} onToast={addToast} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* ヘッダー */}
      <Header
        room={room}
        currentParticipant={currentParticipant}
        onLeaveRoom={handleLeaveRoom}
        onDeleteRoom={handleDeleteRoom}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        onOpenSupabaseConfig={() => setIsSupabaseModalOpen(true)}
        onShowParticipants={() => setIsParticipantsModalOpen(true)}
        onToast={addToast}
      />

      {/* メインナビゲーション */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={tab => {
          setIsCreatingEvent(false);
          setIsShowingForecastList(false);
          setIsHostSettling(false);
          setCurrentTab(tab);
        }}
        isHost={isHost}
        hasActiveEvent={!!activeEvent}
        activeEventTitle={activeEvent?.title}
      />

      {/* メインコンテンツ領域 */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:py-6">
        {/* 開催一覧 & レース作成 */}
        {currentTab === 'events' && (
          isCreatingEvent ? (
            <CreateEventView
              roomId={room.id}
              templates={room.templates}
              onBack={() => setIsCreatingEvent(false)}
              onCreated={newEvent => {
                setIsCreatingEvent(false);
                setSelectedEventId(newEvent.id);
                setCurrentTab('betting');
                refreshData();
              }}
              onToast={addToast}
            />
          ) : (
            <RoomDashboardView
              events={events}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              onOpenCreateEvent={() => setIsCreatingEvent(true)}
              isHost={isHost}
              currentParticipant={currentParticipant}
            />
          )
        )}

        {/* 予想・投票 タブ */}
        {currentTab === 'betting' && activeEvent && (
          activeEvent.status === 'PREPARING' ? (
            isShowingForecastList ? (
              <ForecastListView
                event={activeEvent}
                forecasts={forecasts}
                initialOdds={initialOdds}
                onBack={() => setIsShowingForecastList(false)}
              />
            ) : (
              <ForecastView
                event={activeEvent}
                participant={currentParticipant}
                isHost={isHost}
                onOpenForecastList={() => setIsShowingForecastList(true)}
                onAdvanceToBetting={handleAdvanceToBetting}
                onToast={addToast}
                onRefreshEvent={refreshData}
              />
            )
          ) : (
            <BettingView
              event={activeEvent}
              currentOdds={displayOdds}
              myTickets={tickets.filter(t => t.participantId === currentParticipant.id)}
              allTickets={tickets}
              participant={currentParticipant}
              isHost={isHost}
              onAdvanceToClose={handleAdvanceToClose}
              onRefreshData={refreshData}
              onToast={addToast}
            />
          )
        )}

        {/* 結果・精算 タブ */}
        {currentTab === 'settlement' && activeEvent && (
          isHostSettling && isHost ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setIsHostSettling(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1"
              >
                ← 結果発表画面に戻る
              </button>
              <HostControlView
                event={activeEvent}
                tickets={tickets}
                onSettled={() => {
                  setIsHostSettling(false);
                  refreshData();
                }}
                onToast={addToast}
              />
            </div>
          ) : (
            <ResultView
              event={activeEvent}
              tickets={tickets}
              currentParticipant={currentParticipant}
              isHost={isHost}
              onOpenHostSettle={() => setIsHostSettling(true)}
            />
          )
        )}

        {/* ランキング タブ */}
        {currentTab === 'ranking' && (
          <RankingView
            room={room}
            currentParticipantId={currentParticipant.id}
            allTickets={allRoomTickets}
          />
        )}

        {/* 履歴 タブ */}
        {currentTab === 'history' && (
          <HistoryView
            transactions={transactions}
            tickets={allRoomTickets}
            currentParticipantId={currentParticipant.id}
          />
        )}

        {/* テンプレート管理 タブ */}
        {currentTab === 'templates' && isHost && (
          <TemplatesView
            roomId={room.id}
            templates={room.templates}
            onUseTemplate={handleUseTemplate}
            onRefreshRoom={refreshData}
            onToast={addToast}
          />
        )}
      </main>

      {/* モーダル */}
      <SupabaseConfigModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onToast={addToast}
      />

      <ParticipantsModal
        isOpen={isParticipantsModalOpen}
        onClose={() => setIsParticipantsModalOpen(false)}
        room={room}
        currentParticipantId={currentParticipant.id}
        onToast={addToast}
      />

      <QrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        room={room}
        onToast={addToast}
      />
    </div>
  );
};

export default App;
