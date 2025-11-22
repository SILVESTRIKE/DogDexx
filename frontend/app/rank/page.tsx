import Leaderboard from "@/components/leaderboard"; 
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bảng Xếp Hạng | Dog Breed ID",
  description: "Xem bảng xếp hạng các nhà sưu tầm giống chó hàng đầu trên toàn thế giới, quốc gia và thành phố.",
};

export default function LeaderboardPage() {
  return (
    // Sử dụng min-h-screen và bg-background để đồng bộ theme toàn ứng dụng
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pb-12 pt-4">
        {/* Chỉ gọi component, không cần thêm tiêu đề ở đây nữa vì component đã có header riêng */}
        <Leaderboard />
      </div>
    </main>
  );
}