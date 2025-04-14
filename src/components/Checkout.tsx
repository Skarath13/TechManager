import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import NotificationModal from './NotificationModal';
import { useAuth } from '../contexts/AuthContext';

// Add LOCATION_DISPLAY_NAMES map here too, or import from a shared file
const LOCATION_DISPLAY_NAMES: Record<string, string> = {
  'irvine': 'Irvine',
  'tustin': 'Tustin',
  'santa_ana': 'Santa Ana',
  'costa_mesa': 'Costa Mesa'
};

interface LocationState {
  location: string;
  technician: string;
}

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, session } = useAuth();
  const locationState = location.state as LocationState;

  const [amount, setAmount] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'venmo' | 'zelle' | null>(null);
  const [tipMethod, setTipMethod] = useState<'card' | 'cash' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTipOptions, setShowTipOptions] = useState(false);
  
  // Notification state
  const [notification, setNotification] = useState<{
    open: boolean;
    type: 'success' | 'error';
    message: string;
  }>({
    open: false,
    type: 'success',
    message: '',
  });
  
  // Check authentication and required state
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { 
        replace: true,
        state: { from: location }
      });
      return;
    }

    if (!locationState) {
      navigate('/', { replace: true });
      return;
    }
  }, [isAuthenticated, locationState, navigate, location]);

  // If no state or not authenticated, don't render the form
  if (!locationState || !isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!amount || !paymentMethod) {
      setNotification({
        open: true,
        type: 'error',
        message: 'Please fill in all required fields'
      });
      setIsSubmitting(false);
      return;
    }

    if (!isAuthenticated) {
      navigate('/login', { 
        replace: true,
        state: { from: location }
      });
      setIsSubmitting(false); 
      return;
    }

    try {
      const orderData = {
        technician_name: locationState.technician,
        location: locationState.location,
        total: parseFloat(amount),
        tip: tipAmount ? parseFloat(tipAmount) : null,
        payment_method: paymentMethod,
        tip_method: tipMethod || null,
      };

      const { error } = await supabase
        .from('orders')
        .insert([orderData]);

      if (error) {
        console.error('Supabase insert error:', error);
        throw new Error(error.message || 'Failed to submit order via Supabase client');
      }

      setNotification({
        open: true,
        type: 'success',
        message: 'Order submitted successfully!'
      });
      setAmount('');
      setTipAmount('');
      setPaymentMethod(null);
      setTipMethod(null);
      setShowTipOptions(false);

    } catch (error) {
      console.error('Error submitting order:', error);
      setNotification({ 
        open: true,
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to submit order'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
    if (notification.type === 'success') {
      navigate('/');
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, p: 3, position: 'relative' }}>
      <Button 
        onClick={() => navigate(-1)}
        variant="contained"
        sx={{ 
          position: 'absolute',
          left: 0,
          top: 0,
          mb: 2,
          background: 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)',
          boxShadow: '0 2px 4px rgba(255, 183, 197, 0.3)',
          color: 'text.primary',
          '&:hover': {
            background: 'linear-gradient(45deg, #FFC8D3 30%, #FFD9E0 90%)',
            boxShadow: '0 3px 6px rgba(255, 183, 197, 0.4)',
          },
          borderRadius: '20px',
          px: 3,
          py: 1
        }}
        startIcon={<span>←</span>}
      >
        Back
      </Button>

      <Box sx={{ mt: 5 }}>
        <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 600 }}>
            Order Details
          </Typography>
          <Typography color="text.secondary">
            Location: {LOCATION_DISPLAY_NAMES[locationState?.location] || locationState?.location}
          </Typography>
          <Typography color="text.secondary">
             Technician: {locationState?.technician}
           </Typography>
        </Paper>

        <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 600 }}>
            Payment Method
          </Typography>
          <ToggleButtonGroup
            value={paymentMethod}
            exclusive
            onChange={(_, value) => setPaymentMethod(value)}
            fullWidth
            sx={{
              mb: 2,
              '& .MuiToggleButton-root': {
                bgcolor: 'background.paper',
                color: 'text.primary',
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'background.paper',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                },
                '&:hover': {
                  bgcolor: 'primary.light',
                },
              },
            }}
          >
            <ToggleButton value="cash">Cash</ToggleButton>
            <ToggleButton value="card">Card</ToggleButton>
            <ToggleButton value="venmo">Venmo</ToggleButton>
            <ToggleButton value="zelle">Zelle</ToggleButton>
          </ToggleButtonGroup>

          {paymentMethod && (
            <TextField
              fullWidth
              label="Total Amount"
              type="number"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              InputProps={{
                startAdornment: <span>$</span>
              }}
            />
          )}
        </Paper>

        <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 600 }}>
            Add Tip?
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setShowTipOptions(!showTipOptions);
              if (!showTipOptions) {
                setTipMethod(null);
                setTipAmount('');
              }
            }}
            sx={{ mb: showTipOptions ? 2 : 0 }}
          >
            {showTipOptions ? 'Remove Tip' : 'Add Tip'}
          </Button>

          {showTipOptions && (
            <>
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="body1" gutterBottom>
                  Tip Method
                </Typography>
                <ToggleButtonGroup
                  value={tipMethod}
                  exclusive
                  onChange={(_, value) => setTipMethod(value)}
                  fullWidth
                  sx={{
                    '& .MuiToggleButton-root': {
                      bgcolor: 'background.paper',
                      color: 'text.primary',
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'background.paper',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                      },
                      '&:hover': {
                        bgcolor: 'primary.light',
                      },
                    },
                  }}
                >
                  <ToggleButton value="cash">Cash</ToggleButton>
                  <ToggleButton value="card">Card</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {tipMethod && (
                <TextField
                  fullWidth
                  label="Tip Amount"
                  type="number"
                  required
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  InputProps={{
                    startAdornment: <span>$</span>
                  }}
                />
              )}
            </>
          )}
        </Paper>

        <Box sx={{ textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleSubmit}
            disabled={!amount || !paymentMethod || isSubmitting}
            sx={{
              background: 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)',
              boxShadow: '0 3px 5px 2px rgba(255, 183, 197, .3)',
              color: 'text.primary',
              '&:hover': {
                background: 'linear-gradient(45deg, #FFC8D3 30%, #FFD9E0 90%)',
              },
              '&:disabled': {
                background: '#E0E0E0',
                color: '#9E9E9E',
              }
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Order 💖'}
          </Button>
        </Box>

        <NotificationModal
          open={notification.open}
          onClose={handleCloseNotification}
          type={notification.type}
          message={notification.message}
        />
      </Box>
    </Box>
  );
};

export default Checkout; 