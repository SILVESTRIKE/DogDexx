"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, useAnimation, PanInfo } from "framer-motion";
import { useTheme } from "next-themes";

// --- CẤU HÌNH ---
const DOG_WIDTH = 64;
const DOG_HEIGHT = 48;
const SCALE = 2;
const TOTAL_ROWS = 9;
const TOTAL_COLS = 8;
const CHASE_RANGE = 300; // Tầm nhìn: 350px thì bắt đầu đuổi
const CATCH_RANGE = 50; // Tầm bắt: 60px thì dừng lại xin ăn

// --- ẢNH ---
const DOG_IMAGE_LIGHT = "/Dogs-Remastered-02.png";
const DOG_IMAGE_DARK = "/Dogs-Remastered-10.png";

const SPRITES = {
  IDLE: 0,
  SIT: 1,
  LIE_START: 2,
  RUN: 3,
  WALK: 4,
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
  | "PET"
  | "CHASE"
  | "BEG"; // Thêm BEG

export default function WalkingDog() {
  const [behavior, setBehavior] = useState<Behavior>("IDLE");
  const [direction, setDirection] = useState(1);
  const [showHeart, setShowHeart] = useState(false);
  const [tick, setTick] = useState(0); // Trigger render

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const xPos = useRef(0);
  const mouseX = useRef<number | null>(null); // Lưu vị trí chuột
  const isInteracting = useRef(false); // Đang kéo thả hoặc được vuốt ve
  const controls = useAnimation();

  useEffect(() => {
    setMounted(true);
    // 1. THEO DÕI CHUỘT
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.current = e.clientX;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const currentDogImage =
    mounted && resolvedTheme === "dark" ? DOG_IMAGE_DARK : DOG_IMAGE_LIGHT;

  const getSpriteY = (rowIndex: number) =>
    `${(rowIndex / (TOTAL_ROWS - 1)) * 100}%`;

  // --- LOGIC SUY NGHĨ ---
  const thinkNextMove = useCallback(() => {
    if (isInteracting.current) return;

    // A. LOGIC ĐUỔI XƯƠNG (Ưu tiên cao nhất)
    if (mouseX.current !== null) {
      // Tính tâm con chó (Vị trí x + một nửa chiều rộng * scale)
      const dogCenterX = xPos.current + (DOG_WIDTH * SCALE) / 2;
      const dist = Math.abs(mouseX.current - dogCenterX);

      // Nếu trong tầm nhìn VÀ không đang ngủ say
      if (dist < CHASE_RANGE && behavior !== "SLEEP" && behavior !== "PET") {
        // Nếu đã bắt được (gần quá) -> Ngồi xin ăn
        if (dist < CATCH_RANGE) {
          // Quay mặt về phía chuột
          if (mouseX.current > dogCenterX) setDirection(1);
          else setDirection(-1);

          setBehavior("BEG"); // Xin ăn
          setTick((t) => t + 1);
          return; // Dừng suy nghĩ, thực hiện BEG
        }

        // Nếu chưa bắt được -> Đuổi (RUN)
        setBehavior("RUN");

        // Xác định hướng đuổi
        if (mouseX.current > dogCenterX) setDirection(1);
        else setDirection(-1);

        setTick((t) => t + 1);
        return; // Dừng suy nghĩ random, thực hiện RUN đuổi
      }
    }

    // B. LOGIC RANDOM (Nếu chuột ở xa hoặc đang ngủ)
    const rand = Math.random();
    const currentX = xPos.current;
    const MARGIN = 50;

    // Đụng tường thì quay đầu
    if (currentX < MARGIN && direction === -1) {
      setDirection(1);
      setBehavior("IDLE");
      setTick((t) => t + 1);
      return;
    }
    if (
      currentX > window.innerWidth - DOG_WIDTH * SCALE - MARGIN &&
      direction === 1
    ) {
      setDirection(-1);
      setBehavior("IDLE");
      setTick((t) => t + 1);
      return;
    }

    let nextBehavior: Behavior = "IDLE";
    if (behavior === "SLEEP") {
      if (rand > 0.8) nextBehavior = "SIT"; // Khó dậy
      else nextBehavior = "SLEEP";
    } else {
      // Nếu vừa xin ăn xong (BEG) mà chuột đi xa rồi -> IDLE một tí
      if (behavior === "BEG") {
        nextBehavior = "IDLE";
      } else {
        if (rand < 0.3) nextBehavior = "WALK";
        else if (rand < 0.45) nextBehavior = "RUN";
        else if (rand < 0.75) nextBehavior = "IDLE";
        else if (rand < 0.9) nextBehavior = "SIT";
        else nextBehavior = "SLEEP";
      }
    }
    setBehavior(nextBehavior);
    setTick((t) => t + 1);
  }, [behavior, direction]);

  // --- THỰC HIỆN HÀNH ĐỘNG ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const performAction = async () => {
      if (behavior === "DRAGGING" || behavior === "FALLING") return;

      // 1. CHẠY HOẶC ĐI (Bao gồm cả chạy đuổi theo chuột)
      if (behavior === "WALK" || behavior === "RUN") {
        const isChasing =
          mouseX.current !== null &&
          Math.abs(mouseX.current - (xPos.current + (DOG_WIDTH * SCALE) / 2)) <
            CHASE_RANGE;

        // Nếu đang đuổi (Chase) thì tốc độ bàn thờ, còn đi chơi thì thong thả
        const MOVE_SPEED = behavior === "RUN" ? (isChasing ? 400 : 300) : 50;

        let targetX: number;

        if (isChasing && mouseX.current !== null) {
          // Đích đến là vị trí chuột (trừ đi một nửa người chó để nó đứng giữa chuột)
          // Nhưng dừng lại cách chuột 1 đoạn nhỏ để không bị chồng lấn
          const offset = direction === 1 ? -40 : 40;
          targetX = mouseX.current - (DOG_WIDTH * SCALE) / 2 + offset;
        } else {
          // Logic đi random cũ
          const minRange = behavior === "RUN" ? 100 : 30;
          const maxRange = behavior === "RUN" ? 400 : 100;
          let distance = Math.random() * (maxRange - minRange) + minRange;
          targetX = xPos.current + distance * direction;
        }

        // Clamp màn hình
        const maxScreenX = window.innerWidth - DOG_WIDTH * SCALE;
        if (targetX < 0) targetX = 0;
        if (targetX > maxScreenX) targetX = maxScreenX;

        const actualDist = Math.abs(targetX - xPos.current);

        // Nếu gần quá thì thôi đứng đó suy nghĩ tiếp
        if (actualDist < 10) {
          if (isChasing) setBehavior("BEG"); // Đuổi kịp rồi thì xin
          else setBehavior("IDLE");

          setTick((t) => t + 1);
          return;
        }

        const duration = actualDist / MOVE_SPEED;

        try {
          await controls.start({
            x: targetX,
            transition: { duration: duration, ease: "linear" },
          });
          xPos.current = targetX;

          // Chạy xong 1 nhịp thì suy nghĩ tiếp (để check xem chuột có di chuyển chỗ khác không)
          thinkNextMove();
        } catch (e) {}
      }

      // 2. XIN ĂN (Khi bắt được chuột)
      else if (behavior === "BEG") {
        // Kiểm tra liên tục xem chuột có chạy mất không
        // Nếu chuột chạy ra xa > CATCH_RANGE thì quay lại rượt tiếp
        timeoutId = setTimeout(() => {
          if (mouseX.current !== null) {
            const dogCenterX = xPos.current + (DOG_WIDTH * SCALE) / 2;
            const dist = Math.abs(mouseX.current - dogCenterX);
            if (dist > CATCH_RANGE) {
              thinkNextMove(); // Chuột chạy rồi, suy nghĩ tiếp (sẽ kích hoạt RUN)
            } else {
              // Chuột vẫn ở đó, tiếp tục xin (hoặc chuyển sang Happy nếu muốn)
              // Ở đây mình loop lại BEG bằng cách gọi thinkNextMove, nó sẽ check dist < CATCH_RANGE và set BEG lại
              thinkNextMove();
            }
          } else {
            thinkNextMove();
          }
        }, 1000); // 1 giây check 1 lần
      }

      // 3. CÁC HÀNH ĐỘNG TĨNH KHÁC
      else if (behavior === "SLEEP") {
        timeoutId = setTimeout(thinkNextMove, 6000);
      } else if (behavior === "PET") {
        setShowHeart(true);
        await new Promise((r) => setTimeout(r, 2000));
        setShowHeart(false);
        setBehavior("IDLE");
        setTick((t) => t + 1);
      } else {
        // IDLE, SIT...
        const duration = Math.random() * 2000 + 1000;
        timeoutId = setTimeout(thinkNextMove, duration);
      }
    };

    performAction();

    return () => {
      clearTimeout(timeoutId);
      controls.stop(); // Stop animation cũ nếu logic thay đổi đột ngột (ví dụ chuột di chuyển nhanh)
    };
  }, [behavior, controls, direction, thinkNextMove, tick]); // Tick giúp re-run effect

  // --- HANDLERS ---
  const handleDragStart = () => {
    isInteracting.current = true;
    setBehavior("DRAGGING");
    setShowHeart(false);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    let newX = info.point.x - (DOG_WIDTH * SCALE) / 2;
    if (newX < 0) newX = 0;
    if (newX > window.innerWidth - DOG_WIDTH * SCALE)
      newX = window.innerWidth - DOG_WIDTH * SCALE;
    xPos.current = newX;
    setBehavior("FALLING");
    setTick((t) => t + 1);
    controls
      .start({
        y: 0,
        x: newX,
        transition: { type: "spring", stiffness: 400, damping: 25 },
      })
      .then(() => {
        isInteracting.current = false;
        setBehavior("WALK");
        setTick((t) => t + 1);
      });
  };

  const handleClick = () => {
    if (behavior === "DRAGGING" || behavior === "PET") return;
    isInteracting.current = true;
    controls.stop();
    setBehavior("PET");
    setTick((t) => t + 1);
    setTimeout(() => {
      isInteracting.current = false;
    }, 2500);
  };

  // --- RENDER ---
  const getCurrentSpriteRow = () => {
    switch (behavior) {
      case "WALK":
        return SPRITES.WALK;
      case "RUN":
      case "CHASE":
        return SPRITES.RUN; // Chase dùng sprite RUN
      case "IDLE":
        return SPRITES.IDLE;
      case "SIT":
        return SPRITES.SIT;
      case "DRAGGING":
        return SPRITES.SCARED;
      case "FALLING":
        return SPRITES.SIT;
      case "PET":
      case "BEG":
        return SPRITES.BEG; // BEG và PET dùng chung sprite vẫy tay
      case "SLEEP":
        return SPRITES.SLEEP;
      default:
        return SPRITES.IDLE;
    }
  };

  const getAnimDuration = () => {
    if (behavior === "RUN" || behavior === "CHASE") return "0.4s";
    if (behavior === "WALK") return "0.9s";
    if (behavior === "SLEEP") return "2.0s";
    if (behavior === "PET" || behavior === "BEG") return "0.6s";
    return "0.8s";
  };

  const getSteps = () => (behavior === "SLEEP" ? 4 : 7);
  const getEndPosition = () => `-${getSteps() * DOG_WIDTH}px`;

  if (!mounted) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full h-0 z-[50]">
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
          transformOrigin: "bottom center",
          scale: SCALE,
          x: xPos.current,
        }}
      >
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center z-20 w-max">
          {showHeart && (
            <div className="text-md animate-bounce drop-shadow-md">❤️</div>
          )}

          {/* Hiệu ứng bong bóng chat khi tương tác */}
          {behavior === "SLEEP" && (
            <div className="bg-background/90 px-2 py-0.5 rounded-full text-[8px] font-bold text-foreground animate-pulse border border-border shadow-sm">
              Zzz...
            </div>
          )}
          {behavior === "BEG" && (
            <div className="text-md animate-bounce drop-shadow-md mb-1">🦴</div> // Hiện cục xương khi xin ăn
          )}
          {behavior === "RUN" && !showHeart && (
            <div className="text-[10px] italic animate-pulse pr-4">💨</div>
          )}
        </div>

        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `scaleX(${-direction})`,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              imageRendering: "pixelated",
              backgroundImage: `url('${currentDogImage}')`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${TOTAL_COLS * 100}% ${TOTAL_ROWS * 100}%`,
              backgroundPositionY: getSpriteY(getCurrentSpriteRow()),
              // @ts-ignore
              "--end-pos": getEndPosition(),
              animation: `play-sprite ${getAnimDuration()} steps(${getSteps()}) infinite`,
            }}
          />
        </div>
      </motion.div>

      <style jsx global>{`
        @keyframes play-sprite {
          from {
            background-position-x: 0px;
          }
          to {
            background-position-x: var(--end-pos);
          }
        }
      `}</style>
    </div>
  );
}
