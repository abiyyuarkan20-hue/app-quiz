import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// 1. Validasi Environment Variables di awal
if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ ERROR: SUPABASE_URL atau SUPABASE_ANON_KEY tidak ditemukan di file .env",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmins() {
  console.log("--- Memulai Pengecekan Tabel 'admins' ---");

  try {
    // 2. Gunakan select('id, username') untuk efisiensi jika hanya ingin cek data
    const { data, error, status } = await supabase.from("admins").select("*");

    if (error) {
      // 3. Tangani error spesifik dari Supabase (misal: tabel tidak ada/RLS Policy)
      console.error(`❌ Error Fetching (Status ${status}):`, error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log("⚠️ Tabel 'admins' kosong.");
    } else {
      console.log(`✅ Berhasil menemukan ${data.length} admin:`);
      console.table(data); // 4. Gunakan console.table agar data lebih enak dibaca
    }
  } catch (err) {
    // 5. Tangani error tidak terduga (misal: masalah jaringan)
    console.error("❌ Terjadi kesalahan fatal:", err.message);
  }
}

checkAdmins();
