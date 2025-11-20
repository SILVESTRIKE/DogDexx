import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';

type PaymentScreenRouteProp = RouteProp<RootStackParamList, 'momo'>;
type PaymentScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'momo'
>;
export default function PaymentScreen() {
  const route = useRoute<PaymentScreenRouteProp>();
  const navigation = useNavigation<PaymentScreenNavigationProp>();
  const { payUrl } = route.params;

  const [loading, setLoading] = useState(true);

  // Hàm kiểm tra URL redirect
  return (
    <View style={styles.container}>
      {loading && (
        <ActivityIndicator
          size="large"
          color="#007AFF"
          style={styles.loadingIndicator}
        />
      )}
      <WebView
        source={{ uri: payUrl }}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onShouldStartLoadWithRequest={req => {
          const fullUrl = req.url;
          console.log('URL đầy đủ:', fullUrl);
          const baseUrl = fullUrl.split('?')[0];
          console.log('Base URL:', baseUrl);
          if (baseUrl === 'https://dogdexai.vercel.app/profile') {
            console.log('🔔 Đã redirect về trang profile!');
            navigation.goBack();
          }
          return true;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -18,
    marginTop: -18,
  },
});
