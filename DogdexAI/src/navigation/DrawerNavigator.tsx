import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import RootNavigator, { RootStackParamList } from './RootNavigator';
import { useAuth } from '../lib/auth-context';
import { useI18n } from '../lib/i18n-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LanguageToggle } from '../components/LanguageToggle';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Context để quản lý drawer
export const DrawerContext = React.createContext({
  openDrawer: () => { },
  closeDrawer: () => { },
});
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DrawerNavigator() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigation = useNavigation<NavigationProp>();
  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  return (
    <DrawerContext.Provider value={{ openDrawer, closeDrawer }}>
      <View style={{ flex: 1 }}>
        {/* RootNavigator bên trong */}
        <RootNavigator />

        {/* Custom Drawer Modal */}
        <Modal
          visible={isDrawerOpen}
          transparent
          animationType="slide"
          onRequestClose={closeDrawer}
        >
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={closeDrawer}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={styles.drawer}
              onPress={() => { }}
            >
              <SafeAreaView style={styles.drawerContent}>
                {/* Header */}
                <View style={styles.drawerHeader}>
                  <TouchableOpacity
                    onPress={closeDrawer}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                  <Text style={styles.drawerTitle}>Menu</Text>
                  <View style={{ width: 40 }} />
                </View>

                {/* User Info */}
                <View style={styles.userInfo}>
                  <View style={styles.avatarContainer}>
                    <Ionicons
                      name="person-circle-outline"
                      size={70}
                      color="#007AFF"
                    />
                  </View>
                  <Text style={styles.userName}>
                    {user?.username || 'User'}
                  </Text>
                  <Text style={styles.userEmail}>{user?.email}</Text>
                  <View
                    style={[
                      styles.roleBadge,
                      user?.role === 'admin'
                        ? styles.adminBadge
                        : styles.userBadge,
                    ]}
                  >
                    <Text style={styles.userRole}>
                      {user?.role === 'admin' ? 'Administrator' : 'User'}
                    </Text>
                  </View>
                </View>

                {/* Menu Items */}
                <ScrollView
                  style={styles.menuItems}
                  showsVerticalScrollIndicator={false}
                >
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      closeDrawer();
                      navigation.navigate('Pricing'); // 👈 chuyển hướng đến PricingScreen
                    }}
                  >
                    <View style={styles.menuIcon}>
                      <Ionicons
                        name="settings-outline"
                        size={22}
                        color="#007AFF"
                      />
                    </View>
                    <Text style={styles.menuText}>
                      {t('pricing.upgrade') || 'Upgrade'}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#999"
                      style={styles.chevron}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem}
                    onPress={() => {
                      closeDrawer();
                      navigation.navigate('RankScreen'); // 👈 chuyển hướng đến PricingScreen
                    }}
                  >
                    <View style={styles.menuIcon}>
                      <Ionicons
                        name="help-circle-outline"
                        size={22}
                        color="#007AFF"
                      />
                    </View>
                    <Text style={styles.menuText}>
                      {'Rank'}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#999"
                      style={styles.chevron}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      closeDrawer();
                      navigation.navigate('AboutScreen');
                    }}
                  >
                    <View style={styles.menuIcon}>
                      <Ionicons
                        name="information-circle-outline"
                        size={22}
                        color="#007AFF"
                      />
                    </View>
                    <Text style={styles.menuText}>
                      {t('footer.about') || 'About'}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#999"
                      style={styles.chevron}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      closeDrawer();
                      navigation.navigate('ProfileScreen1');
                    }}
                  >
                    <View style={styles.menuIcon}>
                      <Ionicons
                        name="person-outline"
                        size={22}
                        color="#007AFF"
                      />
                    </View>
                    <Text style={styles.menuText}>
                      {t('nav.profile') || 'Profile'}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#999"
                      style={styles.chevron}
                    />
                  </TouchableOpacity>

                  <View style={styles.languageToggleContainer}>
                    <LanguageToggle />
                  </View>

                  <View style={styles.divider} />

                  {user?.username !== 'Guest' && (
                    <TouchableOpacity
                      style={[styles.menuItem, styles.logoutItem]}
                      onPress={() => {
                        closeDrawer();
                        logout();
                      }}
                    >
                      <View style={[styles.menuIcon, styles.logoutIcon]}>
                        <Ionicons
                          name="log-out-outline"
                          size={22}
                          color="#DC3545"
                        />
                      </View>
                      <Text style={[styles.menuText, styles.logoutText]}>
                        {t('nav.logout') || 'Logout'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>Version 1.0.0</Text>
                  <Text style={styles.footerSubText}>© 2024 Your Company</Text>
                </View>
              </SafeAreaView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </DrawerContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
  },
  drawer: {
    width: '80%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 15,
  },
  drawerContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.3,
  },
  userInfo: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 28,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
  },
  avatarContainer: {
    marginBottom: 16,
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  userEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 14,
  },
  roleBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  adminBadge: {
    backgroundColor: '#007AFF',
  },
  userBadge: {
    backgroundColor: '#34C759',
  },
  userRole: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  menuItems: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
    letterSpacing: -0.2,
  },
  chevron: {
    marginLeft: 'auto',
    opacity: 0.4,
  },
  languageToggleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
    marginHorizontal: 32,
  },
  logoutItem: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    shadowColor: '#DC3545',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutIcon: {
    backgroundColor: '#FEE2E2',
  },
  logoutText: {
    color: '#DC3545',
    fontWeight: '700',
  },
  footer: {
    padding: 24,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  footerText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 6,
  },
  footerSubText: {
    fontSize: 12,
    color: '#C7C7CC',
    fontWeight: '500',
  },
});