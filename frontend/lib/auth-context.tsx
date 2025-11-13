"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { apiClient, TokenManager } from "./api-client"
import { User, LoginResponse, RegisterResponse } from "./types"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "./i18n-context"

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  register: (data: any) => Promise<RegisterResponse>;
  verifyOtp: (email: string, otp: string) => Promise<any>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  refetchUser: () => Promise<void>;
  
  // Các thuộc tính để điều khiển modal
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  setAuthModalOpen: (isOpen: boolean) => void;
  setAuthModalMode: (mode: 'login' | 'register') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // BẮT ĐẦU VỚI TRUE
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const { toast } = useToast();
  const { t } = useI18n();
  
  const handleTokenUpdate = useCallback((tokens: { remaining: number; limit: number }) => {
    setUser(currentUser => {
      // Chỉ cập nhật nếu user tồn tại và giá trị token thực sự thay đổi
      if (currentUser && (currentUser.remainingTokens !== tokens.remaining || currentUser.tokenAllotment !== tokens.limit)) {
        return { 
          ...currentUser, 
          remainingTokens: tokens.remaining, 
          tokenAllotment: tokens.limit 
        };
      }
      return currentUser;
    });
  }, []);

  // SỬA ĐỔI QUAN TRỌNG: Tách logic kiểm tra session ra khỏi `refetchUser`
  // Hàm này chỉ nên chạy MỘT LẦN khi ứng dụng khởi động.
  const checkAuthStatus = useCallback(async () => {
    // Chỉ kiểm tra nếu có token trong localStorage. Nếu không có, chắc chắn là khách.
    if (!TokenManager.getAccessToken()) {
      try {
        // Lấy thông tin session của khách
        const response = await apiClient.getSessionStatus();
        if (response.isGuest) {
          setUser({
            id: 'guest-session',
            username: 'Guest',
            plan: 'guest',
            remainingTokens: response.remainingTokens,
            tokenAllotment: response.tokenAllotment,
          });
        }
      } catch (error) {
        console.error("Could not fetch guest session:", error);
        setUser(null); // Không thể lấy session khách, coi như chưa đăng nhập
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      // apiClient.getSessionStatus() SẼ TỰ ĐỘNG XỬ LÝ REFRESH TOKEN
      // Chúng ta chỉ cần chờ kết quả cuối cùng của nó.
      const response = await apiClient.getSessionStatus();
      if (response && !response.isGuest && response.data?.user) {
        setUser(response.data.user);
      } else {
        // Nếu getSessionStatus trả về guest dù có token -> token hỏng -> dọn dẹp
        TokenManager.clearTokens();
        setUser(null);
      }
    } catch (error) {
      // BẮT LỖI Ở ĐÂY: Nếu apiClient thất bại (sau khi đã cố gắng refresh)
      // thì đó là lúc chúng ta thực sự nên đăng xuất người dùng.
      console.error("Session check failed, logging out:", error);
      TokenManager.clearTokens();
      setUser(null);
    } finally {
      // Dù thành công hay thất bại, quá trình khởi tạo đã xong.
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    apiClient.setTokenUpdateCallback(handleTokenUpdate);
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- Chỉ chạy MỘT LẦN

  const login = async (email: string, password: string) => {
    const response = await apiClient.login(email, password);
    TokenManager.setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    setUser(response.user); 
    return response;
  };


  const register = async (data: any) => {
    // THÊM MỚI: Kiểm tra định dạng username trước khi gửi
    const usernameRegex = /^[a-z0-9_]+$/;
    if (!usernameRegex.test(data.username)) {
      throw new Error(t("auth.errorUsernameInvalid") || "Username must be lowercase, no spaces, no accents, and can only contain letters, numbers, and underscores (_).");
    }
    // Tự động chuyển đổi username thành dạng slug để đảm bảo
    const slugify = (str: string) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    data.username = slugify(data.username);
    return apiClient.register(data);
  };

  // Hàm này giờ đây chỉ dùng để làm mới dữ liệu user khi cần, không dùng để check auth nữa
  const refetchUser = useCallback(async () => {
    try {
     const response = await apiClient.getSessionStatus();
     if (response.isGuest) {
       setUser({
         id: 'guest-session',
         username: 'Guest',
         plan: 'guest',
         remainingTokens: response.remainingTokens,
         tokenAllotment: response.tokenAllotment,
       });
     } else if (response.data?.user) {
       setUser(response.data.user);
     }
    } catch(error) {
      console.error("Failed to refetch user data, clearing session:", error)
      // Nếu refetch thất bại, có thể token đã hỏng -> dọn dẹp session cục bộ
      TokenManager.clearTokens();
      setUser(null);
      // Không cần gọi logout() ở đây để tránh vòng lặp
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error("Logout API call failed, clearing session locally:", error);
    } finally {
      TokenManager.clearTokens();
      setUser(null);
      toast({ title: t("nav.logout"), description: t("auth.logoutSuccess") || "Bạn đã đăng xuất thành công." });
      // Gọi refetchUser để lấy lại session của khách một cách nhất quán
      await refetchUser();
    }
  }, [t, toast, refetchUser]);

  const verifyOtp = async (email: string, otp: string) => {
    const response = await apiClient.verifyOtp(email, otp);
    toast({ title: t("common.success"), description: response.message });
    return response;
  };

  const value = {
    user,
    isAuthenticated: !!user?.email, 
    isLoading,
    login,
    logout,
    register,
    verifyOtp,
    setUser,
    refetchUser,
    isAuthModalOpen,
    authModalMode,
    setAuthModalOpen,
    setAuthModalMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}