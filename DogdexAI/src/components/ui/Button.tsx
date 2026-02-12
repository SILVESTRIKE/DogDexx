import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  onPress: () => void;
  title?: string;
  variant?: 'default' | 'outline';
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  title,
  variant = 'default',
  disabled = false,
  fullWidth = false,
  style,
}) => {
  const styles = createStyles();
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variant === 'outline' ? styles.outlineButton : styles.defaultButton,
        disabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === 'outline' ? styles.outlineText : styles.defaultText,
          disabled && styles.disabledText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const createStyles = () =>
  StyleSheet.create({
    button: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    defaultButton: {
      backgroundColor: '#000',
    },
    outlineButton: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#e0e0e0',
    },
    defaultText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    outlineText: {
      color: '#000',
      fontSize: 16,
      fontWeight: '600',
    },
    text: {
      fontSize: 16,
      fontWeight: '600',
    },
    disabled: {
      opacity: 0.5,
    },
    disabledText: {
      opacity: 0.6,
    },
    fullWidth: {
      width: '100%',
    },
  });
