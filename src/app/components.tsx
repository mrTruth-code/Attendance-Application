import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function Card({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
    return (
        <div
            className={cn("rounded-2xl border border-border bg-card p-6 shadow-sm", className)}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

export function Button({
    className,
    variant = "primary",
    size = "md",
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "outline" | "ghost";
    size?: "sm" | "md" | "lg" | "icon";
}) {
    const variants = {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
    };

    const sizes = {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 py-2",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
    };

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        />
    );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all focus:border-indigo-500/50",
                className
            )}
            {...props}
        />
    );
}

export function Badge({ children, className, variant = "primary" }: { children: React.ReactNode; className?: string; variant?: "primary" | "secondary" | "outline" | "destructive" }) {
    const variants = {
        primary: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
        secondary: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
        outline: "border border-input text-foreground font-medium",
        destructive: "bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400",
    };

    return (
        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-transparent", variants[variant], className)}>
            {children}
        </span>
    );
}

export function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-lg transform transition-all animate-in zoom-in-95 duration-300">
                <Card className="shadow-2xl border-indigo-500/20 p-0 overflow-hidden bg-background">
                    <div className="p-6 border-b flex items-center justify-between">
                        <h3 className="text-xl font-black tracking-tighter">{title}</h3>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </Button>
                    </div>
                    <div className="p-6">
                        {children}
                    </div>
                </Card>
            </div>
        </div>
    );
}
