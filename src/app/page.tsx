"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams } from "next/navigation";
import {
  Scan,
  LayoutDashboard,
  UserCheck,
  History,
  User,
  ChevronRight,
  Plus,
  Calendar,
  Monitor,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Settings2,
  Radio,
  Wifi
} from "lucide-react";
import { Card, Button, Input, cn, Badge, Modal } from "./components";
import { Scanner } from "./scanner";

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
  const [view, setView] = useState<"landing" | "student" | "admin">("landing");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [scanning, setScanning] = useState(false);
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  // Student Profile
  const [studentProfile, setStudentProfile] = useState({ name: "", id: "" });
  const [manualSessionName, setManualSessionName] = useState("");
  const [studentFlow, setStudentFlow] = useState<"choice" | "scan" | "manual">("choice");
  const [localScannedSession, setLocalScannedSession] = useState<SessionInfo | null>(null);

  // REFS for stable callbacks
  const profileRef = useRef(studentProfile);
  const recordsRef = useRef(records);
  useEffect(() => { profileRef.current = studentProfile; }, [studentProfile]);
  useEffect(() => { recordsRef.current = records; }, [records]);

  // Modals & Feedback
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Hydration safety
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Deep linking from URL params
  useEffect(() => {
    const sId = searchParams.get("sessionID");
    const sName = searchParams.get("sessionName");
    if (sId && sName) {
      setLocalScannedSession({ id: sId, name: sName });
      setView("student");
      setStudentFlow("scan");
    }
  }, [searchParams]);

  // Sync Logic: Polling the server every 3 seconds
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

  // Load profile from localStorage (this remains local to device)
  useEffect(() => {
    const savedProfile = localStorage.getItem("attendance_student_profile");
    if (savedProfile) {
      try {
        setStudentProfile(JSON.parse(savedProfile));
      } catch (e) { }
    }
  }, []);

  // Sync profile to localStorage
  useEffect(() => {
    if (studentProfile.name || studentProfile.id) {
      localStorage.setItem("attendance_student_profile", JSON.stringify(studentProfile));
    }
  }, [studentProfile]);

  const submitAttendance = useCallback(async (session: SessionInfo, profile: { name: string; id: string }) => {
    if (!profile.name || !profile.id || !session.name) return;

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
      sessionId: session.id || "manual_" + Date.now(),
      sessionName: session.name,
    };

    try {
      await fetch("/api/sync", {
        method: "POST",
        body: JSON.stringify({ action: "ADD_RECORD", payload: newRecord }),
      });
      await fetchState();
      setIsSuccessModalOpen(true);
      setStudentFlow("choice");
      setLocalScannedSession(null);
      setManualSessionName("");
    } catch (e) {
      setErrorMessage("Network error. Could not register.");
      setIsErrorModalOpen(true);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchState]);

  const handleScan = useCallback((data: string) => {
    let session: SessionInfo | null = null;
    try {
      const parsed = JSON.parse(data);
      if (parsed.id && parsed.name) session = parsed;
    } catch (e) {
      if (data.startsWith("session_")) session = { id: data, name: "General Session" };
    }

    if (session) {
      setScanning(false);
      if (profileRef.current.name && profileRef.current.id) {
        submitAttendance(session, profileRef.current);
      } else {
        setLocalScannedSession(session);
        setStudentFlow("scan");
      }
    } else {
      setErrorMessage("Invalid QR Code.");
      setIsErrorModalOpen(true);
    }
  }, [submitAttendance]);

  const handleManualSubmit = () => {
    if (!manualSessionName || !studentProfile.name || !studentProfile.id) {
      setErrorMessage("Please fill in all details.");
      setIsErrorModalOpen(true);
      return;
    }
    submitAttendance({ id: "manual_" + Date.now(), name: manualSessionName }, studentProfile);
  };

  const startSessionCreation = useCallback(() => {
    setNewSessionName("");
    setIsSessionModalOpen(true);
  }, []);

  const clearAllLogs = useCallback(async () => {
    if (confirm("CRITICAL: This will permanently delete ALL attendance logs from the cloud. Proceed?")) {
      await fetch("/api/sync", {
        method: "POST",
        body: JSON.stringify({ action: "CLEAR_RECORDS" }),
      });
      fetchState();
    }
  }, [fetchState]);

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

  const exportToCSV = useCallback(() => {
    if (records.length === 0) return;
    const headers = ["Student Name", "Student ID", "Session Name", "Day", "Time"];
    const rows = records.map((r: AttendanceRecord) => [r.studentName, r.studentId, r.sessionName, r.day, new Date(r.timestamp).toLocaleTimeString()]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_logs.csv`;
    link.click();
  }, [records]);

  const groupedRecords = useMemo(() => {
    return records.reduce((acc: Record<string, AttendanceRecord[]>, record: AttendanceRecord) => {
      if (!acc[record.day]) acc[record.day] = [];
      acc[record.day].push(record);
      return acc;
    }, {} as Record<string, AttendanceRecord[]>);
  }, [records]);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  if (!hasMounted) return null;

  return (
    <div className="min-h-screen bg-background font-sans transition-colors duration-500">
      {/* Navigation */}
      <nav className="border-b bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView("landing")}>
            <div className="w-12 h-12 grad-bg rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 rotate-3 transform hover:rotate-0 transition-all duration-500">
              <UserCheck className="w-7 h-7 text-white" />
            </div>
            <span className="font-extrabold text-3xl tracking-tighter">Attend<span className="text-primary font-black">QR</span></span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500 animate-pulse" : "bg-red-500")}></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{isOnline ? "Live Sync" : "Sync Error"}</span>
            </div>
            <div className="flex gap-4">
              <Button variant="ghost" onClick={() => { setView("student"); setStudentFlow("choice"); }} className={cn("rounded-2xl font-black px-6 tracking-wide", view === "student" && "bg-secondary text-primary")}>
                Student
              </Button>
              <Button variant="ghost" onClick={() => setView("admin")} className={cn("rounded-2xl font-black px-6 tracking-wide", view === "admin" && "bg-secondary text-primary")}>
                Admin
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-16">
        {view === "landing" && (
          <div className="flex flex-col items-center text-center space-y-16 py-12">
            <div className="space-y-6 max-w-4xl">
              <Badge className="mb-6 px-4 py-1 flex items-center gap-2 mx-auto">
                <Wifi className="w-3 h-3 text-primary" /> CLOUD SYNC ACTIVE
              </Badge>
              <h1 className="text-7xl md:text-8xl font-black tracking-tighter grad-text leading-tight md:leading-[0.9] pb-4">
                Real-Time <br /> Attendance.
              </h1>
              <p className="text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium italic">
                Shared records, live sessions, and absolute precision.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-5xl">
              <Card className="group cursor-pointer border-2 border-transparent hover:border-primary/30 transition-all duration-700 transform hover:-translate-y-4 rounded-[3rem] bg-card/60" onClick={() => { setView("student"); setStudentFlow("choice"); }}>
                <div className="flex flex-col items-center space-y-8 p-14 text-center">
                  <div className="p-10 rounded-[2.5rem] bg-secondary group-hover:grad-bg transition-all duration-700 shadow-xl group-hover:shadow-primary/20">
                    <User className="w-16 h-16 text-primary group-hover:text-white" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-3xl font-black tracking-tight">Student Portal</h3>
                    <p className="text-muted-foreground text-lg italic">Scan the live session QR or join using your saved profile.</p>
                  </div>
                </div>
              </Card>
              <Card className="group cursor-pointer border-2 border-transparent hover:border-accent/30 transition-all duration-700 transform hover:-translate-y-4 rounded-[3rem] bg-card/60" onClick={() => setView("admin")}>
                <div className="flex flex-col items-center space-y-8 p-14 text-center">
                  <div className="p-10 rounded-[2.5rem] bg-purple-50 dark:bg-zinc-800/50 group-hover:bg-accent transition-all duration-700 shadow-xl group-hover:shadow-accent/20">
                    <LayoutDashboard className="w-16 h-16 text-accent group-hover:text-white" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-3xl font-black tracking-tight">Admin Console</h3>
                    <p className="text-muted-foreground text-lg italic">Start live broadcasts and track verified student pings.</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {view === "student" && (
          <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-12 duration-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Button variant="ghost" size="icon" onClick={() => { if (studentFlow === "choice") setView("landing"); else setStudentFlow("choice"); }} className="rounded-[1.5rem] h-16 w-16 bg-white dark:bg-zinc-900 shadow-lg border border-border">
                  <ChevronRight className="w-8 h-8 rotate-180" />
                </Button>
                <h2 className="text-5xl font-black tracking-tighter">Identity</h2>
              </div>
              <Button variant="outline" className="h-16 px-6 rounded-2xl border-border hover:bg-secondary flex gap-2 font-black" onClick={() => setIsProfileModalOpen(true)}>
                <Settings2 className="w-5 h-5 text-primary" /> PROFILE
              </Button>
            </div>

            {currentSession && studentFlow === "choice" && (
              <Card className="p-10 border-2 border-primary/30 bg-primary/5 rounded-[3.5rem] animate-in zoom-in-95 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden group shadow-2xl shadow-primary/10">
                <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12">
                  <Radio className="w-32 h-32 text-primary animate-pulse" />
                </div>

                <div className="w-48 h-48 bg-white p-4 rounded-[2.5rem] shadow-xl border-4 border-primary/10 flex-shrink-0 animate-in fade-in slide-in-from-left-4 duration-700 relative z-10">
                  <QRCodeSVG value={JSON.stringify(currentSession)} size={160} level="H" />
                </div>

                <div className="flex-1 text-center md:text-left space-y-6 relative z-10">
                  <div className="space-y-2">
                    <div className="flex items-center justify-center md:justify-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
                      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">Live Session Broadcast</p>
                    </div>
                    <h3 className="text-5xl font-black tracking-tight uppercase italic grad-text">{currentSession.name}</h3>
                  </div>
                  <div className="flex gap-3">
                    <Button className="flex-1 grad-bg border-none h-18 text-xl font-black rounded-2xl shadow-lg shadow-primary/20 text-white transform hover:scale-105 transition-all" onClick={() => {
                      if (studentProfile.name && studentProfile.id) submitAttendance(currentSession, studentProfile);
                      else setStudentFlow("scan");
                    }}>
                      {studentProfile.name ? "INSTANT SIGN-IN" : "VERIFY & JOIN"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-40">
                    ID: {currentSession.id.slice(-12)} • Cloud Linked
                  </p>
                </div>
              </Card>
            )}

            {studentFlow === "choice" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in-95 duration-500">
                <Card className="group cursor-pointer p-12 text-center space-y-8 border-2 border-transparent hover:border-primary/40 transition-all rounded-[3rem] bg-card/40 backdrop-blur-xl flex flex-col items-center" onClick={() => setStudentFlow("scan")}>
                  <div className="w-24 h-24 rounded-[2.5rem] bg-secondary flex items-center justify-center text-primary group-hover:grad-bg group-hover:text-white transition-all duration-700 shadow-inner group-hover:rotate-12">
                    <Scan className="w-12 h-12" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-3xl font-black tracking-tight">Optical Scan</h3>
                    <p className="text-muted-foreground text-lg">Use the lens to scan a physical or remote QR code.</p>
                  </div>
                </Card>
                <Card className="group cursor-pointer p-12 text-center space-y-8 border-2 border-transparent hover:border-accent/40 transition-all rounded-[3rem] bg-card/40 backdrop-blur-xl flex flex-col items-center" onClick={() => setStudentFlow("manual")}>
                  <div className="w-24 h-24 rounded-[2.5rem] bg-purple-50 dark:bg-zinc-800/50 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all duration-700 shadow-inner group-hover:-rotate-12">
                    <FileText className="w-12 h-12" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-3xl font-black tracking-tight">Manual Port</h3>
                    <p className="text-muted-foreground text-lg">Manually register for a class using provided subject details.</p>
                  </div>
                </Card>
              </div>
            )}

            {studentFlow === "scan" && (
              <Card className="flex flex-col items-center p-12 sm:p-24 text-center space-y-12 relative overflow-hidden group border-primary/10 bg-card/40 backdrop-blur-xl rounded-[3.5rem]">
                {localScannedSession ? (
                  <div className="w-full space-y-10 animate-in slide-in-from-bottom-8 duration-500">
                    <div className="space-y-4">
                      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mx-auto border-2 border-primary/20">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <h3 className="text-4xl font-black tracking-tight uppercase italic">{localScannedSession.name} Identified</h3>
                      <p className="text-muted-foreground">Complete your registration for this session below.</p>
                    </div>

                    <div className="space-y-6 text-left max-w-md mx-auto">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Your Full Name</label>
                        <Input placeholder="Enter Name" className="h-16 text-xl px-8 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border-none font-black" value={studentProfile.name} onChange={(e) => setStudentProfile({ ...studentProfile, name: e.target.value })} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Your Student ID</label>
                        <Input placeholder="Enter Student ID" className="h-16 text-xl px-8 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border-none font-black" value={studentProfile.id} onChange={(e) => setStudentProfile({ ...studentProfile, id: e.target.value })} />
                      </div>
                      <Button className="w-full grad-bg border-none h-20 text-2xl font-black rounded-3xl text-white shadow-2xl shadow-primary/20 mt-6" onClick={() => submitAttendance(localScannedSession, studentProfile)} disabled={isSyncing}>
                        {isSyncing ? "UPLOADING..." : "VERIFY & SUBMIT"}
                      </Button>
                      <Button variant="ghost" className="w-full text-zinc-400 font-bold tracking-widest uppercase text-xs mt-2" onClick={() => setLocalScannedSession(null)}>
                        Rescan QR Code
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-28 h-28 rounded-[2.5rem] bg-secondary flex items-center justify-center text-primary relative z-10 shadow-inner">
                      <Scan className="w-16 h-16" />
                    </div>
                    <div className="space-y-4 relative z-10">
                      <h3 className="text-4xl font-black tracking-tight uppercase italic">Optical Verification</h3>
                      <p className="text-muted-foreground text-xl">Point your phone's camera at the broadcast QR code.</p>
                    </div>
                    <div className="w-full space-y-4 relative z-10">
                      <Button size="lg" className="w-full grad-bg border-none h-20 text-2xl font-black shadow-2xl shadow-primary/30 rounded-3xl text-white" onClick={() => setScanning(true)}>
                        IDENTIFY QR
                      </Button>
                      <Button variant="ghost" className="w-full text-zinc-400 font-bold tracking-widest uppercase text-xs" onClick={() => setStudentFlow("manual")}>
                        Switch to Manual entry
                      </Button>
                    </div>
                  </>
                )}
                {scanning && <Scanner onScan={handleScan} onClose={() => setScanning(false)} />}
              </Card>
            )}

            {studentFlow === "manual" && (
              <Card className="p-14 space-y-12 backdrop-blur-3xl border-primary/30 rounded-[3.5rem] animate-in slide-in-from-right-12 duration-700">
                <div className="space-y-2 border-l-4 border-indigo-500 pl-8 py-2">
                  <h3 className="text-5xl font-black tracking-tighter uppercase italic">Manual Node</h3>
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">Fill in the session data manually</p>
                </div>
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-xs font-black text-muted-foreground uppercase px-2">Session Name</label>
                    <Input placeholder="e.g. Science Lab" className="h-20 text-2xl px-10 rounded-3xl bg-zinc-100/50 dark:bg-zinc-800/50 border-none font-black" value={manualSessionName} onChange={(e) => setManualSessionName(e.target.value)} />
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-black text-muted-foreground uppercase px-2">Student Identity</label>
                    <Input placeholder="Full Name" className="h-20 text-2xl px-10 rounded-3xl bg-zinc-100/50 dark:bg-zinc-800/50 border-none font-black" value={studentProfile.name} onChange={(e) => setStudentProfile({ ...studentProfile, name: e.target.value })} />
                    <Input placeholder="Student ID" className="h-20 text-2xl px-10 rounded-3xl bg-zinc-100/50 dark:bg-zinc-800/50 border-none font-black mt-4" value={studentProfile.id} onChange={(e) => setStudentProfile({ ...studentProfile, id: e.target.value })} />
                  </div>
                  <Button className="w-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 h-20 text-2xl font-black rounded-3xl" onClick={handleManualSubmit}>
                    SUBMIT REGISTRATION
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {view === "admin" && (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-12 duration-700">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-10 bg-card/40 p-10 rounded-[3rem] border border-border backdrop-blur-md">
              <div className="flex items-center gap-8">
                <Button variant="ghost" size="icon" onClick={() => setView("landing")} className="rounded-[1.2rem] h-20 w-20 bg-white dark:bg-zinc-900 shadow-xl border border-border">
                  <ChevronRight className="w-10 h-10 rotate-180" />
                </Button>
                <div>
                  <h2 className="text-6xl font-black tracking-tighter uppercase italic">Control</h2>
                  <div className="flex gap-3 mt-2">
                    <Badge variant="primary" className="px-4 py-1.5">{records.length} Logs</Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 w-full lg:w-auto">
                <Button variant="outline" onClick={exportToCSV} className="h-20 px-10 rounded-[1.5rem] font-black border-2 border-border flex gap-3 text-lg flex-1 lg:flex-none">
                  <Download className="w-6 h-6" /> DATA DUMP
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
                      <QRCodeSVG
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
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase opacity-60">
                          <span>Local Link</span>
                          <span className="text-green-500">Live</span>
                        </div>
                        <div className="p-3 bg-white/10 rounded-xl font-mono text-[10px] break-all border border-white/5">
                          {typeof window !== 'undefined' ? window.location.origin : ''}/?sessionID={currentSession.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>

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
        )}
      </main>

      {/* Profile Modal */}
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="DEVICE_IDENTITY">
        <div className="space-y-10 p-4">
          <div className="p-8 bg-primary/5 rounded-3xl border border-primary/10">
            <p className="text-xs text-primary font-black uppercase tracking-widest leading-relaxed">Identity Profile is persistent on this device. Save your details to enable **Instant Signal Check-in** on live broadcasts.</p>
          </div>
          <div className="space-y-6">
            <Input placeholder="Full Name" className="h-16 text-xl px-8 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none font-black" value={studentProfile.name} onChange={(e) => setStudentProfile({ ...studentProfile, name: e.target.value })} />
            <Input placeholder="Student ID" className="h-16 text-xl px-8 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none font-black" value={studentProfile.id} onChange={(e) => setStudentProfile({ ...studentProfile, id: e.target.value })} />
          </div>
          <Button onClick={() => setIsProfileModalOpen(false)} className="w-full h-20 grad-bg border-none font-black text-2xl rounded-[1.5rem] text-white shadow-xl shadow-primary/20">SAVE_IDENTITY</Button>
        </div>
      </Modal>

      {/* Admin Session Modal */}
      <Modal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} title="CREATE_BROADCAST">
        <div className="space-y-8 p-4">
          <Input placeholder="Session Name (e.g. Lab 4B)" className="h-20 text-3xl px-8 rounded-[1.5rem] bg-zinc-50 border-none font-black shadow-inner" value={newSessionName} onChange={(e) => setNewSessionName(e.target.value)} />
          <Button onClick={createSession} className="w-full h-20 grad-bg border-none font-black text-2xl rounded-[1.5rem] text-white">GENERATE SIGNAL</Button>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal isOpen={isSuccessModalOpen} onClose={() => setIsSuccessModalOpen(false)} title="VERIFICATION_SUCCESS">
        <div className="flex flex-col items-center py-10 text-center space-y-10 animate-in zoom-in-75 duration-700">
          <div className="w-32 h-32 rounded-[3.5rem] bg-green-500/10 flex items-center justify-center border-[6px] border-green-500/20 relative overflow-hidden">
            <CheckCircle2 className="w-20 h-20 text-green-500 relative z-10" />
            <div className="absolute inset-0 rounded-[3rem] bg-green-500 opacity-20 animate-ping"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-green-400/50 shadow-[0_0_15px_rgba(74,222,128,0.8)] animate-[scan-line_2s_ease-in-out_infinite]"></div>
          </div>
          <div className="space-y-3">
            <h3 className="text-5xl font-black tracking-tighter text-green-600 uppercase italic">Entry Uploaded</h3>
            <p className="text-muted-foreground text-xl font-medium">Your signature has been synced with the <br /> cloud attendance grid.</p>
          </div>
          <Button onClick={() => { setIsSuccessModalOpen(false); setView("landing"); }} className="w-full h-18 grad-bg border-none text-white font-black text-xl rounded-2xl">DONE</Button>
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

      {/* Footer */}
      <footer className="mt-48 py-20 border-t bg-zinc-950 text-white text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600">© 2026 AttendQR Cloud Systems • Real-Time Optical Networking</p>
      </footer>
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
