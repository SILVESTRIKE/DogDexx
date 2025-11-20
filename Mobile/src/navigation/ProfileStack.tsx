import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/profile/profile-screen';
import LoginScreen from '../screens/profile/login-screen';
import { RegisterScreen } from '../screens/profile/register-screen';
import { View } from 'react-native';
import DrawerButton from './DrawerButton';
import { useI18n } from '../lib/i18n-context';

export type ProfileStackParamList = {
  ProfileScreen: undefined;
  LoginScreen: undefined;
  RegisterScreen: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  const { t } = useI18n();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerLeft: () => (
          <View style={{ marginRight: 12, marginLeft: -10 }}>
            <DrawerButton />
          </View>
        ),
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTintColor: '#000',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} options={{ title: t('nav.profile') }}/>
      <Stack.Screen name="LoginScreen" component={LoginScreen} />
      <Stack.Screen name="RegisterScreen" component={RegisterScreen} />
    </Stack.Navigator>
  );
}
