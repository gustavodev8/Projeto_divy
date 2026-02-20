/**
 * DIVY - App Navigator
 * Gerencia navegação do app (Auth Stack + Main Stack)
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { RootStackParamList } from '../types/navigation';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import TasksScreen from '../screens/TasksScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';

const Stack = createStackNavigator<RootStackParamList>();

// Auth Stack (Login, Register)
const AuthNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

// Main Stack (Home, Tasks, etc)
const MainNavigator: React.FC = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Home"
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Tasks"
      component={TasksScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="TaskDetail"
      component={TaskDetailScreen}
      options={{
        headerShown: false,
        // Fade puro em entrada E saída — interpola opacidade nos dois sentidos
        cardStyleInterpolator: ({ current, closing }) => ({
          cardStyle: {
            opacity: closing
              ? current.progress   // saindo: 1 → 0
              : current.progress,  // entrando: 0 → 1
          },
        }),
        transitionSpec: {
          open:  { animation: 'timing', config: { duration: 220 } },
          close: { animation: 'timing', config: { duration: 200 } },
        },
      }}
    />
  </Stack.Navigator>
);

// Root Navigator
const AppNavigator: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  // Loading
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator;
