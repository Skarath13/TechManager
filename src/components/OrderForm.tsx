import React, { useState } from 'react';
import {
  Typography,
  Box,
  Grid,
  Paper,
  Button,
  Collapse,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface Location {
  name: string;
  technicians: string[];
}

const LOCATIONS: Location[] = [
  {
    name: "Irvine Team",
    technicians: ["Katie", "Angela", "Celine", "Elena", "Gabby", "Tammy", "Fiona"]
  },
  {
    name: "Tustin Team",
    technicians: ["Alice", "Amy", "Austin", "Emma", "Hannah", "Maria", "Olivia", "Wendy"]
  },
  {
    name: "Santa Ana Team",
    technicians: ["Giana", "Macy", "Nancy", "Rosy"]
  },
  {
    name: "Costa Mesa Team",
    technicians: ["Chloe", "Lucy", "Melissa", "Natalie", "Trish", "Vivian"]
  }
];

const OrderForm: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);

  const handleLocationSelect = (locationName: string) => {
    setSelectedLocation(locationName);
    setSelectedTechnician(null);
  };

  const handleTechnicianSelect = (techName: string) => {
    setSelectedTechnician(techName);
  };

  const handleContinueToCheckout = () => {
    navigate('/checkout', { 
      state: { 
        location: selectedLocation,
        technician: selectedTechnician
      }
    });
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, p: 3 }}>
      {/* Location Selection */}
      <Typography variant="h5" gutterBottom sx={{ mb: 2, color: 'text.primary', fontWeight: 600 }}>
        Select Location
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {LOCATIONS.map((location) => (
          <Grid item xs={12} sm={6} key={location.name}>
            <Paper
              elevation={selectedLocation === location.name ? 6 : 1}
              sx={{
                p: 2,
                cursor: 'pointer',
                transition: 'all 0.3s',
                bgcolor: selectedLocation === location.name ? 'primary.main' : 'background.paper',
                color: selectedLocation === location.name ? 'background.paper' : 'text.primary',
                '&:hover': {
                  elevation: 6,
                  bgcolor: 'primary.light',
                  color: 'text.primary',
                },
              }}
              onClick={() => handleLocationSelect(location.name)}
            >
              <Typography variant="h6">{location.name}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Technician Selection */}
      <Collapse in={selectedLocation !== null}>
        <Typography variant="h5" gutterBottom sx={{ mb: 2, color: 'text.primary', fontWeight: 600 }}>
          Select Technician
        </Typography>
        <Grid container spacing={2}>
          {selectedLocation && LOCATIONS.find(loc => loc.name === selectedLocation)?.technicians.map((tech) => (
            <Grid item xs={6} sm={4} md={3} key={tech}>
              <Paper
                elevation={selectedTechnician === tech ? 6 : 1}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  textAlign: 'center',
                  bgcolor: selectedTechnician === tech ? 'primary.main' : 'background.paper',
                  color: selectedTechnician === tech ? 'background.paper' : 'text.primary',
                  '&:hover': {
                    elevation: 6,
                    bgcolor: 'primary.light',
                    color: 'text.primary',
                  },
                }}
                onClick={() => handleTechnicianSelect(tech)}
              >
                <Typography variant="h6">{tech}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Collapse>

      {/* Continue Button */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          disabled={!selectedLocation || !selectedTechnician}
          onClick={handleContinueToCheckout}
          sx={{
            '&:not(:disabled)': {
              background: 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)',
              boxShadow: '0 3px 5px 2px rgba(255, 183, 197, .3)',
              color: '#000000',
            },
            '&:disabled': {
              background: '#E0E0E0',
              color: '#9E9E9E',
            }
          }}
        >
          Continue to Checkout 🧾
        </Button>
      </Box>
    </Box>
  );
};

export default OrderForm;
