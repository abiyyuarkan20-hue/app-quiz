import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Cek file .env Anda!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAdmin() {
  console.log("--- Memulai Proses Update Admin ---");

  try {
    // Gunakan .select() di akhir untuk memverifikasi hasil update
    const { data, error, count } = await supabase
      .from("admins")
      .update({
        username: "admin",
        password_hash: "admin123",
      })
      .eq("id", 1)
      .select(); // Penting: Agar kita tahu data apa yang berubah

    if (error) {
      console.error("❌ Error Supabase:", error.message);
      return;
    }

    // Cek apakah ada baris yang benar-benar terupdate
    if (!data || data.length === 0) {
      console.warn(
        "⚠️ Peringatan: Tidak ada admin dengan ID 1. Tidak ada data yang diubah.",
      );

      // Opsional: Cek semua ID yang tersedia agar Anda tidak menebak-nebak
      const { data: allAdmins } = await supabase
        .from("admins")
        .select("id, username");
      console.log("ID yang tersedia di database:", allAdmins);
    } else {
      console.log("✅ Admin berhasil diperbarui!");
      console.log("Data baru:", data[0]);
    }
  } catch (err) {
    console.error("❌ Terjadi kesalahan sistem:", err.message);
  }
}

updateAdmin();
