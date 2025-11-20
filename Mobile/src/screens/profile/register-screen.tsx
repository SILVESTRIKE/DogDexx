"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native"
import { TextInput } from "react-native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import { ProfileStackParamList } from "../../navigation/ProfileStack"
import { useAuth } from "../../lib/auth-context"



type RegisterScreenProps = NativeStackScreenProps<ProfileStackParamList, "RegisterScreen">

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [view, setView] = useState<"form" | "otp">("form")
  const [otp, setOtp] = useState("")
  const [message, setMessage] = useState("")
  const { login, register, verifyOtp } = useAuth()
  const handleRegister = async () => {
    setError("")
    if (!email.trim() || !password.trim() || !username.trim()) {
      setError("Vui lòng nhập email, tên đăng nhập và mật khẩu")
      return
    }

    setIsLoading(true)
    try {
      const response = await register({
        email,
        password,
        username,
        firstName,
        lastName,
      });
      setMessage(response.message || 'Mã OTP đã được gửi tới email của bạn.');
      setView('otp');

      console.log("[v0] Register attempt:", { email, username })
      setMessage("Mã OTP đã được gửi tới email của bạn.")
      setView("otp")
    } catch (err: any) {
      setError(err.message || "Đăng ký thất bại")
      Alert.alert("Lỗi", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setError("")
    if (!otp.trim() || otp.length !== 6) {
      setError("Vui lòng nhập mã OTP 6 chữ số")
      return
    }

    setIsLoading(true)
    try {
      await verifyOtp(email, otp);
      console.log("[v0] OTP verification:", { email, otp })
      Alert.alert("Thành công", "Tài khoản đã được tạo!")
      navigation.navigate("LoginScreen")
    } catch (err: any) {
      setError(err.message || "Xác nhận OTP thất bại")
      Alert.alert("Lỗi", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Đăng Ký</Text>
        <Text style={styles.description}>Tạo tài khoản mới</Text>
      </View>

      <View style={styles.form}>
        {view === "form" ? (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Họ (không bắt buộc)</Text>
              <TextInput
                style={styles.input}
                placeholder="Văn"
                placeholderTextColor="#999"
                value={firstName}
                onChangeText={setFirstName}
                editable={!isLoading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tên (không bắt buộc)</Text>
              <TextInput
                style={styles.input}
                placeholder="A"
                placeholderTextColor="#999"
                value={lastName}
                onChangeText={setLastName}
                editable={!isLoading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tên đăng nhập</Text>
              <TextInput
                style={styles.input}
                placeholder="username123"
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                editable={!isLoading}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
                secureTextEntry
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.otpContainer}>
              <Text style={styles.otpTitle}>Nhập mã OTP</Text>
              <Text style={styles.otpSubtitle}>Mã OTP đã được gửi tới email: {email}</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Mã OTP</Text>
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor="#999"
                value={otp}
                onChangeText={setOtp}
                editable={!isLoading}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message && !error ? <Text style={styles.message}>{message}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={view === "form" ? handleRegister : handleVerifyOtp}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{view === "form" ? "Đăng Ký" : "Xác Nhận"}</Text>
          )}
        </TouchableOpacity>

        {view === "otp" && (
          <TouchableOpacity
            onPress={() => {
              setView("form")
              setOtp("")
              setError("")
            }}
          >
            <Text style={styles.backLink}>Quay lại</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Đã có tài khoản? </Text>
        <TouchableOpacity onPress={() => navigation.navigate("LoginScreen")}>
          <Text style={styles.linkText}>Đăng nhập</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: "#fff",
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#000",
  },
  description: {
    fontSize: 14,
    color: "#666",
  },
  form: {
    marginBottom: 32,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#000",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#FF3B30",
    fontSize: 14,
    marginBottom: 12,
  },
  message: {
    color: "#34C759",
    fontSize: 14,
    marginBottom: 12,
  },
  otpContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  otpTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    color: "#000",
  },
  otpSubtitle: {
    fontSize: 13,
    color: "#666",
  },
  backLink: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#666",
  },
  linkText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
})
