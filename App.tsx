import React, { useState, useEffect, useRef } from 'react';
import { Employee, KPIType, CalculationResult, EmployeePerformance, EmployeeRole } from './types';
import EmployeeCard from './components/EmployeeCard';
import KPICalculator from './components/KPICalculator';
import { getBonusPercentage } from './services/calculator';
import { KPI_LABELS } from './constants';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const App: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('kpi_employees');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Exemplo Gerente', baseSalary: 18742.00, role: EmployeeRole.GERENTE },
      { id: '2', name: 'Exemplo Equipe', baseSalary: 5000, role: EmployeeRole.EQUIPE }
    ];
  });
  
  const [teamPerformance, setTeamPerformance] = useState<{ [empId: string]: EmployeePerformance }>(() => {
    const saved = localStorage.getItem('kpi_performance');
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedId, setSelectedId] = useState<string | null>(employees[0]?.id || null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRHModal, setShowRHModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', baseSalary: '', role: EmployeeRole.EQUIPE });
  const [currentSelectedResults, setCurrentSelectedResults] = useState<CalculationResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('kpi_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('kpi_performance', JSON.stringify(teamPerformance));
  }, [teamPerformance]);

  const selectedEmployee = employees.find(e => e.id === selectedId);

  const handlePerformanceChange = (kpi: KPIType, value: number) => {
    if (!selectedId) return;
    setTeamPerformance(prev => ({
      ...prev,
      [selectedId]: {
        ...(prev[selectedId] || {}),
        [kpi]: value
      }
    }));
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.name || !newEmployee.baseSalary) return;

    const employee: Employee = {
      id: Date.now().toString(),
      name: newEmployee.name,
      baseSalary: parseFloat(newEmployee.baseSalary),
      role: newEmployee.role
    };

    setEmployees(prev => [...prev, employee]);
    setSelectedId(employee.id);
    setNewEmployee({ name: '', baseSalary: '', role: EmployeeRole.EQUIPE });
    setShowAddModal(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      const newEmployees: Employee[] = [];

      lines.forEach((line) => {
        const parts = line.includes(';') ? line.split(';') : line.split(',');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          let salaryStr = parts[1].trim()
            .replace(/[R$\s]/g, '')
            .replace(/\.(?=[0-9]{3})/g, '')
            .replace(',', '.');
          const salary = parseFloat(salaryStr);
          let role = EmployeeRole.EQUIPE;
          if (parts[2]) {
            const roleStr = parts[2].trim().toUpperCase();
            if (roleStr === 'GERENTE') role = EmployeeRole.GERENTE;
          }
          if (name && !isNaN(salary) && name.toLowerCase() !== 'nome') {
            newEmployees.push({
              id: (Date.now() + Math.random()).toString(),
              name,
              baseSalary: salary,
              role
            });
          }
        }
      });

      if (newEmployees.length > 0) {
        setEmployees(prev => [...prev, ...newEmployees]);
        alert(`${newEmployees.length} colaboradores importados!`);
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteEmployee = (id: string) => {
    if (confirm("Remover este colaborador?")) {
      setEmployees(prev => prev.filter(e => e.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
  };

  const totalBonusForSelected = currentSelectedResults.reduce((acc, curr) => acc + curr.bonusValue, 0);

  const exportToCSV = () => {
    let csv = "Colaborador;Perfil;Salario Base;" + Object.values(KPIType).join(";") + ";Total Premiacao\n";
    employees.forEach(emp => {
      const perf = teamPerformance[emp.id] || {};
      let line = `${emp.name};${emp.role};${emp.baseSalary.toFixed(2)}`;
      let total = 0;
      Object.values(KPIType).forEach(type => {
        const bonusPct = getBonusPercentage(type, perf[type] || 0, emp.role);
        const bonusVal = (emp.baseSalary * bonusPct) / 100;
        total += bonusVal;
        line += `;${bonusVal.toFixed(2)}`;
      });
      line += `;${total.toFixed(2)}\n`;
      csv += line;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio_premiacao.csv";
    link.click();
  };

  return (
    <div className="min-h-screen pb-12">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.txt" className="hidden" />
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white font-bold">KPI</div>
            <h1 className="text-xl font-bold text-gray-900">Calculadora de Prêmios</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowRHModal(true)} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold">Resumo RH</button>
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold">Importar CSV</button>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">Novo</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase">Colaboradores</h2>
          <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {employees.map(emp => (
              <EmployeeCard 
                key={emp.id} 
                employee={emp} 
                isSelected={selectedId === emp.id} 
                onSelect={(employee: Employee) => setSelectedId(employee.id)} 
                onDelete={handleDeleteEmployee} 
              />
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          {selectedEmployee ? (
            <div className="animate-in fade-in">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 mb-8 text-white shadow-lg flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold">{selectedEmployee.name}</h2>
                  <p className="text-blue-100">Base: {formatCurrency(selectedEmployee.baseSalary)} | {selectedEmployee.role}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold opacity-80 uppercase">Total Estimado</div>
                  <div className="text-3xl font-black">{formatCurrency(totalBonusForSelected)}</div>
                </div>
              </div>

              <KPICalculator 
                employee={selectedEmployee} 
                performance={teamPerformance[selectedId!] || {}}
                onPerformanceChange={handlePerformanceChange}
                onCalculatedResults={setCurrentSelectedResults}
              />
            </div>
          ) : (
            <div className="text-center py-20 border-2 border-dashed rounded-3xl text-gray-400">Selecione alguém para começar</div>
          )}
        </div>
      </main>

      {showRHModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-2xl font-bold">Relatório Consolidado</h2>
              <div className="flex gap-2">
                <button onClick={exportToCSV} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Exportar CSV</button>
                <button onClick={() => setShowRHModal(false)} className="text-gray-400 text-2xl">&times;</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Salário</th>
                    {Object.values(KPIType).map(t => <th key={t} className="p-3 text-center">{t.split('_')[1]}</th>)}
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map(emp => {
                    const perf = teamPerformance[emp.id] || {};
                    let total = 0;
                    return (
                      <tr key={emp.id}>
                        <td className="p-3 font-medium">{emp.name}</td>
                        <td className="p-3 text-gray-500">{formatCurrency(emp.baseSalary)}</td>
                        {Object.values(KPIType).map(type => {
                          const bonusPct = getBonusPercentage(type, perf[type] || 0, emp.role);
                          const bonusVal = (emp.baseSalary * bonusPct) / 100;
                          total += bonusVal;
                          return <td key={type} className="p-3 text-center">{formatCurrency(bonusVal)}</td>;
                        })}
                        <td className="p-3 text-right font-bold text-blue-600">{formatCurrency(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Adicionar Colaborador</h2>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <input placeholder="Nome" required className="w-full p-2 border rounded" value={newEmployee.name} onChange={e => setNewEmployee(p => ({ ...p, name: e.target.value }))} />
              <select className="w-full p-2 border rounded" value={newEmployee.role} onChange={e => setNewEmployee(p => ({ ...p, role: e.target.value as EmployeeRole }))}>
                <option value={EmployeeRole.EQUIPE}>Equipe</option>
                <option value={EmployeeRole.GERENTE}>Gerente</option>
              </select>
              <input type="number" placeholder="Salário Base" required className="w-full p-2 border rounded" value={newEmployee.baseSalary} onChange={e => setNewEmployee(p => ({ ...p, baseSalary: e.target.value }))} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 p-2 bg-gray-100 rounded">Cancelar</button>
                <button type="submit" className="flex-1 p-2 bg-blue-600 text-white rounded">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
