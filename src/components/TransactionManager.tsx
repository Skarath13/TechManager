import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Grid,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Snackbar,
  Alert,
  CardHeader,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { supabase } from '../services/supabase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Transaction {
  id: number;
  technician_id: number;
  technician_name: string;
  date: string;
  payment_method: 'cash' | 'card' | 'venmo' | 'zelle';
  total: number;
  tip: number;
  location: string;
  tip_method: string | null;
}

type SortField = 'date' | 'technician_name' | 'total' | 'tip' | 'payment_method' | 'location';
type SortDirection = 'asc' | 'desc';

interface Technician {
  id: number;
  name: string;
  location: string;
  commission_rate: number;
  active: boolean;
}

interface Submission {
  id: number;
  technician_id: number;
  date: string;
  cash_services_count: number;
  cash_services_total: number;
  cash_tech_keep: number;
  cash_manager_keep: number;
  cash_tips_total: number;
  card_services_count: number;
  card_services_total: number;
  card_tech_keep: number;
  card_manager_keep: number;
  card_tips_total: number;
  card_processing_fees: number;
  card_tips_processing_fee: number;
  manager_owed: number;
  carry_over: number;
  is_cashed_out: boolean;
  is_check_requested: boolean;
}

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

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const LOCATIONS = [
  "Irvine Team",
  "Tustin Team",
  "Santa Ana Team",
  "Costa Mesa Team"
];

interface EditableTransaction extends Transaction {
  isEditing: boolean;
}

// Add these utility functions before the Dashboard component
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

