"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PawPrint, Bone, Search, Loader2 } from "lucide-react";

// Danh sách các câu nói/sự thật thú vị để hiển thị
const LOADING_MESSAGES = [
  "Đang đánh hơi dữ liệu...",
  "Đang triệu hồi các chú chó...",
  "Bạn có biết? Chó có khứu giác mạnh gấp 40 lần con người.",
  "Đang phân tích từng pixel...",
  "AI đang suy nghĩ... (đừng làm phiền)",
  "Chó Basenji là giống chó duy nhất không thể sủa.",
  "Đang tìm kiếm khúc xương thất lạc...",
  "Dấu vân mũi của chó là duy nhất, giống như vân tay người.",
  "Chờ chút nhé, Boss đang tới...",
  "Greyhound là giống chó chạy nhanh nhất thế giới (72km/h).",
];

export default function Loading() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Hiệu ứng thay đổi câu nói mỗi 3 giây
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);

    return () => clearInterval(messageInterval);
  }, []);

  // Hiệu ứng thanh progress giả lập (tăng dần nhưng chậm lại khi gần 90%)
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress === 100) return 100;
        const diff = Math.random() * 10;
        return Math.min(oldProgress + diff, 90); // Dừng ở 90% cho đến khi trang load xong
      });
    }, 500);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-3xl overflow-hidden">

      {/* Background Decor (Giống trang Home) */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] -z-10 animate-pulse delay-700" />

      <div className="relative flex flex-col items-center max-w-md w-full px-6 text-center space-y-8">

        {/* Main Icon Animation */}
        <div className="relative">
          {/* Vòng xoay bên ngoài */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-4 rounded-full border-t-2 border-r-2 border-primary/30 w-32 h-32"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-2 rounded-full border-b-2 border-l-2 border-purple-500/30 w-28 h-28 mx-auto left-0 right-0 top-0 bottom-0 m-auto"
          />

          {/* Icon trung tâm nảy lên xuống */}
          <div className="bg-background shadow-2xl shadow-primary/20 rounded-full p-6 relative z-10 border border-white/10">
            <motion.div
              animate={{
                y: [0, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <PawPrint className="w-12 h-12 text-transparent bg-clip-text bg-gradient-to-br from-primary to-purple-600 stroke-current fill-primary/20" />
            </motion.div>
          </div>
        </div>

        {/* Text Section */}
        <div className="h-24 flex flex-col items-center justify-center space-y-2">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
            DOGDEX AI
          </h2>

          {/* Animated Quotes */}
          <div className="relative w-full h-12">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentMessageIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="text-muted-foreground text-sm md:text-base font-medium absolute w-full left-0 right-0 px-4"
              >
                "{LOADING_MESSAGES[currentMessageIndex]}"
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Custom Progress Bar */}
        <div className="w-full max-w-xs space-y-2">
          <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden border border-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-primary via-purple-500 to-primary background-animate"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut" }}
              style={{ backgroundSize: "200% 100%" }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground/50 px-1">
            <span>Loading assets...</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Icon trang trí bay bay (Optional) */}
        <motion.div
          className="absolute -right-10 top-0 text-primary/10"
          animate={{ y: [0, 20, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
        >
          <Bone className="w-16 h-16" />
        </motion.div>
        <motion.div
          className="absolute -left-10 bottom-0 text-purple-500/10"
          animate={{ y: [0, -20, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Search className="w-16 h-16" />
        </motion.div>

      </div>
    </div>
  );
}