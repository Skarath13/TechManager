import React from 'react';
import { Link } from 'react-router-dom';
import { Box, AppBar, Toolbar, Button, ButtonGroup, Chip, keyframes } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import flawlessLashesLogo from '../assets/flawless-lashes-logo.png';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const ping = keyframes`
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(82, 183, 136, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(82, 183, 136, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(82, 183, 136, 0);
  }
`;

export function Navbar() {
  const { user, logout, hasLocationAccess } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <AppBar position="static" color="primary" elevation={0} sx={{ bgcolor: 'background.paper' }}>
      <Toolbar sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        minHeight: '64px',
        px: 3
      }}>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 2 }}>
          <Button
            component={Link}
            to="/"
            variant="contained"
            sx={{
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
          >
            💰 New Order
          </Button>
          
          {/* User Status Chip - Moved here */}
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Chip
              icon={<AccountCircleIcon />}
              label={`${user?.name || 'Guest'} (${user?.role || 'none'})`}
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'success.main',
                '& .MuiChip-icon': {
                  ml: 0.5
                }
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                right: -26,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 8,
                height: 8,
                bgcolor: 'success.main',
                borderRadius: '50%',
                animation: `${ping} 1.5s cubic-bezier(0, 0, 0.2, 1) infinite`,
                zIndex: 1
              }}
            />
          </Box>
        </Box>
        
        <Box sx={{ 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%)',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'auto'
        }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none'
            }}
          >
            <Box
              component="img"
              src={flawlessLashesLogo}
              alt="Flawless Lashes Logo"
              sx={{
                height: '45px',
                width: 'auto',
                filter: 'drop-shadow(0 0 10px rgba(255, 183, 197, 0.5))',
                transition: 'all 0.3s ease',
                '&:hover': {
                  filter: 'drop-shadow(0 0 12px rgba(255, 183, 197, 0.7))',
                  transform: 'scale(1.05)'
                }
              }}
            />
          </Link>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 2, alignItems: 'center' }}>
          <ButtonGroup
            variant="contained"
            sx={{
              '& .MuiButton-root': {
                background: 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)',
                boxShadow: '0 2px 4px rgba(255, 183, 197, 0.3)',
                color: 'text.primary',
                '&:hover': {
                  background: 'linear-gradient(45deg, #FFC8D3 30%, #FFD9E0 90%)',
                  boxShadow: '0 3px 6px rgba(255, 183, 197, 0.4)',
                },
                borderRadius: '20px !important',
                px: 3,
                py: 1,
                border: 'none',
                '&:not(:last-child)': {
                  marginRight: 1
                }
              }
            }}
          >
            <Button
              component={Link}
              to="/transactions"
            >
              📊 Transactions
            </Button>
            <Button
              component={Link}
              to="/tech_summary"
            >
              👩‍💼 Tech Summary
            </Button>
          </ButtonGroup>

          {/* Logout Button */}
          <Button
            onClick={handleLogout}
            variant="contained"
            startIcon={<LogoutIcon />}
            sx={{
              background: 'linear-gradient(45deg, #ff9999 30%, #ffb3b3 90%)',
              boxShadow: '0 2px 4px rgba(255, 153, 153, 0.3)',
              color: 'text.primary',
              '&:hover': {
                background: 'linear-gradient(45deg, #ffb3b3 30%, #ffcccc 90%)',
                boxShadow: '0 3px 6px rgba(255, 153, 153, 0.4)',
              },
              borderRadius: '20px',
              ml: 2
            }}
          >
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
} 