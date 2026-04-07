import { jsPDF } from "jspdf";
import { useState, useEffect } from "react";
import {
  uploadResume,
  analyzeResume,
  getHistory,
  getAnalysisDetail,
  generateCoverLetter,
} from "./services/api";
import { SignedIn, SignedOut, SignIn, UserButton, useAuth } from "@clerk/clerk-react";

// ─── Improved Bullet Card ────────────────────────────────────────────────────
const ImprovedBullet = ({ item }) => {
  const [isOriginal, setIsOriginal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.rewritten);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
      {/* Toggle bar */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            onClick={() => setIsOriginal(true)}
            className={`rounded-md px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-all ${
              isOriginal
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Draft
          </button>
          <button
            onClick={() => setIsOriginal(false)}
            className={`rounded-md px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-all ${
              !isOriginal
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Optimized
          </button>
        </div>

        {!isOriginal && (
          <button
            onClick={handleCopy}
            className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-all ${
              copied
                ? "border-emerald-200 bg-emerald-500 text-white"
                : "border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
            }`}
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="min-h-[110px] p-5 flex items-center">
        {isOriginal ? (
          <div>
            <span className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-300">
              Original Draft
            </span>
            <p className="text-sm leading-relaxed italic text-slate-400">
              "{item.original}"
            </p>
          </div>
        ) : (
          <div className="w-full">
            <span className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-500">
              AI Transformation
            </span>
            <p className="flex gap-3 text-sm font-medium leading-relaxed text-slate-800">
              <span className="mt-0.5 text-amber-500">✦</span>
              <span>{item.rewritten}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Section Header ──────────────────────────────────────────────────────────
const SectionHeader = ({ eyebrow, title, description }) => (
  <div className="mb-7">
    <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.25em] text-amber-600">
      {eyebrow}
    </p>
    <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
      {title}
    </h2>
    {description && (
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
        {description}
      </p>
    )}
  </div>
);

// ─── Pill Tag ────────────────────────────────────────────────────────────────
const Tag = ({ label }) => (
  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-slate-500">
    {label}
  </span>
);

// ─── Skill Chip ──────────────────────────────────────────────────────────────
const SkillChip = ({ label, variant }) => (
  <span
    className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
      variant === "match"
        ? "border-emerald-100 bg-emerald-50 text-emerald-700"
        : "border-rose-100 bg-rose-50 text-rose-700"
    }`}
  >
    {label}
  </span>
);

// ─── Nav Item ────────────────────────────────────────────────────────────────
const NavItem = ({ icon, label, active, onClick, accentActive }) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
      active
        ? accentActive
          ? "bg-amber-500 text-white shadow-sm shadow-amber-200"
          : "bg-slate-900 text-white shadow-sm"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    }`}
  >
    <span className="text-base leading-none">{icon}</span>
    {label}
  </button>
);

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const { userId } = useAuth();

  const [activeTab, setActiveTab] = useState("analyze");
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [coverLetter, setCoverLetter] = useState("");
  const [generatingLetter, setGeneratingLetter] = useState(false);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userId]);

  const loadHistory = async () => {
    if (!userId) return;
    try {
      const data = await getHistory(userId);
      setHistory(data || []);
    } catch (err) {
      console.error("History fetch error:", err);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!file || !jobDescription) {
      setError("Upload a resume and paste a JD first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const uploadData = await uploadResume(file);
      const analysisData = await analyzeResume(uploadData.id, jobDescription, userId);
      setResults({ ...analysisData.results, current_resume_id: uploadData.id });
      setCoverLetter("");
      setActiveTab("analyze");
    } catch (err) {
      setError("Analysis failed. Check your API connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLetter = async () => {
    if (!jobDescription) return alert("Need a Job Description to write a letter.");
    if (!results?.current_resume_id && !history[0]?.id)
      return alert("Please run an analysis first.");
    setGeneratingLetter(true);
    try {
      const resumeIdToUse = results.current_resume_id || history[0]?.id;
      const data = await generateCoverLetter(resumeIdToUse, jobDescription);
      setCoverLetter(data.cover_letter);
    } catch (err) {
      alert("Failed to generate cover letter. Check backend console.");
    } finally {
      setGeneratingLetter(false);
    }
  };

  const handleSelectHistory = async (id) => {
    setLoading(true);
    setError("");
    try {
      const data = await getAnalysisDetail(id);
      setResults(data.results);
      setCoverLetter("");
      setActiveTab("analyze");
    } catch (err) {
      setError("Failed to retrieve past audit details.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!results) return;
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(180, 117, 23); // amber
    doc.text("Resume Audit Report", 20, 30);
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`ATS Match Score: ${results.match_score}%`, 20, 44);
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 51, 190, 51);
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129);
    doc.text("Strengths:", 20, 63);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const matchedLines = doc.splitTextToSize(results.matched_skills?.join(", ") || "None", 170);
    doc.text(matchedLines, 20, 70);
    let y = 70 + matchedLines.length * 6 + 10;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(244, 63, 94);
    doc.text("Skill Gaps:", 20, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const missingLines = doc.splitTextToSize(results.missing_skills?.join(", ") || "None", 170);
    y += 7;
    doc.text(missingLines, 20, y);
    y += missingLines.length * 6 + 14;
    doc.setDrawColor(226, 232, 240);
    doc.line(20, y - 4, 190, y - 4);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Recommended Bullet Rewrites:", 20, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    y += 14;
    results.weak_bullets?.forEach((bullet) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const lines = doc.splitTextToSize(`- ${bullet.rewritten}`, 160);
      doc.text(lines, 25, y);
      y += lines.length * 6 + 4;
    });
    doc.save(`Resume_Audit_${results.match_score}pct.pdf`);
  };

  // ── Signed-out landing ───────────────────────────────────────────────────
  return (
    <>
      <SignedOut>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="w-full max-w-5xl grid gap-12 lg:grid-cols-2 items-center">
            {/* Left copy */}
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                Resume AI Platform
              </div>
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.15]">
                Turn your resume into a{" "}
                <span className="text-amber-600">stronger match.</span>
              </h1>
              <p className="text-base leading-relaxed text-slate-500 max-w-md">
                Audit your resume against any job description, identify missing skills,
                rewrite weak bullets, and generate a focused cover letter.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {["ATS score", "Skill gaps", "STAR bullets", "Cover letter"].map((t) => (
                  <Tag key={t} label={t} />
                ))}
              </div>
            </div>

            {/* Sign-in card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white font-bold text-lg shadow-sm shadow-amber-200">
                  R
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Resume AI</p>
                  <p className="text-xs text-slate-400">Sign in to start your first audit</p>
                </div>
              </div>
              <SignIn routing="hash" />
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="min-h-screen bg-slate-50 text-slate-900">
          <div className="flex">

            {/* ── Sidebar ──────────────────────────────────────────────── */}
            <aside className="sticky top-0 hidden h-screen w-52 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
              {/* Logo */}
              <div className="mb-6 flex items-center gap-2.5 px-1 pt-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-sm shadow-sm shadow-amber-200 flex-shrink-0">
                  R
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 leading-none">Resume AI</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Audit smarter, apply better</p>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex flex-col gap-1">
                <NavItem
                  icon="＋"
                  label="New Audit"
                  active={activeTab === "analyze" && !results}
                  onClick={() => { setActiveTab("analyze"); setResults(null); setError(""); }}
                />
                <p className="px-3 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  History
                </p>
                <NavItem
                  icon="🗂"
                  label="Past Audits"
                  active={activeTab === "history"}
                  accentActive
                  onClick={() => setActiveTab("history")}
                />
              </nav>

              {/* User */}
              <div className="mt-auto border-t border-slate-100 pt-4 px-1">
                <UserButton showName={true} />
              </div>
            </aside>

            {/* ── Main ─────────────────────────────────────────────────── */}
            <main className="flex-1 px-5 py-6 lg:px-10 xl:px-14">

              {/* Top header bar */}
              <div className="mx-auto mb-7 max-w-6xl flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-600 mb-0.5">
                    Intelligent Resume Review
                  </p>
                  <h1 className="text-base font-semibold text-slate-900 md:text-lg leading-tight">
                    Build a resume that looks strong to both people and ATS systems.
                  </h1>
                </div>
                <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 md:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-medium text-emerald-700">Connected</span>
                </div>
              </div>

              {/* ── Upload / Analyze state ── */}
              {activeTab === "analyze" && !results && (
                <div className="mx-auto max-w-6xl">
                  <SectionHeader
                    eyebrow="Resume Audit"
                    title="Upload. Analyze. Improve."
                    description="Paste the job description and upload your resume. The app calculates your match score, shows skill gaps, and turns weak bullets into sharper, impact-driven statements."
                  />

                  <form onSubmit={handleAnalyze}>
                    {/* Main card */}
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-4">
                      <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

                        {/* Upload zone */}
                        <div className="relative p-6">
                          <p className="mb-3 text-xs font-medium text-slate-500 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            Your Resume
                          </p>
                          <input
                            type="file"
                            onChange={(e) => setFile(e.target.files[0])}
                            className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                            accept=".pdf,.txt"
                          />
                          <div
                            className={`pointer-events-none relative z-10 flex min-h-[220px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-all ${
                              file
                                ? "border-emerald-300 bg-emerald-50/50"
                                : "border-slate-200 bg-slate-50 hover:border-amber-300 hover:bg-amber-50/30"
                            }`}
                          >
                            <div
                              className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl text-2xl transition-all ${
                                file
                                  ? "bg-emerald-100 text-emerald-600"
                                  : "bg-white border border-slate-200 shadow-sm"
                              }`}
                            >
                              {file ? "✓" : "📄"}
                            </div>
                            <p className="mb-1 text-sm font-medium text-slate-800">
                              {file ? file.name : "Upload your resume"}
                            </p>
                            <p className="mb-4 text-xs text-slate-400">
                              {file
                                ? "Document ready for analysis"
                                : "Drag & drop or click to browse"}
                            </p>
                            <div className="flex gap-2">
                              <Tag label="PDF" />
                              <Tag label="TXT" />
                              <Tag label="Fast analysis" />
                            </div>
                          </div>
                        </div>

                        {/* JD textarea */}
                        <div className="flex flex-col p-6">
                          <p className="mb-1 text-xs font-medium text-slate-500 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                            Target Job Description
                            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                              Recommended
                            </span>
                          </p>
                          <p className="mb-3 text-xs text-slate-400">
                            Paste the full role description so scoring gets more accurate.
                          </p>
                          <textarea
                            className="flex-1 min-h-[200px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-700 outline-none placeholder:text-slate-300 focus:border-amber-400 focus:bg-white transition-colors"
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            placeholder="Paste the complete job description here..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Error + CTA */}
                    {error && (
                      <p className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                        ⚠️ {error}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">Analysis takes 15–30 seconds</p>
                      <button
                        type="submit"
                        disabled={loading || !file || !jobDescription}
                        className="flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {loading ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                            </svg>
                            Begin Deep Audit
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Results state ── */}
              {activeTab === "analyze" && results && (
                <div className="mx-auto max-w-6xl space-y-6">
                  <SectionHeader
                    eyebrow="Analysis complete"
                    title="Your resume now has a clear path to improvement."
                    description="Review your score, close skill gaps, and use the rewritten bullets below to sharpen your application."
                  />

                  {/* Stats row */}
                  <div className="grid gap-5 lg:grid-cols-12">
                    {/* Score card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-4">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-4">
                        Match strength
                      </p>
                      <div className="flex items-end gap-1 mb-5">
                        <span className="text-6xl font-semibold tracking-tight text-slate-900">
                          {results.match_score}
                        </span>
                        <span className="pb-2 text-xl font-semibold text-amber-500">%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-1000"
                          style={{ width: `${results.match_score}%` }}
                        />
                      </div>
                      <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                        Higher scores mean stronger keyword alignment and better role fit.
                      </p>
                    </div>

                    {/* Skill cards */}
                    <div className="grid gap-5 md:grid-cols-2 lg:col-span-8">
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5">
                        <h4 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-600 mb-4">
                          Strengths
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {results.matched_skills?.length ? (
                            results.matched_skills.map((s, i) => (
                              <SkillChip key={i} label={s} variant="match" />
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">No strengths detected.</span>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-5">
                        <h4 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-rose-600 mb-4">
                          Skill gaps
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {results.missing_skills?.length ? (
                            results.missing_skills.map((s, i) => (
                              <SkillChip key={i} label={s} variant="gap" />
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">No gaps detected.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bullet rewrites */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <SectionHeader
                      eyebrow="Rewrite suggestions"
                      title="Impact improvements"
                      description="These rewrites sound stronger, clearer, and more results-focused. Toggle between draft and optimized to compare."
                    />
                    <div className="grid gap-4">
                      {results.weak_bullets?.length ? (
                        results.weak_bullets.map((item, i) => (
                          <ImprovedBullet key={i} item={item} />
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
                          No bullet improvements available.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cover letter */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-white">
                    <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                          Optional
                        </p>
                        <h3 className="text-lg font-semibold text-white">AI Cover Letter</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          Generate a concise letter tailored to this role.
                        </p>
                      </div>
                      {!coverLetter && (
                        <button
                          onClick={handleGenerateLetter}
                          disabled={generatingLetter}
                          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-amber-400 disabled:opacity-50 flex-shrink-0"
                        >
                          {generatingLetter ? "Writing..." : "Generate cover letter"}
                        </button>
                      )}
                    </div>

                    {coverLetter ? (
                      <div className="relative rounded-lg border border-white/10 bg-white/5 p-5">
                        <button
                          onClick={() => navigator.clipboard.writeText(coverLetter)}
                          className="absolute right-3 top-3 rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-white transition-all hover:bg-amber-500"
                        >
                          Copy
                        </button>
                        <p className="whitespace-pre-wrap text-sm leading-loose text-slate-300 pt-4">
                          {coverLetter}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-500 text-center">
                        Click the button above to generate a tailored cover letter.
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-3 pb-8 md:flex-row">
                    <button
                      onClick={handleExport}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                    >
                      Download PDF Report
                    </button>
                    <button
                      onClick={() => {
                        setResults(null);
                        setJobDescription("");
                        setFile(null);
                        setCoverLetter("");
                        setError("");
                      }}
                      className="rounded-lg bg-amber-500 px-8 py-3 text-sm font-medium text-white shadow-sm shadow-amber-200 transition-all hover:bg-amber-600"
                    >
                      New Audit
                    </button>
                  </div>
                </div>
              )}

              {/* ── History state ── */}
              {activeTab === "history" && (
                <div className="mx-auto max-w-6xl">
                  <SectionHeader
                    eyebrow="Audit history"
                    title="Your past resume checks"
                    description="Open any earlier audit to revisit the score, gaps, and rewritten recommendations."
                  />

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {history.length > 0 ? (
                      history.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectHistory(item.id)}
                          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
                        >
                          <div className="mb-5 flex items-start justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xl transition-colors group-hover:bg-amber-50">
                              📄
                            </div>
                            <span className="text-2xl font-semibold text-slate-900">
                              {item.match_score}%
                            </span>
                          </div>
                          <h5 className="mb-1 truncate text-sm font-medium text-slate-800">
                            {item.resume_filename}
                          </h5>
                          <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                            {new Date(item.created_at).toLocaleDateString()}
                          </p>
                          <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-amber-500 opacity-0 transition-all group-hover:opacity-100">
                            View details →
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-14 text-center text-sm text-slate-400">
                        No past audits found.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Loading overlay */}
              {loading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-xl">
                    <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-amber-500 border-t-transparent" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-600">
                      Processing
                    </p>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </SignedIn>
    </>
  );
}

export default App;


