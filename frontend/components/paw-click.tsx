"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Mảng màu sắc dấu chân chó (Nâu, Cam đất, Vàng, Xám)
const PAW_COLORS = [
  "#8B4513", // SaddleBrown
  "#A0522D", // Sienna
  "#CD853F", // Peru
  "#D2691E", // Chocolate
  "#F4A460", // SandyBrown
  "#BC8F8F", // RosyBrown
];

interface DogItem {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string; // Thêm màu sắc riêng cho từng dấu chân
}

export function DogClickEffect() {
  const [items, setItems] = useState<DogItem[]>([]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const randomColor = PAW_COLORS[Math.floor(Math.random() * PAW_COLORS.length)];
      
      const newItem: DogItem = {
        id: Date.now(),
        x: e.clientX,
        y: e.clientY,
        rotation: Math.random() * 60 - 30, // Xoay ngẫu nhiên (-30 đến 30 độ)
        scale: Math.random() * 0.5 + 0.8,  // Kích thước (0.8 đến 1.3)
        color: randomColor,
      };
      
      setItems((prev) => [...prev, newItem]);

      // Xóa sau 800ms
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== newItem.id));
      }, 800);
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
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: item.scale, opacity: 1, rotate: item.rotation }}
            exit={{ scale: 0, opacity: 0, y: -20 }} // Bay nhẹ lên khi biến mất
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              duration: 0.5,
            }}
            style={{
              position: "absolute",
              left: item.x,
              top: item.y,
              marginLeft: "-20px", // Căn giữa icon 40px
              marginTop: "-20px",
              color: item.color, // Áp dụng màu random
            }}
          >
            {/* --- CHỌN 1 TRONG CÁC MẪU DƯỚI ĐÂY --- */}
            
            {/* Mẫu 1: Dấu chân Trái tim (Cute nhất) */}
            <CutePawIcon />

            {/* Mẫu 2: Dấu chân Tròn trịa (Mụ mẫm) */}
            {/* <ChubbyPawIcon /> */}

            {/* Mẫu 3: Dấu chân Thực tế (Realistic) */}
            {/* <RealPawIcon /> */}
            
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// --- CÁC PHIÊN BẢN ICON MỚI ---

// 1. CUTE PAW (Hình đệm chính dạng trái tim ngược - Rất phổ biến cho style dễ thương)
function CutePawIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 100 100" fill="currentColor">
      {/* 4 Ngón chân */}
      <ellipse cx="18" cy="45" rx="12" ry="16" transform="rotate(-20 18 45)" />
      <ellipse cx="40" cy="28" rx="12" ry="16" transform="rotate(-10 40 28)" />
      <ellipse cx="65" cy="28" rx="12" ry="16" transform="rotate(10 65 28)" />
      <ellipse cx="85" cy="45" rx="12" ry="16" transform="rotate(20 85 45)" />
      
      {/* Đệm chính hình trái tim bầu */}
      <path d="M50 90 C20 90 15 65 25 55 C30 50 40 55 50 65 C60 55 70 50 75 55 C85 65 80 90 50 90 Z" />
    </svg>
  );
}

// 2. CHUBBY PAW (Dạng tròn vo, mập mạp)
function ChubbyPawIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 11.5C14.5 11.5 16.5 13.5 16.5 16C16.5 18.5 14.5 20.5 12 20.5C9.5 20.5 7.5 18.5 7.5 16C7.5 13.5 9.5 11.5 12 11.5Z" />
      <path d="M5 12.5C6.38071 12.5 7.5 11.1569 7.5 9.5C7.5 7.84315 6.38071 6.5 5 6.5C3.61929 6.5 2.5 7.84315 2.5 9.5C2.5 11.1569 3.61929 12.5 5 12.5Z" />
      <path d="M10 8.5C11.3807 8.5 12.5 7.15685 12.5 5.5C12.5 3.84315 11.3807 2.5 10 2.5C8.61929 2.5 7.5 3.84315 7.5 5.5C7.5 7.15685 8.61929 8.5 10 8.5Z" />
      <path d="M14 8.5C15.3807 8.5 16.5 7.15685 16.5 5.5C16.5 3.84315 15.3807 2.5 14 2.5C12.6193 2.5 11.5 3.84315 11.5 5.5C11.5 7.15685 12.6193 8.5 14 8.5Z" />
      <path d="M19 12.5C20.3807 12.5 21.5 11.1569 21.5 9.5C21.5 7.84315 20.3807 6.5 19 6.5C17.6193 6.5 16.5 7.84315 16.5 9.5C16.5 11.1569 17.6193 12.5 19 12.5Z" />
    </svg>
  );
}

// 3. REAL PAW (Chi tiết hơn, giống thật hơn)
function RealPawIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 512 512" fill="currentColor">
      <path d="M149.6,177.6c16.3,26.9,53,37.1,82,22.7c18-8.9,28.7-24.8,30.8-41.4c2.6-21.3-7.4-43.9-28.8-57.2
        c-32.8-20.4-75.3-0.3-88.8,38.9C143,149.1,144.6,163.5,149.6,177.6z"/>
      <path d="M355.3,145.8c-21.4,11.4-29.9,36.8-19.9,59.1c6.5,14.6,20.6,25.4,38.2,27.3c17.5,1.9,34.3-4.8,46.4-16.6
        c24.7-24.2,17.9-68.5-11.9-84.4C392.5,122.9,371.8,128.3,355.3,145.8z"/>
      <path d="M71.4,295c1.3,25.2,19.3,47.4,44.5,53.1c23.9,5.4,48.3-6.8,59.4-28.7c13.3-26.3,5-58.3-19.2-74.2
        C127,226.1,94.3,233,79.7,259.6C74.7,268.7,71.6,280.8,71.4,295z"/>
      <path d="M338.6,318.7c11,22.1,36.1,34.3,60.1,28.5c24.3-5.8,41.7-28.6,42.3-52.5c0.4-15-5.1-28.8-14.5-39.5
        c-23.1-26.4-65.9-23-83.6,7.4C333.7,278.3,333.2,300.1,338.6,318.7z"/>
      <path d="M255.8,261.4c-63.7,1.2-114,50.4-114.3,110c-0.1,32.2,16.3,63.1,43,80.6c16.4,10.7,37.7,13.6,56.6,13.5
        c25.4-0.1,50.8-6.2,71.8-20.5c25.4-17.3,41.4-46.8,41.4-78.4C354.3,308.4,310.5,262.5,255.8,261.4z"/>
    </svg>
  );
}