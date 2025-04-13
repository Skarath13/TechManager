import React from 'react';
import { 
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
  Link,
  Outlet
} from 'react-router-dom';
import { Box, AppBar, Toolbar, Button, Container, ButtonGroup } from '@mui/material';
import OrderForm from './components/OrderForm';
import { TransactionManager } from './components/TransactionManager';
import { TechSummary } from './components/TechSummary';
import Checkout from './components/Checkout';
import flawlessLashesLogo from './assets/flawless-lashes-logo.png';

function AppLayout() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" color="primary" elevation={0} sx={{ bgcolor: 'background.paper' }}>
        <Toolbar sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          minHeight: '64px',
          px: 3
        }}>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
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

          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
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
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<AppLayout />}>
      <Route index element={<OrderForm />} />
      <Route path="transactions" element={<TransactionManager />} />
      <Route path="tech_summary" element={<TechSummary />} />
      <Route path="checkout" element={<Checkout />} />
    </Route>
  )
);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
