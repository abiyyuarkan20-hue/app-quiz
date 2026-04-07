import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Gamepad2, Crown, Zap, Sparkles, ArrowRight } from "lucide-react";
import { useGameStore } from "./store/useGameStore";

// Pages (Pastikan file ini ada di folder pages)
import QuizRoom from "./pages/QuizRoom";
import CreateQuiz from "./pages/CreateQuiz";
import SesiAktif from "./pages/SesiAktif";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLayout from "./components/AdminLayout";
import KelolaQuiz from "./pages/KelolaQuiz";
import Pemain from "./pages/Pemain";
import Pengaturan from "./pages/Pengaturan";
import Leaderboard from "./pages/Leaderboard";

// --- 1. Route Guard ---
function ProtectedRoute({ children, isAdmin }) {
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Mengambil state dari Zustand Store
  const { setRoom, initSocket, getSocket, gameState, setGameState, playerName, lastRoomCode, activeQuizTitle } =
    useGameStore();

  // --- STATE LOKAL ---
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem("isAdmin") === "true",
  );
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");

  // --- EFFECTS ---
  useEffect(() => {
    initSocket();
  }, [initSocket]);

  useEffect(() => {
    if (isAdmin) {
      // Redirect ke dashboard jika admin kembali ke root
      if (location.pathname === "/") {
        setGameState("ADMIN_DASHBOARD");
        navigate("/admin/dashboard");
      }
    }
  }, [isAdmin, location.pathname, setGameState, navigate]);

  // --- HANDLERS ---

  const handleJoinPlayer = () => {
    const socket = getSocket();
    if (!socket?.connected) return alert("Koneksi server terputus.");

    if (name.trim() && code.trim() && whatsapp.trim() && email.trim()) {
      const upperCode = code.toUpperCase();
      setRoom(upperCode, name, email, whatsapp);

      socket.emit("join_room", {
        roomCode: upperCode,
        playerName: name,
        whatsapp,
        email,
      });
      // Store will automatically update gameState to WAITING upon receiving room_joined
    } else {
      alert("Lengkapi semua data!");
    }
  };

  const handleLoginAdmin = () => {
    const socket = getSocket();
    if (!socket) return alert("Socket tidak tersedia.");

    socket.emit(
      "admin_login",
      { username: adminUser, password: adminPass },
      (response) => {
        if (response.success) {
          localStorage.setItem("isAdmin", "true");
          setIsAdmin(true);
          setGameState("ADMIN_DASHBOARD");
          navigate("/admin/dashboard");
        } else {
          alert("Gagal Login: " + response.message);
        }
      },
    );
  };

  return (
    <div className="min-h-screen text-slate-200 selection:bg-cyan-500/30 font-sans theme-container transition-colors duration-1000">
      <Routes>
        <Route
          path="/"
          element={
            <div className="container mx-auto max-w-4xl px-4 py-10">
              {/* 1. HOME SCREEN */}
              {!isAdmin &&
                !["ADMIN_LOGIN", "PLAYER_LOBBY", "WAITING", "PLAYING", "PLAYER_LEADERBOARD"].includes(
                  gameState,
                ) && (
                  <div className="relative flex flex-col items-center justify-center min-h-[85vh] text-center w-full">
                    {/* Ambient Glow Effects */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[150px] -z-10 pointer-events-none animate-pulse duration-1000"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-[20%] -translate-y-[80%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

                    <div className="relative mb-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                      <Sparkles
                        className="absolute -top-8 -right-12 text-cyan-400 animate-pulse"
                        size={40}
                        strokeWidth={1.5}
                      />
                      <Sparkles
                        className="absolute -bottom-4 -left-10 text-purple-400 animate-pulse delay-300"
                        size={24}
                        strokeWidth={1.5}
                      />

                      <div className="flex items-center justify-center gap-4 mb-6">
                        <div className="p-4 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-3xl shadow-[0_0_40px_rgba(34,211,238,0.5)] rotate-3">
                          <Zap
                            className="text-white fill-current animate-pulse"
                            size={48}
                          />
                        </div>
                      </div>

                      <h1 className="text-8xl md:text-9xl font-black tracking-tighter drop-shadow-2xl">
                        <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500">
                          QUIZzz
                        </span>
                      </h1>
                    </div>

                    <p className="text-slate-400 text-lg md:text-xl font-medium mb-16 max-w-md bg-[#1A1D2E]/80 backdrop-blur-xl px-8 py-3 rounded-full border border-[#252843] shadow-lg shadow-black/20 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                      Platform Bermain Kuis Seru dan Menambah Wawasan.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
                      <button
                        onClick={() => setGameState("PLAYER_LOBBY")}
                        className="group relative overflow-hidden bg-[#141624] p-10 rounded-[3rem] border border-[#252843] hover:border-purple-500/50 hover:shadow-[0_0_50px_rgba(168,85,247,0.15)] transition-all duration-500 text-left flex flex-col justify-between h-[280px]"
                      >
                        {/* Hover Gradient Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/10 group-hover:to-transparent transition-all duration-500"></div>

                        <div className="relative z-10 bg-purple-500/10 w-20 h-20 rounded-2xl flex items-center justify-center border border-purple-500/20 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-500">
                          <Gamepad2
                            size={40}
                            className="text-purple-400 group-hover:text-purple-300"
                            strokeWidth={1.5}
                          />
                        </div>

                        <div className="relative z-10 w-full">
                          <h2 className="text-3xl font-black uppercase tracking-widest text-white mb-2 group-hover:text-purple-300 transition-colors">
                            Mainkan
                          </h2>
                          <div className="flex items-center justify-between text-slate-400 group-hover:text-slate-300 transition-colors">
                            <span className="font-medium text-sm">
                              Gabung ke room kuis
                            </span>
                            <ArrowRight className="transform -translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => setGameState("ADMIN_LOGIN")}
                        className="group relative overflow-hidden bg-[#141624] p-10 rounded-[3rem] border border-[#252843] hover:border-cyan-500/50 hover:shadow-[0_0_50px_rgba(34,211,238,0.15)] transition-all duration-500 text-left flex flex-col justify-between h-[280px]"
                      >
                        {/* Hover Gradient Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-cyan-500/0 group-hover:from-cyan-500/10 group-hover:to-transparent transition-all duration-500"></div>

                        <div className="relative z-10 bg-cyan-500/10 w-20 h-20 rounded-2xl flex items-center justify-center border border-cyan-500/20 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all duration-500">
                          <Crown
                            size={40}
                            className="text-cyan-400 group-hover:text-cyan-300"
                            strokeWidth={1.5}
                          />
                        </div>

                        <div className="relative z-10 w-full">
                          <h2 className="text-3xl font-black uppercase tracking-widest text-white mb-2 group-hover:text-cyan-300 transition-colors">
                            Host Game
                          </h2>
                          <div className="flex items-center justify-between text-slate-400 group-hover:text-slate-300 transition-colors">
                            <span className="font-medium text-sm">
                              Buat dan kelola sesi
                            </span>
                            <ArrowRight className="transform -translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

              {/* 2. ADMIN LOGIN */}
              {gameState === "ADMIN_LOGIN" && !isAdmin && (
                <div className="flex items-center justify-center min-h-[70vh]">
                  <div className="w-full max-w-md bg-slate-800 p-10 rounded-[3rem] border border-slate-700 shadow-2xl">
                    <h2 className="text-3xl font-black text-center mb-8">
                      ADMIN ACCESS
                    </h2>
                    <div className="space-y-4">
                      <input
                        type="text"
                        placeholder="Username"
                        className="w-full bg-slate-900/50 p-5 rounded-2xl border border-slate-700 focus:border-cyan-500 outline-none"
                        value={adminUser}
                        onChange={(e) => setAdminUser(e.target.value)}
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        className="w-full bg-slate-900/50 p-5 rounded-2xl border border-slate-700 focus:border-cyan-500 outline-none"
                        value={adminPass}
                        onChange={(e) => setAdminPass(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleLoginAdmin()
                        }
                      />
                      <button
                        onClick={handleLoginAdmin}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 py-5 rounded-2xl font-black text-lg transition-all active:scale-95"
                      >
                        LOGIN
                      </button>
                      <button
                        onClick={() => setGameState("HOME")}
                        className="w-full text-slate-500 font-bold"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. ADMIN DASHBOARD - Dipindahkan ke komponen AdminDashboard */}

              {/* 4. PLAYER LOBBY */}
              {gameState === "PLAYER_LOBBY" && (
                <div className="flex justify-center min-h-[70vh] items-center">
                  <div className="w-full max-w-md bg-slate-800 p-10 rounded-[3rem] border border-slate-700 shadow-2xl">
                    <h2 className="text-3xl font-black text-center mb-8 italic">
                      JOIN GAME
                    </h2>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Nickname"
                        className="w-full bg-slate-900 p-5 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="WhatsApp"
                        className="w-full bg-slate-900 p-5 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        className="w-full bg-slate-900 p-5 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Room Code"
                        className="w-full bg-slate-900 p-5 rounded-2xl font-black text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                      <button
                        onClick={handleJoinPlayer}
                        className="w-full bg-purple-600 hover:bg-purple-500 py-5 rounded-2xl font-black text-xl transition-all active:scale-95"
                      >
                        MASUK ROOM
                      </button>
                      <button
                        onClick={() => setGameState("HOME")}
                        className="w-full text-slate-500 font-bold py-2"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. PLAYER SCREEN */}
              {!isAdmin &&
                (gameState === "WAITING" || gameState === "PLAYING") && (
                  <div className="animate-in fade-in zoom-in duration-500">
                    <QuizRoom />
                  </div>
                )}

              {/* 6. PLAYER LEADERBOARD (End of Game) */}
              {!isAdmin && gameState === "PLAYER_LEADERBOARD" && (
                <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 animate-in slide-in-from-bottom-8 duration-700">
                  <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-[3rem] text-center shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                     <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2">Permainan Berakhir!</h2>
                     <p className="text-slate-400 font-medium tracking-wide">Terima kasih telah bermain, ini adalah klasemen akhir.</p>
                  </div>
                  
                  <div className="p-8 bg-[#141624] border border-[#252843] rounded-[3rem]">
                     <Leaderboard isPlayerView={true} currentPlayer={playerName} filterRoomCode={lastRoomCode} quizTitle={activeQuizTitle} />
                     <button 
                       onClick={() => setGameState("HOME")} 
                       className="mt-8 w-full p-4 rounded-2xl font-black text-lg text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all active:scale-95"
                     >
                        KEMBALI KE BERANDA
                     </button>
                  </div>
                </div>
              )}
            </div>
          }
        />

        {/* ADMIN ROUTES (PROTECTED WITH LAYOUT) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute isAdmin={isAdmin}>
              <AdminLayout setIsAdmin={setIsAdmin} />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="kelola-quiz" element={<KelolaQuiz />} />
          <Route path="create-quiz" element={<CreateQuiz />} />
          <Route path="edit-quiz/:quizId" element={<CreateQuiz />} />
          <Route path="sesi" element={<SesiAktif />} />
          <Route
            path="control-panel"
            element={<Navigate to="/admin/sesi" replace />}
          />
          {/* Fallback routes for sidebar links */}
          <Route path="pemain" element={<Pemain />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="pengaturan" element={<Pengaturan />} />
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

// Wrapper utama dengan Router
export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
