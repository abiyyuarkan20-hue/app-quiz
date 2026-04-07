import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Cek file .env Anda!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAdminSystem() {
  console.log("\n🔍 --- MEMULAI DEBUGGING SISTEM ADMIN ---");

  try {
    // 1. Cek Koneksi & RLS
    // Kadang data ada, tapi tidak muncul karena Row Level Security (RLS) aktif
    const { data, error, status } = await supabase
      .from("admins")
      .select("id, username, password_hash");

    if (error) {
      if (status === 401) console.error("❌ Error 401: API Key tidak valid.");
      if (status === 403)
        console.error(
          "❌ Error 403: RLS aktif! Pastikan tabel 'admins' bisa diakses publik atau gunakan Service Role Key.",
        );
      throw error;
    }

    // 2. Cek Jika Tabel Kosong
    if (!data || data.length === 0) {
      console.log(
        "ℹ️ Tabel 'admins' terdeteksi, tapi TIDAK ADA DATA di dalamnya.",
      );
      console.log(
        "💡 Saran: Tambahkan 1 user manual lewat Dashboard Supabase.",
      );
      return;
    }

    console.log(`✅ Ditemukan ${data.length} akun admin.\n`);

    // 3. Iterasi & Analisis Mendalam
    data.forEach((admin, index) => {
      const u = admin.username || "";
      const isClean = u === u.trim();

      console.log(`--- [ADMIN #${index + 1}] ---`);
      console.log(`ID            : ${admin.id}`);
      console.log(`Username      : "${u}"`);

      // Analisis Karakter (Hex) - Sangat berguna jika ada karakter aneh/spasi
      console.log(`Username Hex  : ${Buffer.from(u).toString("hex")}`);

      // Status Password
      if (!admin.password_hash) {
        console.log(`Password Hash : ❌ KOSONG (Admin tidak akan bisa login!)`);
      } else {
        console.log(
          `Password Hash : ✅ Terisi (${admin.password_hash.substring(0, 10)}...)`,
        );
      }

      // Warning Spasi
      if (!isClean) {
        console.warn(
          `⚠️ PERINGATAN: Ada spasi tersembunyi! Seharusnya: "${u.trim()}"`,
        );
      }
      console.log("");
    });
  } catch (err) {
    console.error("❌ Gagal mengambil data:", err.message);
  }
}

debugAdminSystem();
