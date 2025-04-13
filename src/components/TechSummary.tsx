import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Grid,
  CircularProgress,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Snackbar,
  Alert,
} from '@mui/material';
import { supabase } from '../services/supabase';
import NotificationModal from './NotificationModal';

interface TechnicianSummary {
  id: number;
  name: string;
  location: string;
  commission: number;
  cashServices: number;
  cashTotal: number;
  cashCommission: number;
  cashTips: number;
  cardServices: number;
  cardTotal: number;
  cardCommission: number;
  cardTips: number;
  cardProcessingFees: number;
  cardTipsProcessingFee: number;
  managerOwed: number;
  carryOver: number;
  isCashedOut: boolean;
  isCheckRequested: boolean;
  payLater: boolean;
  cashOutAmount: number;
}

interface ToastState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

const LOCATIONS = [
  "Irvine Team",
  "Tustin Team",
  "Santa Ana Team",
  "Costa Mesa Team"
];

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

const createSubmissionData = (tech: TechnicianSummary, isCashOut: boolean, isCheckRequest: boolean, newManagerOwed?: number) => ({
  technician_id: tech.id,
  date: getTodayDate(),
  cash_services_count: tech.cashServices || 0,
  cash_services_total: tech.cashTotal || 0,
  cash_tech_keep: tech.cashCommission || 0,
  cash_manager_keep: (tech.cashTotal || 0) - (tech.cashCommission || 0),
  cash_tips_total: tech.cashTips || 0,
  card_services_count: tech.cardServices || 0,
  card_services_total: tech.cardTotal || 0,
  card_tech_keep: tech.cardCommission || 0,
  card_manager_keep: (tech.cardTotal || 0) - (tech.cardCommission || 0),
  card_tips_total: tech.cardTips || 0,
  card_processing_fees: tech.cardProcessingFees || 0,
  card_tips_processing_fee: tech.cardTipsProcessingFee || 0,
  manager_owed: newManagerOwed !== undefined ? newManagerOwed : tech.managerOwed || 0,
  carry_over: tech.payLater && newManagerOwed !== undefined ? newManagerOwed : 0,
  is_cashed_out: isCashOut,
  is_check_requested: isCheckRequest
});

