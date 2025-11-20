"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { apiClient, TokenManager } from "./api-client"
import { User, LoginResponse, RegisterResponse } from "./types"
import { useToast } from "../hooks/use-toast"
import { useI18n } from "./i18n-context"
import AsyncStorage from "@react-native-async-storage/async-storage"

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
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const { toast } = useToast();
  const { t } = useI18n();
  
  // Hàm callback thống nhất để cập nhật token (hoạt động tốt)
  const handleTokenUpdate = useCallback((tokens: { remaining: number; limit: number }) => {
    setUser(currentUser => {
      if (currentUser && currentUser.remainingTokens !== tokens.remaining) {
        return { 
          ...currentUser, 
          remainingTokens: tokens.remaining, 
          tokenAllotment: tokens.limit 
        };
      }
      return currentUser;
    });
  }, []);

  // Hàm refetchUser vẫn hữu ích cho việc làm mới session khi cần
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
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to refetch user:", error);
      setUser(null);
      TokenManager.clearTokens();
    }
  }, []);
  
  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error("Logout failed, but clearing client-side session anyway:", error);
    } finally {
      TokenManager.clearTokens();
      setUser(null);
      toast({ title: t("nav.logout"), description: t("auth.logoutSuccess") || "Bạn đã đăng xuất thành công." });
      await refetchUser();
    }
  }, [t, toast, refetchUser]);

  useEffect(() => {
    apiClient.setTokenUpdateCallback(handleTokenUpdate);
    refetchUser().finally(() => setIsLoading(false));
  }, [refetchUser, handleTokenUpdate]);

  // SỬA LẠI HÀM LOGIN - ĐÂY LÀ THAY ĐỔI QUAN TRỌNG NHẤT
  const login = async (email: string, password: string) => {
    // 1. Gọi API login
    const response = await apiClient.login(email, password);
    // 2. Lưu token vào localStorage
    TokenManager.setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    // 3. Cập nhật state với thông tin user vừa nhận được từ API login
    // Đây là cách làm trực tiếp, hiệu quả và đáng tin cậy nhất.
    const s =await AsyncStorage.getItem('accessToken');
   // console.log("vutest:",s);
    setUser(response.user); 
    // 4. Trả về response để AuthModal có thể xử lý tiếp
    return response;
  };

  const register = async (data: any) => {
    return apiClient.register(data);
  };

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