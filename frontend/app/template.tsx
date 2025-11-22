"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      // Trạng thái ban đầu: Mờ (0) và thụt xuống dưới 20px
      initial={{ opacity: 0, x: 100 }}
      
      // Trạng thái kết thúc: Rõ (1) và về vị trí cũ (0)
      animate={{ opacity: 1, x: 0 }}
      
      // Hiệu ứng thoát ra (nếu thích): Mờ dần
      exit={{ opacity: 0, x: 100 }}
      
      // Thời gian chạy: 0.5 giây, kiểu trượt nhẹ nhàng
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}