import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useParams, useNavigate } from "react-router-dom";

const CreateQuiz = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState(20);
  const [points, setPoints] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);

  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([
    { question_text: "", options: ["", "", "", ""], correct_answer: 0 },
  ]);

  // --- 1. LOGIKA LOAD DATA ---
  useEffect(() => {
    if (quizId) {
      const fetchQuizData = async () => {
        setLoading(true);
        try {
          const { data: quiz, error: quizErr } = await supabase
            .from("quizzes")
            .select("title, description, time_limit, points, is_active, randomize_questions")
            .eq("id", quizId)
            .single();
          if (quizErr) throw quizErr;
          setTitle(quiz.title);
          setDescription(quiz.description || "");
          setTimeLimit(quiz.time_limit || 20);
          setPoints(quiz.points || 100);
          setIsActive(quiz.is_active ?? true);
          setRandomizeQuestions(quiz.randomize_questions ?? false);

          const { data: qst, error: qstErr } = await supabase
            .from("questions")
            .select("question_text, options, correct_answer")
            .eq("quiz_id", quizId)
            .order("id", { ascending: true });
          if (qstErr) throw qstErr;

          if (qst && qst.length > 0) setQuestions(qst);
        } catch (err) {
          alert("Gagal memuat: " + err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchQuizData();
    }
  }, [quizId]);

  // --- 2. HANDLER INPUT (IMMUTABLE STATE) ---
  const handleQuestionChange = (index, value) => {
    const updatedQuestions = questions.map((q, i) =>
      i === index ? { ...q, question_text: value } : q,
    );
    setQuestions(updatedQuestions);
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    const updatedQuestions = questions.map((q, i) => {
      if (i === qIndex) {
        const newOptions = [...q.options];
        newOptions[optIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    });
    setQuestions(updatedQuestions);
  };

  const setCorrectAnswer = (qIndex, optIndex) => {
    const updatedQuestions = questions.map((q, i) =>
      i === qIndex ? { ...q, correct_answer: optIndex } : q,
    );
    setQuestions(updatedQuestions);
  };

  // --- 3. LOGIKA SIMPAN ---
  const handleSaveQuiz = async () => {
    if (!title.trim()) return alert("Judul kuis wajib diisi!");

    // Validasi: pastikan tidak ada teks pertanyaan atau opsi yang kosong
    const isValid = questions.every(
      (q) =>
        q.question_text.trim() !== "" &&
        q.options.every((opt) => opt.trim() !== ""),
    );
    if (!isValid) return alert("Lengkapi semua pertanyaan dan pilihan!");

    setLoading(true);
    try {
      let currentQuizId = quizId;

      // 1. Simpan/Update Judul Kuis
      if (quizId) {
        const { error: upErr } = await supabase
          .from("quizzes")
          .update({ 
            title, 
            description, 
            time_limit: parseInt(timeLimit), 
            points: parseInt(points), 
            is_active: isActive,
            randomize_questions: randomizeQuestions,
          })
          .eq("id", quizId)
          .select()
          .single();
        if (upErr) throw upErr;

        // Hapus soal lama hanya jika update judul berhasil
        const { error: delErr } = await supabase
          .from("questions")
          .delete()
          .eq("quiz_id", quizId);
        if (delErr) throw delErr;
      } else {
        // Masukkan Kuis Baru
        // TIPS: Ganti admin_id sesuai user yang login jika sudah ada sistem auth
        const { data: newQuiz, error: qErr } = await supabase
          .from("quizzes")
          .insert([{ 
            title, 
            description, 
            time_limit: parseInt(timeLimit), 
            points: parseInt(points), 
            is_active: isActive,
            randomize_questions: randomizeQuestions,
            admin_id: 1 
          }])
          .select()
          .single();
        if (qErr) throw qErr;
        currentQuizId = newQuiz.id;
      }

      // 2. Format ulang data untuk insert batch
      const finalQuestions = questions.map((q) => ({
        quiz_id: currentQuizId,
        question_text: q.question_text.trim(),
        options: q.options, // Simpan sebagai array JSON (Supabase mendukung ini)
        correct_answer: q.correct_answer,
      }));

      // 3. Insert Batch Semua Pertanyaan
      const { error: insErr } = await supabase
        .from("questions")
        .insert(finalQuestions);

      if (insErr) throw insErr;

      alert("Kuis berhasil disimpan!");
      navigate("/admin/kelola-quiz");
    } catch (err) {
      console.error(err);
      alert("Terjadi Kesalahan: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-black italic tracking-tighter text-cyan-400 uppercase">
            {quizId ? "Edit Mode" : "Creation Mode"}
          </h1>
          <button
            onClick={() => navigate("/admin/kelola-quiz")}
            className="text-slate-500 hover:text-white text-sm transition-all"
          >
            Cancel & Exit
          </button>
        </header>

        {/* Input Settings Quiz */}
        <div className="bg-slate-800 p-8 rounded-[2rem] border border-slate-700 shadow-2xl mb-10">
          <div className="mb-6">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 block">
              Quiz Title
            </label>
            <input
              type="text"
              className="w-full bg-transparent text-4xl font-bold outline-none border-b-2 border-slate-700 focus:border-cyan-500 transition-all pb-2"
              placeholder="Untitled Quiz..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="mb-6">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 block">
              Description
            </label>
            <textarea
              className="w-full bg-slate-900 p-4 rounded-xl text-slate-300 outline-none border border-slate-700 focus:border-cyan-500 transition-all resize-none"
              placeholder="A fun quiz about..."
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 block">
                Time Limit (seconds)
              </label>
              <input
                type="number"
                className="w-full bg-slate-900 p-4 rounded-xl text-slate-300 outline-none border border-slate-700 focus:border-cyan-500 transition-all"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 block">
                Points per Question
              </label>
              <input
                type="number"
                className="w-full bg-slate-900 p-4 rounded-xl text-slate-300 outline-none border border-slate-700 focus:border-cyan-500 transition-all"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>
          </div>

          {/* Toggle Row: Visible + Randomize */}
          <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-700/50">
            {/* Visible Toggle */}
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                isActive
                  ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300"
                  : "bg-slate-900 border-slate-700 text-slate-500"
              }`}
            >
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 ${
                  isActive ? "bg-cyan-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-300 ${
                    isActive ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </span>
              <div className="flex flex-col items-start">
                <span className="text-xs font-black uppercase tracking-wider">Visible</span>
                <span className="text-[10px] opacity-60">{isActive ? "Kuis aktif" : "Kuis tersembunyi"}</span>
              </div>
            </button>

            {/* Randomize Questions Toggle */}
            <button
              type="button"
              onClick={() => setRandomizeQuestions((v) => !v)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                randomizeQuestions
                  ? "bg-purple-500/10 border-purple-500/40 text-purple-300"
                  : "bg-slate-900 border-slate-700 text-slate-500"
              }`}
            >
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 ${
                  randomizeQuestions ? "bg-purple-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-300 ${
                    randomizeQuestions ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </span>
              <div className="flex flex-col items-start">
                <span className="text-xs font-black uppercase tracking-wider">Acak Soal</span>
                <span className="text-[10px] opacity-60">
                  {randomizeQuestions ? "Urutan diacak tiap sesi" : "Urutan sesuai daftar"}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Pertanyaan */}
        {questions.map((q, qIndex) => (
          <div
            key={qIndex}
            className="bg-slate-800 p-8 rounded-[2rem] border border-slate-700 mb-6 shadow-xl relative overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <span className="bg-cyan-500 text-slate-900 text-[10px] font-black px-3 py-1 rounded-full uppercase">
                Question {qIndex + 1}
              </span>
              <button
                onClick={() =>
                  setQuestions(questions.filter((_, i) => i !== qIndex))
                }
                className="text-rose-500 text-xs font-bold hover:underline"
              >
                Remove
              </button>
            </div>

            <textarea
              className="w-full bg-slate-900 p-5 rounded-2xl border border-slate-700 mb-6 focus:ring-2 focus:ring-cyan-500 outline-none resize-none"
              placeholder="What's the question?"
              rows="2"
              value={q.question_text}
              onChange={(e) => handleQuestionChange(qIndex, e.target.value)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {q.options.map((opt, optIndex) => (
                <div key={optIndex} className="relative group">
                  <input
                    type="text"
                    className={`w-full p-4 pr-20 rounded-xl border transition-all outline-none ${
                      q.correct_answer === optIndex
                        ? "bg-green-500/10 border-green-500 text-green-200"
                        : "bg-slate-900 border-slate-700 text-slate-400 focus:border-slate-500"
                    }`}
                    placeholder={`Option ${optIndex + 1}`}
                    value={opt}
                    onChange={(e) =>
                      handleOptionChange(qIndex, optIndex, e.target.value)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setCorrectAnswer(qIndex, optIndex)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                      q.correct_answer === optIndex
                        ? "bg-green-500 text-white"
                        : "bg-slate-700 text-slate-400 opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {q.correct_answer === optIndex ? "Correct" : "Mark"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Action Buttons */}
        <div className="flex gap-4 pb-20 mt-10">
          <button
            onClick={() =>
              setQuestions([
                ...questions,
                {
                  question_text: "",
                  options: ["", "", "", ""],
                  correct_answer: 0,
                },
              ])
            }
            className="flex-1 bg-slate-800 py-5 rounded-2xl font-bold border border-slate-700 hover:bg-slate-700 transition-all"
          >
            + Add Question
          </button>
          <button
            onClick={handleSaveQuiz}
            disabled={loading}
            className="flex-1 bg-cyan-600 py-5 rounded-2xl font-black text-white hover:bg-cyan-500 disabled:opacity-50 shadow-lg shadow-cyan-900/20 transition-all uppercase tracking-widest"
          >
            {loading ? "Saving..." : "Publish Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateQuiz;
