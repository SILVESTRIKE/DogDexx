import React, { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { useToast } from '../hooks/use-toast';

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập đầy đủ email và mật khẩu' });
      return;
    }

    try {
      setLoading(true);
      const res = await login(email, password); // Gọi API login qua AuthContext
      toast({ title: 'Thành công', description: `Chào mừng ${res.user.username || res.user.email}` });
      // Sau khi login, AuthContext sẽ tự cập nhật user → RootNavigator sẽ tự chuyển sang MainTabs
    } catch (err: any) {
      console.error('Login failed:', err);
      toast({ title: 'Lỗi đăng nhập', description: err?.message || 'Đăng nhập thất bại' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đăng nhập</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        placeholder="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <Button title="Đăng nhập" onPress={handleLogin} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    marginBottom: 24,
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
});
