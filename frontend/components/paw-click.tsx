"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

// --- BẢNG MÀU ---
const LIGHT_PAW_COLORS = [
  "rgb(160, 82, 45)",
  "#432818",
  "#8B4513",
  "#CD853F",
  "#D2691E",
  "#A0522D",
];

const DARK_PAW_COLORS = [
  "rgb(45, 143, 247)",
  "#f8fafc",
  "#94a3b8",
  "#60A5FA",
  "#3B82F6",
  "#CBD5E1",
];

interface DogItem {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
}

export function DogClickEffect() {
  const [items, setItems] = useState<DogItem[]>([]);
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);

  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const currentColors = themeRef.current === "dark" ? DARK_PAW_COLORS : LIGHT_PAW_COLORS;
      const randomColor = currentColors[Math.floor(Math.random() * currentColors.length)];

      const newItem: DogItem = {
        id: Date.now() + Math.random(), // Prevent key collision on fast clicks
        x: e.clientX,
        y: e.clientY,
        rotation: Math.random() * 60 - 30,
        scale: Math.random() * 0.3 + 0.9, // Kích thước ngẫu nhiên nhẹ
        color: randomColor,
      };

      setItems((prev) => [...prev, newItem]);

      // Thời gian tồn tại ngắn gọn
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== newItem.id));
      }, 700);
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            // --- ANIMATION "SMOOTH" ---
            // Chỉ hiện ra và ẩn đi, không di chuyển vị trí
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: item.scale, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{
              duration: 0.3, // Nhanh gọn
              ease: "easeOut", // Mượt
            }}
            style={{
              position: "absolute",
              left: item.x,
              top: item.y,
              marginLeft: "-20px",
              marginTop: "-20px",
              color: item.color,
              rotate: `${item.rotation}deg`, // Xoay tĩnh, không animate xoay để đỡ chóng mặt
            }}
          >
            <StandardPawIcon />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// --- ICON DẤU CHÂN CHUẨN (Lõm quay xuống) ---
function StandardPawIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 100 100" fill="currentColor">
      {/* 4 Ngón chân (Hình Elip hơi nghiêng chụm vào giữa) */}
      <ellipse cx="20" cy="40" rx="9" ry="13" transform="rotate(-20 20 40)" />
      <ellipse cx="40" cy="25" rx="9" ry="13" transform="rotate(-10 40 25)" />
      <ellipse cx="60" cy="25" rx="9" ry="13" transform="rotate(10 60 25)" />
      <ellipse cx="80" cy="40" rx="9" ry="13" transform="rotate(20 80 40)" />

      {/* Đệm chính (Main Pad) */}
      {/* Vẽ bằng Path: Phía trên là cung tròn lồi, phía dưới lõm vào */}
      <path d="
        M 25 65 
        C 25 45, 75 45, 75 65  
        C 75 85, 55 90, 50 75 
        C 45 90, 25 85, 25 65 
        Z"
      />
    </svg>
  );
}