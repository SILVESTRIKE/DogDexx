import React from 'react';

export default function LoadingSpinner({ className = "" }: { className?: string }) {
    return (
        <div className={`flex h-full w-full items-center justify-center p-8 ${className}`}>
            <div className="relative h-12 w-12">
                <div className="absolute h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
            </div>
        </div>
    );
}
