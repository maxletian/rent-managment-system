import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { DashboardStats } from '../types';
import { Home, Users, AlertCircle, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateInvoices = async () => {
    if (!confirm('Generate monthly records for all occupied houses for the current month?')) return;
    
    const currentMonth = new Date().toISOString().substring(0, 7);
    try {
      const res = await fetch('/api/admin/generate-monthly-records', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ month_year: currentMonth })
      });
      if (res.ok) {
        alert('Records generated successfully');
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64">Loading...</div>;

  const totalCollected = (stats?.collectedRent || 0) + (stats?.collectedDeposits || 0);

  const cards = [
    { label: 'Total Houses', value: stats?.totalHouses, icon: Home, color: 'bg-blue-500' },
    { label: 'Occupied', value: stats?.occupiedHouses, icon: Users, color: 'bg-emerald-500' },
    { label: 'Vacant', value: stats?.vacantHouses, icon: AlertCircle, color: 'bg-amber-500' },
    { label: 'Expected Rent', value: `KES ${stats?.expectedRent.toLocaleString()}`, icon: TrendingUp, color: 'bg-indigo-500' },
    { label: 'Collected', value: `KES ${totalCollected.toLocaleString()}`, icon: DollarSign, color: 'bg-green-500' },
    { label: 'Total Arrears', value: `KES ${stats?.totalArrears.toLocaleString()}`, icon: AlertCircle, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
          <p className="text-slate-500">Welcome back, {user?.fullName}</p>
        </div>
        {user?.role === 'LANDLORD' && (
          <button 
            onClick={generateInvoices}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Calendar className="mr-2" size={18} />
            Generate Monthly Records
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={card.label}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center"
          >
            <div className={`${card.color} p-4 rounded-xl text-white mr-4 shadow-lg shadow-${card.color.split('-')[1]}-200`}>
              <card.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{card.label}</p>
              <p className="text-2xl font-bold text-slate-800">{card.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4">Collection Status</h3>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-emerald-600 bg-emerald-200">
                  Progress
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-emerald-600">
                  {stats?.expectedRent ? Math.round((stats.collectedRent / stats.expectedRent) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-emerald-100">
              <div 
                style={{ width: `${stats?.expectedRent ? (stats.collectedRent / stats.expectedRent) * 100 : 0}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500 transition-all duration-500"
              ></div>
            </div>
            <p className="text-sm text-slate-500">
              Collected KES {stats?.collectedRent.toLocaleString()} out of KES {stats?.expectedRent.toLocaleString()} expected this month.
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            {user?.role === 'LANDLORD' && (
              <button 
                onClick={() => onNavigate('houses')}
                className="p-4 bg-slate-50 rounded-xl text-left hover:bg-slate-100 transition-colors border border-slate-200 group"
              >
                <p className="font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">Add House</p>
                <p className="text-xs text-slate-500">Create new rental unit</p>
              </button>
            )}
            <button 
              onClick={() => onNavigate('tenants')}
              className="p-4 bg-slate-50 rounded-xl text-left hover:bg-slate-100 transition-colors border border-slate-200 group"
            >
              <p className="font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">Add Tenant</p>
              <p className="text-xs text-slate-500">Register new occupant</p>
            </button>
            <button 
              onClick={() => onNavigate('tenants')}
              className="p-4 bg-slate-50 rounded-xl text-left hover:bg-slate-100 transition-colors border border-slate-200 group"
            >
              <p className="font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">Record Payment</p>
              <p className="text-xs text-slate-500">Log rent collection</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
