/**
 * DIVY - Tema Global
 * Design System para o App Mobile
 */

export const theme = {
  colors: {
    // Primary Colors (Azul)
    primary: '#3b82f6',
    primaryDark: '#2563eb',
    primaryLight: '#60a5fa',

    // Background
    background: '#ffffff',
    backgroundSecondary: '#f9fafb',
    surface: '#ffffff',
    surfaceHover: '#f3f4f6',

    // Text
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    textWhite: '#ffffff',

    // Border
    border: '#e5e7eb',
    borderFocus: '#3b82f6',

    // Status
    success: '#16a34a',
    successLight: '#bbf7d0',
    error: '#dc2626',
    errorLight: '#fecaca',
    warning: '#f59e0b',
    warningLight: '#fde68a',
    info: '#3b82f6',
    infoLight: '#bfdbfe',

    // Task Priority Colors
    priorityHigh: '#dc2626',
    priorityMedium: '#f59e0b',
    priorityLow: '#16a34a',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
  },
};

export default theme;
