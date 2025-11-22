"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, useAnimation, PanInfo } from "framer-motion";

// --- CẤU HÌNH ASSET ---
const DOG_WIDTH = 64;
const DOG_HEIGHT = 48;
const TOTAL_ROWS = 9;
const TOTAL_COLS = 8;

// Mapping đúng hàng trong ảnh Sprite
const SPRITES = {
  IDLE: 0, // Đứng vẫy đuôi
  SIT: 1, // Ngồi
  LIE_START: 2,
  RUN: 3, // Chạy (Hàng 5)
  WALK: 4, // Đi bộ (Hàng 6)
  SCARED: 5,
  BEG: 7,
  SLEEP: 8,
};

type Behavior =
  | "WALK"
  | "RUN"
  | "IDLE"
  | "SIT"
  | "SLEEP"
  | "DRAGGING"
  | "FALLING"
  | "PET";

export default function RealisticPixelDog() {
  const [behavior, setBehavior] = useState<Behavior>("IDLE");
  const [direction, setDirection] = useState(1); // 1: Phải, -1: Trái
  const [showHeart, setShowHeart] = useState(false);

  const xPos = useRef(0); // Vị trí X hiện tại (để tính toán logic)
  const isInteracting = useRef(false);
  const controls = useAnimation();

  // Helper tính vị trí background
  const getSpriteY = (rowIndex: number) =>
    `${(rowIndex / (TOTAL_ROWS - 1)) * 100}%`;

  // --- AI: BỘ NÃO CỦA CHÓ ---
  const thinkNextMove = useCallback(() => {
    if (isInteracting.current) return;

    const rand = Math.random();
    const screenW = window.innerWidth;
    const currentX = xPos.current;

    // 1. LOGIC VA CHẠM TƯỜNG
    const MARGIN = 80;
    if (currentX < MARGIN && direction === -1) {
      setDirection(1); // Đụng tường trái -> Quay phải
      setBehavior("IDLE"); // Đứng lại suy nghĩ chút
      return;
    }
    if (currentX > screenW - MARGIN && direction === 1) {
      setDirection(-1); // Đụng tường phải -> Quay trái
      setBehavior("IDLE");
      return;
    }

    // 2. QUYẾT ĐỊNH HÀNH ĐỘNG TIẾP THEO
    if (behavior === "SLEEP") {
      // Đang ngủ thì lười dậy lắm (80% ngủ tiếp)
      if (rand > 0.8) setBehavior("SIT");
      else setTimeout(thinkNextMove, 4000);
      return;
    }

    // Tỷ lệ hành động
    if (rand < 0.3) setBehavior("WALK"); // 30% Đi bộ thong thả
    else if (rand < 0.45)
      setBehavior("RUN"); // 15% Nổi hứng chạy nhanh (Zoomies)
    else if (rand < 0.85) setBehavior("IDLE"); // 20% Đứng chơi
    else if (rand < 0.95) setBehavior("SIT"); // 10% Ngồi
    else setBehavior("SLEEP"); // 5% Đi ngủ
  }, [behavior, direction]);

  // --- XỬ LÝ DI CHUYỂN & ANIMATION ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const performAction = async () => {
      if (behavior === "DRAGGING" || behavior === "FALLING") return;

      // --- LOGIC DI CHUYỂN (WALK vs RUN) ---
      if (behavior === "WALK" || behavior === "RUN") {
        // CẤU HÌNH TỐC ĐỘ TẠI ĐÂY
        const MOVE_SPEED = behavior === "RUN" ? 350 : 60; // Pixel trên giây (Run nhanh gấp ~6 lần Walk)

        // Walk: Đi ngắn ngắn (50px - 150px)
        // Run: Chạy đoạn dài hơn (200px - 500px)
        const minRange = behavior === "RUN" ? 200 : 50;
        const maxRange = behavior === "RUN" ? 500 : 150;

        let distance = Math.random() * (maxRange - minRange) + minRange;

        // Tính đích đến
        let targetX = xPos.current + distance * direction;

        // Clamp (Kẹp) vị trí trong màn hình
        if (targetX < 0) targetX = 0;
        if (targetX > window.innerWidth - DOG_WIDTH)
          targetX = window.innerWidth - DOG_WIDTH;

        // Tính lại quãng đường thực tế sau khi kẹp
        const actualDist = Math.abs(targetX - xPos.current);

        // Nếu quãng đường quá ngắn (do đụng tường), dừng lại luôn
        if (actualDist < 10) {
          setDirection((prev) => prev * -1);
          setBehavior("IDLE");
          return;
        }

        // Tính thời gian di chuyển = Quãng đường / Tốc độ
        const duration = actualDist / MOVE_SPEED;

        await controls.start({
          x: targetX,
          transition: {
            duration: duration,
            ease: "linear", // Dùng linear để tốc độ đều, ko bị trượt
          },
        });

        xPos.current = targetX;
        thinkNextMove();
      }

      // --- CÁC HÀNH ĐỘNG ĐỨNG YÊN ---
      else if (["IDLE", "SNIFF", "SIT", "BEG", "HAPPY"].includes(behavior)) {
        const duration = Math.random() * 2000 + 1000;
        timeoutId = setTimeout(thinkNextMove, duration);
      }

      // --- NGỦ ---
      else if (behavior === "SLEEP") {
        timeoutId = setTimeout(thinkNextMove, 6000); // Ngủ lâu hơn
      }

      // --- TƯƠNG TÁC ---
      else if (behavior === "PET") {
        setShowHeart(true);
        await new Promise((r) => setTimeout(r, 2000));
        setShowHeart(false);
        setBehavior("SLEEP");
      }
    };

    performAction();

    return () => {
      clearTimeout(timeoutId);
      controls.stop();
    };
  }, [behavior, controls, direction, thinkNextMove]);

  // --- DRAG & DROP ---
  const handleDragStart = () => {
    isInteracting.current = true;
    setBehavior("DRAGGING");
    setShowHeart(false);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    // Cập nhật vị trí xPos dựa trên nơi thả chuột
    // Lấy vị trí tương đối của phần tử cha + delta
    // Cách đơn giản nhất: Giả định vị trí hiện tại của animation là đúng
    // (Framer motion tự handle visual x, ta chỉ cần update logic reference)
    const parentRect = document.body.getBoundingClientRect(); // Hoặc container
    // Với position fixed left-0, point.x là toạ độ màn hình chính xác
    xPos.current = info.point.x - DOG_WIDTH / 2;

    setBehavior("FALLING");

    controls
      .start({
        y: 0,
        transition: { type: "spring", stiffness: 400, damping: 25 },
      })
      .then(() => {
        isInteracting.current = false;
        setBehavior("WALK");
      });
  };

  const handleClick = () => {
    if (behavior === "DRAGGING" || behavior === "PET") return;
    isInteracting.current = true;
    controls.stop();
    setBehavior("PET");
    setTimeout(() => {
      isInteracting.current = false;
    }, 2500);
  };

  // --- RENDER PROPS ---

  const getCurrentSpriteRow = () => {
    switch (behavior) {
      case "WALK":
        return SPRITES.WALK;
      case "RUN":
        return SPRITES.RUN;
      case "IDLE":
        return SPRITES.IDLE;
      case "SIT":
        return SPRITES.SIT;
      case "DRAGGING":
        return SPRITES.SCARED;
      case "FALLING":
        return SPRITES.SIT;
      case "PET":
        return SPRITES.BEG;
      case "SLEEP":
        return SPRITES.SLEEP;
      default:
        return SPRITES.IDLE;
    }
  };

  // QUAN TRỌNG: TỐC ĐỘ ANIMATION (Guồng chân)
  // Chạy thì chân phải guồng nhanh, đi thì thong thả
  const getAnimDuration = () => {
    if (behavior === "RUN") return "0.4s"; // Guồng chân cực nhanh
    if (behavior === "WALK") return "0.9s"; // Đi thong thả
    if (behavior === "SLEEP") return "2.0s"; // Thở chậm rãi
    if (behavior === "PET") return "0.6s"; // Nhảy vui vẻ
    return "0.8s"; // Tốc độ trung bình cho vẫy đuôi
  };

  const getSteps = () => (behavior === "SLEEP" ? 4 : 7);
  const getEndPosition = () => {
    const steps = getSteps();
    return `-${steps * DOG_WIDTH}px`;
  };
  return (
    <div className="fixed bottom-0 left-0 w-full h-0 z-[9999]">
      <motion.div
        drag
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onTap={handleClick}
        animate={controls}
        initial={{ x: 0, y: 0 }}
        className="absolute bottom-0 left-0 cursor-pointer touch-none select-none"
        style={{
          width: DOG_WIDTH,
          height: DOG_HEIGHT,
          scaleX: -direction,
          originX: 0.5,
          originY: 1,
        }}
      >
        {/* EMOTIONS */}
        <div
          className="absolute -top-5 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap flex flex-col items-center"
          style={{ transform: `scaleX(${-direction})` }}
        >
          {showHeart && (
            <div className="text-3xl animate-bounce drop-shadow-md">❤️</div>
          )}

          {behavior === "SLEEP" && (
            <div className="bg-white/80 px-2 py-1 rounded-lg text-xs font-bold text-slate-600 animate-pulse border border-slate-200">
              Zzz...
            </div>
          )}
          {behavior === "RUN" && (
            <div className="text-xs text-gray-400 italic animate-pulse pr-4">
              💨
            </div>
          )}
        </div>

        {/* SPRITE */}
        <div
          style={{
            width: "100%",
            height: "100%",
            imageRendering: "pixelated",
            backgroundImage: "url('/Dogs-Remastered-02.png')",
            backgroundRepeat: "no-repeat",
            backgroundSize: `${TOTAL_COLS * 100}% ${TOTAL_ROWS * 100}%`,
            backgroundPositionY: getSpriteY(getCurrentSpriteRow()),
            // @ts-ignore
            "--end-pos": getEndPosition(),
            animation: `play-sprite ${getAnimDuration()} steps(${getSteps()}) infinite`,
          }}
        />
      </motion.div>

      <style jsx global>{`
        @keyframes play-sprite {
          from {
            background-position-x: 0%;
          }
          to {
            background-position-x: var(--end-pos);
          }
        }
      `}</style>
    </div>
  );
}
