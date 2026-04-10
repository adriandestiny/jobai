"use client";

import { useEffect, useState, useRef } from "react";

interface GeneratedResult {
  tailoredCV: string;
  coverLetter: string;
}

type ActiveTab = "cv" | "cover";

export default function JobApplyForm() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvText, setCvText] = useState("");
  const [cvInputMode, setCvInputMode] = useState<"file" | "text">("file");
  const [jobDescription, setJobDescription] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [minimaxApiKey, setMinimaxApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("cv");
  const [copied, setCopied] = useState<"cv" | "cover" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedKey = sessionStorage.getItem("minimaxApiKey");
    if (storedKey) {
      setMinimaxApiKey(storedKey);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCvFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === "application/pdf" || file.name.endsWith(".txt") || file.name.endsWith(".doc"))) {
      setCvFile(file);
    }
  };

  const handleReferenceFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const supportedFiles = files.filter((file) => {
      const lowerName = file.name.toLowerCase();
      return lowerName.endsWith(".pdf") || lowerName.endsWith(".txt") || lowerName.endsWith(".md");
    });
    setReferenceFiles(supportedFiles);
  };

  const handleGenerate = async () => {
    setError("");
    setResult(null);

    if (!jobDescription.trim()) {
      setError("Please enter a job description.");
      return;
    }
    if (cvInputMode === "file" && !cvFile) {
      setError("Please upload your CV.");
      return;
    }
    if (cvInputMode === "text" && !cvText.trim()) {
      setError("Please paste your CV content.");
      return;
    }
    if (!minimaxApiKey.trim()) {
      setError("Please enter your MiniMax API key.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("jobDescription", jobDescription);
      if (minimaxApiKey.trim()) {
        formData.append("minimaxApiKey", minimaxApiKey.trim());
      }
      if (cvInputMode === "file" && cvFile) {
        formData.append("cv", cvFile);
      } else {
        formData.append("cvText", cvText);
      }

      for (const file of referenceFiles) {
        formData.append("references", file);
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setResult(data);
      setActiveTab("cv");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (type: "cv" | "cover") => {
    const text = type === "cv" ? result?.tailoredCV : result?.coverLetter;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = (type: "cv" | "cover") => {
    const text = type === "cv" ? result?.tailoredCV : result?.coverLetter;
    const filename = type === "cv" ? "tailored-cv.txt" : "cover-letter.txt";
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            CV
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">JobFit AI</h1>
            <p className="text-xs text-gray-400">Tailored CVs & Cover Letters</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {!result ? (
          <div className="space-y-8">
            {/* Hero */}
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-white">
                Land your next job with a{" "}
                <span className="text-indigo-400">tailored application</span>
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Upload your CV and optional references, then paste the job description to generate a fact-grounded CV and cover letter.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* CV Input */}
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">Your CV</h3>
                  <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                    <button
                      onClick={() => setCvInputMode("file")}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        cvInputMode === "file"
                          ? "bg-indigo-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Upload
                    </button>
                    <button
                      onClick={() => setCvInputMode("text")}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        cvInputMode === "text"
                          ? "bg-indigo-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Paste
                    </button>
                  </div>
                </div>

                {cvInputMode === "file" ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      cvFile
                        ? "border-indigo-500 bg-indigo-950/30"
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {cvFile ? (
                      <div className="space-y-2">
                        <div className="text-2xl">📄</div>
                        <p className="text-sm font-medium text-indigo-300">{cvFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(cvFile.size / 1024).toFixed(1)} KB
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setCvFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-3xl">⬆️</div>
                        <p className="text-sm text-gray-400">
                          Drop your CV here or <span className="text-indigo-400">browse</span>
                        </p>
                        <p className="text-xs text-gray-600">PDF, TXT, DOC supported</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={cvText}
                    onChange={(e) => setCvText(e.target.value)}
                    placeholder="Paste your CV content here..."
                    className="w-full h-52 bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                )}
              </div>

              {/* Job Description */}
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-4">
                <h3 className="font-semibold text-white">Job Description</h3>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here — role requirements, responsibilities, company info..."
                  className="w-full h-40 bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
                />

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white">MiniMax API Key</h4>
                  <input
                    type="password"
                    value={minimaxApiKey}
                    onChange={(e) => {
                      const nextKey = e.target.value;
                      setMinimaxApiKey(nextKey);
                      sessionStorage.setItem("minimaxApiKey", nextKey);
                    }}
                    placeholder="Enter your MiniMax API key"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    autoComplete="off"
                  />
                  <p className="text-xs text-gray-500">Stored in your browser session only and cleared when the session ends.</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white">Optional reference documents</h4>
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    multiple
                    onChange={handleReferenceFilesChange}
                    className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-gray-200 hover:file:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500">Upload certificates, recommendations, portfolios, or project notes (PDF, TXT, MD).</p>
                  {referenceFiles.length > 0 && (
                    <ul className="space-y-1 text-xs text-gray-400">
                      {referenceFiles.map((file) => (
                        <li key={`${file.name}-${file.size}`}>• {file.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-800 text-red-300 rounded-xl px-5 py-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-center">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Tailored Documents"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={() => setResult(null)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Back to inputs
            </button>

            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-white">Your documents are ready!</h2>
              <p className="text-gray-400 text-sm">Tailored specifically for this job application</p>
            </div>

            {/* Tabs */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="flex border-b border-gray-800">
                <button
                  onClick={() => setActiveTab("cv")}
                  className={`flex-1 py-4 text-sm font-medium transition-colors ${
                    activeTab === "cv"
                      ? "text-white bg-gray-800/50 border-b-2 border-indigo-500"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Tailored CV
                </button>
                <button
                  onClick={() => setActiveTab("cover")}
                  className={`flex-1 py-4 text-sm font-medium transition-colors ${
                    activeTab === "cover"
                      ? "text-white bg-gray-800/50 border-b-2 border-indigo-500"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Cover Letter
                </button>
              </div>

              <div className="p-6">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => handleCopy(activeTab)}
                    className="px-4 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                  >
                    {copied === activeTab ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={() => handleDownload(activeTab)}
                    className="px-4 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                  >
                    Download .txt
                  </button>
                </div>

                <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed font-sans bg-gray-800/50 rounded-xl p-5 max-h-[600px] overflow-y-auto">
                  {activeTab === "cv" ? result.tailoredCV : result.coverLetter}
                </pre>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setResult(null)}
                className="px-6 py-2 text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-800 rounded-xl transition-colors"
              >
                Generate for another job
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
