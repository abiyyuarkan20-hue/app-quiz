// Store timeouts per room to allow clearing them if everyone answers early
const questionTimeouts = new Map();
const transitionTimeouts = new Map();

// Fisher-Yates shuffle (in-place)
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function gameSocketHandler(io, socket, redisClient, supabase) {
  // --- LOGIKA PEMAIN ---

  // --- LOGIKA PEMAIN ---

  socket.on("join_room", async ({ roomCode, playerName, whatsapp, email }) => {
    try {
      // 1. CEK STATUS GAME (Mencegah player masuk jika game sudah dimulai)
      // Jika ada 'activeQuestion' di Redis untuk room ini, berarti kuis sudah berjalan.
      const isGameStarted = await redisClient.get(
        `room:${roomCode}:activeQuestion`,
      );

      const isExistingPlayer = await redisClient.sIsMember(
        `room:${roomCode}:players`,
        playerName,
      );

      // Tolak hanya jika game sudah mulai DAN player bukan admin DAN player belum ada di room
      if (
        isGameStarted &&
        playerName !== "ADMIN_HOST" &&
        !isExistingPlayer
      ) {
        socket.emit(
          "join_error",
          "Maaf, permainan sudah dimulai! Kamu tidak bisa bergabung.",
        );
        return;
      }

      // Cek duplikasi email & WA di Database (Mencegah pemain menggunakan kontak orang lain yang sudah pernah mendaftar)
      if (playerName !== "ADMIN_HOST") {
        let orQuery = [];
        if (whatsapp && whatsapp.trim() !== "" && whatsapp !== "N/A") orQuery.push(`whatsapp.eq.${whatsapp}`);
        if (email && email.trim() !== "" && email !== "N/A") orQuery.push(`email.eq.${email}`);
        
        if (orQuery.length > 0) {
          const { data: duplicateContacts, error } = await supabase
            .from("players")
            .select("name, whatsapp, email")
            .or(orQuery.join(","));
            
          if (!error && duplicateContacts && duplicateContacts.length > 0) {
             const nameConflict = duplicateContacts.find(p => p.name.toLowerCase() !== playerName.toLowerCase());
             if (nameConflict) {
                if (email && email !== "N/A" && nameConflict.email === email) {
                   socket.emit("join_error", `Email ini sudah terdaftar atas nama pemain '${nameConflict.name}'. Mohon gunakan Nickname tersebut jika itu Anda, atau gunakan Email yang berbeda.`);
                   return;
                }
                if (whatsapp && whatsapp !== "N/A" && nameConflict.whatsapp === whatsapp) {
                   socket.emit("join_error", `WhatsApp ini sudah terdaftar atas nama pemain '${nameConflict.name}'. Mohon gunakan Nickname tersebut jika itu Anda, atau gunakan WA yang berbeda.`);
                   return;
                }
             }
          }
        }
      }

      // Jika game belum mulai, masukkan player ke dalam room
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.playerName = playerName;

      await redisClient.sAdd(`room:${roomCode}:players`, playerName);
      await redisClient.hSet(`room:${roomCode}:player:${playerName}`, {
        score: "0",
        whatsapp: whatsapp || "N/A",
        email: email || "N/A",
        joinedAt: Date.now().toString(),
        hasAnswered: "false",
        correctAnswers: "0",
        incorrectAnswers: "0",
        totalAnswered: "0"
      });

      // Persist player to Supabase (skip admin host)
      if (playerName !== "ADMIN_HOST") {
        try {
          // Ambil quizTitle dari redis jika ada
          const activeQuizTitle = await redisClient.get(`room:${roomCode}:quizTitle`) || "—";
          
          await supabase.from("players").upsert({
            name: playerName,
            whatsapp: whatsapp || "N/A",
            email: email || "N/A",
            room_code: roomCode,
            score: 0,
            correct_answers: 0,
            incorrect_answers: 0,
            total_answered: 0,
            status: "waiting",
            quiz_title: activeQuizTitle,
          }, { onConflict: "name,room_code", ignoreDuplicates: false });
        } catch (dbErr) {
          console.error("[DB] Failed to persist player:", dbErr);
        }
      }

      // Ambil daftar pemain lengkap untuk dikirim ke frontend
      const playerNames = await redisClient.sMembers(`room:${roomCode}:players`);
      const playerList = await Promise.all(
        playerNames.map(async (name) => {
          const data = await redisClient.hGetAll(`room:${roomCode}:player:${name}`);
          return {
            name,
            hasAnswered: data.hasAnswered === "true",
            score: parseInt(data.score || "0"),
            correctAnswers: parseInt(data.correctAnswers || "0"),
            incorrectAnswers: parseInt(data.incorrectAnswers || "0"),
            totalAnswered: parseInt(data.totalAnswered || "0"),
          };
        }),
      );

      // Beritahu ke semua orang di room (termasuk admin) bahwa ada player baru
      io.to(roomCode).emit("player_joined", {
        players: playerList,
      });

      // 2. KIRIM KONFIRMASI BERHASIL KE PLAYER (Wajib untuk Frontend)
      socket.emit("room_joined", { roomCode, players: playerList });

      // 3. JIKA RECONNECT SAAT GAME BERJALAN, SINKRONISASI STATE
      if (isGameStarted) {
        const activeQuestionData = await redisClient.get(`room:${roomCode}:activeQuestion`);
        if (activeQuestionData) {
          const question = JSON.parse(activeQuestionData);
          const startTime = await redisClient.get(`room:${roomCode}:q:${question.id}:startTime`);
          const timeLimitStr = await redisClient.get(`room:${roomCode}:timeLimitDB`);
          const timeLimitDB = parseInt(timeLimitStr || "20000");

          const now = Date.now();
          const elapsed = now - parseInt(startTime || now);
          const remainingTime = Math.max(0, timeLimitDB - elapsed);

          // Cek apakah mode result sedang aktif
          const pData = await redisClient.hGetAll(`room:${roomCode}:player:${playerName}`);
          const hasAnswered = pData.hasAnswered === "true";

          socket.emit("next_question", {
            question,
            timeLimit: remainingTime,
          });
          
          // Jika sudah menjawab, beri tahu kembali state-nya jika perlu,
          // tapi UI utamanya butuh timer dan next_question event untuk sinkron
        }
      }

      console.log(`[JOIN] Room: ${roomCode} | Player: ${playerName}`);
    } catch (err) {
      console.error("Error join_room:", err);
      socket.emit(
        "join_error",
        "Gagal bergabung ke room. Terjadi kesalahan server.",
      );
    }
  });

  socket.on("leave_room", async () => {
    await handlePlayerLeave(socket.roomCode, socket.playerName, true);
  });

  socket.on("disconnect", async () => {
    await handlePlayerLeave(socket.roomCode, socket.playerName, false);
  });

  async function handlePlayerLeave(roomCode, playerName, isExplicit) {
    if (!roomCode || !playerName || playerName === "ADMIN_HOST") return;

    try {
      const isGameStarted = await redisClient.get(`room:${roomCode}:activeQuestion`);

      // Jika bukan leave secara eksplisit (misal disconnect) dan game sudah mulai,
      // jangan hapus player agar bisa reconnect.
      if (!isExplicit && isGameStarted) return;

      // Hapus data player dari redis
      await redisClient.sRem(`room:${roomCode}:players`, playerName);
      await redisClient.del(`room:${roomCode}:player:${playerName}`);

      try {
        const { data: pData } = await supabase.from("players").select("status").eq("name", playerName).eq("room_code", roomCode).single();
        if (pData && pData.status !== "finished") {
          await supabase.from("players").update({ status: isExplicit ? "left" : "disconnected" })
            .eq("name", playerName)
            .eq("room_code", roomCode);
        }
      } catch (e) {
        console.error("Gagal update status player:", e);
      }

      // Beritahu admin dan seluruh room daftar pemain yang baru
      const playerNames = await redisClient.sMembers(`room:${roomCode}:players`);
      const playerList = await Promise.all(
        playerNames.map(async (name) => {
          const data = await redisClient.hGetAll(`room:${roomCode}:player:${name}`);
          return {
            name,
            hasAnswered: data.hasAnswered === "true",
            score: parseInt(data.score || "0"),
            correctAnswers: parseInt(data.correctAnswers || "0"),
            incorrectAnswers: parseInt(data.incorrectAnswers || "0"),
            totalAnswered: parseInt(data.totalAnswered || "0"),
          };
        })
      );

      io.to(roomCode).emit("room_players", playerList);
      console.log(`[LEAVE] Player: ${playerName} left room: ${roomCode}`);
    } catch (err) {
      console.error("Error in handlePlayerLeave:", err);
    }
  }

  socket.on("request_current_question", async ({ roomCode }) => {
    try {
      const activeQuestionData = await redisClient.get(
        `room:${roomCode}:activeQuestion`,
      );

      if (activeQuestionData) {
        const question = JSON.parse(activeQuestionData);
        const startTime = await redisClient.get(
          `room:${roomCode}:q:${question.id}:startTime`,
        );

        const now = Date.now();
        const timeLimit = 20000; // 20 detik
        const elapsed = now - parseInt(startTime || now);
        const remainingTime = Math.max(0, timeLimit - elapsed);

        // Jika waktu belum habis, kirim soal ke pemain yang merefresh halaman
        if (remainingTime > 0) {
          socket.emit("next_question", {
            question,
            timeLimit: remainingTime,
          });
        }
      }
    } catch (err) {
      console.error("Error request_current_question:", err);
    }
  });

  socket.on(
    "submit_answer",
    async ({ roomCode, playerName, questionId, answerIndex }) => {
      try {
        // PERBAIKAN 1: Cek apakah pemain sudah menjawab sebelumnya (Cegah eksploitasi spam)
        const hasAnswered = await redisClient.hGet(
          `room:${roomCode}:player:${playerName}`,
          "hasAnswered",
        );
        if (hasAnswered === "true") return;

        const startTime = await redisClient.get(
          `room:${roomCode}:q:${questionId}:startTime`,
        );
        if (!startTime) return;

        const { data: question, error } = await supabase
          .from("questions")
          .select("correct_answer")
          .eq("id", questionId)
          .single();

        if (error || !question) return;

        const isCorrect = answerIndex === parseInt(question.correct_answer);

        // Kunci jawaban pemain agar tidak bisa diulang dan simpan hasil jawabannya
        await redisClient.hSet(
          `room:${roomCode}:player:${playerName}`,
          "hasAnswered",
          "true"
        );
        await redisClient.hSet(
          `room:${roomCode}:player:${playerName}`,
          "lastAnswerCorrect",
          isCorrect.toString()
        );

        await redisClient.hIncrBy(`room:${roomCode}:player:${playerName}`, "totalAnswered", 1);
        if (isCorrect) {
          await redisClient.hIncrBy(`room:${roomCode}:player:${playerName}`, "correctAnswers", 1);
        } else {
          await redisClient.hIncrBy(`room:${roomCode}:player:${playerName}`, "incorrectAnswers", 1);
        }

        // Hitung waktu dan poin
        const timeTaken = Math.max(0, Date.now() - parseInt(startTime));
        let points = 0;

        if (isCorrect) {
          const basePointsStr = await redisClient.get(`room:${roomCode}:basePoints`);
          const maxTimeStr = await redisClient.get(`room:${roomCode}:timeLimitDB`);
          
          const basePoints = parseInt(basePointsStr || "100");
          const maxTime = parseInt(maxTimeStr || "20000");
          
          // Speed bonus: up to 50% of base points
          const speedBonus = Math.max(
            0,
            Math.floor(((maxTime - timeTaken) / maxTime) * (basePoints / 2))
          );
          points = basePoints + speedBonus;

          await redisClient.hIncrBy(
            `room:${roomCode}:player:${playerName}`,
            "score",
            points,
          );
        }

        // Fetch latest data for this player to broadcast live leaderboard update
        const pData = await redisClient.hGetAll(`room:${roomCode}:player:${playerName}`);
        const pQuizTitle = await redisClient.get(`room:${roomCode}:quizTitle`) || "Quiz";
        
        // Emit live score update to admins
        io.to("admin_dash").emit("live_score_update", {
          name: playerName,
          room_code: roomCode,
          quiz_title: pQuizTitle,
          score: parseInt(pData.score || "0"),
          correct_answers: parseInt(pData.correctAnswers || "0"),
          incorrect_answers: parseInt(pData.incorrectAnswers || "0"),
          total_answered: parseInt(pData.totalAnswered || "0"),
          status: "playing",
          is_live: true
        });

        socket.emit("answer_received", { isCorrect, pointsEarned: points });
        io.to(roomCode).emit("player_answered", { playerName });

        // Cek apakah semua pemain sudah menjawab
        const players = await redisClient.sMembers(`room:${roomCode}:players`);

        // Jika tidak ada pemain, abaikan
        if (players.length === 0) return;

        let allAnswered = true;
        for (const p of players) {
          const pStatus = await redisClient.hGet(
            `room:${roomCode}:player:${p}`,
            "hasAnswered",
          );
          if (pStatus !== "true") {
            allAnswered = false;
            break;
          }
        }

        // Jika semua sudah menjawab, segera hentikan timer dan tampilkan hasil
        if (allAnswered) {
          clearTimeout(questionTimeouts.get(roomCode));
          questionTimeouts.delete(roomCode);
          await emitResult(roomCode, questionId, io, redisClient, supabase);
        }
      } catch (err) {
        console.error("Error submit_answer:", err);
      }
    },
  );

  // --- LOGIKA ADMIN ---

  socket.on("join_admin_dashboard", () => {
    socket.join("admin_dash");
  });

  socket.on("get_live_leaderboard", async (callback) => {
    try {
      const keys = await redisClient.keys("room:*:players");
      let livePlayers = [];
      
      for (const key of keys) {
        const roomCode = key.split(":")[1];
        const quizTitle = await redisClient.get(`room:${roomCode}:quizTitle`) || "Quiz";
        const isGameStarted = await redisClient.get(`room:${roomCode}:activeQuestion`);

        if (isGameStarted) {
          const players = await redisClient.sMembers(key);
          for (const name of players) {
            if (name === "ADMIN_HOST") continue;
            const data = await redisClient.hGetAll(`room:${roomCode}:player:${name}`);
            livePlayers.push({
              name,
              room_code: roomCode,
              quiz_title: quizTitle,
              score: parseInt(data.score || "0"),
              correct_answers: parseInt(data.correctAnswers || "0"),
              incorrect_answers: parseInt(data.incorrectAnswers || "0"),
              total_answered: parseInt(data.totalAnswered || "0"),
              status: "playing",
              is_live: true
            });
          }
        }
      }
      
      if (callback) callback({ success: true, livePlayers });
    } catch (err) {
      console.error("Error get_live_leaderboard:", err);
      if (callback) callback({ success: false, livePlayers: [] });
    }
  });

  socket.on("admin_login", async (data, callback) => {
    try {
      const username = data.username?.trim();
      const password = data.password?.trim();
      const { data: admin } = await supabase
        .from("admins")
        .select("*")
        .eq("username", username)
        .single();

      if (admin && admin.password_hash === password) {
        callback({ success: true, username: admin.username });
      } else {
        callback({ success: false, message: "Kredensial salah!" });
      }
    } catch (err) {
      console.error("Error admin_login:", err);
      callback({ success: false, message: "Terjadi kesalahan server" });
    }
  });

  socket.on("update_admin_credentials", async (data, callback) => {
    try {
      const { oldPassword, newUsername, newPassword } = data;
      // Get the admin account (assuming there's only one or we use a fixed login)
      // Since admin username might be changed, we fetch by ID 1 or the current username
      // We will look up based on the currently logged-in username or just get the first admin
      const { data: adminData } = await supabase
        .from("admins")
        .select("*")
        .limit(1)
        .single();

      if (!adminData) {
        return callback({ success: false, message: "Admin belum dikonfigurasi." });
      }

      if (adminData.password_hash !== oldPassword) {
        return callback({ success: false, message: "Password lama tidak cocok!" });
      }

      const updates = {};
      if (newUsername && newUsername.trim() !== "") updates.username = newUsername.trim();
      if (newPassword && newPassword.trim() !== "") updates.password_hash = newPassword.trim();

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("admins")
          .update(updates)
          .eq("id", adminData.id);

        if (error) {
          callback({ success: false, message: "Gagal menyimpan kredensial." });
        } else {
          callback({ success: true, message: "Kredensial berhasil diperbarui." });
        }
      } else {
        callback({ success: false, message: "Tidak ada data yang diubah." });
      }
    } catch (err) {
      console.error("Error update_admin_credentials:", err);
      callback({ success: false, message: "Terjadi kesalahan server." });
    }
  });

  socket.on("update_theme", async (data) => {
    try {
      const { theme } = data;
      // Simpan di redis sebagai global theme
      await redisClient.set("global:theme", theme);
      // Broadcast ke SEMUA client yang terhubung ke io
      io.emit("theme_updated", { theme });
    } catch (err) {
      console.error("Error update_theme:", err);
    }
  });

  // Saat client baru konek atau merequest theme (bisa ditambahkan ke koneksi awal, tapi agar mudah kita buat event terpisah)
  socket.on("request_theme", async (callback) => {
    try {
      const currentTheme = await redisClient.get("global:theme");
      if (callback) callback({ theme: currentTheme || "cosmic" });
    } catch (err) {
      if (callback) callback({ theme: "cosmic" });
    }
  });

  socket.on("setup_room", async ({ roomCode, quizId }) => {
    try {
      const { data: quiz } = await supabase
        .from("quizzes")
        .select("title")
        .eq("id", quizId)
        .single();

      const roomStartTime = Date.now().toString();
      await redisClient.set(`room:${roomCode}:startTime`, roomStartTime);
      await redisClient.set(`room:${roomCode}:quizTitle`, quiz?.title || "Quiz");

      io.to(roomCode).emit("session_created", {
        roomCode,
        quizTitle: quiz?.title || "Quiz",
        startTime: roomStartTime,
        quizId
      });
    } catch (err) {
      console.error("Error setup_room:", err);
    }
  });

  socket.on("start_game", async ({ roomCode, quizId }) => {
    try {
      const { data: quizMeta, error: metaErr } = await supabase
        .from("quizzes")
        .select("title, time_limit, points, randomize_questions")
        .eq("id", quizId)
        .single();

      const { data: questions, error } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("id", { ascending: true });

      if (error || !questions || questions.length === 0) return;

      // Apply random shuffle if configured
      const shouldRandomize = quizMeta?.randomize_questions === true;
      const orderedQuestions = shouldRandomize
        ? shuffleArray([...questions])
        : questions;

      const firstQuestion = orderedQuestions[0];

      const questionPayload = {
        id: firstQuestion.id,
        text: firstQuestion.question_text,
        options: firstQuestion.options,
        quiz_id: firstQuestion.quiz_id,
      };

      const timeLimitDB = quizMeta?.time_limit ? quizMeta.time_limit * 1000 : 20000;
      const basePointsDB = quizMeta?.points || 100;
      const roomStartTime = Date.now().toString();

      // Store shuffled question order in Redis as JSON array of IDs
      const questionOrder = orderedQuestions.map((q) => q.id);
      await redisClient.set(
        `room:${roomCode}:questionOrder`,
        JSON.stringify(questionOrder),
      );
      await redisClient.set(`room:${roomCode}:currentOrderIndex`, "0");

      await redisClient.set(
        `room:${roomCode}:activeQuestion`,
        JSON.stringify(questionPayload),
      );
      await redisClient.set(
        `room:${roomCode}:q:${firstQuestion.id}:startTime`,
        roomStartTime,
      );
      await redisClient.set(`room:${roomCode}:startTime`, roomStartTime);
      await redisClient.set(`room:${roomCode}:quizTitle`, quizMeta?.title || "Quiz");
      await redisClient.set(`room:${roomCode}:basePoints`, basePointsDB.toString());
      await redisClient.set(`room:${roomCode}:timeLimitDB`, timeLimitDB.toString());

      io.to(roomCode).emit("session_started", {
        roomCode,
        quizTitle: quizMeta?.title || "Quiz",
        startTime: roomStartTime
      });

      io.to(roomCode).emit("next_question", {
        question: questionPayload,
        timeLimit: timeLimitDB,
        currentIndex: 0,
        totalQuestions: orderedQuestions.length
      });

      // Update player status in Supabase
      try {
        await supabase.from("players")
          .update({ status: "playing", quiz_title: quizMeta?.title || "Quiz" })
          .eq("room_code", roomCode);
      } catch (dbErr) {
        console.error("[DB] Failed to update player status:", dbErr);
      }

      startServerTimer(roomCode, firstQuestion.id, io, redisClient, supabase, timeLimitDB);
      console.log(`[GAME_START] Room: ${roomCode} | Quiz: ${quizMeta?.title} | Randomized: ${shouldRandomize}`);
    } catch (err) {
      console.error("Gagal memulai kuis:", err);
    }
  });

  socket.on("get_room_players", async ({ roomCode }) => {
    try {
      const playerNames = await redisClient.sMembers(
        `room:${roomCode}:players`,
      );
      const playerList = await Promise.all(
        playerNames.map(async (name) => {
          const data = await redisClient.hGetAll(
            `room:${roomCode}:player:${name}`,
          );
          return {
            name,
            hasAnswered: data.hasAnswered === "true",
            score: parseInt(data.score || "0"),
            correctAnswers: parseInt(data.correctAnswers || "0"),
            incorrectAnswers: parseInt(data.incorrectAnswers || "0"),
            totalAnswered: parseInt(data.totalAnswered || "0"),
          };
        }),
      );
      socket.emit("room_players", playerList);
    } catch (err) {
      console.error("Error get_room_players:", err);
    }
  });

  socket.on("next_question", async ({ roomCode }) => {
    await gotoNextQuestion(roomCode, io, redisClient, supabase);
  });

  socket.on("end_game", async ({ roomCode }) => {
    await processEndGame(roomCode, io, redisClient, supabase);
  });

  // --- ADMIN: Get all historical players from Supabase ---
  socket.on("get_all_players", async (data, callback) => {
    try {
      const { data: players, error } = await supabase
        .from("players")
        .select("*")
        .order("joined_at", { ascending: false });
      if (error) throw error;
      callback({ success: true, players: players || [] });
    } catch (err) {
      console.error("Error get_all_players:", err);
      callback({ success: false, players: [] });
    }
  });

  // --- ADMIN: Clear all players from Supabase ---
  socket.on("clear_all_players", async (data, callback) => {
    try {
      const { error } = await supabase.from("players").delete().neq("id", 0);
      if (error) throw error;
      callback({ success: true });
    } catch (err) {
      console.error("Error clear_all_players:", err);
      callback({ success: false });
    }
  });
  // --- HELPERS ---

  async function processEndGame(roomCode, io, redisClient, supabase) {
    try {
      const quizTitle = await redisClient.get(`room:${roomCode}:quizTitle`) || "";
      const playerNames = await redisClient.sMembers(`room:${roomCode}:players`);
      
      if (playerNames && playerNames.length > 0) {
        for (const name of playerNames) {
          if (name === "ADMIN_HOST") continue;
          const data = await redisClient.hGetAll(`room:${roomCode}:player:${name}`);
          await supabase.from("players")
            .update({
              score: parseInt(data.score || "0"),
              correct_answers: parseInt(data.correctAnswers || "0"),
              incorrect_answers: parseInt(data.incorrectAnswers || "0"),
              total_answered: parseInt(data.totalAnswered || "0"),
              quiz_title: quizTitle,
              status: "finished",
            })
            .eq("name", name)
            .eq("room_code", roomCode);
        }
        // Emit global event to notify Admin Dashboard to refresh player analytics
        io.emit("players_db_updated", { roomCode });
      }
    } catch (dbErr) {
      console.error("[DB] Failed to persist final scores:", dbErr);
    }

    // Also clean up questionOrder keys
    await redisClient.del(`room:${roomCode}:questionOrder`);
    await redisClient.del(`room:${roomCode}:currentOrderIndex`);

    io.to(roomCode).emit("game_status", "HOME");
    io.to(roomCode).emit("game_over");
    
    clearTimeout(questionTimeouts.get(roomCode));
    questionTimeouts.delete(roomCode);
    clearTimeout(transitionTimeouts.get(roomCode));
    transitionTimeouts.delete(roomCode);

    await redisClient.del(`room:${roomCode}:activeQuestion`);
    await redisClient.del(`room:${roomCode}:startTime`);
    await redisClient.del(`room:${roomCode}:quizTitle`);
  }

  async function gotoNextQuestion(roomCode, io, redisClient, supabase) {
    try {
      const activeQuestionData = await redisClient.get(
        `room:${roomCode}:activeQuestion`,
      );
      if (!activeQuestionData) return;

      const currentQuestion = JSON.parse(activeQuestionData);

      // --- Check if we have a stored question order (randomized or sequential) ---
      const questionOrderData = await redisClient.get(`room:${roomCode}:questionOrder`);

      if (questionOrderData) {
        // Use Redis-stored order (works for both random and sequential)
        const questionOrder = JSON.parse(questionOrderData);
        const currentIndexStr = await redisClient.get(`room:${roomCode}:currentOrderIndex`);
        const currentIndex = parseInt(currentIndexStr || "0");
        const nextIndex = currentIndex + 1;

        if (nextIndex >= questionOrder.length) {
          // No more questions → end game
          await processEndGame(roomCode, io, redisClient, supabase);
          return;
        }

        const nextQuestionId = questionOrder[nextIndex];
        const { data: nextQuestion, error: qErr } = await supabase
          .from("questions")
          .select("*")
          .eq("id", nextQuestionId)
          .single();

        if (qErr || !nextQuestion) {
          console.error("Gagal mengambil soal berikutnya dari order:", qErr);
          await processEndGame(roomCode, io, redisClient, supabase);
          return;
        }

        const questionPayload = {
          id: nextQuestion.id,
          text: nextQuestion.question_text,
          options: nextQuestion.options,
          quiz_id: nextQuestion.quiz_id,
        };

        const { data: quizData } = await supabase
          .from("quizzes")
          .select("time_limit, points")
          .eq("id", nextQuestion.quiz_id)
          .single();

        const timeLimitDB = quizData?.time_limit ? quizData.time_limit * 1000 : 20000;
        const basePointsDB = quizData?.points || 100;

        await redisClient.set(`room:${roomCode}:timeLimitDB`, timeLimitDB.toString());
        await redisClient.set(`room:${roomCode}:basePoints`, basePointsDB.toString());
        await redisClient.set(`room:${roomCode}:currentOrderIndex`, nextIndex.toString());
        await redisClient.set(
          `room:${roomCode}:activeQuestion`,
          JSON.stringify(questionPayload),
        );
        await redisClient.set(
          `room:${roomCode}:q:${nextQuestion.id}:startTime`,
          Date.now().toString(),
        );

        // Reset player hasAnswered
        const players = await redisClient.sMembers(`room:${roomCode}:players`);
        await Promise.all(
          players.map((p) =>
            redisClient.hSet(`room:${roomCode}:player:${p}`, "hasAnswered", "false")
              .then(() => redisClient.hSet(`room:${roomCode}:player:${p}`, "lastAnswerCorrect", "null"))
          )
        );

        io.to(roomCode).emit("next_question", {
          question: questionPayload,
          timeLimit: timeLimitDB,
          currentIndex: nextIndex,
          totalQuestions: questionOrder.length
        });

        // Send fresh player list
        const freshPlayerList = await Promise.all(
          players.map(async (name) => {
            const data = await redisClient.hGetAll(`room:${roomCode}:player:${name}`);
            return {
              name,
              hasAnswered: data.hasAnswered === "true",
              score: parseInt(data.score || "0"),
              correctAnswers: parseInt(data.correctAnswers || "0"),
              incorrectAnswers: parseInt(data.incorrectAnswers || "0"),
              totalAnswered: parseInt(data.totalAnswered || "0"),
            };
          }),
        );
        io.to(roomCode).emit("room_players", freshPlayerList);

        startServerTimer(roomCode, nextQuestion.id, io, redisClient, supabase, timeLimitDB);
        return;
      }

      // --- Fallback: legacy sequential (no questionOrder in Redis) ---
      const targetQuizId =
        currentQuestion.quiz_id ||
        (await getQuizIdFromQuestion(currentQuestion.id, supabase));

      const { data: questions, error } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", targetQuizId)
        .order("id", { ascending: true });

      if (error || !questions) {
        console.error("Gagal mengambil soal untuk next_question");
        return;
      }

      const currentIndex = questions.findIndex(
        (q) => q.id === currentQuestion.id,
      );
      const nextQuestion = questions[currentIndex + 1];

      if (nextQuestion) {
        const questionPayload = {
          id: nextQuestion.id,
          text: nextQuestion.question_text,
          options: nextQuestion.options,
          quiz_id: nextQuestion.quiz_id,
        };

        const { data: quizData } = await supabase
          .from("quizzes")
          .select("time_limit, points")
          .eq("id", targetQuizId)
          .single();
          
        const timeLimitDB = quizData?.time_limit ? quizData.time_limit * 1000 : 20000;
        const basePointsDB = quizData?.points || 100;
        
        await redisClient.set(`room:${roomCode}:timeLimitDB`, timeLimitDB.toString());
        await redisClient.set(`room:${roomCode}:basePoints`, basePointsDB.toString());

        await redisClient.set(
          `room:${roomCode}:activeQuestion`,
          JSON.stringify(questionPayload),
        );
        await redisClient.set(
          `room:${roomCode}:q:${nextQuestion.id}:startTime`,
          Date.now().toString(),
        );

        const players = await redisClient.sMembers(`room:${roomCode}:players`);
        await Promise.all(
          players.map((p) =>
            redisClient.hSet(
              `room:${roomCode}:player:${p}`,
              "hasAnswered",
              "false"
            ).then(() => 
              redisClient.hSet(
                `room:${roomCode}:player:${p}`,
                "lastAnswerCorrect",
                "null"
              )
            )
          )
        );

        io.to(roomCode).emit("next_question", {
          question: questionPayload,
          timeLimit: timeLimitDB,
          currentIndex: currentIndex + 1,
          totalQuestions: questions.length
        });

        io.to(roomCode).emit(
          "room_players",
          players.map((p) => ({ name: p, hasAnswered: false, score: 0 })),
        );
        
        const freshPlayerList = await Promise.all(
          players.map(async (name) => {
            const data = await redisClient.hGetAll(`room:${roomCode}:player:${name}`);
            return {
              name,
              hasAnswered: data.hasAnswered === "true",
              score: parseInt(data.score || "0"),
              correctAnswers: parseInt(data.correctAnswers || "0"),
              incorrectAnswers: parseInt(data.incorrectAnswers || "0"),
              totalAnswered: parseInt(data.totalAnswered || "0"),
            };
          }),
        );
        io.to(roomCode).emit("room_players", freshPlayerList);

        startServerTimer(roomCode, nextQuestion.id, io, redisClient, supabase, timeLimitDB);
      } else {
        await processEndGame(roomCode, io, redisClient, supabase);
      }
    } catch (err) {
      console.error("Error gotoNextQuestion:", err);
    }
  }

  function startServerTimer(roomCode, questionId, io, redisClient, supabase, duration = 20000) {
    clearTimeout(questionTimeouts.get(roomCode));
    const timeout = setTimeout(async () => {
      await emitResult(roomCode, questionId, io, redisClient, supabase);
      questionTimeouts.delete(roomCode);
    }, duration);
    questionTimeouts.set(roomCode, timeout);
  }

  async function emitResult(roomCode, questionId, io, redisClient, supabase) {
    try {
      const { data: question } = await supabase
        .from("questions")
        .select("correct_answer")
        .eq("id", questionId)
        .single();

      if (question) {
        // Enkapsulasi info pemain (benar/salah) untuk admin dashboard
        const players = await redisClient.sMembers(`room:${roomCode}:players`);
        const playerList = await Promise.all(
          players.map(async (name) => {
            const data = await redisClient.hGetAll(`room:${roomCode}:player:${name}`);
            return {
              name,
              score: parseInt(data.score || "0"),
              isCorrect: data.lastAnswerCorrect === "true",
              hasAnswered: data.hasAnswered === "true",
              correctAnswers: parseInt(data.correctAnswers || "0"),
              incorrectAnswers: parseInt(data.incorrectAnswers || "0"),
              totalAnswered: parseInt(data.totalAnswered || "0"),
            };
          })
        );

        io.to(roomCode).emit("show_result", {
          correctAnswer: parseInt(question.correct_answer),
          players: playerList
        });

        // Automatically goto next question after 5 seconds
        clearTimeout(transitionTimeouts.get(roomCode));
        const tTimeout = setTimeout(() => {
          gotoNextQuestion(roomCode, io, redisClient, supabase);
          transitionTimeouts.delete(roomCode);
        }, 5000);
        transitionTimeouts.set(roomCode, tTimeout);
      }
    } catch (err) {
      console.error("Error emitResult:", err);
    }
  }

  async function getQuizIdFromQuestion(questionId, supabase) {
    try {
      const { data } = await supabase
        .from("questions")
        .select("quiz_id")
        .eq("id", questionId)
        .single();
      return data?.quiz_id;
    } catch (err) {
      console.error("Error getQuizIdFromQuestion:", err);
      return null;
    }
  }
}
