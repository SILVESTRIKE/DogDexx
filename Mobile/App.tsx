import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "./src/lib/auth-context";
import { AnalyticsProvider } from "./src/lib/analytics-context";
import { I18nProvider } from "./src/lib/i18n-context";
import HomeScreen from "./src/screens/home-screen";
import ResultsScreen from "./src/screens/results/result-screens";
import DogDetailScreen from "./src/screens/dog/dog-detail-screen";
// import ResultsScreen from "./src/screens/result-screen";
import RootNavigator from './src/navigation/RootNavigator';
import { CollectionProvider } from "./src/lib/collection-context";
import DrawerNavigator from "./src/navigation/DrawerNavigator";
const Stack = createNativeStackNavigator();

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ✅ I18nProvider bọc ngoài toàn bộ 1*/}
      <I18nProvider>
        <AuthProvider>
          <CollectionProvider>
          <AnalyticsProvider>
            <NavigationContainer>

              <DrawerNavigator />
             
            </NavigationContainer>
          </AnalyticsProvider>
          </CollectionProvider>
        </AuthProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}



export default App;
