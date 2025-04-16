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
  IconButton,
} from '@mui/material';
import { supabase } from '../lib/supabaseClient';
import NotificationModal from './NotificationModal';
import { useAuth, Location } from '../contexts/AuthContext';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';

interface Transaction {
  id: number;
  technician_name: string;
  location: string;
  total: number;
  tip: number | null;
  payment_method: 'cash' | 'card' | 'venmo' | 'zelle';
  tip_method: 'cash' | 'card' | null;
  created_at: string;
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

interface Technician {
  id: string;
  active: boolean;
  name: string;
  email: string;
}

// Restore LOCATIONS constant to use full names from DB
const LOCATIONS = [
  "Irvine Team",
  "Tustin Team",
  "Santa Ana Team",
  "Costa Mesa Team"
] as const; // Assuming these exactly match the values in technicians table

// Adjust map: Keys are DB values, Values are desired display
const LOCATION_DISPLAY_NAMES: Record<string, string> = {
  "Irvine Team": 'Irvine',
  "Tustin Team": 'Tustin',
  "Santa Ana Team": 'Santa Ana',
  "Costa Mesa Team": 'Costa Mesa'
};

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

const createSubmissionData = (
  tech: TechnicianSummary, 
  isCashOut: boolean, 
  isCheckRequest: boolean, 
  targetDate: string,
  carryOverValue: number // Explicitly pass the carry_over value to be saved
) => {
  // manager_owed saved should be the base calculation result from the summary
  const baseManagerOwed = tech.managerOwed; 

  return {
    technician_id: tech.id,
    date: targetDate, 
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
    manager_owed: baseManagerOwed, // Store the base manager owed 
    carry_over: carryOverValue, // Store the explicitly passed carry_over value
    is_cashed_out: isCashOut,
    is_check_requested: isCheckRequest
  };
};

export const TechSummary: React.FC = () => {
  const { hasLocationAccess } = useAuth();
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
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [lockedSummaries, setLockedSummaries] = useState<Set<number>>(new Set());

  // Filter locations based on user access (uses full names now)
  const accessibleLocations = LOCATIONS.filter(locationName => {
    // Convert full name to key for hasLocationAccess check
    const locationKey = locationName.replace(/ Team$/i, '').toLowerCase().replace(/\s+/g, '_');
    return hasLocationAccess(locationKey as Location);
  });

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
    previousDaySubmissions: any[]
  ) => {
    const summaries: TechnicianSummary[] = [];

    for (const tech of techs) {
      const techTransactions = transactions.filter(t => { 
        return tech.name && t.technician_name && 
               tech.name.toLowerCase() === t.technician_name.toLowerCase();
      });
      
      const todaySubmission = todaySubmissions.find(s => s.technician_id === tech.id);
      const previousDaySubmission = previousDaySubmissions.find(s => s.technician_id === tech.id);

      const previousCarryOver = previousDaySubmission?.carry_over || 0;

      const cashTransactions = techTransactions.filter(t => t.payment_method === 'cash');
      const cashTotal = cashTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
      const cashTips = cashTransactions.reduce((sum, t) => sum + (t.tip || 0), 0);
      const techCommissionRate = tech.commission_rate || 0.5;
      const cashCommission = cashTotal * techCommissionRate;
      const cashManagerKeep = cashTotal * (1 - techCommissionRate);

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

      // Correct calculation: Final manager owed for the state is base cash share + previous day's carry over
      const finalManagerOwedForState = managerOwed + previousCarryOver;
      // Note: The value saved in DB 'manager_owed' column via createSubmissionData uses this same base value.

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
        managerOwed: finalManagerOwedForState, // Store the BASE manager owed in state
        carryOver: previousCarryOver, 
        isCashedOut: todaySubmission?.is_cashed_out || false,
        isCheckRequested: todaySubmission?.is_check_requested || false,
        payLater: !!todaySubmission && todaySubmission.carry_over < 0,
        cashOutAmount
      });
    }
    return summaries;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const targetDate = formatDate(selectedDate);
      const previousDate = formatDate(new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000));

      const techniciansPromise = supabase.from('technicians').select('*');
      const ordersPromise = supabase
          .from('orders')
          .select('*')
          .gte('date', `${targetDate}T00:00:00-07:00`)
          .lt('date', `${targetDate}T23:59:59-07:00`)
          .order('date', { ascending: false });
      const todaySubmissionsPromise = supabase.from('submissions').select('*').eq('date', targetDate);
      const previousDaySubmissionsPromise = supabase.from('submissions').select('*').eq('date', previousDate);

      const [
        { data: techniciansData, error: techniciansError },
        { data: transactionsData, error: transactionsError },
        { data: todaySubmissionsData, error: todaySubmissionsError },
        { data: previousDaySubmissionsData, error: previousDaySubmissionsError },
      ] = await Promise.all([
        techniciansPromise,
        ordersPromise,
        todaySubmissionsPromise,
        previousDaySubmissionsPromise,
      ]);

      if (techniciansError) throw new Error(`Failed to fetch technicians: ${techniciansError.message}`);
      if (transactionsError) throw new Error(`Failed to fetch orders for ${targetDate}: ${transactionsError.message}`);
      if (todaySubmissionsError) throw new Error(`Failed to fetch today's submissions: ${todaySubmissionsError.message}`);
      if (previousDaySubmissionsError) throw new Error(`Failed to fetch previous day's submissions: ${previousDaySubmissionsError.message}`);

      setTechnicians(techniciansData || []);
      const summaries = await calculateTechnicianSummaries(
        transactionsData || [],
        techniciansData || [],
        todaySubmissionsData || [],
        previousDaySubmissionsData || []
      );
      setTechSummaries(summaries);
      showToast('Data loaded successfully', 'success');

    } catch (error) {
      console.error("Error fetching data:", error);
      showToast(error instanceof Error ? error.message : 'Failed to fetch data', 'error');
      setTechSummaries([]);
      setTechnicians([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, calculateTechnicianSummaries]);

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
    fetchData();
  };

  const handleReturnToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setIsHistoricalView(false);
    fetchData();
  };

  const handleToggleCashOut = async (techId: number) => {
    const techSummary = techSummaries.find(t => t.id === techId);
    if (!techSummary) {
      showToast('Technician not found', 'error');
      return;
    }

    const isCurrentlyCashedOut = techSummary.isCashedOut;
    const targetDate = formatDate(selectedDate);

    // --- Mutual Exclusivity Check --- 
    if (!isCurrentlyCashedOut && techSummary.isCheckRequested) {
      showToast('Cannot Pay Out when Check Request is active.', 'warning');
      return;
    }
    // --- End Check --- 

    // Optimistically update UI FIRST - ONLY toggle the isCashedOut flag
    setTechSummaries(prev => prev.map(t => 
      t.id === techId ? { ...t, isCashedOut: !isCurrentlyCashedOut } : t
    ));

    try {
      const { data: existingSubmission, error: fetchError } = await supabase
        .from('submissions')
        // Fetch fields needed for update or potential insert/race condition
        .select('id, is_check_requested, carry_over') 
        .eq('technician_id', techId)
        .eq('date', targetDate)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Failed to check existing submission: ${fetchError.message}`);
      }

      if (isCurrentlyCashedOut) {
        // --- Canceling Cash Out --- 
        if (existingSubmission) {
          // Update ONLY the is_cashed_out flag in DB
          const { error: updateError } = await supabase
            .from('submissions')
            .update({ is_cashed_out: false })
            .eq('id', existingSubmission.id);

          if (updateError) {
            throw new Error(`Failed to update submission: ${updateError.message}`);
          }
          // Update local state flag AND revert managerOwed using the original prior carry over
          // Make sure techSummary.carryOver holds the correct prior day value here
          const revertedBaseManagerOwed = (techSummary.cashTotal * (1 - techSummary.commission)) + (techSummary.carryOver || 0);
          console.log("Cancel Payout - Reverted Base Owed:", revertedBaseManagerOwed, "Prior CarryOver:", techSummary.carryOver); 
          setTechSummaries(prev => prev.map(t => 
            t.id === techId ? { ...t, isCashedOut: false, managerOwed: revertedBaseManagerOwed } : t
          ));
          showToast('Cash out cancelled successfully.', 'success');

        } else {
          // If somehow canceling cash out but no submission exists, revert local state
          // Use techSummary.carryOver for consistency
          const revertedBaseManagerOwed = (techSummary.cashTotal * (1 - techSummary.commission)) + (techSummary.carryOver || 0); 
          setTechSummaries(prev => prev.map(t => 
            t.id === techId ? { ...t, isCashedOut: false, managerOwed: revertedBaseManagerOwed } : t
          ));
          showToast('Cash out state corrected locally.', 'info');
        }
      } else {
        // --- Enabling Cash Out --- 
        if (existingSubmission) {
           // Update ONLY the is_cashed_out flag
           const { error: updateError } = await supabase
             .from('submissions')
             .update({ is_cashed_out: true })
             .eq('id', existingSubmission.id);
    
           if (updateError) {
             throw new Error(`Failed to update submission: ${updateError.message}`);
           }
        } else {
          // Create new submission if none exists
          // Calculate default carry_over if no submission exists
          const defaultCarryOver = Math.max(0, techSummary.managerOwed);
          const submissionData = createSubmissionData(
            techSummary, 
            true, // Setting cash out true
            false, // Check requested is false by default
            targetDate,
            defaultCarryOver // Use default carry_over
          );
          const { error: insertError } = await supabase
            .from('submissions')
            .insert([submissionData]);

          if (insertError) {
            // Check for unique constraint violation specifically
            if (insertError.message.includes('duplicate key value violates unique constraint')) {
               // If duplicate key error on insert, try updating again (race condition mitigation)
               console.warn('Duplicate key on insert, attempting update...');
               const { data: raceSubmission, error: raceFetchError } = await supabase
                 .from('submissions')
                 // Fetch necessary fields for the update in race condition
                 .select('id, is_cashed_out, is_check_requested, carry_over') 
                 .eq('technician_id', techId)
                 .eq('date', targetDate)
                 .single(); 
 
               if (raceFetchError || !raceSubmission) {
                 throw new Error(`Failed to fetch submission after duplicate key error: ${raceFetchError?.message || 'Not found'}`);
               }
 
                // In race condition, still just try updating the flag
                const { error: raceUpdateError } = await supabase
                  .from('submissions')
                  .update({ is_cashed_out: true })
                  .eq('id', raceSubmission.id);
   
                if (raceUpdateError) {
                  throw new Error(`Failed to update submission after duplicate key error: ${raceUpdateError.message}`);
                }
            } else {
                 throw new Error(`Failed to create submission: ${insertError.message}`);
            }
          }
        }
        // Update local state *after* successful DB operation for enable
        setTechSummaries(prev => prev.map(t => 
          t.id === techId ? { ...t, isCashedOut: true } : t
        ));
        showToast('Technician cashed out successfully.', 'success');
      }
    } catch (error) {
      console.error("Error toggling cash out:", error);
      showToast(error instanceof Error ? error.message : 'Failed to toggle cash out', 'error');
      // Revert optimistic update on error - revert flag and potentially managerOwed if needed?
      // Reverting only the flag is usually safer, let next fetch correct derived values.
      setTechSummaries(prev => prev.map(t => 
        t.id === techId ? { ...t, isCashedOut: isCurrentlyCashedOut } : t
      ));
    }
  };

  const handleToggleCheckRequest = async (techId: number) => {
    const techSummary = techSummaries.find(t => t.id === techId);
    if (!techSummary) {
       showToast('Technician not found', 'error');
       return;
    }

    const isCurrentlyCheckRequested = techSummary.isCheckRequested;
    const newCheckRequestedState = !isCurrentlyCheckRequested;
    const originalManagerOwed = techSummary.managerOwed; 
    const targetDate = formatDate(selectedDate);

    // --- Mutual Exclusivity Check --- 
    if (newCheckRequestedState && techSummary.isCashedOut) { 
      showToast('Cannot Request Check when Pay Out is active.', 'warning');
      return;
    }
    // --- End Check --- 

    // Optimistically update UI - Only toggle the flag
    setTechSummaries(prev => prev.map(t => 
      t.id === techId ? { ...t, isCheckRequested: newCheckRequestedState } : t
    ));

    try {
      const { data: existingSubmission, error: fetchError } = await supabase
        .from('submissions')
        // Fetch fields needed for update or potential insert/race condition
        .select('id, is_cashed_out, carry_over') 
        .eq('technician_id', techId)
        .eq('date', targetDate)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Failed to check existing submission: ${fetchError.message}`);
      }
      
      // Determine the correct isCashedOut status to preserve
      const isCashedOutStatus = existingSubmission?.is_cashed_out || techSummary.isCashedOut;
      // --- Get the CURRENT carry_over value to preserve --- 
      const currentCarryOver = existingSubmission?.carry_over || 0;

      if (isCurrentlyCheckRequested) {
         // --- Canceling Check Request --- 
         if (existingSubmission) {
             // Update ONLY the is_check_requested flag
              const { error: updateError } = await supabase
                .from('submissions')
                .update({ is_check_requested: false })
                .eq('id', existingSubmission.id);

              if (updateError) {
                throw new Error(`Failed to update submission: ${updateError.message}`);
              }
             // Update local state *after* successful DB operation
             setTechSummaries(prev => prev.map(t => 
                t.id === techId ? { ...t, isCheckRequested: false } : t
             ));
              showToast('Check request cancelled successfully.', 'success');
         } else {
            // If canceling check request but no submission exists, just update local state
             setTechSummaries(prev => prev.map(t => 
                t.id === techId ? { ...t, isCheckRequested: false } : t
             ));
            showToast('Check request state corrected locally.', 'info');
         }
      } else {
        // --- Enabling Check Request --- 
        if (existingSubmission) {
          // Update ONLY the is_check_requested flag
          const { error: updateError } = await supabase
            .from('submissions')
            .update({ is_check_requested: true })
            .eq('id', existingSubmission.id);

          if (updateError) {
            throw new Error(`Failed to update submission: ${updateError.message}`);
          }
        } else {
          // Insert new submission
          // Calculate default carry_over if no submission exists
          const defaultCarryOver = Math.max(0, techSummary.managerOwed);
          const submissionData = createSubmissionData(
            techSummary, 
            false, // Cash out is false by default
            true, // Setting check requested true
            targetDate,
            defaultCarryOver // Use default carry_over
          );
          const { error: insertError } = await supabase
            .from('submissions')
            .insert([submissionData]);

          if (insertError) {
            // Check for unique constraint violation specifically
            if (insertError.message.includes('duplicate key value violates unique constraint')) {
               // If duplicate key error on insert, try updating again (race condition mitigation)
               console.warn('Duplicate key on insert, attempting update...');
               const { data: raceSubmission, error: raceFetchError } = await supabase
                 .from('submissions')
                 // Fetch necessary fields for the update in race condition
                 .select('id, is_cashed_out, is_check_requested, carry_over') 
                 .eq('technician_id', techId)
                 .eq('date', targetDate)
                 .single(); 
 
               if (raceFetchError || !raceSubmission) {
                 throw new Error(`Failed to fetch submission after duplicate key error: ${raceFetchError?.message || 'Not found'}`);
               }
 
                // In race condition, still just try updating the flag
                const { error: raceUpdateError } = await supabase
                  .from('submissions')
                  .update({ is_check_requested: true })
                  .eq('id', raceSubmission.id);
   
                if (raceUpdateError) {
                  throw new Error(`Failed to update submission after duplicate key error: ${raceUpdateError.message}`);
                }
            } else {
                 throw new Error(`Failed to create submission: ${insertError.message}`);
            }
          }
        }
         // Update local state *after* successful DB operation
         setTechSummaries(prev => prev.map(t => 
            t.id === techId ? { ...t, isCheckRequested: true } : t
         ));
         showToast('Technician check request submitted successfully.', 'success');
      }
    } catch (error) {
      console.error("Error toggling check request:", error);
      showToast(error instanceof Error ? error.message : 'Failed to toggle check request', 'error');
      // Revert optimistic update on error - revert flag ONLY
      setTechSummaries(prev => prev.map(t => 
        t.id === techId ? { ...t, isCheckRequested: isCurrentlyCheckRequested } : t 
      ));
    }
  };
  
  // --- Handler for Pay Later/Pay Now buttons to update carry_over --- 
  const handleTogglePayLater = async (techId: number, setPayLater: boolean) => {
      const techSummary = techSummaries.find(t => t.id === techId);
      if (!techSummary) return; // Added early return if techSummary not found

      // Calculate the effective manager owed, considering cash out
      const adjustedManagerOwed = techSummary.isCashedOut
        ? (techSummary.managerOwed || 0) - (techSummary.cashOutAmount || 0)
        : (techSummary.managerOwed || 0);

      // Only allow toggling if the ADJUSTED managerOwed is currently negative
      if (adjustedManagerOwed >= 0) { 
        showToast('Pay Later only applicable if Manager Owed (after cash out) is negative.', 'warning');
        return; 
      }
  
      const targetDate = formatDate(selectedDate);
      // The carryOver value TO BE STORED is the adjusted negative managerOwed if setting Pay Later, otherwise 0
      const carryOverValueToSave = setPayLater ? adjustedManagerOwed : 0;
  
      // Optimistic UI Update - ONLY update the payLater flag visually
      setTechSummaries(prev => prev.map(t => 
          t.id === techId ? { ...t, payLater: setPayLater /* Don't update local carryOver here */ } : t
      ));
  
      try {
          const { data: existingSubmission, error: fetchError } = await supabase
              .from('submissions')
              .select('id, is_cashed_out, is_check_requested, manager_owed') // Select needed fields to preserve
              .eq('technician_id', techId)
              .eq('date', targetDate)
              .maybeSingle();
  
          if (fetchError) {
              throw new Error(`Failed to check existing submission: ${fetchError.message}`);
          }
  
          if (existingSubmission) {
              // Update existing submission with new carry_over value ONLY
              const { error: updateError } = await supabase
                  .from('submissions')
                  .update({ carry_over: carryOverValueToSave }) // Only update carry_over
                  .eq('id', existingSubmission.id);
  
              if (updateError) {
                  throw new Error(`Failed to update carry_over: ${updateError.message}`);
              }
              showToast(`Carry over set to ${carryOverValueToSave.toFixed(2)}`, 'success');
          } else {
              // Insert new submission, ensuring other flags are preserved from local state
              // Pass the calculated carryOverValueToSave
              const submissionData = createSubmissionData(
                techSummary, 
                techSummary.isCashedOut, 
                techSummary.isCheckRequested,
                targetDate,
                carryOverValueToSave // Pass the specific carry_over value needed
              );
              const { error: insertError } = await supabase
                  .from('submissions')
                  .insert([submissionData]);
  
              if (insertError) {
                 // Add duplicate key handling here too, just in case
                 if (insertError.message.includes('duplicate key value violates unique constraint')) {
                    console.warn('Duplicate key on insert for carry_over, attempting update...');
                    const { error: updateError } = await supabase
                      .from('submissions')
                      .update({ carry_over: carryOverValueToSave })
                      .eq('technician_id', techId)
                      .eq('date', targetDate);
                     if (updateError) {
                       throw new Error(`Failed to update carry_over after duplicate key: ${updateError.message}`);
                     }
                 } else {
                    throw new Error(`Failed to insert submission for carry_over: ${insertError.message}`);
                 }
              }
              showToast(`Submission created with carry over ${carryOverValueToSave.toFixed(2)}`, 'success');
          }
      } catch (error) {
          console.error("Error toggling pay later:", error);
          showToast(error instanceof Error ? error.message : 'Failed to toggle pay later', 'error');
          // Revert optimistic update - only revert the payLater flag
          setTechSummaries(prev => prev.map(t => 
              t.id === techId ? { ...t, payLater: !setPayLater /* Revert only payLater */ } : t
          ));
      }
  };

  // --- Lock Toggle Handler ---
  const handleToggleLock = (techId: number) => {
    setLockedSummaries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(techId)) {
        newSet.delete(techId);
      } else {
        newSet.add(techId);
      }
      return newSet;
    });
  };
  // --- End Lock Toggle Handler ---

  useEffect(() => {
    if (isHistoricalView) return;

    const checkDayChange = () => {
      const newDay = formatDate(new Date());
      if (newDay !== currentDay) {
        setCurrentDay(newDay);
        fetchData();
        showToast('New day started - refreshing data', 'info');
      }
    };

    const interval = setInterval(checkDayChange, 60000);
    checkDayChange();

    return () => clearInterval(interval);
  }, [currentDay, isHistoricalView, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Revert Filtering: Compare DB location directly with selectedLocation (full name)
  const techsWithData = selectedLocation ? 
    techSummaries.filter(tech => 
      tech.location === selectedLocation && // Direct comparison now
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

  // --- Helper Function for Currency Formatting ---
  const formatCurrency = (value: number | undefined | null): string => {
    return (value ?? 0).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  };
  // --- End Helper Function ---

  // ----- Filtered Summaries Calculation -----
  const filteredSummaries: TechnicianSummary[] = useMemo(() => {
    return techSummaries.filter(summary => {
      const hasTransactions = summary.cashServices > 0 || summary.cardServices > 0;
      const locationMatch = !selectedLocation || summary.location === selectedLocation;
      const technicianMatch = !selectedTechnician || summary.name === selectedTechnician;
      return hasTransactions && locationMatch && technicianMatch;
    });
  }, [techSummaries, selectedLocation, selectedTechnician]);
  // ----- End Filtered Summaries Calculation -----

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
        {accessibleLocations.map((loc) => (
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
      ) : filteredSummaries.length === 0 ? (
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
            No summaries found for {LOCATION_DISPLAY_NAMES[selectedLocation] || selectedLocation} on {formatDisplayDate(selectedDate)}
            {selectedTechnician && ` for ${selectedTechnician}`}
          </Typography>
          <Typography variant="body1" sx={{ 
            color: 'text.secondary',
            textAlign: 'center'
          }}>
            There might be no transactions for this selection, or data is still loading.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredSummaries.map((tech) => {
            const isLocked = lockedSummaries.has(tech.id);
            
            // --- Calculate the manager owed amount adjusted for cash out FOR DISPLAY --- 
            const displayedManagerOwed = tech.isCashedOut 
              ? tech.managerOwed - tech.cashOutAmount 
              : tech.managerOwed;
            // --- End calculation --- 
            
            return (
              <Grid item xs={12} key={tech.id}>
                {/* Apply visual styles when locked */}
                <Card elevation={3} sx={{ position: 'relative', filter: isLocked ? 'grayscale(80%) opacity(70%)' : 'none', transition: 'filter 0.3s ease' }}>
                  {/* Lock Button positioned top-right */}
                  <IconButton 
                    onClick={() => handleToggleLock(tech.id)}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 10, // Ensure it's above content
                      bgcolor: 'rgba(255, 255, 255, 0.7)', // Slight background for visibility
                      '&:hover': {
                         bgcolor: 'rgba(255, 255, 255, 0.9)',
                      }
                    }}
                  >
                    {isLocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                  </IconButton>

                  {/* Disable content interaction when locked? Optional: pointerEvents */}
                  <CardContent sx={{ pointerEvents: isLocked ? 'none' : 'auto' }}> 
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h5">
                        👩‍💼 {tech.name || 'Unknown'} ({LOCATION_DISPLAY_NAMES[tech.location] || tech.location})
                      </Typography>
                    </Box>
                    
                    <Grid container spacing={4}>
                      <Grid item xs={12} md={6}>
                        <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
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
                                  <TableCell align="right">{formatCurrency(tech.cashTotal)}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>Adjusted Cash Total ({formatCurrency(tech.cashTotal)} × {(tech.commission * 100).toFixed(0)}%):</TableCell>
                                  <TableCell align="right">{formatCurrency(tech.cashCommission)}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>Cash Tip Reported:</TableCell>
                                  <TableCell align="right">{formatCurrency(tech.cashTips)}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </TableContainer>
                          <Box sx={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'flex-start',
                            mt: 2,
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
                              {tech.carryOver > 0 && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                   <Typography component="span" sx={{ fontWeight: 'bold', color: 'info.main' }}>Prior Balance:</Typography>
                                   <Typography 
                                     component="span"
                                     sx={{ 
                                       color: 'info.main', 
                                       fontWeight: 'bold'
                                     }}
                                   >
                                    (-{formatCurrency(tech.carryOver)})
                                   </Typography>
                                </Box>
                              )}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: (displayedManagerOwed || 0) < 0 ? 1 : 0 }}>
                                <Typography component="span" sx={{ fontWeight: 'bold' }}>Manager Owed:</Typography>
                                <Typography 
                                  component="span"
                                  sx={{ 
                                    color: (displayedManagerOwed || 0) < 0 ? 'error.main' : 'inherit',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {formatCurrency(displayedManagerOwed)}
                                </Typography>
                              </Box>
                              {/* Correctly structure Pay Later/Pay Now Buttons */} 
                              {/* Use displayedManagerOwed to determine button visibility */}
                              {displayedManagerOwed < 0 ? ( 
                                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                  <Button
                                    size="small"
                                    variant={!tech.payLater ? "contained" : "outlined"}
                                    onClick={() => handleTogglePayLater(tech.id, false)}
                                    disabled={isLocked}
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
                                    onClick={() => handleTogglePayLater(tech.id, true)}
                                    disabled={isLocked}
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
                              ) : null }
                              
                              {/* Display Carry Over only if Pay Later is active */}
                              {tech.payLater && displayedManagerOwed < 0 ? ( 
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                                  <Typography component="span" sx={{ fontWeight: 'bold' }}>Carry Over:</Typography>
                                  <Typography 
                                    component="span"
                                    sx={{ 
                                      color: 'error.main',
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    {formatCurrency(displayedManagerOwed)} {/* Display the adjusted negative amount */}
                                  </Typography>
                                </Box>
                              ) : null}
                            </Box>
                          </Box>
                        </Paper>
                      </Grid>
           
                      <Grid item xs={12} md={6}>
                        <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
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
                                  <TableCell align="right">{formatCurrency(tech.cardTotal)}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>Adjusted Card Total ({formatCurrency(tech.cardTotal)} × {(tech.commission * 100).toFixed(0)}%):</TableCell>
                                  <TableCell align="right">{formatCurrency(tech.cardCommission)}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>Adjusted Card Tips:</TableCell>
                                  <TableCell align="right">
                                    {formatCurrency(tech.cardTips * 0.85)}
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
                          }}>
                            <Box sx={{ 
                              display: 'flex', 
                              gap: 2, 
                              flexDirection: 'column',
                              flex: 1,
                              p: 2,
                              borderRadius: 1,
                              border: '1px solid rgba(0, 0, 0, 0.12)',
                              bgcolor: 'background.paper'
                            }}>
                              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                                <Button
                                  variant={tech.isCashedOut ? "contained" : "outlined"}
                                  onClick={() => handleToggleCashOut(tech.id)}
                                  disabled={isLocked || tech.cardServices === 0 || tech.isCheckRequested}
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
                                  onClick={() => handleToggleCheckRequest(tech.id)}
                                  disabled={isLocked || tech.isCashedOut || tech.cardServices === 0}
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
                                    textAlign: 'center',
                                    mt: 1
                                  }}
                                >
                                  Cash Out Amount: {formatCurrency(tech.cashOutAmount)}
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
            );
          })}
        </Grid>
      )}

      <NotificationModal
        open={notification.open}
        onClose={handleCloseNotification}
        type={notification.type}
        message={notification.message}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={1500}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseToast} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}; 