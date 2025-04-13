import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom';

// Suppress React Router deprecation warnings
const originalConsoleWarn = console.warn;
console.warn = function filterWarnings(msg, ...args) {
  if (
    msg.includes('React Router') ||
    msg.includes('UNSAFE_NavigationContext')
  ) {
    return;
  }
  originalConsoleWarn(msg, ...args);
}; 