export interface User {
  id: number;
  username: string;
  role: 'LANDLORD' | 'CARETAKER';
  fullName: string;
}

export interface House {
  id: number;
  house_number: string;
  rent_amount: number;
  status: 'VACANT' | 'OCCUPIED';
  tenant_name?: string;
}

export interface Tenant {
  id: number;
  full_name: string;
  phone: string;
  national_id: string;
  house_id: number;
  entry_date: string;
  security_deposit: number;
  house_number?: string;
  monthly_rent?: number;
}

export interface Payment {
  id: number;
  tenant_id: number;
  amount: number;
  payment_date: string;
  month_year: string;
  type: 'RENT' | 'DEPOSIT';
  recorded_by: number;
}

export interface MonthlyRecord {
  id: number;
  tenant_id: number;
  month_year: string;
  rent_due: number;
  arrears_brought_forward: number;
  total_due: number;
  amount_paid: number;
  balance: number;
}

export interface DashboardStats {
  totalHouses: number;
  occupiedHouses: number;
  vacantHouses: number;
  expectedRent: number;
  collectedRent: number;
  collectedDeposits: number;
  totalArrears: number;
}
