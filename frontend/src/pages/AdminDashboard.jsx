import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Library, Activity, Users, MonitorPlay, Clock } from "lucide-react";

export default function AdminDashboard() {
  const [currentTime, setCurrentTime] = useState("");
  const [quizList, setQuizList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // For real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      // Format 08.19.06
      setCurrentTime(
        `${String(now.getHours()).padStart(2, "0")}.${String(
          now.getMinutes()
        ).padStart(2, "0")}.${String(now.getSeconds()).padStart(2, "0")}`
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Quizzes for the "Total Quiz" stats and "Quiz Terbaru" list
  useEffect(() => {
    const fetchQuizzes = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("quizzes")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setQuizList(data || []);
      } catch (err) {
        console.error("Gagal mengambil kuis:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, []);

  // Fetch Online Players
  useEffect(() => {
    const fetchOnlinePlayers = async () => {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .in("status", ["waiting", "playing"])
          .order("joined_at", { ascending: false });
        
        if (error) throw error;
        
        // Remove duplicates by name to be safe
        const uniquePlayers = [];
        const seenNames = new Set();
        (data || []).forEach(p => {
            if(!seenNames.has(p.name)){
                seenNames.add(p.name);
                uniquePlayers.push(p);
            }
        });
        setOnlinePlayers(uniquePlayers);
      } catch (err) {
        console.error("Gagal mengambil pemain online:", err.message);
      } finally {
        setLoadingPlayers(false);
      }
    };
    
    fetchOnlinePlayers();
    const interval = setInterval(fetchOnlinePlayers, 3000);
    return () => clearInterval(interval);
  }, []);

  // Placeholder numbers, can dynamically update based on socket data
  const totalQuiz = quizList.length;
  const quizAktif = quizList.filter(q => q.is_active).length; 
  const pemainOnline = onlinePlayers.length; 
  const totalSesi = 1; // Example static value for now

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#1A1D2E]/50 p-6 -mt-2 rounded-3xl border border-[#252843] shadow-lg shadow-black/10">
        <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-md">
          Dashboard
        </h1>
        <div className="flex items-center gap-3 bg-[#0f111a] border border-[#252843] px-5 py-2.5 rounded-2xl shadow-inner group transition-all hover:border-cyan-500/50">
          <Clock className="text-cyan-500 group-hover:text-cyan-400 transition-colors animate-[spin_4s_linear_infinite]" size={18} />
          <span className="text-slate-200 font-mono font-bold tracking-[0.15em] text-lg drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]">{currentTime}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#252843] flex flex-col gap-4 shadow-lg shadow-black/20">
          <Library className="text-purple-500 bg-purple-500/10 p-2 rounded-xl" size={40} />
          <div>
            <div className="text-3xl font-black text-white">{totalQuiz}</div>
            <div className="text-slate-400 text-sm font-medium mt-1">Total Quiz</div>
          </div>
        </div>

        <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#252843] flex flex-col gap-4 shadow-lg shadow-black/20">
          <Activity className="text-emerald-500 bg-emerald-500/10 p-2 rounded-xl" size={40} />
          <div>
            <div className="text-3xl font-black text-white">{quizAktif}</div>
            <div className="text-slate-400 text-sm font-medium mt-1">Quiz Aktif</div>
          </div>
        </div>

        <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#252843] flex flex-col gap-4 shadow-lg shadow-black/20">
          <Users className="text-cyan-500 bg-cyan-500/10 p-2 rounded-xl" size={40} />
          <div>
            <div className="text-3xl font-black text-white">{pemainOnline}</div>
            <div className="text-slate-400 text-sm font-medium mt-1">Pemain Online</div>
          </div>
        </div>

        <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#252843] flex flex-col gap-4 shadow-lg shadow-black/20">
          <MonitorPlay className="text-orange-500 bg-orange-500/10 p-2 rounded-xl" size={40} />
          <div>
            <div className="text-3xl font-black text-white">{totalSesi}</div>
            <div className="text-slate-400 text-sm font-medium mt-1">Total Sesi</div>
          </div>
        </div>
      </div>

      {/* Bottom Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Quiz Terbaru List */}
        <div className="bg-[#1A1D2E] rounded-3xl border border-[#252843] p-6 shadow-lg shadow-black/20">
          <h2 className="text-lg font-bold text-white mb-6">Quiz Terbaru</h2>
          
          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="text-slate-500 animate-pulse text-sm">Loading...</div>
            ) : quizList.length > 0 ? (
              quizList.slice(0, 3).map((quiz) => (
                <div key={quiz.id} className="flex justify-between items-center py-3 border-b border-[#252843] last:border-0 hover:bg-[#202336] px-4 rounded-xl transition-colors">
                  <span className="text-slate-200 font-medium">{quiz.title}</span>
                  {quiz.is_active ? (
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                      Aktif
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-full border border-rose-500/20">
                      Nonaktif
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-sm">Belum ada kuis.</div>
            )}
          </div>
        </div>

        {/* Pemain Online List */}
        <div className="bg-[#1A1D2E] rounded-3xl border border-[#252843] p-6 shadow-lg shadow-black/20 min-h-[250px]">
          <h2 className="text-lg font-bold text-white mb-6">Pemain Online</h2>
          
          <div className="flex flex-col max-h-[300px] overflow-y-auto pr-2 custom-scrollbar overflow-x-hidden">
            {loadingPlayers ? (
              <div className="flex justify-center items-center h-32">
                 <span className="text-slate-500 animate-pulse text-sm">Memuat...</span>
              </div>
            ) : onlinePlayers.length > 0 ? (
              onlinePlayers.map((player, idx) => (
                <div key={`${player.id || player.name}-${idx}`} className="flex justify-between items-center py-3 border-b border-[#252843] last:border-0 hover:bg-[#202336] px-4 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30">
                      <Users size={14} className="text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-slate-200 font-bold text-sm tracking-wide">{player.name}</div>
                      <div className="text-slate-500 text-xs font-mono">{player.room_code || "N/A"}</div>
                    </div>
                  </div>
                  {player.status === "playing" ? (
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase tracking-widest font-bold rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                      Bermain
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-[10px] uppercase tracking-widest font-bold rounded-full border border-amber-500/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                      Menunggu
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="flex justify-center items-center h-32">
                <span className="text-[#4b4e6d] font-medium text-sm">
                  Tidak ada pemain online
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
