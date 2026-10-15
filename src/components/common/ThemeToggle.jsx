import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function ThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const label = `Switch to ${nextTheme} mode`;

  return (
    <button
      type="button"
      className={`theme-toggle${compact ? ' theme-toggle--compact' : ''}`}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'light' ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
      {!compact && <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>}
    </button>
  );
}
