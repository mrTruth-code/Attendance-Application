"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Plus,
  Calendar,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Radio,
  Wifi,
  Share2,
  Lock,
  History
} from "lucide-react";
import { Card, Button, Input, cn, Badge, Modal } from "./components";

interface AttendanceRecord {
  id: string;
  studentName: string;
  studentId: string;
  timestamp: string;
  day: string;
  sessionId: string;
  sessionName: string;
}

interface SessionInfo {
  id: string;
  name: string;
}

function HomeContent() {
  const searchParams = useSearchParams();

  // Auth & Flow State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isStudentDone, setIsStudentDone] = useState(false);

  // Data State
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  // Student Input State
  const [studentProfile, setStudentProfile] = useState({ name: "", id: "" });
  const [localScannedSession, setLocalScannedSession] = useState<SessionInfo | null>(null);

  // Refs
  const recordsRef = useRef(records);
  useEffect(() => { recordsRef.current = records; }, [records]);

  // Modals
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [newSessionName, setNewSessionName] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Hydration
  useEffect(() => { setHasMounted(true); }, []);

  // Sync Logic
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/sync");
      const data = await res.json();
      setRecords(data.records || []);
      setCurrentSession(data.activeSession);
      setIsOnline(true);
    } catch (e) {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Identify Student Mode via URL
  const isStudentLink = useMemo(() => {
    const sId = searchParams.get("sessionID");
    const sName = searchParams.get("sessionName");
    if (sId && sName) {
      setLocalScannedSession({ id: sId, name: sName });
      return true;
    }
    return false;
  }, [searchParams]);

  // Load Student Profile from LocalStorage (for convenience)
  useEffect(() => {
    const savedProfile = localStorage.getItem("attendance_student_profile");
    if (savedProfile) {
      try { setStudentProfile(JSON.parse(savedProfile)); } catch (e) { }
    }
  }, []);

  // Save Student Profile
  useEffect(() => {
    if (studentProfile.name || studentProfile.id) {
      localStorage.setItem("attendance_student_profile", JSON.stringify(studentProfile));
    }
  }, [studentProfile]);

  const submitAttendance = useCallback(async (session: SessionInfo, profile: { name: string; id: string }) => {
    if (!profile.name || !profile.id) return;

    const isDuplicate = recordsRef.current.some(
      (r: AttendanceRecord) => r.studentId === profile.id && r.sessionId === session.id
    );

    if (isDuplicate) {
      setErrorMessage("You have already marked your attendance for this session.");
      setIsErrorModalOpen(true);
      return;
    }

    setIsSyncing(true);
    const newRecord: AttendanceRecord = {
      id: Math.random().toString(36).substring(7),
      studentName: profile.name,
      studentId: profile.id,
      timestamp: new Date().toISOString(),
      day: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date()),
      sessionId: session.id,
      sessionName: session.name,
    };

    try {
      await fetch("/api/sync", {
        method: "POST",
        body: JSON.stringify({ action: "ADD_RECORD", payload: newRecord }),
      });
      setIsStudentDone(true); // Kick-out
    } catch (e) {
      setErrorMessage("Network error. Could not register.");
      setIsErrorModalOpen(true);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handleAdminLogin = () => {
    if (adminPassword === "admin123") {
      setIsAdminLoggedIn(true);
    } else {
      alert("Invalid Password");
    }
  };

  const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const exportToCSV = useCallback(() => {
    if (records.length === 0) return;
    const sortedRecords = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const headers = ["Week", "Day", "Time", "Student Name", "Student ID", "Session Name"];
    const rows = sortedRecords.map((r: AttendanceRecord) => {
      const date = new Date(r.timestamp);
      return [
        `Week ${getWeekNumber(date)}`,
        r.day,
        date.toLocaleTimeString(),
        r.studentName,
        r.studentId,
        r.sessionName
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_logs_weekly.csv`;
    link.click();
  }, [records]);

  // Admin Actions
  const createSession = useCallback(async () => {
    if (!newSessionName.trim()) return;
    const session: SessionInfo = { id: "session_" + Date.now(), name: newSessionName };
    await fetch("/api/sync", {
      method: "POST",
      body: JSON.stringify({ action: "SET_SESSION", payload: session }),
    });
    fetchState();
    setIsSessionModalOpen(false);
  }, [newSessionName, fetchState]);

  const removeSession = useCallback(async () => {
    await fetch("/api/sync", {
      method: "POST",
      body: JSON.stringify({ action: "CLEAR_SESSION" }),
    });
    fetchState();
  }, [fetchState]);

  const deleteRecord = useCallback(async (id: string) => {
    if (confirm("Are you sure?")) {
      await fetch("/api/sync", {
        method: "POST",
        body: JSON.stringify({ action: "DELETE_RECORD", payload: id }),
      });
      fetchState();
    }
  }, [fetchState]);

  const startSessionCreation = () => {
    setNewSessionName("");
    setIsSessionModalOpen(true);
  }

  const groupedRecords = useMemo(() => {
    return records.reduce((acc: Record<string, AttendanceRecord[]>, record: AttendanceRecord) => {
      if (!acc[record.day]) acc[record.day] = [];
      acc[record.day].push(record);
      return acc;
    }, {} as Record<string, AttendanceRecord[]>);
  }, [records]);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  if (!hasMounted) return null;

  // 1. Student Kicked Out Screen
  if (isStudentDone) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center space-y-8 animate-in fade-in duration-700">
        <div className="w-48 h-48 rounded-full bg-green-500/10 flex items-center justify-center border-4 border-green-500/20 shadow-2xl shadow-green-500/20">
          <CheckCircle2 className="w-24 h-24 text-green-500" />
        </div>
        <div className="space-y-4">
          <h1 className="text-5xl font-black tracking-tighter uppercase italic text-primary">Registration Complete</h1>
          <p className="text-muted-foreground text-2xl">Your attendance has been logged.</p>
          <p className="text-sm text-zinc-400 uppercase tracking-[0.3em] font-bold">You may close this window.</p>
        </div>
      </div>
    );
  }

  // 2. Student Form (Direct Access)
  if (localScannedSession) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
        <Card className="w-full max-w-lg p-10 space-y-12 border-primary/20 shadow-2xl rounded-[3rem] bg-card/50 backdrop-blur-xl animate-in zoom-in-95 duration-500">
          <div className="space-y-4 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl mx-auto flex items-center justify-center text-primary mb-6 border border-primary/20">
              <User className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black tracking-tight uppercase italic">{localScannedSession.name}</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-xs font-bold">Verify your identity to join</p>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-4 tracking-widest">Full Name</label>
              <Input
                placeholder="e.g. John Doe"
                className="h-20 text-xl px-10 rounded-[2rem] bg-zinc-50 dark:bg-zinc-900 border-none font-black shadow-inner"
                value={studentProfile.name}
                onChange={(e) => setStudentProfile({ ...studentProfile, name: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-4 tracking-widest">Student ID</label>
              <Input
                placeholder="e.g. 123456"
                className="h-20 text-xl px-10 rounded-[2rem] bg-zinc-50 dark:bg-zinc-900 border-none font-black shadow-inner"
                value={studentProfile.id}
                onChange={(e) => setStudentProfile({ ...studentProfile, id: e.target.value })}
              />
            </div>
          </div>

          <Button
            onClick={() => submitAttendance(localScannedSession!, studentProfile)}
            disabled={isSyncing}
            className="w-full h-24 grad-bg border-none text-2xl font-black text-white rounded-[2rem] shadow-2xl shadow-primary/30 hover:scale-[1.02] transition-transform"
          >
            {isSyncing ? "VERIFYING..." : "CONFIRM ATTENDANCE"}
          </Button>
        </Card>
      </div>
    );
  }

  // 3. Admin Login (Default)
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md p-12 space-y-12 rounded-[3.5rem] shadow-2xl border-white/5 relative overflow-hidden bg-white dark:bg-zinc-950 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-purple-600"></div>
          <div className="text-center space-y-6">
            <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto text-primary border-4 border-primary/5">
              <Lock className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic">Admin Access</h1>
              <p className="text-muted-foreground font-medium mt-2">Restricted system.</p>
            </div>
          </div>
          <div className="space-y-8">
            <Input
              type="password"
              placeholder="Password"
              className="h-20 text-xl px-10 rounded-[2rem] bg-zinc-50 dark:bg-zinc-900 border-none font-black text-center tracking-widest shadow-inner focus:ring-4 ring-primary/20"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
            />
            <Button onClick={handleAdminLogin} className="w-full h-20 grad-bg border-none text-xl font-black text-white rounded-[2rem] shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
              AUTHENTICATE
            </Button>
          </div>
          <p className="text-center text-[10px] text-zinc-300 uppercase tracking-[0.3em] font-bold">Secure_Node_V1</p>
        </Card>
      </div>
    );
  }

  // 4. Admin Dashboard
  return (
    <div className="min-h-screen bg-background font-sans transition-colors duration-500">
      <nav className="border-b bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer">
            <div className="w-12 h-12 grad-bg rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <span className="font-extrabold text-3xl tracking-tighter">Admin<span className="text-primary font-black">Console</span></span>
          </div>
          <div className="flex items-center gap-6">
            <Button variant="ghost" onClick={() => setIsAdminLoggedIn(false)} className="rounded-2xl font-bold text-destructive hover:bg-destructive/10">
              LOGOUT
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-16">
        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-12 duration-700">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10 bg-card/40 p-10 rounded-[3rem] border border-border backdrop-blur-md">
            <div>
              <h2 className="text-6xl font-black tracking-tighter uppercase italic">Control</h2>
              <div className="flex gap-3 mt-2">
                <Badge variant="primary" className="px-4 py-1.5">{records.length} Logs</Badge>
              </div>
            </div>
            <div className="flex gap-4 w-full lg:w-auto">
              <Button variant="outline" onClick={exportToCSV} className="h-20 px-10 rounded-[1.5rem] font-black border-2 border-border flex gap-3 text-lg flex-1 lg:flex-none">
                <Download className="w-6 h-6" /> DATA DUMP (WEEKLY)
              </Button>
              <Button onClick={startSessionCreation} className="grad-bg border-none h-20 px-12 text-xl font-black shadow-2xl shadow-primary/40 rounded-[1.5rem] text-white flex-1 lg:flex-none">
                <Plus className="w-7 h-7 mr-2" /> NEW BROADCAST
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <Card className="lg:col-span-4 flex flex-col items-center justify-center p-14 space-y-10 h-fit sticky top-32 shadow-2xl border-primary/20 bg-card rounded-[3.5rem]">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-primary animate-ping"></div>
                <h3 className="font-black text-2xl uppercase tracking-widest italic text-primary">Live Signal</h3>
              </div>
              {currentSession ? (
                <div className="space-y-10 w-full flex flex-col items-center">
                  <div className="p-10 bg-white rounded-[4rem] border-8 border-zinc-100 shadow-2xl animate-in zoom-in-75">
                    <QRCodeCanvas
                      id="qr-code-canvas"
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?sessionID=${currentSession.id}&sessionName=${encodeURIComponent(currentSession.name)}`}
                      size={240}
                      level="H"
                    />
                  </div>
                  <div className="w-full bg-secondary p-8 rounded-[2.5rem] text-center border border-primary/10">
                    <p className="text-3xl font-black uppercase italic tracking-tight">{currentSession.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground mt-4 opacity-40">Session ID: {currentSession.id.slice(-8)}</p>
                  </div>

                  <div className="w-full p-6 bg-zinc-950 text-white rounded-[2rem] space-y-4">
                    <div className="flex items-center gap-2 opacity-50">
                      <Wifi className="w-4 h-4" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Network Node</p>
                    </div>
                    <p className="text-xs font-medium leading-relaxed">Students scan this QR with their <span className="text-primary font-black">Phone Camera</span> to open the registration form instantly.</p>
                  </div>

                  <Button variant="outline" size="lg" onClick={async () => {
                    const url = `${window.location.origin}/?sessionID=${currentSession.id}&sessionName=${encodeURIComponent(currentSession.name)}`;
                    const canvas = document.getElementById("qr-code-canvas") as HTMLCanvasElement;

                    if (canvas) {
                      canvas.toBlob(async (blob) => {
                        if (!blob) return;
                        const file = new File([blob], "attendance_qr.png", { type: "image/png" });

                        if (navigator.share && navigator.canShare({ files: [file] })) {
                          try {
                            await navigator.share({
                              title: 'Join Attendance',
                              text: `Scan to join ${currentSession.name}`,
                              files: [file],
                              url
                            });
                          } catch (e) {
                            console.error("Share failed", e);
                          }
                        } else {
                          const link = document.createElement('a');
                          link.href = canvas.toDataURL("image/png");
                          link.download = `qr_${currentSession.name.replace(/\s+/g, '_')}.png`;
                          link.click();

                          await navigator.clipboard.writeText(url);
                          alert("QR Image Downloaded & Link Copied!");
                        }
                      });
                    } else {
                      await navigator.clipboard.writeText(url);
                      alert("Link Copied (QR Image unavailable)");
                    }
                  }} className="w-full h-18 rounded-2xl font-black border-primary/30 text-primary hover:bg-primary hover:text-white transition-all uppercase text-xs mb-4">
                    <Share2 className="w-5 h-5 mr-2" /> SHARE SIGNAL
                  </Button>
                  <Button variant="outline" size="lg" onClick={removeSession} className="w-full h-18 rounded-2xl font-black border-destructive/30 text-destructive hover:bg-destructive hover:text-white transition-all uppercase text-xs">TERMINATE SIGNAL</Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 w-full border-4 border-dashed border-border rounded-[4rem] p-12 bg-zinc-100/30">
                  <Radio className="w-16 h-16 opacity-10 mb-8 animate-pulse text-zinc-950" />
                  <p className="text-3xl font-black text-muted-foreground uppercase italic tracking-tighter">Null Space</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] mt-3 opacity-30 text-center">Initalize a broadcast to <br /> capture student pings</p>
                </div>
              )}
            </Card>

            <div className="lg:col-span-8 space-y-12">
              <Card className="p-12 space-y-12 shadow-2xl border-border rounded-[3.5rem] bg-card/50">
                <h3 className="font-black text-4xl tracking-tighter uppercase italic">Cloud Logs</h3>
                <div className="space-y-16">
                  {records.length === 0 ? (
                    <div className="text-center py-32 text-muted-foreground">
                      <History className="w-16 h-16 opacity-10 mx-auto mb-10" />
                      <p className="text-5xl font-black text-zinc-300 uppercase italic">Empty Queue</p>
                    </div>
                  ) : (
                    days.map((day: string) => {
                      const dayRecords = groupedRecords[day] || [];
                      if (dayRecords.length === 0) return null;
                      return (
                        <div key={day} className="space-y-10">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground flex items-center gap-6">
                            <Calendar className="w-6 h-6 text-primary" /> {day}
                            <span className="h-0.5 flex-1 bg-border/50"></span>
                          </h4>
                          <div className="grid gap-6">
                            {dayRecords.map((record: AttendanceRecord) => (
                              <div key={record.id} className="flex items-center justify-between p-8 rounded-[2.5rem] bg-background border-2 border-transparent hover:border-primary/40 transition-all hover:shadow-xl group relative overflow-hidden backdrop-blur-sm">
                                <div className="flex items-center gap-8">
                                  <div className="w-16 h-16 rounded-[1.2rem] bg-secondary flex items-center justify-center border shadow-sm group-hover:grad-bg group-hover:text-white transition-all">
                                    <User className="w-8 h-8 text-primary group-hover:text-white" />
                                  </div>
                                  <div>
                                    <p className="font-black text-2xl tracking-tight uppercase italic">{record.studentName}</p>
                                    <div className="flex items-center gap-4 mt-1">
                                      <p className="text-xs text-muted-foreground font-black tracking-widest uppercase">{record.studentId}</p>
                                      <p className="text-xs text-primary font-black tracking-widest bg-primary/10 px-3 py-1 rounded-full uppercase">{record.sessionName}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-8">
                                  <p className="text-3xl font-black opacity-80 italic italic">{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  <Button variant="ghost" size="icon" onClick={() => deleteRecord(record.id)} className="h-16 w-16 rounded-[1.2rem] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100">
                                    <Trash2 className="w-7 h-7" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Admin Session Modal */}
      <Modal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} title="CREATE_BROADCAST">
        <div className="space-y-8 p-4">
          <Input placeholder="Session Name (e.g. Lab 4B)" className="h-20 text-3xl px-8 rounded-[1.5rem] bg-zinc-50 border-none font-black shadow-inner" value={newSessionName} onChange={(e) => setNewSessionName(e.target.value)} />
          <Button onClick={createSession} className="w-full h-20 grad-bg border-none font-black text-2xl rounded-[1.5rem] text-white">GENERATE SIGNAL</Button>
        </div>
      </Modal>

      {/* Error Modal */}
      <Modal isOpen={isErrorModalOpen} onClose={() => setIsErrorModalOpen(false)} title="SYNC_EXCEPTION">
        <div className="flex flex-col items-center py-10 text-center space-y-10">
          <AlertCircle className="w-24 h-24 text-destructive" />
          <h3 className="text-4xl font-black text-destructive uppercase italic">Upload Failed</h3>
          <p className="text-muted-foreground text-xl font-medium leading-relaxed">{errorMessage}</p>
          <Button onClick={() => setIsErrorModalOpen(false)} className="w-full h-18 bg-destructive text-white font-black text-xl rounded-2xl border-none uppercase tracking-widest">Retry</Button>
        </div>
      </Modal>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
