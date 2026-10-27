import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Chip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  getDataQualityIssue,
  updateDataQualityIssueStatus,
  type DataQualityIssueStatus,
} from '../../api/dataQualityApi';
import { useAuth } from '../../context/AuthContext';

const ISSUE_TYPE_LABELS: Record<string, string> = {
  sale_exceeds_stock: 'Sale Exceeds Stock',
  inventory_inconsistent_with_movements: 'Inventory Inconsistent with Movements',
  sale_references_inactive_product: 'Sale References Inactive Product',
  sale_references_invalid_customer: 'Sale References Invalid Customer',
  duplicate_product_sku: 'Duplicate Product SKU',
  missing_mandatory_product_info: 'Missing Mandatory Product Info',
  missing_mandatory_customer_info: 'Missing Mandatory Customer Info',
  stock_movement_inconsistent_quantities: 'Stock Movement Inconsistent Quantities',
  report_total_mismatch: 'Report Total Mismatch',
};

type ChipColor = 'error' | 'success' | 'info' | 'default' | 'primary' | 'secondary' | 'warning';

const SEVERITY_CHIP: Record<string, ChipColor> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

const STATUS_CHIP: Record<string, ChipColor> = {
  open: 'default',
  investigating: 'info',
  resolved: 'success',
  ignored: 'default',
};

const DataQualityIssueDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin =
    user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'ANALYST';
  const queryClient = useQueryClient();

  const [newStatus, setNewStatus] = useState<DataQualityIssueStatus>('open');
  const [resolutionNote, setResolutionNote] = useState('');
  const [openResolveDialog, setOpenResolveDialog] = useState(false);

  const { data: issue, isLoading, isError, refetch } = useQuery({
    queryKey: ['dataQualityIssue', id],
    queryFn: () => getDataQualityIssue(id!),
    enabled: !!id,
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      updateDataQualityIssueStatus(id!, {
        status: newStatus,
        resolution_note: resolutionNote || undefined,
        resolved_by: user!.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataQualityIssue', id] });
      queryClient.invalidateQueries({ queryKey: ['dataQualityIssues'] });
      setOpenResolveDialog(false);
      refetch();
    },
  });

  const severityColor = SEVERITY_CHIP[issue?.severity ?? 'low'];
  const statusColor = STATUS_CHIP[issue?.status ?? 'open'];

  if (isLoading) {
    return (
      <Container sx={{ py: 6 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Loading issue details...</Typography>
        </Paper>
      </Container>
    );
  }

  if (isError || !issue) {
    return (
      <Container sx={{ py: 6 }}>
        <Alert severity="error">Issue not found or could not be loaded.</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/data-quality/issues')}
          variant="outlined"
        >
          Back to Issues
        </Button>
      </Container>
    );
  }

  const details = issue.details ?? {};

  return (
    <Container sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Issue Details
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Review and resolve this data quality issue.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/data-quality/issues')}
            sx={{ height: 40 }}
          >
            Back to Issues
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
            sx={{ height: 40 }}
          >
            Refresh
          </Button>
          <Button
            startIcon={<EditIcon />}
            onClick={() => {
              setNewStatus(issue.status as DataQualityIssueStatus);
              setResolutionNote(issue.resolution_note ?? '');
              setOpenResolveDialog(true);
            }}
            disabled={!isAdmin}
            sx={{ height: 40 }}
          >
            Resolve
          </Button>
        </Box>
      </Box>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" component="h3" gutterBottom>
              Issue Summary
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: '30%' }}>Issue ID</TableCell>
                    <TableCell>{issue.id.slice(0, 8)}...</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Issue Type</TableCell>
                    <TableCell>
                      <Typography sx={{ textTransform: 'capitalize', fontWeight: 500 }}>
                        {ISSUE_TYPE_LABELS[issue.issue_type] || issue.issue_type}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                    <TableCell>
                      <Chip
                        label={issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                        color={severityColor}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell>
                      <Chip
                        label={issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                        color={statusColor}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Affected Module</TableCell>
                    <TableCell>{issue.affected_module}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Record Type</TableCell>
                    <TableCell>{issue.affected_record_type ?? '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Record ID</TableCell>
                    <TableCell>
                      {issue.affected_record_id ? issue.affected_record_id.slice(0, 8) + '...' : '—'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                    <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{issue.description}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Detected At</TableCell>
                    <TableCell>{new Date(issue.detected_at).toLocaleString()}</TableCell>
                  </TableRow>
                  {issue.resolved_at && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Resolved At</TableCell>
                      <TableCell>{new Date(issue.resolved_at).toLocaleString()}</TableCell>
                    </TableRow>
                  )}
                  {issue.previous_status && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Previous Status</TableCell>
                      <TableCell>{issue.previous_status}</TableCell>
                    </TableRow>
                  )}
                  {issue.resolution_note && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Resolution Note</TableCell>
                      <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{issue.resolution_note}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {Object.keys(details).length > 0 && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" component="h3" gutterBottom>
                Detected Details
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {Object.entries(details).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell sx={{ fontWeight: 600, width: '30%' }}>
                          {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </div>

        <div className="space-y-6">
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" component="h3" gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
              <Button
                fullWidth
                startIcon={<CheckCircleIcon />}
                onClick={() => {
                  setNewStatus('resolved');
                  setOpenResolveDialog(true);
                }}
                disabled={!isAdmin || issue.status === 'resolved'}
              >
                Mark as Resolved
              </Button>
              <Button
                fullWidth
                startIcon={<WarningIcon />}
                onClick={() => {
                  setNewStatus('investigating');
                  setOpenResolveDialog(true);
                }}
                disabled={!isAdmin || issue.status === 'investigating'}
              >
                Mark as Investigating
              </Button>
              <Button
                fullWidth
                startIcon={<HistoryIcon />}
                onClick={() => {
                  setNewStatus('ignored');
                  setOpenResolveDialog(true);
                }}
                disabled={!isAdmin || issue.status === 'ignored'}
              >
                Mark as Ignored
              </Button>
            </Box>
          </Paper>
        </div>
      </div>

      <Dialog
        open={openResolveDialog}
        onClose={() => setOpenResolveDialog(false)}
        maxWidth="sm"
      >
        <DialogTitle>Update Issue Status</DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <TextField
            fullWidth
            label="Status"
            select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as DataQualityIssueStatus)}
          >
            {[ 'open', 'investigating', 'resolved', 'ignored' ].map((s) => (
              <React.Fragment key={s}>
                <option value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              </React.Fragment>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Resolution Note"
            multiline
            rows={3}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResolveDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending}
          >
            {resolveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DataQualityIssueDetails;
