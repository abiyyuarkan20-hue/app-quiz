import React, { useState, useEffect } from "react";
import { useGameStore } from "../store/useGameStore";
import { supabase } from "../supabaseClient";
import { Gamepad2, Play, Users } from "lucide-react";

export default function SesiAktif() {
  const {
    roomCode,
    activeQuizTitle,
    activeQuizId,
    sessionStartTime,
    currentQuestionIndex,
    totalQuestions,
    isResultPhase,
    players,
    getSocket,
    gameState,
    setRoom,
  } = useGameStore();

  const [elapsedTime, setElapsedTime] = useState(0);
  const [latestQuiz, setLatestQuiz] = useState(null);

  // Load latest quiz for quick start if no active session
  useEffect(() => {
    if (!roomCode) {
      const fetchLatestQuiz = async () => {
        const { data } = await supabase
          .from("quizzes")
          .select("id, title")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(); // Switch to maybeSingle to avoid 406 errors when 0 rows match
          
        if (data) {
          setLatestQuiz(data);
        } else {
          setLatestQuiz(null);
        }
      };
      fetchLatestQuiz();
    }
  }, [roomCode]);

  // Timer logic for active session
  useEffect(() => {
    let timer;
    if (roomCode && sessionStartTime) {
      const updateTimer = () => {
        const now = Date.now();
        const start = parseInt(sessionStartTime);
        const diffInSeconds = Math.max(0, Math.floor((now - start) / 1000));
        setElapsedTime(diffInSeconds);
      };

      updateTimer();
      timer = setInterval(updateTimer, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [roomCode, sessionStartTime]);

  const handleStopSession = () => {
    const socket = getSocket();
    if (window.confirm("Hentikan sesi ini sekarang?")) {
      socket.emit("end_game", { roomCode });
    }
  };

  const handleQuickStart = () => {
    if (!latestQuiz) return;
    const socket = getSocket();
    if (!socket?.connected) return alert("Koneksi server terputus.");

    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoom(newRoomCode, "ADMIN_HOST");

    socket.emit("join_room", { roomCode: newRoomCode, playerName: "ADMIN_HOST" });
    socket.emit("setup_room", { roomCode: newRoomCode, quizId: latestQuiz.id });
  };

  const handleJalankanKuis = () => {
    const socket = getSocket();
    if (!socket?.connected) return alert("Koneksi server terputus.");
    socket.emit("start_game", { roomCode, quizId: activeQuizId });
  };

  if (!roomCode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in zoom-in duration-500">
        <div className="bg-slate-800/30 p-10 rounded-[3rem] border border-slate-700/50 flex flex-col items-center max-w-md text-center shadow-2xl">
          <Gamepad2 size={80} className="text-purple-500 mb-6 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
          <h2 className="text-2xl font-bold text-white mb-2">Tidak ada sesi aktif</h2>
          <p className="text-slate-400 text-sm mb-8">
            Pilih quiz dan mulai sesi untuk para pemain
          </p>
          
          <button
            onClick={handleQuickStart}
            disabled={!latestQuiz}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={18} className="fill-current" />
            Mulai: {latestQuiz ? latestQuiz.title : "..."}
          </button>
        </div>
      </div>
    );
  }

  // LOBBY VIEW
  if (gameState === "ADMIN_LOBBY") {
    return (
      <div className="animate-in fade-in zoom-in duration-500 max-w-4xl mx-auto flex flex-col items-center py-10">
        <h1 className="text-4xl font-bold text-white mb-2 text-center drop-shadow-md">
          Ruang Tunggu
        </h1>
        <p className="text-slate-400 mb-10 text-center max-w-md">
          Minta pemain untuk bergabung di perangkat mereka menggunakan kode ruangan di bawah ini.
        </p>
        
        <div className="bg-[#0B1E19]/80 backdrop-blur-md p-12 rounded-[3rem] border border-[#143D32] flex flex-col items-center w-full max-w-2xl shadow-2xl relative overflow-hidden mb-12">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
          
          <span className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs mb-6">
            KODE RUANGAN
          </span>
          <div className="text-8xl md:text-9xl font-black text-white tracking-[0.1em] mb-8 drop-shadow-[0_0_30px_rgba(16,185,129,0.4)]">
            {roomCode}
          </div>
          <div className="bg-emerald-950/50 px-6 py-3 rounded-full border border-emerald-900/50 flex items-center gap-3">
             <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
             <span className="text-emerald-100 font-bold">
               {players.length} Pemain Siap
             </span>
          </div>
        </div>

        <div className="flex w-full max-w-2xl gap-4">
          <button
            onClick={handleStopSession}
            className="bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 font-bold px-8 py-5 rounded-2xl transition-all"
          >
            Batal
          </button>
          <button
            onClick={handleJalankanKuis}
            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-8 py-5 rounded-2xl text-xl transition-all shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:shadow-[0_0_50px_rgba(34,211,238,0.5)] hover:-translate-y-1 active:translate-y-0 uppercase tracking-widest"
          >
            Mulai Kuis
          </button>
        </div>

        {/* Pemain List */}
        <div className="w-full mt-16 max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <Users className="text-emerald-500" size={24} />
            <h3 className="text-xl font-bold text-white">Daftar Pemain ({players.length})</h3>
          </div>
          
          {players.length === 0 ? (
            <div className="text-center p-12 bg-slate-800/30 rounded-3xl border border-slate-700/50 text-slate-500 italic">
               Belum ada pemain yang masuk ke ruangan.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {players.map((p, idx) => (
                <div key={idx} className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 shadow-lg hover:border-emerald-500/30 transition-colors">
                   <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold shadow-[inset_0_0_10px_rgba(16,185,129,0.2)]">
                     {p.name.substring(0,2).toUpperCase()}
                   </div>
                   <span className="text-slate-200 font-bold truncate text-sm">{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight text-white mb-8">
        Sesi Aktif
      </h1>

      {/* Active Session Info Card */}
      <div className="bg-[#0B1E19] border border-[#143D32] rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">
              {totalQuestions > 0 ? `Soal ke-${currentQuestionIndex + 1} dari ${totalQuestions}` : "Sesi Sedang Berjalan"}
            </span>
          </div>
          <h2 className="text-3xl font-bold text-white">
            {activeQuizTitle || "Loading Quiz..."}
          </h2>
          <p className="text-slate-400 text-sm">
            Berjalan selama {elapsedTime}s
          </p>
        </div>

        <button
          onClick={handleStopSession}
          className="relative z-10 bg-rose-500 hover:bg-rose-600 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-rose-900/40 active:scale-95 whitespace-nowrap"
        >
          <div className="w-3 h-3 bg-white border border-rose-500" />
          Hentikan
        </button>
      </div>

      {/* Players List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">
          Pemain ({players.length})
        </h3>
        {players.length === 0 ? (
          <div className="text-center p-10 bg-[#1A1D2E] rounded-2xl border border-[#252843] text-slate-500 italic">
            Menunggu pemain bergabung...
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {players.map((p, index) => {
              const initials = (p.name || "U").substring(0, 2).toUpperCase();
              
              let borderClass = "border-[#252843] hover:border-[#353853] bg-[#1A1D2E]";
              let statusText = p.hasAnswered ? "Selesai" : "Menjawab...";
              let statusColor = "text-slate-400";
              let pointColor = "text-yellow-500";
              
              if (isResultPhase) {
                  if (p.isCorrect) {
                      borderClass = "border-emerald-500/50 bg-emerald-500/10";
                      statusText = "Jawaban Benar!";
                      statusColor = "text-emerald-400 font-bold";
                      pointColor = "text-emerald-400";
                  } else if (p.hasAnswered) {
                      borderClass = "border-rose-500/50 bg-rose-500/10";
                      statusText = "Jawaban Salah";
                      statusColor = "text-rose-400 font-bold";
                      pointColor = "text-rose-400";
                  } else {
                      borderClass = "border-slate-700/50 bg-slate-800/30 text-slate-500";
                      statusText = "Tidak Menjawab (Waktu Habis)";
                      statusColor = "text-slate-500 font-bold";
                      pointColor = "text-slate-500";
                  }
              }

              const correct = p.correctAnswers ?? 0;
              const incorrect = p.incorrectAnswers ?? 0;
              const answered = p.totalAnswered ?? 0;
              const progressPct = totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;

              return (
                <div
                  key={index}
                  className={`border rounded-2xl transition-all duration-500 overflow-hidden ${borderClass}`}
                >
                  {/* Top row: Avatar + Name + Status + Score */}
                  <div className="flex justify-between items-center p-4 pb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-full border border-purple-500/30 flex items-center justify-center font-bold text-sm tracking-widest flex-shrink-0 ${isResultPhase && !p.isCorrect && !p.hasAnswered ? "bg-slate-800 text-slate-600" : "bg-[#2A1D3D] text-purple-400"}`}>
                        {initials}
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-bold text-base leading-tight ${isResultPhase && !p.hasAnswered && !p.isCorrect ? "text-slate-500" : "text-slate-100"}`}>
                          {p.name}
                        </span>
                        <span className={`text-xs mt-0.5 ${statusColor}`}>
                          {statusText}
                        </span>
                      </div>
                    </div>
                    <div className={`font-black text-xl flex-shrink-0 tabular-nums ${pointColor}`}>
                      {p.score}
                    </div>
                  </div>

                  {/* Bottom stats bar */}
                  <div className="px-4 pb-3 pt-1">
                    <div className="flex items-center gap-3">
                      {/* Correct Answers */}
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/10">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"></div>
                        <span className="text-[11px] font-semibold text-emerald-400">Benar</span>
                        <span className="text-[13px] font-black text-emerald-300 tabular-nums ml-0.5">{correct}</span>
                      </div>

                      {/* Incorrect Answers */}
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 rounded-full border border-rose-500/10">
                        <div className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.7)]"></div>
                        <span className="text-[11px] font-semibold text-rose-400">Salah</span>
                        <span className="text-[13px] font-black text-rose-300 tabular-nums ml-0.5">{incorrect}</span>
                      </div>

                      {/* Divider */}
                      <div className="w-px h-5 bg-slate-700/60 mx-0.5"></div>

                      {/* Progress bar for answered/total */}
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <div className="flex-1 h-2 bg-slate-700/40 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${progressPct}%`,
                              background: progressPct === 100
                                ? "linear-gradient(90deg, #34d399, #2dd4bf)"
                                : "linear-gradient(90deg, #818cf8, #a78bfa)",
                              boxShadow: progressPct > 0
                                ? progressPct === 100
                                  ? "0 0 8px rgba(52,211,153,0.5)"
                                  : "0 0 8px rgba(129,140,248,0.4)"
                                : "none"
                            }}
                          ></div>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 tabular-nums whitespace-nowrap">
                          {answered}<span className="text-slate-600">/</span>{totalQuestions || "?"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
