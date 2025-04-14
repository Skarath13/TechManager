import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  CircularProgress,
  Paper,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the redirect path from location state, default to '/'
  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !email || pin.length !== 4) return;

    try {
      setIsSubmitting(true);
      setError('');
      await login(email, pin);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to login. Check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError('');
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(value);
    setError('');
  };

  // Common TextField styles
  const textFieldStyles = {
    '& .MuiOutlinedInput-root': {
      '& fieldset': {
        borderColor: 'rgba(255, 183, 197, 0.5)',
      },
      '&:hover fieldset': {
        borderColor: 'rgba(255, 183, 197, 0.8)',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#FFB7C5',
      },
    },
    '& .MuiFormHelperText-root': {
      textAlign: 'center',
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(255, 183, 197, 0.2)',
          }}
        >
          <Typography
            component="h1"
            variant="h5"
            sx={{
              mb: 3,
              color: '#2c3e50',
              fontWeight: 600,
              textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
            }}
          >
            Welcome Back! 👋
          </Typography>

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              width: '100%',
              mt: 1,
            }}
          >
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={handleEmailChange}
              error={!!error}
              sx={textFieldStyles}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="pin"
              label="Enter 4-Digit Passcode"
              type="password"
              id="pin"
              autoComplete="current-password"
              value={pin}
              onChange={handlePinChange}
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
                maxLength: 4,
              }}
              error={!!error}
              helperText={error}
              sx={textFieldStyles}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={!email || pin.length !== 4 || isSubmitting}
              sx={{
                mt: 3,
                mb: 2,
                background: 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)',
                boxShadow: '0 3px 5px 2px rgba(255, 183, 197, .3)',
                color: 'text.primary',
                height: 48,
                padding: '0 30px',
                '&:hover': {
                  background: 'linear-gradient(45deg, #FFC8D3 30%, #FFD9E0 90%)',
                },
                '&.Mui-disabled': {
                  background: 'linear-gradient(45deg, #FFE5E5 30%, #FFF0F0 90%)',
                  color: 'rgba(0, 0, 0, 0.26)',
                },
              }}
            >
              {isSubmitting ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} sx={{ color: '#FFB7C5' }} />
                  <span>Logging in...</span>
                </Box>
              ) : (
                'Login'
              )}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
} 