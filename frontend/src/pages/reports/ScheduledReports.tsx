import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  type ScheduledReport,
  type ScheduledReportUpdate,
  type ReportType,
  type ReportFrequency,
  type ReportFormat,
} from '../../api/reportApi';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';

const inputClass =
  'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'sales', label: 'Sales Report' },
  { value: 'inventory', label: 'Inventory Report' },
  { value: 'customer', label: 'Customer Report' },
  { value: 'product_performance', label: 'Product Performance Report' },
  { value: 'stock_movement', label: 'Stock Movement Report' },
];

const FREQUENCY_OPTIONS: { value: ReportFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const FORMAT_OPTIONS: { value: ReportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
];

interface ScheduledReportFormValues {
  name: string;
  report_type: ReportType;
  frequency: ReportFrequency;
  execution_time: string;
  recipients: string;
  export_format: ReportFormat;
  is_active: boolean;
}

const emptyFormValues: ScheduledReportFormValues = {
  name: '',
  report_type: 'sales',
  frequency: 'daily',
  execution_time: '08:00',
  recipients: '',
  export_format: 'csv',
  is_active: true,
};

const ScheduledReports: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'ANALYST';

  const [page, setPage] = useState(1);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ScheduledReportFormValues>({ defaultValues: emptyFormValues });

  const { data, isLoading } = useQuery({
    queryKey: ['scheduledReports', page, filterActive],
    queryFn: () => getScheduledReports({ page, page_size: 20, is_active: filterActive }),
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: createScheduledReport,
    onSuccess: () => {
      showNotification('Scheduled report created', 'success');
      setModalOpen(false);
      reset(emptyFormValues);
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
    },
    onError: (error: any) => {
      showNotification(error?.response?.data?.detail || 'Failed to create scheduled report', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ScheduledReportUpdate }) => updateScheduledReport(id, payload),
    onSuccess: () => {
      showNotification('Scheduled report updated', 'success');
      setModalOpen(false);
      setEditingReport(null);
      reset(emptyFormValues);
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
    },
    onError: (error: any) => {
      showNotification(error?.response?.data?.detail || 'Failed to update scheduled report', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteScheduledReport,
    onSuccess: () => {
      showNotification('Scheduled report deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
    },
    onError: (error: any) => {
      showNotification(error?.response?.data?.detail || 'Failed to delete scheduled report', 'error');
    },
  });

  const openCreate = () => {
    setEditingReport(null);
    reset(emptyFormValues);
    setModalOpen(true);
  };

  const openEdit = (report: ScheduledReport) => {
    setEditingReport(report);
    setValue('name', report.name);
    setValue('report_type', report.report_type);
    setValue('frequency', report.frequency);
    setValue('execution_time', report.execution_time);
    setValue('recipients', (report.recipients || []).join(', '));
    setValue('export_format', report.export_format);
    setValue('is_active', report.is_active);
    setModalOpen(true);
  };

  const onSubmit = (values: ScheduledReportFormValues) => {
    const recipients = values.recipients.split(',').map((r) => r.trim()).filter(Boolean);
    if (recipients.length === 0) {
      showNotification('At least one recipient email is required', 'error');
      return;
    }
    if (editingReport) {
      updateMutation.mutate({
        id: editingReport.id,
        payload: {
          name: values.name,
          report_type: values.report_type,
          frequency: values.frequency,
          execution_time: values.execution_time,
          recipients,
          export_format: values.export_format,
          is_active: values.is_active,
        },
      });
    } else {
      createMutation.mutate({
        name: values.name,
        report_type: values.report_type,
        frequency: values.frequency,
        execution_time: values.execution_time,
        recipients,
        export_format: values.export_format,
        is_active: values.is_active,
      });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this scheduled report?')) {
      deleteMutation.mutate(id);
    }
  };

  const toggleActive = (report: ScheduledReport) => {
    updateMutation.mutate({
      id: report.id,
      payload: { is_active: !report.is_active },
    });
  };

  if (!isAdmin) {
    return <div className="p-6 text-red-600 text-sm">You do not have permission to access scheduled reports.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Scheduled Reports</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Create and manage recurring report schedules</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <AddIcon fontSize="small" /> New Schedule
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <button
            onClick={() => setFilterActive(undefined)}
            className={`px-3 py-1.5 text-[10px] font-medium rounded-lg border ${filterActive === undefined ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterActive(true)}
            className={`px-3 py-1.5 text-[10px] font-medium rounded-lg border ${filterActive === true ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterActive(false)}
            className={`px-3 py-1.5 text-[10px] font-medium rounded-lg border ${filterActive === false ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
          >
            Inactive
          </button>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading scheduled reports...</div>
        ) : data && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Report Type</th>
                  <th className="px-4 py-3 font-medium">Frequency</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Format</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Run</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.items.map((report: ScheduledReport) => (
                  <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium">{report.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 capitalize">{report.report_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 capitalize">{report.frequency}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{report.execution_time}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 uppercase">{report.export_format}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${report.is_active ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-400'}`}>
                        {report.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {report.last_run_at ? new Date(report.last_run_at).toLocaleString() : 'Never'}
                      {report.last_run_status && <span className={`ml-2 text-[10px] ${report.last_run_status === 'completed' ? 'text-emerald-600' : 'text-red-600'}`}>({report.last_run_status})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleActive(report)} title={report.is_active ? 'Pause' : 'Resume'} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {report.is_active ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
                        </button>
                        <button onClick={() => openEdit(report)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                          <EditIcon fontSize="small" />
                        </button>
                        <button onClick={() => handleDelete(report.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600">
                          <DeleteIcon fontSize="small" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Total: {data.total} schedules</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-[10px] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-50">Prev</button>
                <span className="text-[10px] text-slate-500">Page {page}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={data.items.length < 20} className="px-3 py-1 text-[10px] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">No scheduled reports found. Create one to get started.</div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{editingReport ? 'Edit Scheduled Report' : 'New Scheduled Report'}</h3>
              <button onClick={() => { setModalOpen(false); setEditingReport(null); reset(emptyFormValues); }} className="text-slate-400 hover:text-slate-600">
                <CloseIcon fontSize="small" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Name</label>
                <input {...register('name', { required: 'Name is required' })} className={inputClass} placeholder="Weekly Sales Report" />
                {errors.name && <span className="text-[10px] text-red-600">{errors.name.message}</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Report Type</label>
                  <select {...register('report_type')} className={inputClass}>
                    {REPORT_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Frequency</label>
                  <select {...register('frequency')} className={inputClass}>
                    {FREQUENCY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Execution Time</label>
                  <input type="time" {...register('execution_time')} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Export Format</label>
                  <select {...register('export_format')} className={inputClass}>
                    {FORMAT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Recipients (comma-separated emails)</label>
                <input {...register('recipients', { required: 'At least one recipient is required' })} className={inputClass} placeholder="user@example.com, admin@example.com" />
                {errors.recipients && <span className="text-[10px] text-red-600">{errors.recipients.message}</span>}
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" {...register('is_active')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <label htmlFor="is_active" className="text-xs text-slate-700 dark:text-slate-300">Active</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setModalOpen(false); setEditingReport(null); reset(emptyFormValues); }} className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {editingReport ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledReports;
