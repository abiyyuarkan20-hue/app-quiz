import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createClient } from "redis"; // Cukup satu import saja
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";
import gameSocketHandler from "./game/gameSocket.js";

// 1. Validasi Environment Variables
const { SUPABASE_URL, SUPABASE_ANON_KEY, REDIS_URL, PORT, FRONTEND_URL } =
  process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !REDIS_URL) {
  console.error(
    "❌ ERROR: Config (Supabase/Redis) tidak lengkap di Variables!",
  );
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// 2. Inisialisasi Supabase
const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3. Konfigurasi Redis (Gunakan satu client utama dan duplikat untuk Pub/Sub)
const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

pubClient.on("error", (err) => console.error("❌ Redis Pub Error:", err));
subClient.on("error", (err) => console.error("❌ Redis Sub Error:", err));

async function bootstrap() {
  try {
    // Hubungkan Redis
    await Promise.all([pubClient.connect(), subClient.connect()]);
    console.log("✅ Terhubung ke Redis Upstash");

    // 4. Inisialisasi Socket.io dengan Redis Adapter
    const io = new Server(server, {
      cors: {
        origin: FRONTEND_URL || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      adapter: createAdapter(pubClient, subClient),
    });

    // 5. Handler Game Socket
    io.on("connection", (socket) => {
      gameSocketHandler(io, socket, pubClient, supabase);
    });

    // 6. Start Server
    const finalPort = PORT || 3000;
    server.listen(finalPort, () => {
      console.log(`🚀 Server berjalan di port: ${finalPort}`);
    });
  } catch (err) {
    console.error("❌ Gagal memulai server:", err.message);
    process.exit(1);
  }
}

bootstrap();
