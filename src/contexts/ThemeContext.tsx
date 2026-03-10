import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeOption = 'warm-sunset' | 'ocean' | 'garden' | 'lavender' | 'rosy';

interface ThemeContextType {
  theme: ThemeOption;
  setTheme: (theme: ThemeOption) => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'warm-sunset', setTheme: () => {} });

export const themes: { id: ThemeOption; name: string; color: string }[] = [
  { id: 'warm-sunset', name: 'Warm Sunset', color: '#e07830' },
  { id: 'ocean', name: 'Ocean Breeze', color: '#2596be' },
  { id: 'garden', name: 'Garden Green', color: '#3d9956' },
  { id: 'lavender', name: 'Lavender Dreams', color: '#7c5cbf' },
  { id: 'rosy', name: 'Rosy Blush', color: '#d14d72' },
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeOption>(() => {
    return (localStorage.getItem('ndis-theme') as ThemeOption) || 'warm-sunset';
  });

  useEffect(() => {
    localStorage.setItem('ndis-theme', theme);
    const root = document.documentElement;
    root.classList.remove('theme-ocean', 'theme-garden', 'theme-lavender', 'theme-rosy');
    if (theme !== 'warm-sunset') {
      root.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
