import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { ReportIncidentScreen } from './src/screens/ReportIncidentScreen';
import { MyReportsScreen } from './src/screens/MyReportsScreen';
import { IncidentDetailsScreen } from './src/screens/IncidentDetailsScreen';
import { SubmissionResultScreen } from './src/screens/SubmissionResultScreen';
import { colors } from './src/theme/colors';
import { initializeIncidentDatabase } from './src/services/incidentQueue';
import { startIncidentSyncManager, stopIncidentSyncManager } from './src/services/incidentSync';

type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Home: undefined;
  ReportIncident: undefined;
  MyReports: undefined;
  IncidentDetails: { incidentId?: string; localId?: string };
  SubmissionResult: import('./src/types/incidents').SubmissionResultParams;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthNavigation() {
  const { user, tokens, initializing } = useAuth();

  useEffect(() => {
    initializeIncidentDatabase();
  }, []);

  useEffect(() => {
    if (user && tokens) void startIncidentSyncManager(tokens.accessToken, user.id);
    else stopIncidentSyncManager();
    return stopIncidentSyncManager;
  }, [tokens, user]);

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
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="ReportIncident" component={ReportIncidentScreen} />
            <Stack.Screen name="MyReports" component={MyReportsScreen} />
            <Stack.Screen name="IncidentDetails" component={IncidentDetailsScreen} />
            <Stack.Screen name="SubmissionResult" component={SubmissionResultScreen} />
          </>
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
