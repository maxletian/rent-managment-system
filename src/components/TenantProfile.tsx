import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Tenant, Payment, MonthlyRecord } from '../types';
import { ArrowLeft, Phone, CreditCard, Home, Calendar, Plus, Printer } from 'lucide-react';
import { format } from 'date-fns';

interface TenantProfileProps {
  tenantId: number;
  onBack: () => void;
}

const TenantProfile: React.FC<TenantProfileProps> = ({ tenantId, onBack }) => {
  const { token } = useAuth();
  const [data, setData] = useState<(Tenant & { payments: Payment[], records: MonthlyRecord[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().substring(0, 10),
    month_year: new Date().toISOString().substring(0, 7),
    type: 'RENT' as const
  });

  useEffect(() => {
    fetchTenantData();
  }, [tenantId]);

  const fetchTenantData = async () => {
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...paymentForm,
          tenant_id: tenantId,
          amount: parseFloat(paymentForm.amount)
        })
      });
      if (res.ok) {
        setShowPaymentModal(false);
        setPaymentForm({
          amount: '',
          payment_date: new Date().toISOString().substring(0, 10),
          month_year: new Date().toISOString().substring(0, 7),
          type: 'RENT'
        });
        fetchTenantData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!data) return <div>Tenant not found</div>;

  const currentRecord = data.records[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} className="mr-2" />
          Back to Tenants
        </button>
        <div className="flex space-x-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Printer size={18} className="mr-2" />
            Print Statement
          </button>
          <button 
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus size={18} className="mr-2" />
            Record Payment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                <span className="text-3xl font-bold">{data.full_name.charAt(0)}</span>
              </div>
              <h3 className="text-xl font-bold text-slate-800">{data.full_name}</h3>
              <p className="text-slate-500 text-sm">Tenant ID: #{data.id}</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center p-3 bg-slate-50 rounded-xl">
                <Phone size={18} className="text-slate-400 mr-3" />
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold">Phone</p>
                  <p className="text-sm font-medium">{data.phone}</p>
                </div>
              </div>
              <div className="flex items-center p-3 bg-slate-50 rounded-xl">
                <CreditCard size={18} className="text-slate-400 mr-3" />
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold">National ID</p>
                  <p className="text-sm font-medium">{data.national_id}</p>
                </div>
              </div>
              <div className="flex items-center p-3 bg-slate-50 rounded-xl">
                <Home size={18} className="text-slate-400 mr-3" />
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold">House</p>
                  <p className="text-sm font-medium">{data.house_number}</p>
                </div>
              </div>
              <div className="flex items-center p-3 bg-slate-50 rounded-xl">
                <Calendar size={18} className="text-slate-400 mr-3" />
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold">Entry Date</p>
                  <p className="text-sm font-medium">{format(new Date(data.entry_date), 'PPP')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h4 className="font-bold mb-4">Financial Summary</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Monthly Rent</span>
                <span className="font-bold">KES {data.monthly_rent?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Security Deposit</span>
                <span className="font-bold">KES {data.security_deposit.toLocaleString()}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between">
                <span className="text-slate-800 font-bold">Current Balance</span>
                <span className={`font-bold ${currentRecord?.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  KES {currentRecord?.balance.toLocaleString() || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History & Records */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h4 className="font-bold">Monthly Rent Records</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                    <th className="px-6 py-3">Month</th>
                    <th className="px-6 py-3">Rent Due</th>
                    <th className="px-6 py-3">Prev Arrears</th>
                    <th className="px-6 py-3">Total Due</th>
                    <th className="px-6 py-3">Paid</th>
                    <th className="px-6 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.records.map(record => (
                    <tr key={record.id} className="text-sm">
                      <td className="px-6 py-4 font-medium">{record.month_year}</td>
                      <td className="px-6 py-4">KES {record.rent_due.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-500">KES {record.arrears_brought_forward.toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold">KES {record.total_due.toLocaleString()}</td>
                      <td className="px-6 py-4 text-emerald-600 font-medium">KES {record.amount_paid.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${record.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          KES {record.balance.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h4 className="font-bold">Recent Payments</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">For Month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.payments.map(payment => (
                    <tr key={payment.id} className="text-sm">
                      <td className="px-6 py-4">{format(new Date(payment.payment_date), 'PP')}</td>
                      <td className="px-6 py-4 font-bold text-emerald-600">KES {payment.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium uppercase">
                          {payment.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{payment.month_year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold">Record Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (KES)</label>
                <input 
                  type="number" required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. 15000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
                <input 
                  type="date" required
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">For Month</label>
                <input 
                  type="month" required
                  value={paymentForm.month_year}
                  onChange={(e) => setPaymentForm({ ...paymentForm, month_year: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Type</label>
                <select 
                  value={paymentForm.type}
                  onChange={(e) => setPaymentForm({ ...paymentForm, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="RENT">Rent Payment</option>
                  <option value="DEPOSIT">Security Deposit</option>
                </select>
              </div>
              <div className="pt-4 flex space-x-3">
                <button 
                  type="button" 
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantProfile;
