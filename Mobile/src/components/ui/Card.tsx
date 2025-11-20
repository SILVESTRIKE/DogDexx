import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  featured?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, featured }) => {
  const styles = createStyles();
  
  return (
    <View
      style={[
        styles.card,
        featured && styles.featured,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 24,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    featured: {
      borderWidth: 2,
      borderColor: '#000',
    },
  });
