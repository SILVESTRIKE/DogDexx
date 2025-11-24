import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs';
// import { UserContext } from '../context/UserContext';
import { useAuth } from '../lib/auth-context';
import PricingScreen from '../screens/pricing/PricingScreen';
import CheckoutScreen from '../screens/checkout/CheckoutScreen';
import PaymentScreen from '../screens/checkout/momo';
import AboutScreen from '../screens/about/AboutScreen';
import LoginScreen from '../screens/profile/login-screen';
import { RegisterScreen } from '../screens/profile/register-screen';
import ProfileScreen from '../screens/profile/profile-screen';
import ProfileStack from './ProfileStack';
const Stack = createNativeStackNavigator();
export type RootStackParamList = {
  MainTabs: undefined;
  Pricing: undefined; // 👈 thêm screen Pricing
  Checkout: { plan: string; period: 'monthly' | 'yearly' };
  momo: { payUrl: string };
  AboutScreen: undefined;
  ProfileScreen1: undefined;
};
export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null; 

  return (
    <Stack.Navigator screenOptions={{ 
      headerShown: false
       }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Pricing" component={PricingScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="momo" component={PaymentScreen} />
      <Stack.Screen name="AboutScreen" component={AboutScreen} />
      <Stack.Screen name="ProfileScreen1" component={ProfileStack} />
    </Stack.Navigator>
  );
}
