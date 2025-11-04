"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import Footer from "@/components/footer";
import AdBanner from "@/components/ad-banner";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth-context";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const isAdminPage = pathname.startsWith("/admin");

  // Logic hiển thị AdBanner:
  // - Không hiển thị trên trang admin.
  // - Hiển thị nếu người dùng chưa đăng nhập.
  // - Hiển thị nếu người dùng đã đăng nhập nhưng đang dùng gói 'free'.
  const showAdBanner = !isAdminPage && (!isAuthenticated || (user && user.plan === 'free'));

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      {showAdBanner && <AdBanner />}

      <main className="flex-grow">{children}</main>
      {!isAdminPage && <Footer />}
      <Toaster position="top-right" richColors />
    </div>
  );
}
