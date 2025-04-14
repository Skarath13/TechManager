import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(45deg, #FFF5F7 30%, #FFF8FA 90%)',
        }}
      >
        <CircularProgress
          size={60}
          thickness={4}
          sx={{
            color: '#FFB7C5',
            mb: 3,
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
            },
          }}
        />
        <Typography
          variant="h6"
          sx={{
            color: '#2c3e50',
            fontWeight: 500,
            textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            '@keyframes pulse': {
              '0%, 100%': {
                opacity: 1,
              },
              '50%': {
                opacity: 0.7,
              },
            },
          }}
        >
          Loading your dashboard...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page but save the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // If a specific role is required and user doesn't have it, redirect to home
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
} 