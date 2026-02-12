import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// import FeedScreen from '../screens/FeedScreen';
import LiveDetectionScreen from '../screens/live/live-screen';
import ResultsScreen from '../screens/results/result-screens';
import { useI18n } from '../lib/i18n-context';
import DogDetailScreen from '../screens/dog/dog-detail-screen';
import PokedexScreen from '../screens/pokedex/pokedex-screen';
import { View } from 'react-native';
import DrawerButton from './DrawerButton';

export type FeedStackParamList = {
  LiveScreen: undefined;
  ResulteScreen: any;
  DogDetail: any;
  PokedexScreen: any;
};

const Stack = createNativeStackNavigator<FeedStackParamList>();

export default function FeedStack() {
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




      <Stack.Screen name="LiveScreen" component={LiveDetectionScreen}  options={{ title: t('nav.live') }}/>
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
