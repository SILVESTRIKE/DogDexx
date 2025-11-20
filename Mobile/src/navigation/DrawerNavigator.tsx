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
  openDrawer: () => {},
  closeDrawer: () => {},
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
              onPress={() => {}}
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
                  {/* <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuIcon}>
                      <Ionicons
                        name="settings-outline"
                        size={22}
                        color="#007AFF"
                      />
                    </View>
                    <Text style={styles.menuText}>
                      {t('footer.setting') || 'Setting'}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#999"
                      style={styles.chevron}
                    />
                  </TouchableOpacity> */}
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

                  <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuIcon}>
                      <Ionicons
                        name="help-circle-outline"
                        size={22}
                        color="#007AFF"
                      />
                    </View>
                    <Text style={styles.menuText}>
                      {t('footer.help') || 'Help & Support'}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#999"
                      style={styles.chevron}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem}>
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

                  <View style={styles.languageToggleContainer}>
                    <LanguageToggle />
                  </View>

                  <View style={styles.divider} />

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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-start',
  },
  drawer: {
    width: '85%',
    height: '100%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  drawerContent: {
    flex: 1,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  userInfo: {
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
  },
  avatarContainer: {
    marginBottom: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  adminBadge: {
    backgroundColor: '#E3F2FD',
  },
  userBadge: {
    backgroundColor: '#E8F5E8',
  },
  userRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  menuItems: {
    flex: 1,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    marginVertical: 2,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },
  languageToggleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 16,
    marginHorizontal: 20,
  },
  logoutItem: {
    backgroundColor: '#fffaf5',
    borderWidth: 1,
    borderColor: '#ffeaea',
  },
  logoutIcon: {
    backgroundColor: '#fff5f5',
  },
  logoutText: {
    color: '#DC3545',
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginBottom: 4,
  },
  footerSubText: {
    fontSize: 11,
    color: '#ccc',
  },
});
