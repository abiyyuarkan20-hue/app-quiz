import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useGameStore } from "../store/useGameStore";
import {
  LayoutDashboard,
  FileEdit,
  Gamepad2,
  Users,
  Trophy,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";

export default function AdminLayout({ setIsAdmin }) {
  const navigate = useNavigate();
  const { setGameState, resetGame } = useGameStore();

  const handleLogout = () => {
    if (window.confirm("Keluar dari mode Admin?")) {
      localStorage.removeItem("isAdmin");
      // Since setIsAdmin might be handled in App, we call the prop
      setIsAdmin(false);
      resetGame();
      setGameState("HOME");
      navigate("/");
    }
  };

  const navItems = [
    {
      name: "Dashboard",
      path: "/admin/dashboard",
      icon: LayoutDashboard,
      color: "text-blue-500",
    },
    {
      name: "Kelola Quiz",
      path: "/admin/kelola-quiz",
      icon: FileEdit,
      color: "text-orange-500",
    },
    {
      name: "Sesi Aktif",
      path: "/admin/sesi",
      icon: Gamepad2,
      color: "text-purple-500",
    },
    {
      name: "Pemain",
      path: "/admin/pemain",
      icon: Users,
      color: "text-fuchsia-500",
    },
    {
      name: "Leaderboard",
      path: "/admin/leaderboard",
      icon: Trophy,
      color: "text-yellow-500",
    },
    {
      name: "Pengaturan",
      path: "/admin/pengaturan",
      icon: Settings,
      color: "text-slate-400",
    },
  ];

  return (
    <div className="flex h-screen text-slate-200 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#141624] border-r border-[#1F2235] flex-col justify-between hidden md:flex">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 p-8">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Zap size={20} className="text-white fill-current" />
            </div>
            <h1 className="text-2xl font-black italic tracking-wider text-cyan-400">
              QUIZzz
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 px-4 mt-4">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-3 rounded-2xl font-semibold transition-all ${
                    isActive
                      ? "bg-[#252746] text-blue-400 border-l-4 border-blue-500"
                      : "text-slate-400 hover:bg-[#1A1C2C] hover:text-slate-200 border-l-4 border-transparent"
                  }`
                }
              >
                <item.icon size={20} className={item.color} />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Logout */}
        <div className="p-4 mb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 px-4 py-3 w-full rounded-2xl font-semibold text-rose-500 hover:bg-rose-500/10 transition-all border-l-4 border-transparent hover:border-rose-500"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
