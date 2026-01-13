
export enum KPIType {
  MONTHLY_BSC = 'MONTHLY_BSC',
  QUARTERLY_GERENCIAL = 'QUARTERLY_GERENCIAL',
  MONTHLY_MAT = 'MONTHLY_MAT',
  QUARTERLY_SPECIAL = 'QUARTERLY_SPECIAL'
}

export enum EmployeeRole {
  GERENTE = 'GERENTE',
  EQUIPE = 'EQUIPE'
}

export interface Employee {
  id: string;
  name: string;
  baseSalary: number;
  role: EmployeeRole;
}

export interface AchievementResult {
  kpiType: KPIType;
  achievementPercentage: number;
}

export interface CalculationResult {
  kpiType: KPIType;
  achievement: number;
  bonusPercentage: number;
  bonusValue: number;
}

export interface PrizeBracket {
  attaining: number;
  basePercentage: number;
}

export interface EmployeePerformance {
  [kpi: string]: number;
}
