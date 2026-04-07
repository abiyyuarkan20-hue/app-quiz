import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { Trash2, ChevronDown } from "lucide-react";

import { useGameStore } from "../store/useGameStore";

export default function Leaderboard({
  isPlayerView = false,
  currentPlayer = "",
  filterRoomCode = "",   // player's last game room code
  quizTitle = "",        // player's last quiz title (for display)
}) {
  const [dbPlayers, setDbPlayers] = useState([]);
  const [livePlayers, setLivePlayers] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState("all");
  const [loading, setLoading] = useState(true);

  const { getSocket } = useGameStore();

  const fetchLeaderboard = async () => {
    setLoading(true);

    if (isPlayerView && filterRoomCode) {
      // --- PLAYER VIEW: only show this specific game session ---
      const { data: playersData, error } = await supabase
        .from("players")
        .select("*")
        .eq("room_code", filterRoomCode)
        .order("score", { ascending: false });

      if (!error && playersData) {
        setDbPlayers(playersData.filter(p => !isPlayerView || p.score > 0)); 
      }
    } else {
      // --- ADMIN VIEW: show all players with quiz filter ---
      const { data: playersData, error: pError } = await supabase
        .from("players")
        .select("*")
        .gt("score", 0) 
        .order("score", { ascending: false });

      if (!pError && playersData) {
        setDbPlayers(playersData);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [filterRoomCode]);

  // Compute quizzes directly instead of using an effect
  const derivedQuizzes = useMemo(() => {
     const titles = [...dbPlayers.map(p => p.quiz_title), ...livePlayers.map(p => p.quiz_title)].filter(Boolean);
     return [...new Set(titles)];
  }, [dbPlayers, livePlayers]);
  // SOCKET LIVE DATA MAPPING FOR ADMIN
  useEffect(() => {
    if (isPlayerView) return; // Player view is isolated and doesn't get global live updates

    const socket = getSocket();
    if (!socket) return;

    socket.emit("join_admin_dashboard");
    
    // Initial fetch of active rooms
    socket.emit("get_live_leaderboard", (response) => {
      if (response && response.success) {
        setLivePlayers(response.livePlayers || []);
      }
    });

    const handleLiveScore = (data) => {
      // data contains: name, room_code, quiz_title, score, etc.
      setLivePlayers((prev) => {
        const existing = prev.findIndex(p => p.name === data.name && p.room_code === data.room_code);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = data;
          return updated;
        } else {
          return [...prev, data];
        }
      });
    };

    socket.on("live_score_update", handleLiveScore);

    return () => {
      socket.off("live_score_update", handleLiveScore);
    };
  }, [isPlayerView, getSocket]);

  const handleClearAll = async () => {
    if (
      !window.confirm(
        "Hapus semua data pemain di leaderboard? Aksi ini tidak bisa dibatalkan."
      )
    )
      return;
    const { error } = await supabase.from("players").delete().neq("id", 0);
    if (!error) {
      fetchLeaderboard();
      setLivePlayers([]); // Also clear live visual if requested
    }
  };

  // Merge DB players with Live players ensuring live overwrites DB if they have same name+room
  const mergedPlayers = useMemo(() => {
    const map = new Map();
    // 1. Put all DB players
    dbPlayers.forEach(p => map.set(`${p.name}-${p.room_code}`, p));
    // 2. Put/overwrite with Live players
    livePlayers.forEach(p => map.set(`${p.name}-${p.room_code}`, p));
    
    let combined = Array.from(map.values());
    
    if (!isPlayerView && selectedQuiz !== "all") {
       combined = combined.filter(p => p.quiz_title === selectedQuiz);
    }
    
    // Remove zero scores for admin view if they are not live
    if (!isPlayerView) {
      combined = combined.filter(p => p.score > 0 || p.is_live);
    }

    return combined.sort((a, b) => b.score - a.score);
  }, [dbPlayers, livePlayers, selectedQuiz, isPlayerView]);

  const filteredPlayers = mergedPlayers;

  const getRankStyle = (index) => {
    switch (index) {
      case 0:
        return "bg-yellow-500 text-yellow-950 shadow-[0_0_15px_rgba(234,179,8,0.4)]";
      case 1:
        return "bg-slate-300 text-slate-900 shadow-[0_0_15px_rgba(203,213,225,0.3)]";
      case 2:
        return "bg-amber-700 text-amber-50 shadow-[0_0_15px_rgba(180,83,9,0.4)]";
      default:
        return "bg-[#2A2D40] text-slate-400 border border-[#3A3D55]";
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Leaderboard
          </h1>
          {isPlayerView && quizTitle && (
            <p className="text-sm text-slate-400 mt-1 font-medium">
              📋 {quizTitle}
              {filteredPlayers.length > 0 && (
                <span className="ml-2 text-slate-500">
                  · {filteredPlayers.length} pemain
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Dropdown Filter — only for admin */}
          {!isPlayerView && (
            <div className="relative flex-1 md:w-48">
              <select
                value={selectedQuiz}
                onChange={(e) => setSelectedQuiz(e.target.value)}
                className="w-full appearance-none bg-[#1E2136] hover:bg-[#252843] text-slate-200 font-medium px-4 py-2.5 rounded-xl border border-[#2A2D40] focus:border-cyan-500 outline-none transition-colors cursor-pointer"
              >
                <option value="all">Semua Quiz</option>
                {derivedQuizzes.map((q, i) => (
                  <option key={i} value={q}>
                    {q}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          )}

          {!isPlayerView && (
            <button
              onClick={handleClearAll}
              disabled={filteredPlayers.length === 0}
              className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-500/20 whitespace-nowrap"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Hapus Semua</span>
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-slate-500 font-medium animate-pulse">
              Memuat Leaderboard...
            </div>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-[#1A1D2E] rounded-3xl border border-[#252843]">
            <span className="font-medium text-lg">Belum ada data pemain.</span>
            <span className="text-sm">Mainkan kuis untuk mengisi leaderboard!</span>
          </div>
        ) : (
          filteredPlayers.map((player, index) => {
            const initials = (player.name || "?").substring(0, 2).toUpperCase();
            const rankStyle = getRankStyle(index);
            const scoreColor = index === 0 ? "text-yellow-400 font-black drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" : 
                               index === 1 ? "text-slate-300 font-black drop-shadow-[0_0_8px_rgba(203,213,225,0.4)]" : 
                               index === 2 ? "text-amber-500 font-black drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]" : 
                               "text-yellow-500 font-bold";

            const isMe = isPlayerView && player.name === currentPlayer;
            return (
              <div
                key={`${player.id || player.name}-${player.room_code || index}`}
                className={`group flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-[#1A1D2E] border hover:border-purple-500/30 rounded-2xl transition-all hover:shadow-lg hover:shadow-purple-500/5 hover:-translate-y-0.5 gap-4 sm:gap-2 ${isMe ? 'border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.2)]' : 'border-[#252843]'} ${player.is_live ? 'relative overflow-hidden' : ''}`}
              >
                {/* Live Pulse Effect for Active Playing Sessions */}
                {player.is_live && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse"></div>
                )}
                
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  {/* Rank Badge */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${rankStyle}`}>
                    {index + 1}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#2A1D3D] flex items-center justify-center text-purple-400 font-bold text-sm shrink-0 border border-purple-500/20 group-hover:border-purple-500/50 transition-colors">
                    {initials}
                  </div>

                  {/* Details */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 font-bold text-lg truncate leading-tight">
                        {player.name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          Kamu
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-xs truncate">
                      {player.correct_answers || 0} benar
                      {player.incorrect_answers > 0 && (
                        <span className="text-slate-600"> · {player.incorrect_answers} salah</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div className="flex items-center sm:justify-end w-full sm:w-auto pl-14 sm:pl-0">
                  <span className={`text-2xl tracking-tight tabular-nums ${scoreColor}`}>
                    {player.score || 0}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
