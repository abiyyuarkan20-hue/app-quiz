import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  "https://app-quiz-production-6a61.up.railway.app";

// Single socket instance
const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: false,
});

export const useGameStore = create(
  persist(
    (set, get) => ({
      // --- DATA STATE ---
      roomCode: "",
      playerName: "",
      players: [],
      playerEmail: "",
      playerPhone: "",
      gameState: "HOME",
      currentQuestion: null,
      timeLimit: 0,
      score: 0,
      showResult: false,
      correctAnswer: null,
      isConnected: false,
      sessionStartTime: null,
      activeQuizTitle: "",
      activeQuizId: null,
      currentQuestionIndex: 0,
      totalQuestions: 0,
      isResultPhase: false,
      lastRoomCode: "",
      lastAnswerPoints: 0,
      theme: "cosmic",

      // --- ACTION STATE ---
      setPlayers: (playerList) =>
        set({
          players: playerList.map((p) => ({
            name: p.name || p.playerName,
            hasAnswered: p.hasAnswered || false,
            score: p.score || 0,
            correctAnswers: p.correctAnswers || 0,
            incorrectAnswers: p.incorrectAnswers || 0,
            totalAnswered: p.totalAnswered || 0,
          })),
        }),

      setGameState: (newState) => {
        const isAdmin = localStorage.getItem("isAdmin") === "true";
        if (isAdmin && (newState === "PLAYING" || newState === "WAITING")) {
          set({ gameState: "ADMIN_CONTROL" });
        } else {
          set({ gameState: newState });
        }
      },

      setRoom: (code, name, email = "", phone = "") =>
        set({
          roomCode: code?.toUpperCase(),
          playerName: name,
          playerEmail: email,
          playerPhone: phone,
        }),

      resetGame: () => {
        if (socket.connected) socket.emit("leave_room");
        set({
          gameState: "HOME",
          score: 0,
          currentQuestion: null,
          roomCode: "",
          playerName: "",
          playerEmail: "",
          playerPhone: "",
          timeLimit: 0,
          players: [],
          showResult: false,
          correctAnswer: null,
          sessionStartTime: null,
          activeQuizTitle: "",
        });
      },

      // --- SOCKET LOGIC ---
      initSocket: () => {
        const s = socket;

        // 1. Guard agar listener tidak didaftarkan berulang kali
        if (s.hasListeners("next_question")) return;

        // 2. Connect jika belum terhubung
        if (!s.connected) {
          s.on("connect", () => {
            set({ isConnected: true });
            // Auto re-join jika ada roomCode (untuk handle page refresh)
            const { roomCode, playerName, playerEmail, playerPhone } = get();
            if (roomCode) {
              s.emit("join_room", {
                roomCode,
                playerName:
                  playerName ||
                  (localStorage.getItem("isAdmin") === "true"
                    ? "ADMIN_HOST"
                    : "Player"),
                email: playerEmail,
                whatsapp: playerPhone,
              });
            }
            // Request global theme
            s.emit("request_theme", (res) => {
              if (res && res.theme) {
                set({ theme: res.theme });
                document.documentElement.setAttribute("data-theme", res.theme);
              }
            });
          });
          s.on("disconnect", () => set({ isConnected: false }));
          s.connect();
        }

        // 3. Listener saat berhasil masuk room (PENTING)
        s.on("room_joined", (data) => {
          // Guard: data bisa kosong jika backend lama, jangan timpa state
          const incomingRoom = data?.roomCode;
          const incomingPlayers = data?.players;
          console.log("[STORE] Berhasil join ke room:", incomingRoom);
          const isAdmin = localStorage.getItem("isAdmin") === "true";

          const updates = {
            // Jika admin, tetap di DASHBOARD (admin pindah ke CONTROL hanya saat pilih kuis)
            // Jika player, ke WAITING
            gameState: isAdmin ? get().gameState : "WAITING",
          };

          // Hanya update roomCode jika ada nilai valid dari server
          if (incomingRoom) updates.roomCode = incomingRoom;
          if (incomingPlayers) {
            updates.players = incomingPlayers.map((p) => ({
              name: p.name || p.playerName,
              hasAnswered: p.hasAnswered || false,
              score: p.score || 0,
              correctAnswers: p.correctAnswers || 0,
              incorrectAnswers: p.incorrectAnswers || 0,
              totalAnswered: p.totalAnswered || 0,
            }));
          }

          set(updates);
        });

        s.on("join_error", (message) => {
          alert(message);
        });

        s.on("session_created", (data) => {
          set({
            roomCode: data.roomCode,
            activeQuizTitle: data.quizTitle,
            sessionStartTime: data.startTime,
            activeQuizId: data.quizId,
            gameState: "ADMIN_LOBBY",
          });
        });

        s.on("session_started", (data) => {
          set({
            roomCode: data.roomCode,
            activeQuizTitle: data.quizTitle,
            sessionStartTime: data.startTime,
          });
        });

        // 4. Listener kuis dimulai / soal selanjutnya
        s.on("next_question", (data) => {
          console.log("[STORE] next_question received:", data.question?.id);
          const isAdmin = localStorage.getItem("isAdmin") === "true";

          set({
            currentQuestion: data.question,
            timeLimit: data.timeLimit,
            currentQuestionIndex:
              data.currentIndex !== undefined
                ? data.currentIndex
                : get().currentQuestionIndex,
            totalQuestions: data.totalQuestions || get().totalQuestions,
            isResultPhase: false,
            showResult: false,
            correctAnswer: null,
            gameState: isAdmin ? "ADMIN_CONTROL" : "PLAYING",
          });
        });

        s.on("answer_received", ({ pointsEarned, isCorrect }) => {
          if (isCorrect) {
            set({ lastAnswerPoints: pointsEarned });
          } else {
            set({ lastAnswerPoints: 0 });
          }
        });

        s.on("player_joined", ({ players }) => {
          if (players) get().setPlayers(players);
        });

        s.on("room_players", (playerList) => {
          get().setPlayers(playerList);
        });

        s.on("show_result", (data) => {
          const updates = {
            showResult: true,
            correctAnswer: data.correctAnswer,
            isResultPhase: true,
          };
          if (data.players) {
            updates.players = data.players.map((p) => ({
              name: p.name || p.playerName,
              hasAnswered: p.hasAnswered,
              score: p.score,
              isCorrect: p.isCorrect,
              correctAnswers: p.correctAnswers || 0,
              incorrectAnswers: p.incorrectAnswers || 0,
              totalAnswered: p.totalAnswered || 0,
            }));

            // Sync score from server (authoritative Redis value)
            const currentPlayerName = get().playerName;
            const serverPlayer = data.players.find(
              (p) => (p.name || p.playerName) === currentPlayerName,
            );
            if (serverPlayer && typeof serverPlayer.score === "number") {
              updates.score = serverPlayer.score;
            }
          }
          set(updates);
        });

        s.on("theme_updated", (data) => {
          if (data && data.theme) {
            set({ theme: data.theme });
            document.documentElement.setAttribute("data-theme", data.theme);
          }
        });

        s.on("game_over", () => {
          const isAdmin = localStorage.getItem("isAdmin") === "true";
          const lastPlayerName = get().playerName;
          const lastRoomCode = get().roomCode;
          const lastQuizTitle = get().activeQuizTitle;

          get().resetGame();

          if (!isAdmin) {
            set({
              gameState: "PLAYER_LEADERBOARD",
              playerName: lastPlayerName,
              lastRoomCode: lastRoomCode,
              activeQuizTitle: lastQuizTitle,
            });
          } else {
            set({ gameState: "ADMIN_DASHBOARD" });
          }
        });
      },

      getSocket: () => socket,
    }),
    {
      name: "quiz-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        roomCode: state.roomCode,
        playerName: state.playerName,
        playerEmail: state.playerEmail,
        playerPhone: state.playerPhone,
        gameState: state.gameState,
        score: state.score,
        sessionStartTime: state.sessionStartTime,
        activeQuizTitle: state.activeQuizTitle,
        activeQuizId: state.activeQuizId,
        currentQuestionIndex: state.currentQuestionIndex,
        totalQuestions: state.totalQuestions,
        isResultPhase: state.isResultPhase,
        lastRoomCode: state.lastRoomCode,
      }),
    },
  ),
);
