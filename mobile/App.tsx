import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { colors } from './src/theme/colors';

type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthNavigation() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <>
            <Stack.Screen name="Welcome">
              {({ navigation }) => (
                <WelcomeScreen onLogin={() => navigation.navigate('Login')} onRegister={() => navigation.navigate('Register')} />
              )}
            </Stack.Screen>
            <Stack.Screen name="Login">
              {({ navigation }) => (
                <LoginScreen
                  onGoRegister={() => navigation.navigate('Register')}
                  onForgotPassword={() => navigation.navigate('ForgotPassword')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Register">
              {({ navigation }) => <RegisterScreen onGoLogin={() => navigation.navigate('Login')} />}
            </Stack.Screen>
            <Stack.Screen name="ForgotPassword">
              {({ navigation }) => <ForgotPasswordScreen onBack={() => navigation.navigate('Login')} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthNavigation />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
