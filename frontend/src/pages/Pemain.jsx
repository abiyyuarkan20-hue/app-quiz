import { useState, useEffect } from "react";
import { useGameStore } from "../store/useGameStore";
import { Users, Trash2, Search, Phone, Mail, Hash, RefreshCw } from "lucide-react";

export default function Pemain() {
  const { getSocket, initSocket } = useGameStore();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState(null);

  // Fetch players from Supabase via socket
  const fetchPlayers = (silent = false) => {
    const socket = getSocket();
    if (!socket?.connected) {
      initSocket();
      setTimeout(() => fetchPlayers(silent), 500);
      return;
    }
    if (!silent) setLoading(true);
    socket.emit("get_all_players", {}, (response) => {
      if (response.success) {
        setPlayers(response.players);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchPlayers(false);
    
    // Listen for automatic backend updates
    const socket = getSocket();
    const handleUpdate = () => fetchPlayers(true);
    
    if (socket) {
      socket.on("players_db_updated", handleUpdate);
    }
    
    return () => {
      if (socket) {
        socket.off("players_db_updated", handleUpdate);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClearAll = () => {
    if (!window.confirm("Hapus semua data pemain? Aksi ini tidak bisa dibatalkan.")) return;
    const socket = getSocket();
    if (!socket?.connected) return;
    socket.emit("clear_all_players", {}, (response) => {
      if (response.success) {
        setPlayers([]);
      }
    });
  };

  const filtered = players.filter((p) => {
    if (statusFilter !== "all") {
      if (statusFilter === "waiting") {
        if (p.status !== "waiting" && p.status !== "playing") return false;
      } else {
        if (p.status !== statusFilter) return false;
      }
    }

    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.whatsapp?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.room_code?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "finished":
        return (
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
            Selesai
          </span>
        );
      case "playing":
        return (
          <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-xs font-bold rounded-full border border-cyan-500/20 animate-pulse">
            Bermain
          </span>
        );
      case "left":
        return (
          <span className="px-3 py-1 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-full border border-rose-500/20">
            Keluar
          </span>
        );
      case "disconnected":
        return (
          <span className="px-3 py-1 bg-slate-500/10 text-slate-400 text-xs font-bold rounded-full border border-slate-500/20">
            Terputus
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-full border border-amber-500/20">
            Menunggu
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">Pemain</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPlayers(false)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2.5 rounded-xl border border-slate-700 transition-all active:scale-95"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={handleClearAll}
            disabled={players.length === 0}
            className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold px-5 py-2.5 rounded-xl border border-rose-500/30 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} />
            Hapus Semua Pemain
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Cari nama, WhatsApp, email, atau kode room..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#1A1D2E] pl-12 pr-4 py-3.5 rounded-2xl border border-[#252843] focus:border-purple-500 outline-none text-slate-200 placeholder:text-slate-600 transition-colors"
        />
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-[#1A1D2E] p-4 rounded-2xl border border-[#252843] flex flex-col justify-center">
          <div className="text-2xl font-black text-white">{players.length}</div>
          <div className="text-slate-500 text-xs font-medium mt-1">Total Pemain</div>
        </div>
        <div className="bg-[#1A1D2E] p-4 rounded-2xl border border-[#252843] flex flex-col justify-center">
          <div className="text-2xl font-black text-emerald-400">{players.filter(p => p.status === "finished").length}</div>
          <div className="text-slate-500 text-xs font-medium mt-1">Selesai</div>
        </div>
        <div className="bg-[#1A1D2E] p-4 rounded-2xl border border-[#252843] flex flex-col justify-center">
          <div className="text-2xl font-black text-amber-400">{players.filter(p => p.status === "waiting" || p.status === "playing").length}</div>
          <div className="text-slate-500 text-xs font-medium mt-1">Menunggu/Main</div>
        </div>
        <div className="bg-[#1A1D2E] p-4 rounded-2xl border border-[#252843] flex flex-col justify-center">
          <div className="text-2xl font-black text-rose-400">{players.filter(p => p.status === "left").length}</div>
          <div className="text-slate-500 text-xs font-medium mt-1">Keluar</div>
        </div>
        <div className="bg-[#1A1D2E] p-4 rounded-2xl border border-[#252843] flex flex-col justify-center">
          <div className="text-2xl font-black text-slate-400">{players.filter(p => p.status === "disconnected").length}</div>
          <div className="text-slate-500 text-xs font-medium mt-1">Terputus</div>
        </div>
        <div className="bg-[#1A1D2E] p-4 rounded-2xl border border-[#252843] flex flex-col justify-center">
          <div className="text-2xl font-black text-yellow-400">
            {players.length > 0 ? Math.max(...players.map(p => p.score || 0)) : 0}
          </div>
          <div className="text-slate-500 text-xs font-medium mt-1">Skor Tertinggi</div>
        </div>
      </div>

      {/* Filter Status Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setStatusFilter("all")} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${statusFilter === "all" ? "bg-purple-500/20 text-purple-400 border-purple-500/50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-300"}`}>Semua</button>
        <button onClick={() => setStatusFilter("finished")} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${statusFilter === "finished" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-300"}`}>Selesai</button>
        <button onClick={() => setStatusFilter("waiting")} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${statusFilter === "waiting" ? "bg-amber-500/20 text-amber-400 border-amber-500/50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-300"}`}>Menunggu/Main</button>
        <button onClick={() => setStatusFilter("left")} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${statusFilter === "left" ? "bg-rose-500/20 text-rose-400 border-rose-500/50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-300"}`}>Keluar</button>
        <button onClick={() => setStatusFilter("disconnected")} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${statusFilter === "disconnected" ? "bg-slate-500/20 text-slate-300 border-slate-500/50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-300"}`}>Terputus</button>
      </div>

      {/* Table */}
      <div className="bg-[#1A1D2E] rounded-3xl border border-[#252843] overflow-hidden shadow-lg shadow-black/20">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-[#252843] text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
          <div className="col-span-3">Pemain</div>
          <div className="col-span-2">Kontak</div>
          <div className="col-span-2">Room</div>
          <div className="col-span-2">Quiz</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Skor</div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="flex items-center gap-3 text-slate-500">
              <RefreshCw size={20} className="animate-spin" />
              <span className="font-medium">Memuat data pemain...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Users size={48} className="mb-4 opacity-30" />
            <span className="font-medium">
              {searchQuery ? "Tidak ditemukan pemain yang cocok." : "Belum ada data pemain."}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-[#252843]/50">
            {filtered.map((player, idx) => {
              const initials = (player.name || "?").substring(0, 2).toUpperCase();
              const isExpanded = expandedRow === player.id;

              return (
                <div key={player.id || idx}>
                  {/* Main Row */}
                  <div
                    className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-[#1E2136] transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(isExpanded ? null : player.id)}
                  >
                    {/* Player Name + Avatar */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#2A1D3D] border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-sm shrink-0">
                        {initials}
                      </div>
                      <span className="text-slate-100 font-bold truncate">{player.name}</span>
                    </div>

                    {/* Contact Info (compact) */}
                    <div className="col-span-2 flex flex-col gap-0.5 min-w-0">
                      <span className="text-slate-400 text-xs truncate flex items-center gap-1">
                        <Phone size={10} className="text-slate-600 shrink-0" />
                        {player.whatsapp || "N/A"}
                      </span>
                      <span className="text-slate-400 text-xs truncate flex items-center gap-1">
                        <Mail size={10} className="text-slate-600 shrink-0" />
                        {player.email || "N/A"}
                      </span>
                    </div>

                    {/* Room Code */}
                    <div className="col-span-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-mono font-bold rounded-lg border border-indigo-500/20">
                        <Hash size={10} />
                        {player.room_code || "—"}
                      </span>
                    </div>

                    {/* Quiz Title */}
                    <div className="col-span-2">
                      <span className="text-slate-300 text-sm truncate block">
                        {player.quiz_title || "—"}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      {getStatusBadge(player.status)}
                    </div>

                    {/* Score */}
                    <div className="col-span-1 text-right">
                      <span className="text-yellow-400 font-black text-lg tabular-nums">
                        {player.score || 0}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Detail Row */}
                  {isExpanded && (
                    <div className="bg-[#141624] px-6 py-4 border-t border-[#252843]/30 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-[#1A1D2E] p-3 rounded-xl border border-[#252843]">
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">WhatsApp</div>
                          <div className="text-slate-200 text-sm font-medium flex items-center gap-2">
                            <Phone size={14} className="text-emerald-500" />
                            {player.whatsapp || "N/A"}
                          </div>
                        </div>
                        <div className="bg-[#1A1D2E] p-3 rounded-xl border border-[#252843]">
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Email</div>
                          <div className="text-slate-200 text-sm font-medium flex items-center gap-2">
                            <Mail size={14} className="text-cyan-500" />
                            {player.email || "N/A"}
                          </div>
                        </div>
                        <div className="bg-[#1A1D2E] p-3 rounded-xl border border-[#252843]">
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Jawaban Benar</div>
                          <div className="text-emerald-400 text-lg font-black">
                            {player.correct_answers || 0}
                          </div>
                        </div>
                        <div className="bg-[#1A1D2E] p-3 rounded-xl border border-[#252843]">
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Jawaban Salah</div>
                          <div className="text-rose-400 text-lg font-black">
                            {player.incorrect_answers || 0}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-[10px] text-slate-600">
                        Bergabung: {player.joined_at ? new Date(player.joined_at).toLocaleString("id-ID") : "—"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
