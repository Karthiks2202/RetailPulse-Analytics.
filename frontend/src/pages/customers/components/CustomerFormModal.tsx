import React from 'react';
import { useForm } from 'react-hook-form';
import { Close as CloseIcon } from '@mui/icons-material';
import { type Customer, type CustomerCreate } from '../../api/customerApi';

interface CustomerFormValues {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  customer_type: 'RETAIL' | 'WHOLESALE' | 'CORPORATE';
  preferred_sales_channel: string;
  notes: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface CustomerFormModalProps {
  open: boolean;
  editing: Customer | null;
  onClose: () => void;
  onSubmit: (values: CustomerFormValues) => void;
  error: string | null;
  isPending: boolean;
}

const inputClass =
  'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  open, editing, onClose, onSubmit, error, isPending,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: '',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      customer_type: 'RETAIL',
      preferred_sales_channel: '',
      notes: '',
      status: 'ACTIVE',
    },
  });

  React.useEffect(() => {
    if (open) {
      if (editing) {
        setValue('first_name', editing.first_name);
        setValue('last_name', editing.last_name);
        setValue('email', editing.email || '');
        setValue('phone', editing.phone || '');
        setValue('date_of_birth', editing.date_of_birth ? new Date(editing.date_of_birth).toISOString().split('T')[0] : '');
        setValue('gender', (editing as any).gender || '');
        setValue('address', editing.address || '');
        setValue('city', editing.city || '');
        setValue('state', editing.state || '');
        setValue('postal_code', editing.postal_code || '');
        setValue('country', editing.country || '');
        setValue('customer_type', (editing as any).customer_type || 'RETAIL');
        setValue('preferred_sales_channel', (editing as any).preferred_sales_channel || '');
        setValue('notes', editing.notes || '');
        setValue('status', editing.status);
      } else {
        reset({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          date_of_birth: '',
          gender: '',
          address: '',
          city: '',
          state: '',
          postal_code: '',
          country: '',
          customer_type: 'RETAIL',
          preferred_sales_channel: '',
          notes: '',
          status: 'ACTIVE',
        });
      }
    }
  }, [open, editing, setValue, reset]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-modal-enter">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {editing ? 'Edit Customer' : 'New Customer'}
            </h2>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              {editing ? 'Update customer information' : 'Add a new customer to your database'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <CloseIcon style={{ fontSize: 20 }} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 text-xs font-medium px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">First Name</label>
              <input {...register('first_name', { required: 'First name is required' })} className={`${inputClass} w-full`} placeholder="First name" />
              {errors.first_name && <p className="text-red-500 text-[10px] mt-1">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Last Name</label>
              <input {...register('last_name', { required: 'Last name is required' })} className={`${inputClass} w-full`} placeholder="Last name" />
              {errors.last_name && <p className="text-red-500 text-[10px] mt-1">{errors.last_name.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Email</label>
              <input type="email" {...register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' } })} className={`${inputClass} w-full`} placeholder="email@example.com" />
              {errors.email && <p className="text-red-500 text-[10px] mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Phone</label>
              <input {...register('phone', { required: 'Phone is required', pattern: { value: /^[+]?[\d\s()-]{7,15}$/, message: 'Invalid phone number' } })} className={`${inputClass} w-full`} placeholder="+1 234 567 8900" />
              {errors.phone && <p className="text-red-500 text-[10px] mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Date of Birth</label>
              <input type="date" {...register('date_of_birth')} className={`${inputClass} w-full`} />
              {errors.date_of_birth && <p className="text-red-500 text-[10px] mt-1">{errors.date_of_birth.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Gender</label>
              <select {...register('gender')} className={`${inputClass} w-full`}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
              {errors.gender && <p className="text-red-500 text-[10px] mt-1">{errors.gender.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Address</label>
              <input {...register('address', { required: 'Address is required' })} className={`${inputClass} w-full`} placeholder="Street address" />
              {errors.address && <p className="text-red-500 text-[10px] mt-1">{errors.address.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">City</label>
              <input {...register('city', { required: 'City is required' })} className={`${inputClass} w-full`} placeholder="City" />
              {errors.city && <p className="text-red-500 text-[10px] mt-1">{errors.city.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">State</label>
              <input {...register('state', { required: 'State is required' })} className={`${inputClass} w-full`} placeholder="State" />
              {errors.state && <p className="text-red-500 text-[10px] mt-1">{errors.state.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Postal Code</label>
              <input {...register('postal_code', { required: 'Postal code is required' })} className={`${inputClass} w-full`} placeholder="Postal code" />
              {errors.postal_code && <p className="text-red-500 text-[10px] mt-1">{errors.postal_code.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Country</label>
              <input {...register('country', { required: 'Country is required' })} className={`${inputClass} w-full`} placeholder="Country" />
              {errors.country && <p className="text-red-500 text-[10px] mt-1">{errors.country.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Customer Type</label>
              <select {...register('customer_type')} className={`${inputClass} w-full`}>
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="CORPORATE">Corporate</option>
              </select>
              {errors.customer_type && <p className="text-red-500 text-[10px] mt-1">{errors.customer_type.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Preferred Sales Channel</label>
              <input {...register('preferred_sales_channel')} className={`${inputClass} w-full`} placeholder="e.g. Online, In-store" />
              {errors.preferred_sales_channel && <p className="text-red-500 text-[10px] mt-1">{errors.preferred_sales_channel.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Status</label>
              <select {...register('status')} className={`${inputClass} w-full`}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              {errors.status && <p className="text-red-500 text-[10px] mt-1">{errors.status.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Notes</label>
              <textarea {...register('notes')} className={`${inputClass} w-full`} rows={3} placeholder="Optional notes about this customer" />
              {errors.notes && <p className="text-red-500 text-[10px] mt-1">{errors.notes.message}</p>}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {isPending ? 'Saving...' : editing ? 'Update Customer' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerFormModal;
