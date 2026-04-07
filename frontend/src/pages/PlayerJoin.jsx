import { useState, useEffect } from "react";
import { useGameStore } from "../store/useGameStore";
import { useNavigate } from "react-router-dom";

export default function PlayerJoin() {
  const navigate = useNavigate();
  const { setRoom, getSocket, initSocket, setGameState } = useGameStore();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    room: "",
  });

  // 1. Pastikan socket terinisialisasi saat halaman dibuka
  useEffect(() => {
    initSocket();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleJoin = () => {
    const { name, email, phone, room } = formData;
    const socket = getSocket();

    // 1. Trimming data untuk validasi yang lebih akurat
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanRoom = room.trim().toUpperCase();

    if (
      !cleanName ||
      !cleanEmail.includes("@") ||
      cleanPhone.length < 10 ||
      !cleanRoom
    ) {
      return alert(
        "Harap isi data dengan benar (Email valid & No. WA minimal 10 digit)",
      );
    }

    // 2. Cek apakah socket benar-benar terhubung
    if (!socket || !socket.connected) {
      return alert(
        "Koneksi server terputus atau sedang menghubungkan. Tunggu sebentar.",
      );
    }

    setLoading(true);

    // 3. Bersihkan listener error lama
    socket.off("join_error");

    socket.once("join_error", (message) => {
      setLoading(false);
      alert(message);
    });

    // 4. Set room data di store SEBELUM emit (gunakan positional args sesuai signature)
    setRoom(cleanRoom, cleanName, cleanEmail, cleanPhone);

    // 5. Kirim data yang sudah di-clean
    socket.emit("join_room", {
      roomCode: cleanRoom,
      playerName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
    });

    // 6. Set gameState ke WAITING dan navigasi ke "/" agar QuizRoom tampil
    // (room_joined listener di store akan meng-update players)
    setGameState("WAITING");
    setLoading(false);
    navigate("/");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white p-4 font-sans">
      <div className="bg-slate-800 p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-700/50 backdrop-blur-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black mb-2 tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
            QUIZ TIME!
          </h1>
          <p className="text-slate-400 text-xs uppercase tracking-[0.2em] font-bold">
            Registration Form
          </p>
        </div>

        <div className="space-y-5">
          {[
            {
              label: "Nama Lengkap",
              name: "name",
              type: "text",
              placeholder: "Budi Santoso",
            },
            {
              label: "Email Aktif",
              name: "email",
              type: "email",
              placeholder: "budi@mail.com",
            },
            {
              label: "Nomor WhatsApp",
              name: "phone",
              type: "tel",
              placeholder: "08123456789",
            },
            {
              label: "Kode Room",
              name: "room",
              type: "text",
              placeholder: "ABCXYZ",
              mono: true,
            },
          ].map((field) => (
            <div key={field.name}>
              <label className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-1 block tracking-widest">
                {field.label}
              </label>
              <input
                name={field.name}
                type={field.type}
                placeholder={field.placeholder}
                className={`w-full p-4 rounded-2xl bg-slate-900/50 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-700 ${field.mono ? "font-mono uppercase text-cyan-400" : ""}`}
                value={formData[field.name]}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          ))}
        </div>

        <button
          disabled={loading}
          className={`w-full p-5 rounded-2xl font-black text-lg mt-10 transition-all transform active:scale-95 shadow-xl flex justify-center items-center gap-2
            ${
              loading
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white shadow-cyan-900/20"
            }`}
          onClick={handleJoin}
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              MENYAMBUNGKAN...
            </>
          ) : (
            "GABUNG SEKARANG"
          )}
        </button>

        <div className="mt-8 pt-6 border-t border-slate-700/50 text-center">
          <p className="text-slate-500 text-[10px] leading-relaxed uppercase tracking-widest px-4">
            Data digunakan untuk sistem leaderboard & verifikasi pemenang Sohor
            Kopi.
          </p>
        </div>
      </div>
    </div>
  );
}
