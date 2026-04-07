import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store/useGameStore";
import { Play, PenLine, Trash2, PowerOff } from "lucide-react";

export default function KelolaQuiz() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { setRoom, getSocket, setGameState } = useGameStore();

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      // Kita fetch kuis berserta query count relasi questions-nya
      const { data, error } = await supabase
        .from("quizzes")
        .select(`
          id,
          title,
          description,
          time_limit,
          points,
          is_active,
          created_at,
          questions ( count )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (err) {
      console.error("Gagal mengambil kuis:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuatQuiz = () => {
    navigate("/admin/create-quiz");
  };

  const handleEditQuiz = (quizId) => {
    navigate(`/admin/edit-quiz/${quizId}`);
  };

  const handleDeleteQuiz = async (quizId) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus kuis ini secara permanen?")) {
      try {
        const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
        if (error) throw error;
        setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      } catch (err) {
        alert("Gagal menghapus: " + err.message);
      }
    }
  };

  const handleToggleAktif = async (quiz) => {
    try {
      const newStatus = !quiz.is_active;
      const { error } = await supabase
        .from("quizzes")
        .update({ is_active: newStatus })
        .eq("id", quiz.id)
        .select()
        .single();
      
      if (error) throw error;

      setQuizzes((prev) =>
        prev.map((q) => (q.id === quiz.id ? { ...q, is_active: newStatus } : q))
      );
    } catch (err) {
      alert("Gagal update status: " + err.message);
    }
  };

  const handleMulaiQuiz = (quizId) => {
    const socket = getSocket();
    if (!socket?.connected) return alert("Koneksi server terputus.");

    // Generate room code if current room Code is not there
    // For admin UI, maybe we just overwrite and generate fresh room each time they press Mulai
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Set Local Store
    setRoom(newRoomCode, "ADMIN_HOST");

    // Join Server Room
    socket.emit("join_room", {
      roomCode: newRoomCode,
      playerName: "ADMIN_HOST",
    });

    // Setup room without starting it
    socket.emit("setup_room", { roomCode: newRoomCode, quizId });
    navigate("/admin/sesi");
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Kelola Quiz
        </h1>
        <button
          onClick={handleBuatQuiz}
          className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-fuchsia-500/20 transition-all active:scale-95"
        >
          + Buat Quiz
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="text-center p-10 text-slate-400 animate-pulse">
            Memuat data kuis...
          </div>
        ) : quizzes.length > 0 ? (
          quizzes.map((quiz) => {
            const questionCount = quiz.questions[0]?.count || 0;
            return (
              <div
                key={quiz.id}
                className="bg-[#1A1D2E] border border-[#252843] rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-6 hover:border-[#353853] transition-colors"
              >
                {/* Left Side: Detail */}
                <div className="flex flex-col items-start gap-2 w-full md:w-auto">
                  <h3 className="text-xl font-bold text-slate-100">
                    {quiz.title}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {quiz.description || "Tidak ada deskripsi"}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-3 py-1 bg-[#252746] text-purple-400 text-xs font-semibold border border-purple-500/20 rounded-full">
                      {questionCount} soal
                    </span>
                    <span className="px-3 py-1 bg-[#1A334B] text-cyan-400 text-xs font-semibold border border-cyan-500/20 rounded-full">
                      ⏱ {quiz.time_limit || 20}s/soal
                    </span>
                    <span className="px-3 py-1 bg-[#3A331E] text-yellow-500 text-xs font-semibold border border-yellow-500/20 rounded-full">
                      ⭐ {quiz.points || 100} poin
                    </span>
                    {quiz.is_active ? (
                      <span className="px-3 py-1 bg-[#1A3D36] text-emerald-400 text-xs font-semibold border border-emerald-500/20 rounded-full">
                        Aktif
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-[#3A1E24] text-rose-400 text-xs font-semibold border border-rose-500/20 rounded-full">
                        Nonaktif
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Side: Actions */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={() => handleMulaiQuiz(quiz.id)}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2 rounded-xl transition-all"
                  >
                    <Play size={16} className="fill-current" />
                    Mulai
                  </button>

                  {/* Kita arahkan ke Edit karena Edit mencakup soal juga */}
                  <button
                    onClick={() => handleEditQuiz(quiz.id)}
                    className="bg-[#24263A] hover:bg-[#2D2F45] text-slate-300 font-semibold px-4 py-2 rounded-xl border border-transparent transition-all"
                  >
                    Soal
                  </button>
                  <button
                    onClick={() => handleEditQuiz(quiz.id)}
                    className="bg-[#24263A] hover:bg-[#2D2F45] text-purple-400 font-semibold px-4 py-2 rounded-xl border border-[#252843] transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteQuiz(quiz.id)}
                    className="bg-rose-500 hover:bg-rose-600 text-white font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-rose-500/20"
                  >
                    Hapus
                  </button>
                  <button
                    onClick={() => handleToggleAktif(quiz)}
                    className="bg-[#24263A] hover:bg-[#2D2F45] text-slate-300 font-semibold px-4 py-2 rounded-xl border border-transparent transition-all"
                  >
                    {quiz.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-10 text-center text-slate-500 bg-[#1A1D2E] rounded-2xl border border-[#252843]">
            Belum ada kuis. Klik "Buat Quiz" untuk memulai.
          </div>
        )}
      </div>
    </div>
  );
}
