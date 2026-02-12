import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ScanScreen from '../screens/ScanScreen';
import HomeScreen from '../screens/home-screen';
import ResultsScreen from '../screens/results/result-screens';
import DogDetailScreen from '../screens/dog/dog-detail-screen';
export type ScanStackParamList = {
  ScanScreen: undefined;
  HomeScreen: undefined;
  ResulteScreen: any;
  DogDetail: any;
  PokedexScreen: any;
};
import { useI18n } from '../lib/i18n-context';
import PokedexScreen from '../screens/pokedex/pokedex-screen';

import { View } from 'react-native';
import DrawerButton from './DrawerButton';
import { TokenBadge } from '../components/TokenBadge';
import { useAuth } from '../lib/auth-context';

const Stack = createNativeStackNavigator<ScanStackParamList>();

export default function ScanStack() {
  const { user} = useAuth()
  const { t } = useI18n();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerLeft: () => (
          <View style={{ marginRight: 12 ,marginLeft: -10,}}>
            <DrawerButton />
          </View>
        ),
         headerRight: () => (
          <TokenBadge
            remaining={user?.remainingTokens || 0}
            total={user?.tokenAllotment || 0}
          />
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
      <Stack.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{ title: t('nav.detect') }}
      />
      <Stack.Screen
        name="ResulteScreen"
        component={ResultsScreen}
        options={{ title: t('results.title') }}
      />
      <Stack.Screen
        name="DogDetail"
        component={DogDetailScreen}
        options={{ title: t('dogDetails.title') }}
      />
      <Stack.Screen name="PokedexScreen" component={PokedexScreen} />
    </Stack.Navigator>
  );
}
