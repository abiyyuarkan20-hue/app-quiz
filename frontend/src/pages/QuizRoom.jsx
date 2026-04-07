import { useEffect, useState, useMemo, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useGameStore } from "../store/useGameStore";

export default function QuizRoom() {
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  const {
    currentQuestion,
    timeLimit,
    getSocket,
    roomCode,
    playerName,
    playerEmail,
    playerPhone,
    resetGame,
    showResult,
    correctAnswer,
    gameState,
    players,
    currentQuestionIndex,
    totalQuestions,
    score,
    lastAnswerPoints,
  } = useGameStore();

  const [timeLeft, setTimeLeft] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);

  // 1. Reset State & Inisialisasi Timer saat Pertanyaan Berubah
  useEffect(() => {
    if (currentQuestion?.id) {
      setHasAnswered(false);
      setSelectedIdx(null);
      // Gunakan fallback 10 detik jika timeLimit tidak valid
      const duration =
        timeLimit && timeLimit > 0 ? Math.floor(timeLimit / 1000) : 10;
      setTimeLeft(duration);
    }
  }, [currentQuestion?.id, timeLimit]);

  // 2. Logika Timer dengan Cleanup yang lebih bersih
  useEffect(() => {
    // Jangan jalankan timer jika kondisi tidak terpenuhi
    if (!currentQuestion || isAdmin || showResult) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestion, isAdmin, showResult]);  // 3. Safe Options Parsing (Memoized)
  const options = useMemo(() => {
    const rawOptions = currentQuestion?.options;
    if (!rawOptions) return [];
    if (Array.isArray(rawOptions)) return rawOptions;

    try {
      const parsed =
        typeof rawOptions === "string" ? JSON.parse(rawOptions) : rawOptions;
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Gagal parsing opsi pertanyaan:", error);
      return [];
    }
  }, [currentQuestion]);

  // 4. Handle Answer dengan useCallback untuk efisiensi
  const handleAnswer = useCallback(
    (index) => {
      const socket = getSocket();
      if (hasAnswered || timeLeft === 0 || showResult || !socket) return;

      setHasAnswered(true);
      setSelectedIdx(index);

      socket.emit("submit_answer", {
        roomCode,
        playerName,
        email: playerEmail,
        phone: playerPhone,
        questionId: currentQuestion.id,
        answerIndex: index,
      });
    },
    [
      getSocket,
      hasAnswered,
      timeLeft,
      showResult,
      roomCode,
      playerName,
      playerEmail,
      playerPhone,
      currentQuestion?.id,
    ],
  );

  const handleExit = () => {
    if (window.confirm("Keluar dari permainan?")) {
      resetGame();
      navigate("/");
    }
  };

  // Guard Clause untuk Admin
  if (isAdmin) return <Navigate to="/admin/control-panel" replace />;

  // --- 4. TAMPILAN WAITING ROOM ---
  if (gameState === "WAITING" || !currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white p-6 text-center animate-in fade-in duration-500">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.1)]"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-cyan-500 animate-spin"></div>
        </div>

        <h2 className="text-4xl font-black italic tracking-tighter text-cyan-400 mb-2 uppercase">
          READY TO PLAY?
        </h2>
        <p className="text-slate-400 font-medium max-w-xs mx-auto mb-8">
          Kamu berada di room{" "}
          <span className="text-white font-mono font-bold tracking-widest bg-slate-800 px-2 py-1 rounded">
            {roomCode || "----"}
          </span>
          . Tunggu hingga host memulai kuis.
        </p>

        <div className="bg-slate-800/50 p-6 rounded-[2.5rem] border border-slate-700/50 w-full max-w-sm backdrop-blur-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">
            Pemain Terkoneksi: {players?.length || 0}
          </p>
          <div className="flex flex-wrap justify-center gap-2 max-h-40 overflow-y-auto p-2">
            {players?.length > 0 ? (
              players.map((p, i) => (
                <span
                  key={`player-${i}`}
                  className="px-3 py-1 bg-slate-900/80 rounded-full text-xs border border-slate-700 text-slate-300 font-bold animate-in zoom-in duration-300"
                >
                  {p.name}
                </span>
              ))
            ) : (
              <span className="text-slate-600 italic text-xs">
                Menunggu pemain lain bergabung...
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleExit}
          className="mt-12 text-xs text-slate-600 hover:text-rose-400 font-black uppercase tracking-[0.3em] transition-all"
        >
          Keluar Room
        </button>
      </div>
    );
  }

  // --- 5. TAMPILAN KUIS ---
  const totalDuration = timeLimit && timeLimit > 0 ? timeLimit / 1000 : 10;
  const progress = (timeLeft / totalDuration) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white p-4 md:p-8 font-sans animate-in fade-in duration-500">
      {/* Question Progress + Timer Header */}
      <div className="w-full max-w-3xl mb-6">
        {/* Question Progress Pill */}
        {totalQuestions > 0 && (
          <div className="flex items-center justify-between mb-4">
            {/* Left: Question counter badge */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-full">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Soal</span>
                <span className="text-white font-black text-lg leading-none tabular-nums">
                  {currentQuestionIndex + 1}
                </span>
                <span className="text-slate-600 font-bold text-sm">/</span>
                <span className="text-slate-400 font-black text-sm tabular-nums">
                  {totalQuestions}
                </span>
              </div>

              {/* Dot Step Indicator */}
              <div className="hidden sm:flex items-center gap-1.5">
                {Array.from({ length: totalQuestions }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-500 ${
                      i < currentQuestionIndex
                        ? "w-2 h-2 bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.6)]"
                        : i === currentQuestionIndex
                        ? "w-3.5 h-2.5 bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                        : "w-2 h-2 bg-slate-700"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right: Score display */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden md:block">
                {Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100)}% selesai
              </span>
              <div className="flex items-center gap-2 bg-slate-800 border border-yellow-500/20 px-4 py-2 rounded-full">
                <span className="text-[10px] font-black text-yellow-500/70 uppercase tracking-wider">Skor</span>
                <span className="text-yellow-400 font-black text-lg leading-none tabular-nums drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]">
                  {score}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar Area */}
        <div className="flex justify-between items-end mb-2 px-1">
          <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">
            Time Remaining
          </span>
          <span
            className={`font-mono font-bold transition-colors ${timeLeft < 5 ? "text-rose-500 animate-pulse text-xl" : "text-cyan-400"}`}
          >
            {timeLeft}s
          </span>
        </div>
        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/50">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              timeLeft < 5
                ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                : "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Teks Pertanyaan */}
      <div className="w-full max-w-3xl bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-700/50 shadow-2xl backdrop-blur-sm mb-8 text-center">
        <h2 className="text-2xl md:text-4xl font-extrabold leading-tight tracking-tight">
          {currentQuestion.question_text ||
            currentQuestion.text ||
            "Pertanyaan tidak tersedia"}
        </h2>
      </div>

      {/* Kisi Pilihan Jawaban */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
        {options.map((opt, idx) => {
          const isCorrect = showResult && idx === correctAnswer;
          const isWrong =
            showResult && selectedIdx === idx && idx !== correctAnswer;
          const isSelected = selectedIdx === idx;

          let btnClass =
            "bg-slate-800 border-slate-700 text-slate-300 hover:border-cyan-500/50";

          if (showResult) {
            if (isCorrect)
              btnClass =
                "bg-green-500 border-green-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-105 z-10";
            else if (isWrong)
              btnClass =
                "bg-rose-500/20 border-rose-500 text-rose-500 opacity-80";
            else
              btnClass =
                "bg-slate-900 text-slate-600 border-slate-800 opacity-40";
          } else if (hasAnswered) {
            if (isSelected)
              btnClass =
                "bg-cyan-600 border-cyan-400 text-white animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.3)]";
            else
              btnClass =
                "bg-slate-900 text-slate-600 border-slate-800 opacity-50";
          }

          return (
            <button
              key={`${currentQuestion.id}-${idx}`}
              onClick={() => handleAnswer(idx)}
              disabled={hasAnswered || timeLeft === 0 || showResult}
              className={`relative p-6 text-lg font-bold rounded-2xl border-2 transition-all duration-300 transform active:scale-95 ${btnClass} flex items-center justify-center min-h-[80px]`}
            >
              <span className="px-4">{opt}</span>
              {isCorrect && (
                <span className="absolute right-4 text-xl">✅</span>
              )}
              {isWrong && <span className="absolute right-4 text-xl">❌</span>}
            </button>
          );
        })}
      </div>

      {/* Footer Feedback */}
      <div className="mt-10 flex flex-col items-center justify-center w-full gap-3">
        {/* +Points flash */}
        {showResult && lastAnswerPoints > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="inline-flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-black text-xl px-5 py-2 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.15)]">
              +{lastAnswerPoints} pts
            </span>
          </div>
        )}

        <div className="h-16 flex items-center justify-center">
          {showResult ? (
            <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              {selectedIdx === correctAnswer ? (
                <p className="text-green-400 font-black text-2xl italic uppercase tracking-tighter">
                  🔥 LUAR BIASA! BENAR!
                </p>
              ) : selectedIdx !== null ? (
                <p className="text-rose-500 font-black text-2xl italic uppercase tracking-tighter">
                  😅 KURANG TEPAT!
                </p>
              ) : (
                <p className="text-amber-500 font-black text-2xl italic uppercase tracking-tighter">
                  ⏰ WAKTU HABIS!
                </p>
              )}
              <p className="text-slate-500 text-[10px] uppercase mt-2 tracking-widest font-bold">
                Menunggu pertanyaan selanjutnya...
              </p>
            </div>
          ) : hasAnswered ? (
            <div className="bg-cyan-500/10 border border-cyan-500/20 px-8 py-4 rounded-full animate-pulse shadow-inner">
              <p className="text-cyan-400 font-bold italic text-sm flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                </span>
                ✓ Jawaban dikunci. Semoga beruntung!
              </p>
            </div>
          ) : timeLeft > 0 ? (
            <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] animate-bounce">
              Pilih Jawaban Sekarang!
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