export const TechSummary: React.FC = () => {
  const [techSummaries, setTechSummaries] = useState<TechnicianSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedTechnician, setSelectedTechnician] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isHistoricalView, setIsHistoricalView] = useState(false);
  const [currentDay, setCurrentDay] = useState(formatDate(new Date()));
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    severity: 'info'
  });
  const [notification, setNotification] = useState<{
    open: boolean;
    type: 'success' | 'error';
    message: string;
  }>({
    open: false,
    type: 'success',
    message: ''
  });

  // ... Copy over the necessary functions from Dashboard.tsx ...
  const showToast = (message: string, severity: ToastState['severity'] = 'info') => {
    setToast({
      open: true,
      message,
      severity
    });
  };

  const handleCloseToast = () => {
    setToast(prev => ({
      ...prev,
      open: false
    }));
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({
      open: true,
      type,
      message
    });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  const calculateTechnicianSummaries = useCallback(async (
    transactions: any[], 
    techs: any[],
    todaySubmissions: any[],
    yesterdaySubmissions: any[]
  ) => {
    const summaries: TechnicianSummary[] = [];

    for (const tech of techs) {
      const techTransactions = transactions.filter(t => {
        if (t.technician_id && tech.id) {
          return t.technician_id === tech.id;
        }
        const techName = tech.name?.toLowerCase();
        const transName = t.technician_name?.toLowerCase();
        return techName === transName;
      });
      
      const yesterdaySubmission = yesterdaySubmissions.find(s => s.technician_id === tech.id);
      const todaySubmission = todaySubmissions.find(s => s.technician_id === tech.id);

      const previousCarryOver = yesterdaySubmission?.carry_over || 0;

      // Calculate cash totals with null checks
      const cashTransactions = techTransactions.filter(t => t.payment_method === 'cash');
      const cashTotal = cashTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
      const cashTips = cashTransactions.reduce((sum, t) => sum + (t.tip || 0), 0);
      const techCommissionRate = tech.commission_rate || 0.5;
      const cashCommission = cashTotal * techCommissionRate;
      const cashManagerKeep = cashTotal * (1 - techCommissionRate);

      // Calculate card totals with null checks
      const cardTransactions = techTransactions.filter(t => t.payment_method === 'card');
      const cardTotal = cardTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
      const cardTips = cardTransactions.reduce((sum, t) => sum + (t.tip || 0), 0);
      const cardTipsAfterFees = cardTips * 0.85;  // Apply 15% fee to displayed tips
      
      const cardProcessingFees = cardTransactions.length * 10;
      const cardTipsProcessingFee = cardTips * 0.15;
      const cardCommission = cardTotal * techCommissionRate;
      const cardManagerKeep = cardTotal * (1 - techCommissionRate);
      const techCardKeep = cardCommission + cardTips;
      const cashOutAmount = ((cardTotal - cardProcessingFees) * techCommissionRate) + cardTipsAfterFees;  // Use already calculated tips after fees
      const managerOwed = cashManagerKeep;

      const finalManagerOwed = todaySubmission?.is_cashed_out
        ? managerOwed - cashOutAmount
        : previousCarryOver 
          ? managerOwed + previousCarryOver
          : managerOwed;

      summaries.push({
        id: tech.id,
        name: tech.name || 'Unknown',
        location: tech.location || 'Unknown',
        commission: techCommissionRate,
        cashServices: cashTransactions.length,
        cashTotal,
        cashCommission,
        cashTips,
        cardServices: cardTransactions.length,
        cardTotal,
        cardCommission,
        cardTips,
        cardProcessingFees,
        cardTipsProcessingFee: cardTipsProcessingFee,
        managerOwed: finalManagerOwed,
        carryOver: previousCarryOver,
        isCashedOut: todaySubmission?.is_cashed_out || false,
        isCheckRequested: todaySubmission?.is_check_requested || false,
        payLater: false,
        cashOutAmount
      });
    }

    return summaries;
  }, []);

  const fetchData = useCallback(async (date: Date) => {
    try {
      setLoading(true);
      
      const targetDate = formatDate(date);
      const previousDate = formatDate(new Date(date.getTime() - 86400000));

      const [techniciansResponse, transactionsResponse, todaySubmissionsResponse, yesterdaySubmissionsResponse] = await Promise.all([
        supabase.from('technicians').select('*'),
        supabase
          .from('orders')
          .select('*')
          .gte('date', `${targetDate}T00:00:00-07:00`)
          .lt('date', `${targetDate}T23:59:59-07:00`)
          .order('date', { ascending: false }),
        supabase.from('submissions').select('*').eq('date', targetDate),
        supabase.from('submissions').select('*').eq('date', previousDate)
      ]);

      if (techniciansResponse.error) throw techniciansResponse.error;
      if (transactionsResponse.error) throw transactionsResponse.error;
      if (todaySubmissionsResponse.error) throw todaySubmissionsResponse.error;
      if (yesterdaySubmissionsResponse.error) throw yesterdaySubmissionsResponse.error;

      const activeTechnicians = (techniciansResponse.data || []).filter(tech => tech.active);
      
      const summaries = await calculateTechnicianSummaries(
        transactionsResponse.data || [], 
        activeTechnicians,
        todaySubmissionsResponse.data || [],
        yesterdaySubmissionsResponse.data || []
      );
      
      setTechSummaries(summaries);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      showToast('Error fetching data: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  }, [calculateTechnicianSummaries]);

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(event.target.value + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (newDate > today) {
      showToast('Cannot select future dates', 'warning');
      return;
    }

    setSelectedDate(newDate);
    setIsHistoricalView(formatDate(newDate) !== formatDate(new Date()));
    fetchData(newDate);
  };

  const handleReturnToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setIsHistoricalView(false);
    fetchData(today);
  };

  const handleToggleCashOut = async (techId: number) => {
    if (loading) return;
    
    try {
      const tech = techSummaries.find(t => t.id === techId);
      if (!tech) {
        showNotification('Technician not found', 'error');
        return;
      }

      const { data: existingSubmission, error: fetchError } = await supabase
        .from('submissions')
        .select('*')
        .eq('technician_id', techId)
        .eq('date', getTodayDate())
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Calculate the new manager owed amount
      const newManagerOwed = tech.isCashedOut 
        ? tech.cashTotal * (1 - tech.commission)  // Recalculate if canceling
        : tech.managerOwed - tech.cashOutAmount;  // Reduce by cash out amount if enabling

      if (existingSubmission) {
        if (tech.isCashedOut) {
          // If already cashed out, just cancel it
          const { error: updateError } = await supabase
            .from('submissions')
            .delete()
            .eq('id', existingSubmission.id);

          if (updateError) throw updateError;

          setTechSummaries(prev => prev.map(t => 
            t.id === techId 
              ? { ...t, isCashedOut: false, managerOwed: tech.cashTotal * (1 - tech.commission) }
              : t
          ));
        } else {
          // Update existing submission to cash out
          const { error: updateError } = await supabase
            .from('submissions')
            .update(createSubmissionData(tech, true, false, newManagerOwed))
            .eq('id', existingSubmission.id);

          if (updateError) throw updateError;

          setTechSummaries(prev => prev.map(t => 
            t.id === techId 
              ? { ...t, isCashedOut: true, managerOwed: newManagerOwed }
              : t
          ));
        }
      } else {
        // Create new submission
        const { error: insertError } = await supabase
          .from('submissions')
          .insert(createSubmissionData(tech, true, false, newManagerOwed));

        if (insertError) throw insertError;

        setTechSummaries(prev => prev.map(t => 
          t.id === techId 
            ? { ...t, isCashedOut: true, managerOwed: newManagerOwed }
            : t
        ));
      }
    } catch (err) {
      console.error('Error toggling cash out:', err);
      if (err instanceof Error) {
        showNotification(`Error: ${err.message}`, 'error');
      } else {
        showNotification('An unexpected error occurred', 'error');
      }
      fetchData(new Date());
    }
  };

  const handleToggleCheckRequest = async (techId: number) => {
    if (loading) return;
    
    try {
      const tech = techSummaries.find(t => t.id === techId);
      if (!tech) {
        showNotification('Technician not found', 'error');
        return;
      }

      const { data: existingSubmission, error: fetchError } = await supabase
        .from('submissions')
        .select('*')
        .eq('technician_id', techId)
        .eq('date', getTodayDate())
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingSubmission) {
        if (tech.isCheckRequested) {
          // If already check requested, just cancel it
          const { error: updateError } = await supabase
            .from('submissions')
            .delete()
            .eq('id', existingSubmission.id);

          if (updateError) throw updateError;

          setTechSummaries(prev => prev.map(t => 
            t.id === techId 
              ? { ...t, isCheckRequested: false }
              : t
          ));
        } else {
          // Update existing submission to request check
          const { error: updateError } = await supabase
            .from('submissions')
            .update(createSubmissionData(tech, false, true))
            .eq('id', existingSubmission.id);

          if (updateError) throw updateError;

          setTechSummaries(prev => prev.map(t => 
            t.id === techId 
              ? { ...t, isCheckRequested: true }
              : t
          ));
        }
      } else {
        // Create new submission
        const { error: insertError } = await supabase
          .from('submissions')
          .insert(createSubmissionData(tech, false, true));

        if (insertError) throw insertError;

        setTechSummaries(prev => prev.map(t => 
          t.id === techId 
            ? { ...t, isCheckRequested: true }
            : t
        ));
      }
    } catch (err) {
      console.error('Error toggling check request:', err);
      if (err instanceof Error) {
        showNotification(`Error: ${err.message}`, 'error');
      } else {
        showNotification('An unexpected error occurred', 'error');
      }
      fetchData(new Date());
    }
  };

  useEffect(() => {
    if (isHistoricalView) return;

    const checkDayChange = () => {
      const newDay = formatDate(new Date());
      if (newDay !== currentDay) {
        setCurrentDay(newDay);
        fetchData(new Date());
        showToast('New day started - refreshing data', 'info');
      }
    };

    const interval = setInterval(checkDayChange, 60000);
    checkDayChange();

    return () => clearInterval(interval);
  }, [currentDay, isHistoricalView, fetchData]);

  useEffect(() => {
    fetchData(new Date());
  }, [fetchData]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Filter technicians with data
  const techsWithData = selectedLocation ? 
    techSummaries.filter(tech => 
      tech.location === selectedLocation && 
      (
        tech.cashServices > 0 || 
        tech.cardServices > 0 ||
        tech.cashTotal > 0 || 
        tech.cardTotal > 0 ||
        tech.cashTips > 0 || 
        tech.cardTips > 0
      )
    ) :
    techSummaries.filter(tech => 
      tech.cashServices > 0 || 
      tech.cardServices > 0 ||
      tech.cashTotal > 0 || 
      tech.cardTotal > 0 ||
      tech.cashTips > 0 || 
      tech.cardTips > 0
    );

  return (
    <Box sx={{ width: '100%', typography: 'body1' }}>
      <Grid container spacing={2} sx={{ mb: 3 }} alignItems="center">
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <TextField
              type="date"
              value={formatDate(selectedDate)}
              onChange={handleDateChange}
              size="small"
              InputProps={{
                sx: {
                  borderRadius: 2,
                  '&:hover': {
                    borderColor: 'primary.light',
                  },
                }
              }}
            />
            {isHistoricalView && (
              <Button
                onClick={handleReturnToToday}
                variant="contained"
                size="small"
                sx={{
                  borderRadius: '20px',
                  px: 3,
                  background: 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)',
                  color: '#000000',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #FFC8D3 30%, #FFD9E0 90%)',
                  },
                  boxShadow: '0 3px 5px 2px rgba(255, 183, 197, .3)',
                }}
              >
                Return to Today
              </Button>
            )}
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              textAlign: 'center',
              color: isHistoricalView ? 'warning.main' : 'text.secondary',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1
            }}
          >
            {isHistoricalView && '🕒 Historical View: '}
            {formatDisplayDate(selectedDate)}
          </Typography>
        </Grid>
        <Grid item xs={12} md={4}>
          {selectedLocation && (
            <Box sx={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2
            }}>
              <FormControl 
                sx={{ 
                  minWidth: 200,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: 'primary.light',
                    },
                  }
                }}
              >
                <InputLabel>Filter by Technician</InputLabel>
                <Select
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                  label="Filter by Technician"
                  size="small"
                >
                  <MenuItem value="">
                    <em>All Technicians</em>
                  </MenuItem>
                  {techsWithData.map((tech) => (
                    <MenuItem key={tech.id} value={tech.name}>{tech.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedTechnician && (
                <Button
                  onClick={() => setSelectedTechnician('')}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderRadius: '20px',
                    borderColor: 'rgba(255, 183, 197, 0.5)',
                    color: '#2c3e50',
                    '&:hover': {
                      background: 'rgba(255, 183, 197, 0.1)',
                      borderColor: 'rgba(255, 183, 197, 0.8)',
                    },
                  }}
                >
                  Clear
                </Button>
              )}
            </Box>
          )}
        </Grid>
      </Grid>

      <Box sx={{ 
        display: 'flex',
        gap: 2,
        flexWrap: 'wrap',
        justifyContent: 'center',
        mb: 4
      }}>
        {LOCATIONS.map((loc) => (
          <Button
            key={loc}
            variant={selectedLocation === loc ? "contained" : "outlined"}
            onClick={() => {
              setSelectedLocation(loc);
              setSelectedTechnician('');
            }}
            sx={{
              borderRadius: '20px',
              px: 3,
              py: 1,
              borderColor: 'rgba(255, 183, 197, 0.5)',
              color: selectedLocation === loc ? '#000000' : '#2c3e50',
              background: selectedLocation === loc 
                ? 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)'
                : 'transparent',
              '&:hover': {
                background: selectedLocation === loc 
                  ? 'linear-gradient(45deg, #FFC8D3 30%, #FFD9E0 90%)'
                  : 'rgba(255, 183, 197, 0.1)',
                borderColor: 'rgba(255, 183, 197, 0.8)',
              },
              boxShadow: selectedLocation === loc 
                ? '0 3px 5px 2px rgba(255, 183, 197, .3)'
                : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            {loc}
          </Button>
        ))}
      </Box>

      {!selectedLocation ? (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '300px',
            bgcolor: 'rgba(255, 183, 197, 0.05)',
            borderRadius: 3,
            border: '2px dashed rgba(255, 183, 197, 0.3)',
          }}
        >
          <Typography variant="h6" sx={{ 
            color: 'text.secondary',
            mb: 2,
            fontWeight: 500
          }}>
            Select a location to view technician summaries 👩‍💼
          </Typography>
          <Typography variant="body1" sx={{ 
            color: 'text.secondary',
            textAlign: 'center'
          }}>
            Choose from one of the locations above to see technician performance data
          </Typography>
        </Box>
      ) : techsWithData.length === 0 ? (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '300px',
            bgcolor: 'rgba(255, 183, 197, 0.05)',
            borderRadius: 3,
            border: '2px dashed rgba(255, 183, 197, 0.3)',
          }}
        >
          <Typography variant="h6" sx={{ 
            color: 'text.secondary',
            mb: 2,
            fontWeight: 500
          }}>
            No transaction data available for {selectedLocation} 📊
          </Typography>
          <Typography variant="body1" sx={{ 
            color: 'text.secondary',
            textAlign: 'center'
          }}>
            There are no transactions recorded for technicians in this location today
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {techsWithData
            .filter(tech => !selectedTechnician || tech.name === selectedTechnician)
            .map((tech) => (
            <Grid item xs={12} key={tech.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5">
                      👩‍💼 {tech.name || 'Unknown'}
                    </Typography>
                  </Box>
                  
                  <Grid container spacing={4}>
                    <Grid item xs={12} md={6}>
                      <Paper>
                        <Typography variant="h6" gutterBottom>Cash Breakdown</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell>Total Cash Services:</TableCell>
                                <TableCell align="right">{tech.cashServices || 0}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Total Cash:</TableCell>
                                <TableCell align="right">${(tech.cashTotal || 0).toFixed(2)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Adjusted Cash Total (${(tech.cashTotal || 0).toFixed(2)} × {(tech.commission * 100).toFixed(0)}%):</TableCell>
                                <TableCell align="right">${(tech.cashCommission || 0).toFixed(2)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Cash Tip Reported:</TableCell>
                                <TableCell align="right">${(tech.cashTips || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <Box sx={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'flex-start',
                          mt: 2,
                          px: 2,
                          pb: 2
                        }}>
                          <Box sx={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            width: '100%',
                            bgcolor: 'background.paper',
                            p: 2,
                            borderRadius: 1,
                            border: '1px solid rgba(0, 0, 0, 0.12)'
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: (tech.managerOwed || 0) < 0 ? 1 : 0 }}>
                              <Typography component="span" sx={{ fontWeight: 'bold' }}>Give:</Typography>
                              <Typography 
                                component="span"
                                sx={{ 
                                  color: (tech.managerOwed || 0) < 0 ? 'error.main' : 'inherit',
                                  fontWeight: 'bold'
                                }}
                              >
                                ${(tech.managerOwed || 0).toFixed(2)}
                              </Typography>
                            </Box>
                            {(tech.managerOwed || 0) < 0 && (
                              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                <Button
                                  size="small"
                                  variant={!tech.payLater ? "contained" : "outlined"}
                                  onClick={() => {
                                    const updatedSummaries = techSummaries.map(t => 
                                      t.id === tech.id ? { ...t, payLater: false, carryOver: 0 } : t
                                    );
                                    setTechSummaries(updatedSummaries);
                                  }}
                                  sx={{
                                    minWidth: 'auto',
                                    px: 2,
                                    py: 0.5,
                                    borderRadius: '8px',
                                    borderColor: !tech.payLater ? 'transparent' : 'rgba(255, 183, 197, 0.8)',
                                    color: !tech.payLater ? '#000000' : '#2c3e50',
                                    background: !tech.payLater 
                                      ? 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)'
                                      : 'transparent',
                                    '&:hover': {
                                      background: !tech.payLater 
                                        ? 'linear-gradient(45deg, #FFC8D3 30%, #FFD9E0 90%)'
                                        : 'rgba(255, 183, 197, 0.1)',
                                    },
                                    textTransform: 'none',
                                    fontWeight: 600
                                  }}
                                >
                                  Pay Now
                                </Button>
                                <Button
                                  size="small"
                                  variant={tech.payLater ? "contained" : "outlined"}
                                  onClick={() => {
                                    const updatedSummaries = techSummaries.map(t => 
                                      t.id === tech.id ? { ...t, payLater: true, carryOver: t.managerOwed } : t
                                    );
                                    setTechSummaries(updatedSummaries);
                                  }}
                                  sx={{
                                    minWidth: 'auto',
                                    px: 2,
                                    py: 0.5,
                                    borderRadius: '8px',
                                    borderColor: tech.payLater ? 'transparent' : 'rgba(255, 183, 197, 0.8)',
                                    color: tech.payLater ? '#000000' : '#2c3e50',
                                    background: tech.payLater 
                                      ? 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)'
                                      : 'transparent',
                                    '&:hover': {
                                      background: tech.payLater 
                                        ? 'linear-gradient(45deg, #FFC8D3 30%, #FFD9E0 90%)'
                                        : 'rgba(255, 183, 197, 0.1)',
                                    },
                                    textTransform: 'none',
                                    fontWeight: 600
                                  }}
                                >
                                  Pay Later
                                </Button>
                              </Box>
                            )}
                            {tech.payLater && (tech.managerOwed || 0) < 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                                <Typography component="span" sx={{ fontWeight: 'bold' }}>Carry Over:</Typography>
                                <Typography 
                                  component="span"
                                  sx={{ 
                                    color: 'error.main',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  ${(tech.carryOver || 0).toFixed(2)}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Paper>
                        <Typography variant="h6" gutterBottom>Card Breakdown</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell>Total Card Services:</TableCell>
                                <TableCell align="right">{tech.cardServices || 0}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Total Card Amount:</TableCell>
                                <TableCell align="right">${(tech.cardTotal || 0).toFixed(2)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Adjusted Card Total (${(tech.cardTotal || 0).toFixed(2)} × {(tech.commission * 100).toFixed(0)}%):</TableCell>
                                <TableCell align="right">${(tech.cardCommission || 0).toFixed(2)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Adjusted Card Tips:</TableCell>
                                <TableCell align="right">
                                  ${(tech.cardTips * 0.85 || 0).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <Box sx={{ 
                          display: 'flex', 
                          gap: 2, 
                          justifyContent: 'space-between', 
                          alignItems: 'flex-start',
                          mt: 2,
                          px: 2,
                          pb: 2
                        }}>
                          <Box sx={{ 
                            display: 'flex', 
                            gap: 2, 
                            flexDirection: 'column',
                            flex: 1
                          }}>
                            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                              <Button
                                variant={tech.isCashedOut ? "contained" : "outlined"}
                                onClick={() => {
                                  if (tech.isCashedOut) {
                                    void handleToggleCashOut(tech.id);
                                  } else {
                                    if (tech.isCheckRequested) {
                                      void handleToggleCheckRequest(tech.id).then(() => {
                                        void handleToggleCashOut(tech.id);
                                      });
                                    } else {
                                      void handleToggleCashOut(tech.id);
                                    }
                                  }
                                }}
                                sx={{
                                  borderRadius: '8px',
                                  px: 3,
                                  py: 1.5,
                                  minWidth: '160px',
                                  borderColor: tech.isCashedOut ? 'transparent' : 'rgba(255, 183, 197, 0.8)',
                                  color: tech.isCashedOut ? '#000000' : '#2c3e50',
                                  background: tech.isCashedOut 
                                    ? 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)'
                                    : 'transparent',
                                  '&:hover': {
                                    background: tech.isCashedOut 
                                      ? 'linear-gradient(45deg, #FFC8D3 30%, #FFD9E0 90%)'
                                      : 'rgba(255, 183, 197, 0.1)',
                                    borderColor: tech.isCashedOut ? 'transparent' : 'rgba(255, 183, 197, 1)',
                                  },
                                  boxShadow: tech.isCashedOut ? '0 3px 5px 2px rgba(255, 183, 197, .3)' : 'none',
                                  transition: 'all 0.2s ease',
                                  textTransform: 'none',
                                  fontWeight: 600
                                }}
                              >
                                {tech.isCashedOut ? '✅ Cancel Pay Out' : '💰 Pay Out'}
                              </Button>
                              <Button
                                variant={tech.isCheckRequested ? "contained" : "outlined"}
                                onClick={() => {
                                  if (tech.isCheckRequested) {
                                    void handleToggleCheckRequest(tech.id);
                                  } else {
                                    if (tech.isCashedOut) {
                                      void handleToggleCashOut(tech.id).then(() => {
                                        void handleToggleCheckRequest(tech.id);
                                      });
                                    } else {
                                      void handleToggleCheckRequest(tech.id);
                                    }
                                  }
                                }}
                                sx={{
                                  borderRadius: '8px',
                                  px: 3,
                                  py: 1.5,
                                  minWidth: '160px',
                                  borderColor: tech.isCheckRequested ? 'transparent' : 'rgba(255, 183, 197, 0.8)',
                                  color: tech.isCheckRequested ? '#000000' : '#2c3e50',
                                  background: tech.isCheckRequested 
                                    ? 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)'
                                    : 'transparent',
                                  '&:hover': {
                                    background: tech.isCheckRequested 
                                      ? 'linear-gradient(45deg, #FFC8D3 30%, #FFD9E0 90%)'
                                      : 'rgba(255, 183, 197, 0.1)',
                                    borderColor: tech.isCheckRequested ? 'transparent' : 'rgba(255, 183, 197, 1)',
                                  },
                                  boxShadow: tech.isCheckRequested ? '0 3px 5px 2px rgba(255, 183, 197, .3)' : 'none',
                                  transition: 'all 0.2s ease',
                                  textTransform: 'none',
                                  fontWeight: 600
                                }}
                              >
                                {tech.isCheckRequested ? '✅ Cancel Check' : '📝 Request Check'}
                              </Button>
                            </Box>
                            {tech.isCashedOut && (
                              <Typography
                                sx={{
                                  color: 'success.main',
                                  fontWeight: 600,
                                  fontSize: '1.1rem',
                                  textAlign: 'center'
                                }}
                              >
                                Cash Out Amount: ${(tech.cashOutAmount || 0).toFixed(2)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <NotificationModal
        open={notification.open}
        onClose={handleCloseNotification}
        type={notification.type}
        message={notification.message}
      />
    </Box>
  );
}; 