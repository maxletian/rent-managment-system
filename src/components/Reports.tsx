import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { DashboardStats } from '../types';

const Reports: React.FC = () => {
  const { token, user } = useAuth();
  const [arrearsList, setArrearsList] = useState<any[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [arrearsRes, statsRes] = await Promise.all([
        fetch('/api/reports/arrears', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/dashboard/stats', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      const arrearsData = await arrearsRes.json();
      const statsData = await statsRes.json();
      
      setArrearsList(arrearsData);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64">Loading...</div>;

  const totalCollected = (stats?.collectedRent || 0) + (stats?.collectedDeposits || 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Financial Reports</h2>
        <button className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors">
          <Download className="mr-2" size={18} />
          Export All (Excel)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl mr-4">
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 className="font-bold">Arrears Report</h3>
              <p className="text-sm text-slate-500">Tenants with outstanding balances</p>
            </div>
          </div>
          <div className="space-y-4">
            {arrearsList.length > 0 ? (
              arrearsList.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="font-bold text-sm">{item.full_name}</p>
                    <p className="text-xs text-slate-500">House: {item.house_number}</p>
                  </div>
                  <p className="text-rose-600 font-bold">KES {item.arrears_amount.toLocaleString()}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                <CheckCircle className="mx-auto mb-2 opacity-20" size={48} />
                <p>No arrears found for this month!</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl mr-4">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-bold">Monthly Collection</h3>
              <p className="text-sm text-slate-500">Summary of income this month</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-xs text-emerald-600 font-bold uppercase mb-1">Total Collected</p>
              <p className="text-2xl font-bold text-emerald-700">KES {totalCollected.toLocaleString()}</p>
              <p className="text-xs text-emerald-600 mt-1">Current Month: {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 font-bold uppercase">Rent</p>
                <p className="font-bold">KES {stats?.collectedRent.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 font-bold uppercase">Deposits</p>
                <p className="font-bold">KES {stats?.collectedDeposits.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
