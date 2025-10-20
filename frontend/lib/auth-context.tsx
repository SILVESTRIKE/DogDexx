"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { apiClient, TokenManager } from "./api-client"
import { User, LoginResponse, RegisterResponse } from "./types"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "./i18n-context"

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<LoginResponse>
  logout: () => void
  register: (data: {
    username: string
    email: string
    password: string
    firstName: string
    lastName: string
    avatar?: File
  }) => Promise<RegisterResponse>
  verifyOtp: (email: string, otp: string) => Promise<any>
  setUser: React.Dispatch<React.SetStateAction<User | null>> // Thêm setUser
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const { t } = useI18n()

  const logout = useCallback(async () => {
    try {
      await apiClient.logout()
      toast({ title: t("nav.logout"), description: t("auth.logoutSuccess") || "Bạn đã đăng xuất thành công." });
    } catch (error) {
      console.error("Logout failed, but clearing tokens anyway:", error)
    } finally {
      TokenManager.clearTokens()
      TokenManager.clearGuestSession(); // Xóa cả guest session để bắt đầu lại sạch sẽ
      setUser(null)
    }
  }, [])

  const fetchProfile = useCallback(async () => {
    const token = TokenManager.getAccessToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      const response = await apiClient.getProfile()
      setUser(response.data.user)
    } catch (error) {
      console.error("Failed to fetch profile:", error)
      // Nếu fetch profile thất bại (thường do 401), thực hiện logout
      logout()
    } finally {
      setIsLoading(false)
    }
  }, [logout])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.login(email, password)
      TokenManager.setTokens(response.tokens.accessToken, response.tokens.refreshToken)
      setUser(response.user)
      return response
    } catch (error) {
      console.error("Login failed:", error)
      throw error
    }
  }

  const register = async (data: {
    username: string
    email: string
    password: string
    firstName: string
    lastName: string
    avatar?: File
  }) => {
    try {
      const response = await apiClient.register(data)
      return response
    } catch (error) {
      console.error("Registration failed:", error)
      throw error
    }
  }

  const verifyOtp = async (email: string, otp: string) => {
    try {
      const response = await apiClient.verifyOtp(email, otp)
      toast({
        title: t("common.success"),
        description: response.message,
      })
      return response
    } catch (error) {
      console.error("OTP verification failed:", error)
      throw error
    }
  }

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    register,
    verifyOtp,
    setUser, // Cung cấp setUser qua context
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}