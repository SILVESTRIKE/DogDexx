import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HistoryScreen from '../screens/history/history-screen';

import { useI18n } from '../lib/i18n-context';
import ResultsScreen from '../screens/results/result-screens';
import DogDetailScreen from '../screens/dog/dog-detail-screen';
import PokedexScreen from '../screens/pokedex/pokedex-screen';
import { View } from 'react-native';
import DrawerButton from './DrawerButton';
export type HistoryStackParamList = {
  HistoryScreen: undefined;
  ResulteScreen: any;
  DogDetail: any;
  PokedexScreen: any;
};
const Stack = createNativeStackNavigator<HistoryStackParamList>();
export default function HistoryStack() {
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
      <Stack.Screen name="HistoryScreen" component={HistoryScreen} options={{ title: t('nav.history') }}/>
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
