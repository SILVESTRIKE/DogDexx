import React from "react";

export function BackgroundEffects() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {/* Blob ở giữa/trên */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-50 animate-pulse-slow" />
      
      {/* Blob ở góc dưới phải */}
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] opacity-30" />
      
      {/* Thêm một blob nhỏ ở góc trái cho cân đối (Option) */}
    </div>
  );
}