export const TransactionManager: React.FC = () => {
  const [transactions, setTransactions] = useState<EditableTransaction[]>([]);
  const [techSummaries, setTechSummaries] = useState<TechnicianSummary[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedTechnician, setSelectedTechnician] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentDay, setCurrentDay] = useState(formatDate(new Date()));
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    severity: 'info'
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isHistoricalView, setIsHistoricalView] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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
  }, [currentDay, isHistoricalView]);

  const calculateTechnicianSummaries = useCallback(async (
    transactions: Transaction[], 
    techs: Technician[],
    todaySubmissions: Submission[],
    yesterdaySubmissions: Submission[]
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
      
      const cardProcessingFees = cardTransactions.length * 10;
      const cardTipsProcessingFee = cardTips * 0.15;
      const cardCommission = cardTotal * techCommissionRate;
      const cardManagerKeep = cardTotal * (1 - techCommissionRate);
      const techCardKeep = cardCommission + cardTips;
      const cashOutAmount = ((cardTotal - cardProcessingFees) * techCommissionRate) + (cardTips * 0.85);
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
      
      const transactionsWithEdit = (transactionsResponse.data || []).map(tx => ({
        ...tx,
        isEditing: false,
        total: tx.total || 0,
        tip: tx.tip || 0,
        technician_name: tx.technician_name || 'Unknown',
        location: tx.location || 'Unknown',
        payment_method: tx.payment_method || 'cash',
        tip_method: tx.tip_method || null,
        date: tx.date || targetDate
      }));

      setTransactions(transactionsWithEdit);

      const summaries = await calculateTechnicianSummaries(
        transactionsWithEdit, 
        activeTechnicians,
        todaySubmissionsResponse.data || [],
        yesterdaySubmissionsResponse.data || []
      );
      
      setTechSummaries(summaries);
      setTechnicians(activeTechnicians);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      showToast('Error fetching data: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  }, [calculateTechnicianSummaries]);

  useEffect(() => {
    fetchData(new Date());
  }, [fetchData]);

  const chartData = useMemo(() => ({
    labels: techSummaries.map(tech => tech.name || 'Unknown'),
    datasets: [
      {
        label: 'Total Cash Services ($)',
        data: techSummaries.map(tech => tech.cashTotal || 0),
        backgroundColor: '#FFB7C5',
        borderColor: '#E6A5B1',
        borderWidth: 1,
      },
      {
        label: 'Total Card Services ($)',
        data: techSummaries.map(tech => tech.cardTotal || 0),
        backgroundColor: '#FFC8D3',
        borderColor: '#E6B5C0',
        borderWidth: 1,
      },
      {
        label: 'Total Tips ($)',
        data: techSummaries.map(tech => (tech.cashTips || 0) + (tech.cardTips || 0)),
        backgroundColor: '#FFD9E0',
        borderColor: '#E6C5CC',
        borderWidth: 1,
      }
    ],
  }), [techSummaries]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '✨ Technician Performance',
      },
    },
    scales: {
      x: {
        stacked: false,
      },
      y: {
        stacked: false,
        beginAtZero: true,
      }
    }
  };

  const handleEdit = (id: number) => {
    setTransactions(prev =>
      prev.map(transaction =>
        transaction.id === id
          ? { ...transaction, isEditing: true }
          : transaction
      )
    );
  };

  const handleSave = async (id: number) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          technician_name: transaction.technician_name,
          location: transaction.location,
          total: transaction.total,
          tip: transaction.tip,
          payment_method: transaction.payment_method,
          tip_method: transaction.tip_method,
        })
        .eq('id', id);

      if (error) throw error;

      setTransactions(prev =>
        prev.map(t =>
          t.id === id
            ? { ...t, isEditing: false }
            : t
        )
      );
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleChange = (id: number, field: keyof Transaction, value: any) => {
    setTransactions(prev =>
      prev.map(transaction =>
        transaction.id === id
          ? { ...transaction, [field]: value }
          : transaction
      )
    );
  };

  const handleSort = (field: SortField) => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    setSortField(field);
  };

  const getSortedTransactions = (transactions: EditableTransaction[]) => {
    return [...transactions].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      
      switch (sortField) {
        case 'date':
          return direction * (new Date(a.date).getTime() - new Date(b.date).getTime());
        case 'total':
          return direction * ((a.total || 0) - (b.total || 0));
        case 'tip':
          return direction * ((a.tip || 0) - (b.tip || 0));
        case 'technician_name':
        case 'payment_method':
        case 'location':
          return direction * (a[sortField].localeCompare(b[sortField]));
        default:
          return 0;
      }
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const filteredTransactions = useMemo(() => {
    return getSortedTransactions(
      transactions.filter(transaction => {
        const locationMatch = !selectedLocation || transaction.location === selectedLocation;
        const technicianMatch = !selectedTechnician || transaction.technician_name === selectedTechnician;
        return locationMatch && technicianMatch;
      })
    ).map(transaction => ({
      ...transaction,
      total: transaction.total || 0,
      tip: transaction.tip || 0
    }));
  }, [transactions, selectedLocation, selectedTechnician, getSortedTransactions]);

  const availableTechnicians = useMemo(() => {
    const techs = new Set<string>();
    transactions
      .filter(t => !selectedLocation || t.location === selectedLocation)
      .forEach(t => techs.add(t.technician_name));
    return Array.from(techs).sort();
  }, [transactions, selectedLocation]);

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

  const handleToggleCashOut = async (techId: number) => {
    if (loading) return;
    
    try {
      const tech = techSummaries.find(t => t.id === techId);
      if (!tech) {
        showToast('Technician not found', 'error');
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

          showToast(`Successfully cancelled cash out for ${tech.name}`, 'success');
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

          showToast(`Successfully enabled cash out for ${tech.name}`, 'success');
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

        showToast(`Successfully enabled cash out for ${tech.name}`, 'success');
      }
    } catch (err) {
      console.error('Error toggling cash out:', err);
      if (err instanceof Error) {
        showToast(`Error toggling cash out: ${err.message}`, 'error');
      } else {
        showToast('An unexpected error occurred while toggling cash out', 'error');
      }
      fetchData(new Date());
    }
  };

  const handleToggleCheckRequest = async (techId: number) => {
    if (loading) return;
    
    try {
      const tech = techSummaries.find(t => t.id === techId);
      if (!tech) {
        showToast('Technician not found', 'error');
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

          showToast(`Successfully cancelled check request for ${tech.name}`, 'success');
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

          showToast(`Successfully requested check for ${tech.name}`, 'success');
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

        showToast(`Successfully requested check for ${tech.name}`, 'success');
      }
    } catch (err) {
      console.error('Error toggling check request:', err);
      if (err instanceof Error) {
        showToast(`Error toggling check request: ${err.message}`, 'error');
      } else {
        showToast('An unexpected error occurred while toggling check request', 'error');
      }
      fetchData(new Date());
    }
  };

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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

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
                  {availableTechnicians.map((tech) => (
                    <MenuItem key={tech} value={tech}>{tech}</MenuItem>
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
            Select a location to view transactions 🏠
          </Typography>
          <Typography variant="body1" sx={{ 
            color: 'text.secondary',
            textAlign: 'center'
          }}>
            Choose from one of the locations above to see their transaction history
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ 
          mb: 4,
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(255, 183, 197, 0.2)'
        }}>
          <Table>
            <TableHead>
              <TableRow sx={{ 
                background: 'linear-gradient(45deg, #FFB7C5 30%, #FFC8D3 90%)',
              }}>
                <TableCell 
                  sx={{ 
                    color: '#000000', 
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8,
                    }
                  }}
                  onClick={() => handleSort('date')}
                >
                  Date | Time {getSortIcon('date')}
                </TableCell>
                <TableCell 
                  sx={{ 
                    color: '#000000', 
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8,
                    }
                  }}
                  onClick={() => handleSort('technician_name')}
                >
                  Technician {getSortIcon('technician_name')}
                </TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 600 }}>Location</TableCell>
                <TableCell 
                  sx={{ 
                    color: '#000000', 
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8,
                    }
                  }}
                  onClick={() => handleSort('payment_method')}
                >
                  Payment Method {getSortIcon('payment_method')}
                </TableCell>
                <TableCell 
                  sx={{ 
                    color: '#000000', 
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8,
                    }
                  }}
                  onClick={() => handleSort('total')}
                >
                  Amount {getSortIcon('total')}
                </TableCell>
                <TableCell 
                  align="right" 
                  sx={{ 
                    color: '#000000', 
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8,
                    }
                  }}
                  onClick={() => handleSort('tip')}
                >
                  Tip {getSortIcon('tip')}
                </TableCell>
                <TableCell align="center" sx={{ color: '#000000', fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTransactions.map((transaction, index) => (
                <TableRow 
                  key={transaction.id}
                  sx={{
                    bgcolor: index % 2 === 0 ? 'rgba(255, 183, 197, 0.05)' : 'transparent',
                    '&:hover': {
                      bgcolor: 'rgba(255, 183, 197, 0.1)',
                    },
                    transition: 'all 0.3s ease',
                    '& > td': {
                      fontFamily: '"Helvetica Neue", Arial, sans-serif',
                      fontSize: '0.95rem',
                      color: '#2c3e50',
                      transition: 'all 0.3s ease',
                    },
                    '&:hover > td': {
                      color: '#000000',
                    }
                  }}
                >
                  <TableCell sx={{ 
                    fontWeight: 500,
                    color: 'text.secondary'
                  }}>
                    {transaction.isEditing ? (
                      <TextField
                        type="datetime-local"
                        value={transaction.date.slice(0, 16)}
                        onChange={(e) => handleChange(transaction.id, 'date', e.target.value)}
                        size="small"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            '&:hover fieldset': {
                              borderColor: 'primary.light',
                            },
                          }
                        }}
                      />
                    ) : (
                      formatDateTime(transaction.date)
                    )}
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: 500,
                    letterSpacing: '0.02em'
                  }}>
                    {transaction.isEditing ? (
                      <TextField
                        value={transaction.technician_name}
                        onChange={(e) => handleChange(transaction.id, 'technician_name', e.target.value)}
                        size="small"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            '&:hover fieldset': {
                              borderColor: 'primary.light',
                            },
                          }
                        }}
                      />
                    ) : (
                      transaction.technician_name
                    )}
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: 500,
                    letterSpacing: '0.02em'
                  }}>
                    {transaction.isEditing ? (
                      <TextField
                        value={transaction.location}
                        onChange={(e) => handleChange(transaction.id, 'location', e.target.value)}
                        size="small"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            '&:hover fieldset': {
                              borderColor: 'primary.light',
                            },
                          }
                        }}
                      />
                    ) : (
                      transaction.location
                    )}
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: 500,
                    color: 'text.secondary'
                  }}>
                    {transaction.isEditing ? (
                      <Select
                        value={transaction.payment_method}
                        onChange={(e) => handleChange(transaction.id, 'payment_method', e.target.value)}
                        size="small"
                        fullWidth
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            '&:hover fieldset': {
                              borderColor: 'primary.light',
                            },
                          }
                        }}
                      >
                        <MenuItem value="cash">CASH</MenuItem>
                        <MenuItem value="card">CARD</MenuItem>
                        <MenuItem value="venmo">VENMO</MenuItem>
                        <MenuItem value="zelle">ZELLE</MenuItem>
                      </Select>
                    ) : (
                      transaction.payment_method.toUpperCase()
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ 
                    fontWeight: 500,
                    color: 'text.secondary'
                  }}>
                    {transaction.isEditing ? (
                      <TextField
                        type="number"
                        value={transaction.total}
                        onChange={(e) => handleChange(transaction.id, 'total', parseFloat(e.target.value))}
                        size="small"
                        inputProps={{ style: { textAlign: 'right' } }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            '&:hover fieldset': {
                              borderColor: 'primary.light',
                            },
                          }
                        }}
                      />
                    ) : (
                      `$${transaction.total.toFixed(2)}`
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ 
                    fontWeight: 500,
                    color: 'text.secondary'
                  }}>
                    {transaction.isEditing ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                        <TextField
                          type="number"
                          value={transaction.tip}
                          onChange={(e) => handleChange(transaction.id, 'tip', parseFloat(e.target.value))}
                          size="small"
                          inputProps={{ style: { textAlign: 'right' } }}
                          sx={{
                            width: '100px',
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover fieldset': {
                                borderColor: 'primary.light',
                              },
                            }
                          }}
                        />
                        <Select
                          value={transaction.tip_method || ''}
                          onChange={(e) => handleChange(transaction.id, 'tip_method', e.target.value)}
                          size="small"
                          sx={{
                            width: '90px',
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover fieldset': {
                                borderColor: 'primary.light',
                              },
                            }
                          }}
                        >
                          <MenuItem value="card">💳 Card</MenuItem>
                          <MenuItem value="cash">💵 Cash</MenuItem>
                        </Select>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        <span>${transaction.tip.toFixed(2)}</span>
                        <span>{transaction.tip_method === 'card' ? '💳' : '💵'}</span>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ 
                    fontWeight: 500,
                    color: 'text.secondary'
                  }}>
                    {transaction.isEditing ? (
                      <IconButton 
                        onClick={() => handleSave(transaction.id)} 
                        sx={{ 
                          color: 'primary.main',
                          '&:hover': {
                            bgcolor: 'rgba(255, 183, 197, 0.2)',
                          }
                        }}
                      >
                        ✅
                      </IconButton>
                    ) : (
                      <>
                        <IconButton 
                          onClick={() => handleEdit(transaction.id)}
                          sx={{ 
                            color: 'primary.main',
                            '&:hover': {
                              bgcolor: 'rgba(255, 183, 197, 0.2)',
                            }
                          }}
                        >
                          ✏️
                        </IconButton>
                        <IconButton 
                          onClick={() => handleDelete(transaction.id)}
                          sx={{ 
                            color: 'error.main',
                            '&:hover': {
                              bgcolor: 'rgba(255, 183, 197, 0.2)',
                            }
                          }}
                        >
                          🗑️
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
