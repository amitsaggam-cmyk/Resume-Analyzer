import { jsPDF } from "jspdf";
import { useState, useEffect } from 'react';
import { uploadResume, analyzeResume, getHistory, getAnalysisDetail, generateCoverLetter } from './services/api';
import { SignedIn, SignedOut, SignIn, UserButton, useAuth } from "@clerk/clerk-react";

// --- SUB-COMPONENT: The "Comparison" Bullet Card ---
const ImprovedBullet = ({ item }) => {
  const [isOriginal, setIsOriginal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.rewritten);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-500/5">
      <div className="flex justify-between items-center px-6 py-3 bg-slate-50/50 border-b border-slate-50">
        <div className="flex bg-white p-1 rounded-full border border-slate-100 shadow-sm">
          <button onClick={() => setIsOriginal(true)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${isOriginal ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>Draft</button>
          <button onClick={() => setIsOriginal(false)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${!isOriginal ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:text-slate-600'}`}>Optimized</button>
        </div>
        {!isOriginal && (
          <button onClick={handleCopy} className={`text-[10px] font-bold px-4 py-1.5 rounded-full transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-900 hover:text-white'}`}>
            {copied ? '✓ COPIED' : 'COPY STAR BULLET'}
          </button>
        )}
      </div>
      <div className="p-8 min-h-[120px] flex items-center">
        {isOriginal ? (
          <div className="animate-in fade-in slide-in-from-left-2 duration-300">
            <span className="text-[10px] font-black text-slate-300 uppercase block mb-2 tracking-widest">Original Draft</span>
            <p className="text-slate-500 italic leading-relaxed text-sm">"{item.original}"</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 w-full">
            <span className="text-[10px] font-black text-indigo-400 uppercase block mb-2 tracking-widest">AI Transformation</span>
            <p className="text-slate-800 font-semibold leading-relaxed text-base flex gap-3">
              <span className="text-indigo-500 font-black">✦</span>
              {item.rewritten}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  const { userId } = useAuth(); // <--- GRABS THE LOGGED IN USER'S ID

  const [activeTab, setActiveTab] = useState('analyze');
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  
  // States for our Killer Features
  const [coverLetter, setCoverLetter] = useState('');
  const [generatingLetter, setGeneratingLetter] = useState(false);
  
  // Initialize the Live Editor state, checking LocalStorage first
  const [resumeDraft, setResumeDraft] = useState(() => {
    return localStorage.getItem('saved_resume_draft') || '';
  });

  // Auto-Save whenever they type!
  useEffect(() => {
    localStorage.setItem('saved_resume_draft', resumeDraft);
  }, [resumeDraft]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, userId]); // Re-run if they switch tabs OR login state changes

  const loadHistory = async () => {
    if (!userId) return; // Wait until we know who is logged in
    try {
      const data = await getHistory(userId); // Passing userId to backend
      setHistory(data);
    } catch (err) { console.error("History fetch error:", err); }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!file || !jobDescription) return setError('Upload a resume and paste a JD first.');
    setLoading(true); setError('');
    try {
      const uploadData = await uploadResume(file);
      const analysisData = await analyzeResume(uploadData.id, jobDescription, userId); // Passing userId to backend
      
      setResults({ ...analysisData.results, current_resume_id: uploadData.id });
      setCoverLetter(''); 
      setResumeDraft(''); // Clear editor for new audit
    } catch (err) { 
      setError('Analysis failed. Check your API connection.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleGenerateLetter = async () => {
    if (!jobDescription) return alert("Need a Job Description to write a letter.");
    if (!results?.current_resume_id && !history[0]?.id) return alert("Please run an analysis first.");
    
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
    try {
      const data = await getAnalysisDetail(id);
      setResults(data.results); 
      setCoverLetter(''); 
      setResumeDraft(''); // Clear editor
      setActiveTab('analyze'); 
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
    doc.setFontSize(24);
    doc.setTextColor(79, 70, 229); 
    doc.text("Resume Audit Report", 20, 30);
    
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); 
    doc.text(`ATS Match Probability: ${results.match_score}%`, 20, 45);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 52, 190, 52);

    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129); 
    doc.text("Verified Strengths:", 20, 65);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); 
    const matchedText = results.matched_skills?.join(', ') || 'None found';
    const matchedLines = doc.splitTextToSize(matchedText, 170);
    doc.text(matchedLines, 20, 72);

    let currentY = 72 + (matchedLines.length * 6) + 10;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(244, 63, 94);
    doc.text("Identified Skill Gaps:", 20, currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const missingText = results.missing_skills?.join(', ') || 'None found';
    const missingLines = doc.splitTextToSize(missingText, 170);
    currentY += 7;
    doc.text(missingLines, 20, currentY);

    currentY += (missingLines.length * 6) + 15;

    doc.setDrawColor(226, 232, 240);
    doc.line(20, currentY - 5, 190, currentY - 5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Recommended Bullet Updates (STAR Method):", 20, currentY + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    
    currentY += 15;

    results.weak_bullets?.forEach((bullet) => {
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
      const bulletText = `- ${bullet.rewritten}`; 
      const bulletLines = doc.splitTextToSize(bulletText, 160);
      doc.text(bulletLines, 25, currentY);
      currentY += (bulletLines.length * 6) + 4;
    });

    doc.save(`Resume_Audit_${results.match_score}pct.pdf`);
  };

  return (
    <>
      {/* WHAT USERS SEE WHEN LOGGED OUT */}
      <SignedOut>
        <div className="min-h-screen bg-[#F8FAFF] flex flex-col items-center justify-center p-4">
          <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-100 mx-auto mb-4">
              <span className="text-white font-black text-3xl">R</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter">Resume AI<span className="text-indigo-500">.</span></h1>
            <p className="text-slate-500 mt-2 font-medium">Sign in to audit your resume and generate cover letters.</p>
          </div>
          <SignIn routing="hash" />
        </div>
      </SignedOut>

      {/* WHAT USERS SEE WHEN LOGGED IN */}
      <SignedIn>
        <div className="min-h-screen bg-[#F8FAFF] text-slate-900 font-sans selection:bg-indigo-100">
          <div className="flex">
            
            {/* Sidebar */}
            <aside className="w-72 h-screen sticky top-0 border-r border-indigo-50 bg-white/60 backdrop-blur-xl p-8 flex flex-col z-10">
              <div className="flex items-center gap-3 mb-12">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <span className="text-white font-black text-xl">R</span>
                </div>
                <span className="font-black tracking-tighter text-2xl">RAI<span className="text-indigo-500">.</span></span>
              </div>
              <nav className="space-y-2 flex-1">
                <button onClick={() => {setActiveTab('analyze'); setResults(null);}} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'analyze' && !results ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}><span>✨</span> New Audit</button>
                <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}><span>📁</span> Past Audits</button>
              </nav>

              {/* Profile Widget at bottom of sidebar */}
              <div className="mt-auto p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                <UserButton showName={true} />
              </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 p-10 xl:p-16 relative overflow-hidden">
              
              {/* Input State */}
              {activeTab === 'analyze' && !results && (
                <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <header className="space-y-4 text-center md:text-left">
                    <h1 className="text-5xl font-black tracking-tight">Smart <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Resume Audit</span>.</h1>
                    <p className="text-slate-500 text-lg font-medium">Fine-tune your narrative for a perfect ATS match.</p>
                  </header>
                  <form onSubmit={handleAnalyze} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white border border-slate-100 p-10 rounded-[2.5rem] shadow-sm relative group hover:shadow-xl transition-all">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 block text-center">Resume</label>
                      <div className="border-2 border-dashed border-slate-100 rounded-[2rem] p-12 text-center bg-slate-50/50 group-hover:border-indigo-300 transition-all">
                        <input type="file" onChange={(e) => setFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <div className="text-5xl mb-4">📄</div>
                        <p className="text-sm font-bold text-slate-600">{file ? file.name : "Select File"}</p>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-100 p-10 rounded-[2.5rem] shadow-sm">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 block text-center">Job Specs</label>
                      <textarea rows="8" className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] p-6 text-sm outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all font-medium" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste JD here..." />
                    </div>
                    <div className="col-span-full text-center pt-4">
                      {error && <p className="text-rose-500 font-bold mb-4">⚠️ {error}</p>}
                      <button type="submit" disabled={loading} className="px-14 py-5 bg-slate-900 text-white font-black rounded-full hover:bg-indigo-600 hover:-translate-y-1 transition-all disabled:bg-slate-200 shadow-2xl shadow-indigo-100">
                        {loading ? "Crunching Logic..." : "Analyze Now"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Results State (SPLIT SCREEN WORKSPACE) */}
              {activeTab === 'analyze' && results && (
                <div className="max-w-[100rem] mx-auto flex flex-col xl:flex-row gap-10 animate-in zoom-in-95 duration-500">
                  
                  {/* LEFT COLUMN: Audit Data */}
                  <div className="flex-1 space-y-10">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-1 bg-white border border-indigo-50 p-10 rounded-[3rem] shadow-sm flex flex-col items-center justify-center relative">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-8 tracking-widest">Match Strength</p>
                        <div className="text-8xl font-black text-slate-900">{results.match_score}<span className="text-2xl text-indigo-400">%</span></div>
                        <div className="w-full bg-slate-100 h-2 rounded-full mt-10"><div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{width: `${results.match_score}%`}}></div></div>
                      </div>
                      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="bg-emerald-50/50 border border-emerald-100 p-8 rounded-[2.5rem]">
                            <h4 className="text-[10px] font-black text-emerald-600 uppercase mb-6 tracking-widest">Strengths</h4>
                            <div className="flex flex-wrap gap-2">{results.matched_skills?.map((s,i) => <span key={i} className="px-3 py-2 bg-white text-emerald-700 text-[10px] font-bold rounded-xl shadow-sm border border-emerald-100">{s}</span>)}</div>
                         </div>
                         <div className="bg-rose-50/50 border border-rose-100 p-8 rounded-[2.5rem]">
                            <h4 className="text-[10px] font-black text-rose-600 uppercase mb-6 tracking-widest">Skill Gaps</h4>
                            <div className="flex flex-wrap gap-2">{results.missing_skills?.map((s,i) => <span key={i} className="px-3 py-2 bg-white text-rose-700 text-[10px] font-bold rounded-xl shadow-sm border border-rose-100">{s}</span>)}</div>
                         </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-100 p-12 rounded-[3.5rem] shadow-sm">
                      <h3 className="text-2xl font-black text-slate-800 mb-10 flex items-center gap-4"><span className="text-2xl">⚡</span> Impact Improvements</h3>
                      <div className="grid grid-cols-1 gap-6">{results.weak_bullets?.map((item, i) => <ImprovedBullet key={i} item={item} />)}</div>
                    </div>

                    {/* Cover Letter Box */}
                    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-10 rounded-[3rem] shadow-xl text-white">
                        <div className="flex justify-between items-center mb-8">
                          <h3 className="text-2xl font-black flex items-center gap-4">
                            <span className="text-3xl">✍️</span> AI Cover Letter
                          </h3>
                          {!coverLetter && (
                            <button onClick={handleGenerateLetter} disabled={generatingLetter} className="bg-indigo-500 hover:bg-indigo-400 text-white px-8 py-3 rounded-full font-bold transition-all disabled:opacity-50">
                              {generatingLetter ? "Writing..." : "Generate Magic Letter"}
                            </button>
                          )}
                        </div>
                        {coverLetter && (
                          <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700 relative group">
                            <button onClick={() => navigator.clipboard.writeText(coverLetter)} className="absolute top-4 right-4 bg-slate-700 hover:bg-emerald-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">Copy Text</button>
                            <p className="whitespace-pre-wrap text-slate-300 text-sm leading-loose">{coverLetter}</p>
                          </div>
                        )}
                    </div>

                    <div className="flex gap-4 pb-10">
                      <button onClick={handleExport} className="flex-1 bg-white border border-slate-200 text-slate-800 font-black py-5 rounded-3xl hover:border-indigo-400 transition-all">Download PDF Report</button>
                      <button onClick={() => {setResults(null); setJobDescription(''); setFile(null);}} className="px-12 bg-indigo-600 text-white font-black py-5 rounded-3xl hover:bg-indigo-700 transition-all">New Audit</button>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Live Editor */}
                  <div className="w-full xl:w-[450px] shrink-0 relative">
                    <div className="sticky top-8 bg-white border border-slate-200 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-4rem)]">
                       <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                          <h3 className="font-black text-lg flex items-center gap-2"><span>📝</span> Live Editor</h3>
                          <button 
                            onClick={() => navigator.clipboard.writeText(resumeDraft)} 
                            className="text-[10px] bg-indigo-500 hover:bg-emerald-500 px-4 py-2 rounded-full uppercase font-black tracking-widest transition-all"
                          >
                            Copy All
                          </button>
                       </div>
                       <div className="bg-indigo-50/50 p-4 border-b border-indigo-100">
                         <p className="text-xs text-indigo-500 font-bold text-center leading-relaxed">
                           Paste your resume below. When you click <span className="bg-white px-2 py-0.5 rounded border border-indigo-200">Copy Star Bullet</span> on the left, paste it directly in here!
                         </p>
                       </div>
                       <textarea 
                         className="flex-1 w-full p-8 text-sm text-slate-700 bg-white outline-none resize-none leading-loose placeholder:text-slate-300"
                         placeholder="Paste your original resume text here..."
                         value={resumeDraft}
                         onChange={(e) => setResumeDraft(e.target.value)}
                       />
                    </div>
                  </div>

                </div>
              )}

              {/* History State */}
              {activeTab === 'history' && (
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-right-8 duration-700">
                   {history.length > 0 ? history.map((item) => (
                     <div key={item.id} onClick={() => handleSelectHistory(item.id)} className="group bg-white border border-slate-100 p-8 rounded-[2.5rem] hover:shadow-2xl hover:border-indigo-300 transition-all cursor-pointer active:scale-95">
                        <div className="flex justify-between items-start mb-8">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-indigo-50 transition-colors">📄</div>
                          <div className="text-2xl font-black text-slate-900">{item.match_score}%</div>
                        </div>
                        <h5 className="font-bold text-slate-800 truncate mb-1">{item.resume_filename}</h5>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString()}</p>
                        <p className="text-[10px] text-indigo-500 font-bold mt-4 opacity-0 group-hover:opacity-100 transition-all">VIEW DETAILS →</p>
                     </div>
                   )) : <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 font-bold text-slate-400">No private records found.</div>}
                </div>
              )}

              {/* Global Loader Overlay */}
              {loading && (
                 <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-4">
                       <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                       <p className="font-black text-indigo-600 tracking-widest uppercase text-[10px]">Processing...</p>
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