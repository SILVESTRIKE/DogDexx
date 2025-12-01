"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PawPrint, Bone, Search, Dog, Activity, BrainCircuit } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";

export default function Loading() {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Danh sách các key để lấy từ file ngôn ngữ
  const MESSAGE_KEYS = [
    { icon: Search, key: "sniffing" },
    { icon: Dog, key: "wakingBoss" },
    { icon: BrainCircuit, key: "analyzingFur" },
    { icon: Bone, key: "lookingBones" },
    { icon: Activity, key: "didYouKnow" },
    { icon: PawPrint, key: "summoningAI" },
    { icon: Dog, key: "identifying" },
    { icon: Activity, key: "funFact" },
  ];

  // Random câu nói mỗi 2.5 giây
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % MESSAGE_KEYS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  // Thanh progress giả lập
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((old) => {
        if (old >= 90) return 90; // Giữ ở 90%
        const diff = Math.random() * 15;
        return Math.min(old + diff, 90);
      });
    }, 400);
    return () => clearInterval(timer);
  }, []);

  const currentItem = MESSAGE_KEYS[currentIndex];
  const CurrentIcon = currentItem.icon;

  // @ts-ignore
  const title = t(`loadingMessages.${currentItem.key}.title`);
  // @ts-ignore
  const desc = t(`loadingMessages.${currentItem.key}.desc`);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-background/95 backdrop-blur-3xl overflow-hidden">

      {/* Background Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] -z-10" />

      <div className="relative flex flex-col items-center max-w-md w-full px-6 space-y-10">

        {/* CENTER ANIMATION */}
        <div className="relative">
          {/* Vòng xoay trang trí */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-6 rounded-full border border-dashed border-primary/20 w-40 h-40 m-auto"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-2 rounded-full border border-dashed border-purple-500/20 w-32 h-32 m-auto"
          />

          {/* Main Changing Icon */}
          <div className="bg-gradient-to-br from-background to-secondary shadow-2xl shadow-primary/20 rounded-full p-8 relative z-10 border border-white/10">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <CurrentIcon className="w-10 h-10 text-primary" />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* TEXT CONTENT */}
        <div className="flex flex-col items-center justify-center text-center h-24 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-1"
            >
              <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 tracking-wide uppercase">
                {title}
              </h3>
              <p className="text-muted-foreground font-medium text-sm md:text-base max-w-[300px] mx-auto leading-relaxed">
                {desc}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full max-w-[280px] space-y-3">
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
            <span>{t("loadingMessages.processing")}</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>

      </div>
    </div>
  );
}