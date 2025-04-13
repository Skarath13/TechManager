import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#FF80A0', // 30% darker soft cherry blossom pink
      light: '#FF9BB5',
      dark: '#FF6686',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#B5E5CF', // Soft mint green
      light: '#D1F2E1',
      dark: '#96C7B2',
    },
    background: {
      default: '#FFF0F3',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#2C1A1D',
      secondary: '#4A2F33',
    },
  },
  typography: {
    fontFamily: '"Nunito", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      color: '#4A4A4A',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      color: '#4A4A4A',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      color: '#4A4A4A',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(135deg, #FFE6EA 0%, #FFF0F3 50%, #FFE6EA 100%)',
          minHeight: '100vh',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(90deg, #2D1F3C 0%, #3D2952 100%)',
          boxShadow: '0 2px 8px rgba(45, 31, 60, 0.15)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
        },
      },
    },
  },
});
