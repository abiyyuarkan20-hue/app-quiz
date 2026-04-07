import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store/useGameStore";

export default function AdminControlPanel() {
  const navigate = useNavigate();
  const {
    currentQuestion,
    getSocket,
    players = [],
    roomCode,
    initSocket,
    showResult,
    correctAnswer,
    timeLimit,
    setPlayers,
    resetGame,
    setGameState,
  } = useGameStore();

  const [timeLeft, setTimeLeft] = useState(0);
  const socket = getSocket();

  // 1. Socket Initialization & Persistent Listeners
  useEffect(() => {
    // Ensure socket is connected
    if (!socket || !socket.connected) {
      initSocket();
    }

    if (roomCode && socket) {
      // Initial data fetch
      socket.emit("get_room_players", { roomCode });

      const handleRoomPlayers = (playerList) => {
        setPlayers(playerList);
      };

      const handlePlayerAnswered = () => {
        socket.emit("get_room_players", { roomCode });
      };

      socket.on("room_players", handleRoomPlayers);
      socket.on("player_answered", handlePlayerAnswered);

      return () => {
        socket.off("room_players", handleRoomPlayers);
        socket.off("player_answered", handlePlayerAnswered);
      };
    }
  }, [roomCode, socket, setPlayers, initSocket]);

  // 2. Logic Timer: Reset when question changes
  useEffect(() => {
    if (currentQuestion && !showResult) {
      const duration = timeLimit > 0 ? Math.floor(timeLimit / 1000) : 20;
      setTimeLeft(duration);
    } else {
      setTimeLeft(0);
    }
  }, [currentQuestion?.id, showResult, timeLimit]);

  // 3. Logic Timer: Countdown
  useEffect(() => {
    // Only run interval if time > 0 and results aren't shown
    if (timeLeft <= 0 || showResult) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, showResult]);

  // 4. Options Parsing
  const options = useMemo(() => {
    if (!currentQuestion?.options) return [];
    if (Array.isArray(currentQuestion.options)) return currentQuestion.options;
    try {
      // Check if it's a string before parsing
      const parsed =
        typeof currentQuestion.options === "string"
          ? JSON.parse(currentQuestion.options)
          : currentQuestion.options;
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Gagal parsing options:", e);
      return [];
    }
  }, [currentQuestion]);

  // --- HANDLERS ---
  const handleNextQuestion = () => {
    if (!roomCode || !socket?.connected) {
      return alert("Koneksi server terputus!");
    }
    socket.emit("next_question", { roomCode });
  };

  const handleEndGame = () => {
    if (window.confirm("Akhiri sesi kuis untuk semua pemain?")) {
      socket.emit("end_game", { roomCode });
    }
  };

  const handleGlobalLogout = () => {
    if (window.confirm("Akhiri sesi admin dan logout?")) {
      localStorage.removeItem("isAdmin");
      if (socket?.connected) socket.emit("end_game", { roomCode });
      resetGame();
      setGameState("HOME");
      navigate("/");
    }
  };

  const answeredCount = players.filter((p) => p.hasAnswered).length;
  const allAnswered = players.length > 0 && answeredCount === players.length;

  return (
    <div className="p-8 min-h-screen text-white font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-cyan-400 italic tracking-tighter uppercase">
              Panel Kontrol Admin
            </h1>
            <p className="text-slate-400 mt-1">
              Room:{" "}
              <span className="font-mono text-white bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                {roomCode}
              </span>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleGlobalLogout}
              className="bg-slate-700 hover:bg-rose-600 px-4 py-3 rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              LOGOUT
            </button>
            <button
              onClick={handleEndGame}
              className="bg-rose-600 hover:bg-rose-700 px-6 py-3 rounded-xl text-xs font-bold shadow-lg shadow-rose-900/20 transition-all"
            >
              AKHIRI GAME
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Question Panel */}
          <div className="lg:col-span-2 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Soal Aktif
              </h3>
              <div className="flex gap-3">
                {timeLeft > 0 && !showResult && (
                  <span className="text-sm font-mono bg-rose-500/10 text-rose-500 px-3 py-1 rounded-full border border-rose-500/20 animate-pulse">
                    ⏱️ {timeLeft}s
                  </span>
                )}
                {currentQuestion && (
                  <span className="text-sm text-cyan-400 font-mono bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                    ID: {currentQuestion.id}
                  </span>
                )}
              </div>
            </div>

            {currentQuestion ? (
              <div className="space-y-6">
                <p className="text-3xl font-extrabold leading-tight">
                  {currentQuestion.question_text || currentQuestion.text}
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {options.map((opt, idx) => {
                    const isCorrect = showResult && idx === correctAnswer;
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all ${isCorrect ? "bg-green-500/20 text-green-400 border-green-500/50 font-bold" : "bg-slate-900/50 text-slate-400 border-slate-700"} flex justify-between items-center`}
                      >
                        <span>
                          <span className="opacity-40 font-mono mr-3">
                            {idx + 1}.
                          </span>{" "}
                          {opt}
                        </span>
                        {isCorrect && <span>✅</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center border-2 border-dashed border-slate-700 rounded-3xl">
                <p className="italic text-slate-500">
                  Belum ada kuis yang dimulai.
                </p>
              </div>
            )}

            <button
              onClick={handleNextQuestion}
              disabled={!currentQuestion && players.length === 0}
              className={`w-full mt-10 py-5 rounded-2xl font-black text-xl transition-all active:scale-[0.98] shadow-xl ${allAnswered ? "bg-green-600 hover:bg-green-500" : "bg-cyan-600 hover:bg-cyan-500"} disabled:bg-slate-700 disabled:opacity-50`}
            >
              {allAnswered
                ? "SEMUA SUDAH MENJAWAB! LANJUT →"
                : "LANJUT KE SOAL BERIKUTNYA →"}
            </button>
          </div>

          {/* Player Status Sidebar */}
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">
              Pemain ({answeredCount}/{players.length})
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {players.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm italic">
                  Menunggu pemain...
                </div>
              ) : (
                players.map((p, index) => (
                  <div
                    key={p.id || index}
                    className="flex justify-between items-center p-4 bg-slate-900 rounded-2xl border border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${p.hasAnswered ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-amber-500 animate-pulse"}`}
                      />
                      <span className="font-bold text-slate-200">
                        {p.name || p.playerName}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-3 py-1 rounded-full border font-black uppercase ${p.hasAnswered ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}
                    >
                      {p.hasAnswered ? "Selesai" : "Mikir..."}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
