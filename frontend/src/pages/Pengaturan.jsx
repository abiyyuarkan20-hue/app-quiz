import { useState } from "react";
import { Sparkles, Waves, Trees, Sun, Candy, Moon, Save, CheckCircle } from "lucide-react";
import { useGameStore } from "../store/useGameStore";

const themes = [
  { id: "cosmic", name: "Cosmic", icon: Sparkles, color: "bg-purple-900 border-purple-500", text: "text-purple-400" },
  { id: "ocean", name: "Ocean", icon: Waves, color: "bg-blue-900 border-blue-500", text: "text-blue-400" },
  { id: "forest", name: "Forest", icon: Trees, color: "bg-emerald-900 border-emerald-500", text: "text-emerald-400" },
  { id: "sunset", name: "Sunset", icon: Sun, color: "bg-orange-900 border-orange-500", text: "text-orange-400" },
  { id: "candy", name: "Candy", icon: Candy, color: "bg-pink-900 border-pink-500", text: "text-pink-400" },
  { id: "midnight", name: "Midnight", icon: Moon, color: "bg-slate-900 border-slate-500", text: "text-slate-400" },
];

export default function Pengaturan() {
  const { theme, getSocket } = useGameStore();

  const [oldPassword, setOldPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleUpdateCredentials = () => {
    if (!oldPassword) {
      setMessage({ type: "error", text: "Password lama wajib diisi!" });
      return;
    }
    
    if (!newUsername && !newPassword) {
      setMessage({ type: "error", text: "Isi Username atau Password baru!" });
      return;
    }

    const socket = getSocket();
    if (!socket) {
      setMessage({ type: "error", text: "Koneksi ke server tidak tersedia." });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    socket.emit("update_admin_credentials", { oldPassword, newUsername, newPassword }, (res) => {
      setIsSaving(false);
      if (res.success) {
        setMessage({ type: "success", text: res.message });
        setOldPassword("");
        setNewPassword("");
        // if username changed, might want to relogin, but for now just clear
      } else {
        setMessage({ type: "error", text: res.message });
      }
    });
  };

  const handleThemeChange = (selectedTheme) => {
    const socket = getSocket();
    if (socket) {
      socket.emit("update_theme", { theme: selectedTheme });
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-4xl">
      <h1 className="text-3xl font-black tracking-tight text-white mb-2">
        Pengaturan
      </h1>

      {/* Akun Admin Section */}
      <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#252843] flex flex-col gap-5 shadow-lg">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          Akun Admin
        </h2>

        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold border ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
            {message.type === 'success' && <CheckCircle size={18} />}
            {message.text}
          </div>
        )}

        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
            PASSWORD LAMA (Wajib)
          </label>
          <input
            type="password"
            placeholder="Masukkan password saat ini..."
            className="w-full bg-[#141624] text-slate-200 p-4 rounded-xl border border-[#2A2D40] focus:border-cyan-500 outline-none transition-colors"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
            USERNAME BARU
          </label>
          <input
            type="text"
            placeholder="Pisahkan atau ganti username..."
            className="w-full bg-[#141624] text-slate-200 p-4 rounded-xl border border-[#2A2D40] focus:border-cyan-500 outline-none transition-colors"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
            PASSWORD BARU
          </label>
          <input
            type="password"
            placeholder="Kosongkan jika tidak ingin mengganti password"
            className="w-full bg-[#141624] text-slate-200 p-4 rounded-xl border border-[#2A2D40] focus:border-cyan-500 outline-none transition-colors"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <button
          onClick={handleUpdateCredentials}
          disabled={isSaving}
          className="mt-2 flex items-center justify-center gap-2 bg-linear-to-r from-purple-500 to-cyan-500 text-white font-bold p-4 rounded-xl hover:from-purple-400 hover:to-cyan-400 transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] disabled:opacity-50 active:scale-95"
        >
          <Save size={18} />
          {isSaving ? "Menyimpan..." : "Simpan Kredensial"}
        </button>
      </div>

      {/* Tema Warna Section */}
      <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#252843] flex flex-col gap-5 shadow-lg">
        <h2 className="text-lg font-bold text-white">Tema Warna</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {themes.map((t) => {
            const Icon = t.icon;
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all duration-300 ${isActive ? 'bg-[#141624] border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-[#141624] border-[#2A2D40] hover:border-[#3A3D55]'}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner ${t.color}`}>
                  <Icon className={t.text} size={24} />
                </div>
                <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {t.name}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 italic mt-2">
          Catatan: Konfigurasi tema akan mengubah vibe latar belakang secara global di seluruh permainan yang dirasakan oleh Anda dan para pemain!
        </p>
      </div>
    </div>
  );
}
