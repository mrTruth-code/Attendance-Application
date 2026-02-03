"use client";

import { useEffect } from "react";
import { Button, Card } from "./components";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Application Error:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-2xl border-red-500/20">
                <div className="w-16 h-16 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black tracking-tight">Something went wrong</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                        The application encountered a runtime error. This might be due to incompatible data in your browser's storage.
                    </p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left overflow-auto max-h-[150px]">
                    <p className="text-xs font-mono text-red-500 break-all">{error.message || "Unknown error"}</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => { localStorage.clear(); window.location.reload(); }}>
                        Clear Data \u0026 Reset
                    </Button>
                    <Button className="flex-1 grad-bg border-none" onClick={() => reset()}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Try Again
                    </Button>
                </div>
            </Card>
        </div>
    );
}
