import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'secondary';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default' }) => {
  const styles = createStyles();
  
  return (
    <View style={[styles.badge, variant === 'secondary' ? styles.secondary : styles.default]}>
      <Text style={[styles.text, variant === 'secondary' ? styles.secondaryText : styles.defaultText]}>
        {label}
      </Text>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    badge: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      alignSelf: 'flex-start',
      marginBottom: 12,
    },
    default: {
      backgroundColor: '#000',
    },
    secondary: {
      backgroundColor: '#f0f0f0',
    },
    text: {
      fontSize: 12,
      fontWeight: '600',
    },
    defaultText: {
      color: '#fff',
    },
    secondaryText: {
      color: '#000',
    },
  });
