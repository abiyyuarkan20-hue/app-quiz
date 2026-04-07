import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createClient as createRedisClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";
import gameSocketHandler from "./game/gameSocket.js";

const app = express();
const server = http.createServer(app);

// 1. Validasi Environment Variables
const { SUPABASE_URL, SUPABASE_ANON_KEY, REDIS_URL, PORT, FRONTEND_URL } =
  process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ ERROR: Supabase config tidak ditemukan di .env");
  process.exit(1);
}

// 2. Inisialisasi Supabase
const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3. Konfigurasi Redis
const redisUrl =
  REDIS_URL ||
  "rediss://default:gQAAAAAAAUFWAAIncDIzMDY2ZGQ4ZmZmMzE0NWZlODBkMjVkMDJkNTI5YjU5M3AyODIyNjI@pleasant-flamingo-82262.upstash.io:6379";
const pubClient = createRedisClient({ url: redisUrl });
const subClient = pubClient.duplicate();

const handleRedisError = (name, err) =>
  console.error(`❌ Redis ${name} Error:`, err);
pubClient.on("error", (err) => handleRedisError("Pub", err));
subClient.on("error", (err) => handleRedisError("Sub", err));

async function bootstrap() {
  try {
    // Hubungkan Redis
    await Promise.all([pubClient.connect(), subClient.connect()]);
    console.log("✅ Terhubung ke Redis");

    // 4. Inisialisasi Socket.io
    const io = new Server(server, {
      cors: {
        // Izinkan localhost dan domain produksi Anda
        origin: FRONTEND_URL || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      // Menggunakan Redis Adapter agar state sinkron antar instance server
      adapter: createAdapter(pubClient, subClient),
    });

    // 5. Handler Game Socket
    io.on("connection", (socket) => {
      // Kita kirim pubClient sebagai client untuk menyimpan data game di Redis
      gameSocketHandler(io, socket, pubClient, supabase);
    });

    // 6. Logika Start Server (Gunakan PORT dari Railway)
    const finalPort = process.env.PORT || 3000;

    server.listen(finalPort, "0.0.0.0", () => {
      console.log(`✅ Terhubung ke Redis Upstash`); // Pesan sukses yang kamu lihat di log
      console.log(`🚀 Server berjalan di port: ${finalPort}`);
    });
  } catch (err) {
    console.error("❌ Gagal memulai server:", err.message);
    process.exit(1);
  }
}

// Tambahkan error handling sederhana
server.on("error", (err) => {
  console.error("❌ Fatal Server Error:", err);
  process.exit(1);
});

// Global error handling agar server tidak langsung mati jika ada error tak terduga
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

bootstrap();
