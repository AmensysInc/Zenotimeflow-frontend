import React, { useState, useEffect } from 'react';
import { Platform, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import LoginScreen from '../screens/LoginScreen';
import ClockInLoginScreen from '../screens/ClockInLoginScreen';
import ClockInScreen from '../screens/ClockInScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import CompaniesScreen from '../screens/CompaniesScreen';
import EmployeesScreen from '../screens/EmployeesScreen';
import MissedShiftsScreen from '../screens/MissedShiftsScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import EmployeeScheduleScreen from '../screens/EmployeeScheduleScreen';
import CalendarScreen from '../screens/CalendarScreen';
import TasksScreen from '../screens/TasksScreen';
import FocusScreen from '../screens/FocusScreen';
import HabitsScreen from '../screens/HabitsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MenuScreen from '../screens/MenuScreen';
import AccountScreen from '../screens/AccountScreen';
import ChecklistsScreen from '../screens/ChecklistsScreen';
import UserManagementScreen from '../screens/UserManagementScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const iconMap: Record<string, string> = {
  Calendar: '📅',
  Dashboard: '📊',
  Tasks: '✓',
  Focus: '⏱',
  Companies: '🏢',
  Employees: '👥',
  Missed: '⚠',
  Clock: '🕐',
  Habits: '💪',
  Profile: '👤',
  Menu: '≡',
};

const tabBarTheme = {
  headerStyle: { backgroundColor: '#ffffff' },
  headerTintColor: '#0f172a',
  tabBarStyle: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    height: 64,
  },
  tabBarActiveTintColor: '#3b82f6',
  tabBarInactiveTintColor: '#64748b',
  tabBarLabelStyle: { fontSize: 10, marginTop: 2 },
  tabBarIconStyle: { marginBottom: 0 },
};

function TabIcon({ name }: { name: string }) {
  return (
    <View style={styles.tabIconWrap}>
      <Text style={styles.tabIconEmoji}>{iconMap[name] ?? '•'}</Text>
    </View>
  );
}

function EmployeeTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarTheme}>
      <Tab.Screen name="Clock" component={ClockInScreen} options={{ tabBarIcon: () => <TabIcon name="Clock" /> }} />
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: () => <TabIcon name="Dashboard" /> }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarIcon: () => <TabIcon name="Calendar" /> }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ tabBarIcon: () => <TabIcon name="Tasks" /> }} />
      <Tab.Screen name="Focus" component={FocusScreen} options={{ tabBarIcon: () => <TabIcon name="Focus" /> }} />
      <Tab.Screen name="Habits" component={HabitsScreen} options={{ tabBarIcon: () => <TabIcon name="Habits" /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: () => <TabIcon name="Profile" /> }} />
    </Tab.Navigator>
  );
}

function MenuStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#0f172a',
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="MenuList" component={MenuScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Focus" component={FocusScreen} options={{ title: 'Focus Hours' }} />
      <Stack.Screen name="Habits" component={HabitsScreen} options={{ title: 'Daily Routines' }} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'Schedule' }} />
      <Stack.Screen name="EmployeeSchedule" component={EmployeeScheduleScreen} options={{ title: 'Employee Schedule' }} />
      <Stack.Screen name="MissedShifts" component={MissedShiftsScreen} options={{ title: 'Missed Shifts' }} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="Checklists" component={ChecklistsScreen} options={{ title: 'Check Lists' }} />
      <Stack.Screen name="UserManagement" component={UserManagementScreen} options={{ title: 'User Management' }} />
    </Stack.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarTheme}>
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarIcon: () => <TabIcon name="Calendar" /> }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ tabBarIcon: () => <TabIcon name="Tasks" /> }} />
      <Tab.Screen name="Companies" component={CompaniesScreen} options={{ tabBarIcon: () => <TabIcon name="Companies" /> }} />
      <Tab.Screen name="Employees" component={EmployeesScreen} options={{ tabBarIcon: () => <TabIcon name="Employees" /> }} />
      <Tab.Screen name="Clock" component={ClockInScreen} options={{ tabBarIcon: () => <TabIcon name="Clock" /> }} />
      <Tab.Screen name="Menu" component={MenuStack} options={{ tabBarIcon: () => <TabIcon name="Menu" /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: () => <TabIcon name="Profile" /> }} />
    </Tab.Navigator>
  );
}

function getInitialAuthScreen(): 'Login' | 'ClockInLogin' {
  if (Platform.OS === 'web') {
    const w = typeof globalThis !== 'undefined' ? (globalThis as any).window : null;
    const search = w?.location?.search;
    if (search) {
      const intent = new URLSearchParams(search).get('intent');
      if (intent === 'clockin') return 'ClockInLogin';
    }
  }
  return 'Login';
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading, loginIntent } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [initialAuthScreen, setInitialAuthScreen] = useState<'Login' | 'ClockInLogin'>(() => getInitialAuthScreen());

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Linking.getInitialURL().then((url) => {
        if (url?.includes('intent=clockin')) setInitialAuthScreen('ClockInLogin');
      });
    }
  }, []);

  if (isLoading || (isAuthenticated && loginIntent !== 'clockin' && roleLoading)) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialAuthScreen}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login">
              {({ navigation }) => (
                <LoginScreen onClockIn={() => navigation.navigate('ClockInLogin')} />
              )}
            </Stack.Screen>
            <Stack.Screen name="ClockInLogin">
              {({ navigation }) => (
                <ClockInLoginScreen onBack={() => navigation.goBack()} />
              )}
            </Stack.Screen>
          </>
        ) : loginIntent === 'clockin' ? (
          <Stack.Screen name="ClockInOnly" component={ClockInScreen} />
        ) : isAdmin ? (
          <Stack.Screen name="Main" component={AdminTabs} />
        ) : (
          <Stack.Screen name="Main" component={EmployeeTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: { color: '#64748b', fontSize: 16 },
  tabIconWrap: { alignItems: 'center', justifyContent: 'center' },
  tabIconEmoji: { fontSize: 20 },
});
