// auth-context.tsx (PHIÊN BẢN ĐÃ CẬP NHẬT)

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { apiClient, TokenManager } from "./api-client";
import type { User, LoginResponse, RegisterResponse } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string
  ) => Promise<RegisterResponse>;
  logout: () => void;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  isLoading: boolean; // Chỉ là true trong lần tải đầu tiên để fetch user profile
  updateUser: (
    data: Partial<Pick<User, "username" | "firstName" | "lastName">>
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Khởi tạo trạng thái xác thực ngay lập tức từ localStorage
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!TokenManager.getAccessToken()
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      // 1. Nếu có Access Token, hãy thử khôi phục phiên
      if (TokenManager.getAccessToken()) {
        try {
          const response = await apiClient.getProfile();
          if (response && response.data && response.data.user) {
            // Thành công: Đã có session và profile
            setUser(response.data.user);
            setIsAuthenticated(true);
            TokenManager.clearGuestSession(); // Xóa cờ guest session nếu nó tồn tại
            console.log("User session restored.");
          } else {
            // Trường hợp response không chứa user (nên không xảy ra nhưng là biện pháp an toàn)
            console.log("Invalid token structure or no user found. Logging out.");
            TokenManager.clearTokens();
            setIsAuthenticated(false);
            setUser(null);
          }
        } catch (error) {
          console.log("Failed to restore user session:", error);
          // Bất kể lỗi là gì (token hết hạn, mạng, server), cách xử lý an toàn nhất
          // là đăng xuất người dùng để buộc họ đăng nhập lại.
          // API client có thể đã xóa token nếu refresh thất bại.
          console.log("Clearing user session due to an error.");
          TokenManager.clearTokens();
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        // 2. Nếu không có token, đảm bảo có Guest Session.
        await apiClient.ensureGuestSession().catch(e => {
            // Xử lý lỗi khi tạo guest session, nhưng vẫn tiếp tục.
            console.error("Initial guest session creation failed:", e);
        });
        setIsAuthenticated(false);
        setUser(null);
      }
      
      // Đánh dấu loading ban đầu đã xong
      setIsLoading(false);
    };

    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Chỉ chạy một lần duy nhất khi component mount

  const login = async (email: string, password: string): Promise<void> => {
    const response = await apiClient.login(email, password);
    if (response.tokens) {
      TokenManager.setTokens(
        response.tokens.accessToken,
        response.tokens.refreshToken
      );
    }
    setUser(response.user);
    setIsAuthenticated(true); // Set trạng thái đã đăng nhập
    // Đảm bảo xóa cờ guest session khi đăng nhập thành công
    TokenManager.clearGuestSession(); 
  };

  const register = async (
    email: string,
    password: string,
    name: string
  ): Promise<RegisterResponse> => {
    const response = await apiClient.register(name, email, password);
    return response;
  };

  const verifyOtp = async (email: string, otp: string): Promise<void> => {
    await apiClient.verifyOtp(email, otp);
  };

  const logout = async () => {
    try {
      // Gọi API logout để xóa session/refresh token phía server
      await apiClient.logout();
    } catch (error) {
      // Nếu API logout thất bại (ví dụ: mất mạng, token đã hết hạn)
      console.error("[v0] Logout API call failed:", error);
    } finally {
      // Luôn luôn xóa trạng thái client và redirect, bất kể kết quả API
      setUser(null);
      setIsAuthenticated(false); // Set trạng thái chưa đăng nhập
      TokenManager.clearTokens();
      TokenManager.setGuestSession(); // Set cờ guest session để trigger tạo guest session mới
      
      // Dùng window.location.replace để buộc tải lại trang, đảm bảo trạng thái sạch
      window.location.replace("/"); 
    }
  };

  const updateUser = async (
    data: Partial<Pick<User, "username" | "firstName" | "lastName">>
  ) => {
    const response = await apiClient.updateProfile(data);
    setUser((prevUser) => ({ ...prevUser, ...response.user } as User));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        register,
        logout,
        verifyOtp,
        isLoading,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}