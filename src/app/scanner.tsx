"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Card, Button } from "./components";
import { Camera, RefreshCw, Smartphone, X } from "lucide-react";

interface ScannerProps {
    onScan: (data: string) => void;
    onClose: () => void;
}

export function Scanner({ onScan, onClose }: ScannerProps) {
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const isScanningRef = useRef(false);
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        let isMounted = true;

        const initScanner = async () => {
            // small artificial delay for "premium" feeling (tech warming up)
            await new Promise(resolve => setTimeout(resolve, 800));

            if (!isMounted) return;

            const container = document.getElementById("reader");
            if (!container) {
                setError("OPTICAL_CONTAINER_NOT_FOUND");
                setIsInitializing(false);
                return;
            }

            try {
                // Ensure any previous Instance is dead
                if (scannerRef.current) {
                    try { await scannerRef.current.stop(); } catch (e) { }
                    try { scannerRef.current.clear(); } catch (e) { }
                }

                const scanner = new Html5Qrcode("reader");
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 25,
                        qrbox: { width: 280, height: 280 },
                    },
                    (decodedText) => {
                        if (isScanningRef.current) return;
                        isScanningRef.current = true;

                        // Haptic feedback
                        if (window.navigator && window.navigator.vibrate) {
                            window.navigator.vibrate(150);
                        }

                        onScan(decodedText);

                        // If the scanner isn't unmounted by onScan (e.g. error), 
                        // reset the trigger after a logic delay
                        if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
                        resetTimeoutRef.current = setTimeout(() => {
                            if (isMounted) isScanningRef.current = false;
                        }, 3000);
                    },
                    () => {
                        // Silent frame failure
                    }
                );

                if (isMounted) {
                    setIsInitializing(false);
                }
            } catch (err: any) {
                console.warn("Scanner initialization failed", err);
                if (isMounted) {
                    // Provide actually useful error messages
                    if (err?.message?.includes("Permission")) {
                        setError("CAMERA_PERMISSION_DENIED");
                    } else if (err?.message?.includes("NotFound")) {
                        setError("NO_CAMERA_FOUND");
                    } else {
                        setError("HARDWARE_BUSY_OR_UNAVAILABLE");
                    }
                    setIsInitializing(false);
                }
            }
        };

        initScanner();

        return () => {
            isMounted = false;
            if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
            if (scannerRef.current) {
                if (scannerRef.current.isScanning) {
                    scannerRef.current.stop()
                        .then(() => {
                            try { scannerRef.current?.clear(); } catch (e) { }
                        })
                        .catch(err => console.warn("Scanner stop issue", err));
                } else {
                    try { scannerRef.current.clear(); } catch (err) { }
                }
            }
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-[300] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-4 animate-in fade-in duration-500">
            <Card className="w-full max-w-2xl bg-zinc-950 border-white/5 p-0 overflow-hidden relative shadow-2xl rounded-[3rem]">
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                            <Camera className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <span className="font-black text-xl text-white tracking-tighter uppercase italic">Optical Lens Active</span>
                            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.4em]">Secure_Auth Grid</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-500 hover:text-white hover:bg-white/5 h-12 w-12 rounded-xl">
                        <X className="w-6 h-6" />
                    </Button>
                </div>

                <div className="relative aspect-square sm:aspect-video bg-black flex items-center justify-center overflow-hidden">
                    <div id="reader" className="w-full h-full"></div>

                    {isInitializing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-950 z-20">
                            <RefreshCw className="w-12 h-12 animate-spin text-primary mb-6" />
                            <div className="space-y-1 text-center">
                                <p className="text-xl font-black tracking-tighter animate-pulse text-primary italic uppercase">
                                    INITIALIZING_OPTICS...
                                </p>
                                <p className="text-[10px] text-zinc-500 font-mono">
                                    CALIBRATING FOCUS RING...
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-zinc-950 text-white z-20">
                            <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center border-4 border-destructive/20 mb-8">
                                <AlertCircle className="w-10 h-10 text-destructive" />
                            </div>
                            <p className="font-black text-3xl tracking-tighter mb-4 uppercase italic">Hardware Blocked</p>
                            <p className="text-zinc-500 text-lg mb-10 max-w-xs leading-relaxed italic">
                                {error === "CAMERA_PERMISSION_DENIED" ? "Camera access was denied. Please check your browser settings." :
                                    error === "NO_CAMERA_FOUND" ? "No camera hardware detected on this device." :
                                        "The camera is being used by another app or is unavailable."}
                            </p>
                            <Button onClick={onClose} size="lg" className="grad-bg border-none px-12 h-16 rounded-2xl font-black text-xl text-white shadow-xl shadow-primary/20">
                                DISCONNECT_LINK
                            </Button>
                        </div>
                    )}

                    {!error && !isInitializing && (
                        <div className="absolute inset-0 pointer-events-none z-10">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] border-2 border-primary/30 rounded-[3rem] shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]">
                                {/* Focus Frame */}
                                <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-[2rem]"></div>
                                <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-[2rem]"></div>
                                <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-[2rem]"></div>
                                <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-[2rem]"></div>

                                {/* Scanning Laser */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-primary/80 shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.8)] animate-scan-line opacity-90 rounded-full"></div>
                                <div className="absolute top-0 left-0 w-full h-[100px] bg-gradient-to-b from-primary/20 to-transparent animate-scan-line opacity-30"></div>
                            </div>

                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/5 backdrop-blur-xl px-6 py-2 rounded-full border border-white/10">
                                <Smartphone className="w-4 h-4 text-primary" />
                                <span className="text-[9px] text-white font-black uppercase tracking-[0.2em]">Signal_Lock: Stable</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 bg-zinc-950 text-center border-t border-white/5">
                    <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">
                        Center the matrix on the target QR code
                    </p>
                </div>
            </Card>
        </div>
    );
}

function AlertCircle({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
    );
}
