/**
 * DIVY - Theme Types
 * Tipos para o Design System
 */

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceHover: string;
  surfaceCard: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textWhite: string;
  border: string;
  borderFocus: string;
  success: string;
  successLight: string;
  error: string;
  errorLight: string;
  warning: string;
  warningLight: string;
  info: string;
  infoLight: string;
  priorityHigh: string;
  priorityMedium: string;
  priorityLow: string;
  overlay: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface ThemeBorderRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface ThemeFontSize {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
}

export interface ThemeFontWeight {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
}

export interface ThemeShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface Theme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  fontSize: ThemeFontSize;
  fontWeight: ThemeFontWeight;
  shadows: {
    sm: ThemeShadow;
    md: ThemeShadow;
    lg: ThemeShadow;
  };
}
