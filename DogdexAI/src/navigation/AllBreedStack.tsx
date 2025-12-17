import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PokedexScreen from '../screens/pokedex/pokedex-screen';
import DogDetailScreen from '../screens/dog/dog-detail-screen';
import { useI18n } from '../lib/i18n-context';
import AchievementsScreen from '../screens/achievements/achievements-screen';
import { View } from 'react-native';
import DrawerButton from './DrawerButton';

export type AllBreedStackParamList = {
  PokedexScreen: any;
  DogDetail: any;
  Archievetment: any;
};

const Stack = createNativeStackNavigator<AllBreedStackParamList>();

export default function AllBreedStack() {
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
      <Stack.Screen name="PokedexScreen" component={PokedexScreen} options={{ title: t('nav.dogdex') }} />
      <Stack.Screen name="Archievetment" component={AchievementsScreen} options={{ title: t('achievements.title') }} />
      <Stack.Screen
        name="DogDetail"
        component={DogDetailScreen}
        options={{ title: t('dogDetails.title') }}
      />
    </Stack.Navigator>
  );
}
