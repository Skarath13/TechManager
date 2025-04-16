import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
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

// Define Service and Style types/enums for better type safety
export type ServiceType = 'Full Set' | 'Refill' | 'Other';
export type StyleType = 
  | 'Natural Set' | 'Elegant Set' | 'Mega Set' // For Full Set
  | 'Natural Fill' | 'Elegant Fill' | 'Mega Fill' // For Refill
  | 'Removal' | 'Super Mega' | 'New Client' | 'Other'; // For Other

// Define Days Since options
export type DaysSinceType = '1-7 days' | '8-14 days' | '15-28 days';
export const DAYS_SINCE_OPTIONS: DaysSinceType[] = ['1-7 days', '8-14 days', '15-28 days'];

// Map services to their corresponding styles
export const STYLE_OPTIONS: Record<ServiceType, StyleType[]> = {
  'Full Set': ['Natural Set', 'Elegant Set', 'Mega Set'],
  'Refill': ['Natural Fill', 'Elegant Fill', 'Mega Fill'],
  'Other': ['Removal', 'Super Mega', 'New Client', 'Other'],
};

// --- Add Pricing Rules --- 
const PRICING_RULES = {
  'Full Set': {
    'Natural Set': 95,
    'Elegant Set': 105,
    'Mega Set': 125,
  },
  'Refill': {
    'Natural Fill': {
      '1-7 days': 60,
      '8-14 days': 70,
      '15-28+ days': 80,
    },
    'Elegant Fill': {
      '1-7 days': 60,
      '8-14 days': 70,
      '15-28+ days': 80,
    },
    'Mega Fill': {
      '1-7 days': 70,
      '8-14 days': 80,
      '15-28+ days': 90,
    },
  },
  'Other': { // Default to 0 for these, requires manual input
    'Removal': 35,
    'Super Mega': 135,
    'New Client': 75,
    'Other': 0, // Price for the new 'Other' style
  }
};
// --- End Pricing Rules ---

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, session } = useAuth();
  const locationState = location.state as LocationState;

  const [amount, setAmount] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'venmo' | 'zelle' | null>(null);
  const [tipMethod, setTipMethod] = useState<'cash' | 'card' | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StyleType | null>(null);
  const [selectedDaysSince, setSelectedDaysSince] = useState<DaysSinceType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
  
  // --- Add useEffect for Predictive Pricing --- 
  useEffect(() => {
    let predictedAmount = 0;
    if (selectedService && selectedStyle) {
      const servicePricing = PRICING_RULES[selectedService];
      if (selectedService === 'Full Set' || selectedService === 'Other') {
        predictedAmount = (servicePricing as Record<string, number>)[selectedStyle] ?? 0;
      } else if (selectedService === 'Refill' && selectedDaysSince) {
        const stylePricing = (servicePricing as Record<string, Record<string, number>>)[selectedStyle];
        if (stylePricing) {
          predictedAmount = stylePricing[selectedDaysSince] ?? 0;
        }
      }
    }

    // Apply cash discount if applicable
    const isDiscountApplicable = 
      (selectedService === 'Full Set' || selectedService === 'Refill' || (selectedService === 'Other' && selectedStyle === 'Super Mega'));
      
    if (paymentMethod === 'cash' && isDiscountApplicable && predictedAmount > 0) {
      predictedAmount = Math.max(0, predictedAmount - 10); // Subtract $10, ensure not negative
    }

    // Update amount state only if a valid prediction exists and the price is greater than 0
    // Allow $0 for 'Other' -> 'Other' case, requiring manual input
    if (predictedAmount > 0 || (selectedService === 'Other' && selectedStyle === 'Other')) {
      setAmount(String(predictedAmount));
    } else if (!selectedService || !selectedStyle || (selectedService === 'Refill' && !selectedDaysSince)) {
      // Clear amount if selection is incomplete or invalid, prevents showing stale price
      setAmount(''); 
    }
    // If predictedAmount is 0 due to non-cash payment for 'Other'->'Other', keep it as 0 to signal manual entry
    // Do nothing if predictedAmount is 0 for other reasons (like invalid combo before discount)

  }, [selectedService, selectedStyle, selectedDaysSince, paymentMethod]); // Rerun when selections OR payment method change
  // --- End useEffect ---

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

    if (!amount || !paymentMethod || !selectedService || !selectedStyle || (selectedService === 'Refill' && !selectedDaysSince)) {
      setNotification({
        open: true,
        type: 'error',
        message: 'Please fill in all required fields (Service, Style, Payment Method, Amount' + (selectedService === 'Refill' ? ', Days Since' : '') + ')',
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
        service: selectedService,
        style: selectedStyle,
        days_since_last_appointment: selectedService === 'Refill' ? selectedDaysSince : null,
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
      setSelectedService(null);
      setSelectedStyle(null);
      setSelectedDaysSince(null);

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

  const handleServiceChange = (_: React.MouseEvent<HTMLElement>, newService: ServiceType | null) => {
    setSelectedService(newService);
    setSelectedStyle(null);
    setSelectedDaysSince(null);
  };

  const handleStyleChange = (_: React.MouseEvent<HTMLElement>, newStyle: StyleType | null) => {
    setSelectedStyle(newStyle);
  };

  const handleDaysSinceChange = (_: React.MouseEvent<HTMLElement>, newDaysSince: DaysSinceType | null) => {
    setSelectedDaysSince(newDaysSince);
  };

  const currentStyleOptions = selectedService ? STYLE_OPTIONS[selectedService] : [];

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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography color="text.secondary">
              Location: <strong>{LOCATION_DISPLAY_NAMES[locationState?.location] || locationState?.location}</strong>
            </Typography>
            <Typography color="text.secondary">
              Technician: <strong>{locationState?.technician}</strong>
            </Typography>
          </Box>
        </Paper>

        <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 600 }}>
            Select Service
          </Typography>
          <ToggleButtonGroup
            value={selectedService}
            exclusive
            onChange={handleServiceChange}
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
            <ToggleButton value="Full Set">Full Set</ToggleButton>
            <ToggleButton value="Refill">Refill</ToggleButton>
            <ToggleButton value="Other">Other</ToggleButton>
          </ToggleButtonGroup>
        </Paper>

        <Collapse in={selectedService !== null} sx={{ width: '100%' }}>
          <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 600 }}>
              Select Style
            </Typography>
            {selectedService && currentStyleOptions.length > 0 ? (
              <ToggleButtonGroup
                value={selectedStyle}
                exclusive
                onChange={handleStyleChange}
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
                {currentStyleOptions.map((style) => (
                  <ToggleButton key={style} value={style}>
                    {style}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            ) : (
              <Typography color="text.secondary">Please select a service first.</Typography>
            )}
          </Paper>
        </Collapse>

        <Collapse in={selectedService === 'Refill'} sx={{ width: '100%' }}>
          <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 600 }}>
              Days Since Last Appointment
            </Typography>
            <ToggleButtonGroup
              value={selectedDaysSince}
              exclusive
              onChange={handleDaysSinceChange}
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
              {DAYS_SINCE_OPTIONS.map((option) => (
                <ToggleButton key={option} value={option}>
                  {option}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Paper>
        </Collapse>

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

          <Collapse in={paymentMethod !== null}>
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
          </Collapse>
        </Paper>

        <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 600 }}>
            Add Tip
          </Typography>
          
          <Box sx={{ mb: 2 }}> 
            <Typography variant="body1" gutterBottom sx={{ color: 'text.secondary', mb: 1 }}>
              Tip Method (Optional)
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
              <ToggleButton value="cash">Cash 💵</ToggleButton>
              <ToggleButton value="card">Card 💳</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Collapse in={tipMethod !== null}>
            <TextField
              fullWidth
              label="Tip Amount"
              type="number"
              required={tipMethod !== null}
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              InputProps={{
                startAdornment: <span>$</span>
              }}
            />
          </Collapse>
        </Paper>

        <Box sx={{ textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleSubmit}
            disabled={!amount || !paymentMethod || !selectedService || !selectedStyle || (selectedService === 'Refill' && !selectedDaysSince) || isSubmitting}
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