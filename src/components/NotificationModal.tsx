import React from 'react';
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  IconButton,
  Fade,
  styled,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 16,
    padding: theme.spacing(2),
    maxWidth: '400px',
    margin: theme.spacing(2),
  },
}));

const AnimatedEmoji = styled('div')({
  fontSize: '4rem',
  animation: 'bounce 1s infinite',
  '@keyframes bounce': {
    '0%, 100%': {
      transform: 'translateY(0)',
    },
    '50%': {
      transform: 'translateY(-10px)',
    },
  },
});

interface NotificationModalProps {
  open: boolean;
  onClose: () => void;
  type: 'success' | 'error';
  message: string;
}

const NotificationModal: React.FC<NotificationModalProps> = ({
  open,
  onClose,
  type,
  message,
}) => {
  const emoji = type === 'success' ? '✨' : '🌸';
  const secondaryEmoji = type === 'success' ? '💝' : '💫';

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      TransitionComponent={Fade}
      TransitionProps={{ timeout: 500 }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: 'grey.500',
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          textAlign="center"
          py={2}
        >
          <AnimatedEmoji>
            {emoji}
          </AnimatedEmoji>

          <Typography
            variant="h6"
            sx={{
              mt: 2,
              mb: 1,
              color: type === 'success' ? 'primary.main' : 'error.main',
              fontWeight: 'bold',
            }}
          >
            {type === 'success' ? 'Success!' : 'Oops!'}
          </Typography>

          <Typography variant="body1" sx={{ mb: 2 }}>
            {message}
          </Typography>

          <Typography variant="h5" sx={{ mt: 1 }}>
            {secondaryEmoji}
          </Typography>
        </Box>
      </DialogContent>
    </StyledDialog>
  );
};

export default NotificationModal; 