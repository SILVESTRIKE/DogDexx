"use client"

import { useRef, useState, useMemo } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, FlatList } from "react-native"
import { TextInput } from "react-native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import { ProfileStackParamList } from "../../navigation/ProfileStack"
import { useAuth } from "../../lib/auth-context"
import ReCaptcha, { GoogleRecaptchaRefAttributes } from '@valture/react-native-recaptcha-v3';
import { Country, State } from 'country-state-city';
import { ChevronDown } from 'lucide-react-native';

type RegisterScreenProps = NativeStackScreenProps<ProfileStackParamList, "RegisterScreen">
const SITE_KEY = '6Ldwbw4sAAAAAJdJxxTHVThczZPKj5egdZo_O_zx';
const BASE_URL = 'https://dogdexx.vercel.app';

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [country, setCountry] = useState("")
  const [countryCode, setCountryCode] = useState("")
  const [city, setCity] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [view, setView] = useState<"form" | "otp">("form")
  const [otp, setOtp] = useState("")
  const [message, setMessage] = useState("")
  const [showCountryModal, setShowCountryModal] = useState(false)
  const [showCityModal, setShowCityModal] = useState(false)
  const [countrySearch, setCountrySearch] = useState("")
  const [citySearch, setCitySearch] = useState("")
  const { register, verifyOtp } = useAuth()
  const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);

  // Get all countries
  const allCountries = useMemo(() => Country.getAllCountries(), []);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    return allCountries.filter(c =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase())
    );
  }, [countrySearch, allCountries]);

  // Get states/cities for selected country
  const allCities = useMemo(() => {
    if (!countryCode) return [];
    return State.getStatesOfCountry(countryCode) || [];
  }, [countryCode]);

  // Filter cities based on search
  const filteredCities = useMemo(() => {
    return allCities.filter(c =>
      c.name.toLowerCase().includes(citySearch.toLowerCase())
    );
  }, [citySearch, allCities]);

  const handleSelectCountry = (selectedCountry: any) => {
    setCountry(selectedCountry.name);
    setCountryCode(selectedCountry.isoCode);
    setCity(""); // Reset city when country changes
    setShowCountryModal(false);
    setCountrySearch("");
  };

  const handleSelectCity = (selectedCity: any) => {
    setCity(selectedCity.name);
    setShowCityModal(false);
    setCitySearch("");
  };

  const handleRegister = async () => {
    setError("")
    if (!email.trim() || !password.trim() || !username.trim()) {
      setError("Vui lòng nhập email, tên đăng nhập và mật khẩu")
      return
    }

    if (!country || !city) {
      setError("Vui lòng chọn quốc gia và thành phố")
      return
    }

    setIsLoading(true)
    try {
      const captchaToken = await recaptchaRef.current?.getToken('register');
      const response = await register({
        email,
        password,
        username,
        firstName,
        lastName,
        country,
        city,
        captchaToken
      });
      console.log("Register response:", response);
      setMessage(response.message || 'Mã OTP đã được gửi tới email của bạn.');
      setView('otp');
    } catch (err: any) {
      setError(err.message || "Đăng ký thất bại")
      Alert.alert("Lỗi", err.message || "Đăng ký thất bại")
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
      Alert.alert("Lỗi", err.message || "Xác nhận OTP thất bại")
    } finally {
      setIsLoading(false)
    }
  }

  const CountryItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.modalItem}
      onPress={() => handleSelectCountry(item)}
    >
      <Text style={styles.modalItemText}>{item.name}</Text>
    </TouchableOpacity>
  );

  const CityItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.modalItem}
      onPress={() => handleSelectCity(item)}
    >
      <Text style={styles.modalItemText}>{item.name}</Text>
    </TouchableOpacity>
  );

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

            {/* Country Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Quốc gia *</Text>
              <TouchableOpacity
                style={[styles.selectButton, !country && styles.selectButtonEmpty]}
                onPress={() => setShowCountryModal(true)}
                disabled={isLoading}
              >
                <Text style={[styles.selectButtonText, !country && styles.selectButtonTextEmpty]}>
                  {country || "Chọn quốc gia"}
                </Text>
                <ChevronDown size={20} color={country ? "#007AFF" : "#999"} />
              </TouchableOpacity>
            </View>

            {/* City Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Thành phố *</Text>
              <TouchableOpacity
                style={[styles.selectButton, !city && styles.selectButtonEmpty]}
                onPress={() => {
                  if (country) setShowCityModal(true);
                  else Alert.alert("Thông báo", "Vui lòng chọn quốc gia trước");
                }}
                disabled={isLoading || !country}
              >
                <Text style={[styles.selectButtonText, !city && styles.selectButtonTextEmpty]}>
                  {city || "Chọn thành phố"}
                </Text>
                <ChevronDown size={20} color={city ? "#007AFF" : "#999"} />
              </TouchableOpacity>
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

      {/* Country Modal */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn quốc gia</Text>
              <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalSearchInput}
              placeholder="Tìm kiếm quốc gia..."
              placeholderTextColor="#999"
              value={countrySearch}
              onChangeText={setCountrySearch}
            />

            <FlatList
              data={filteredCountries}
              renderItem={CountryItem}
              keyExtractor={(item) => item.isoCode}
              style={styles.modalList}
            />
          </View>
        </View>
      </Modal>

      {/* City Modal */}
      <Modal
        visible={showCityModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn thành phố ({country})</Text>
              <TouchableOpacity onPress={() => setShowCityModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalSearchInput}
              placeholder="Tìm kiếm thành phố..."
              placeholderTextColor="#999"
              value={citySearch}
              onChangeText={setCitySearch}
            />

            <FlatList
              data={filteredCities}
              renderItem={CityItem}
              keyExtractor={(item) => item.isoCode}
              style={styles.modalList}
            />
          </View>
        </View>
      </Modal>

      <ReCaptcha
        ref={recaptchaRef}
        siteKey={SITE_KEY}
        baseUrl={BASE_URL}
        action="register"
        containerStyle={styles.recaptchaContainer}
        testMode={__DEV__}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  recaptchaContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
    zIndex: -1,
  },
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
  selectButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  selectButtonEmpty: {
    backgroundColor: "#f9f9f9",
  },
  selectButtonText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  selectButtonTextEmpty: {
    color: "#999",
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  modalClose: {
    fontSize: 24,
    color: "#999",
    fontWeight: "300",
  },
  modalSearchInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginHorizontal: 16,
    marginVertical: 12,
    color: "#000",
  },
  modalList: {
    paddingHorizontal: 16,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalItemText: {
    fontSize: 14,
    color: "#333",
  },
})