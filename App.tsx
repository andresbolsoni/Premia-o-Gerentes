
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Employee, KPIType, CalculationResult, EmployeePerformance, EmployeeRole } from './types';
import EmployeeCard from './components/EmployeeCard';
import KPICalculator from './components/KPICalculator';
import { formatCurrency, getBonusPercentage } from './services/calculator';
import { KPI_LABELS } from './constants';

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
        // Detecta se é CSV com ponto-e-virgula ou virgula
        const parts = line.includes(';') ? line.split(';') : line.split(',');
        
        if (parts.length >= 2) {
          const name = parts[0].trim();
          
          // Limpa o salário: remove R$, remove pontos de milhar, troca vírgula por ponto
          let salaryStr = parts[1].trim()
            .replace(/[R$\s]/g, '')
            .replace(/\.(?=[0-9]{3})/g, '')
            .replace(',', '.');
          
          const salary = parseFloat(salaryStr);
          
          // Perfil (Terceira Coluna)
          let role = EmployeeRole.EQUIPE;
          if (parts[2]) {
            const roleStr = parts[2].trim().toUpperCase();
            if (roleStr === 'GERENTE') {
              role = EmployeeRole.GERENTE;
            }
          }

          // Evita cabeçalhos e valores inválidos
          if (name && !isNaN(salary) && name.toLowerCase() !== 'nome' && name.toLowerCase() !== 'gerente') {
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
        // Opção: Substituir tudo ou adicionar? Vou usar adicionar para não perder dados.
        // Se quiser substituir, use: setEmployees(newEmployees);
        setEmployees(prev => [...prev, ...newEmployees]);
        alert(`${newEmployees.length} colaboradores importados com sucesso!`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDeleteEmployee = (id: string) => {
    if (confirm("Tem certeza que deseja remover este colaborador?")) {
      setEmployees(prev => prev.filter(e => e.id !== id));
      setTeamPerformance(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (selectedId === id) setSelectedId(null);
    }
  };

  const clearAllData = () => {
    if (confirm("ATENÇÃO: Isso apagará TODOS os colaboradores e dados inseridos. Deseja continuar?")) {
      setEmployees([]);
      setTeamPerformance({});
      setSelectedId(null);
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
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "relatorio_rh_premiacao.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen pb-12">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.txt" className="hidden" />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">KPI Rewards</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowRHModal(true)} className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-semibold rounded-lg transition-colors border border-indigo-100 shadow-sm">
              <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Resumo RH
            </button>
            <div className="relative group">
              <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors shadow-sm">
                Importar CSV
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-gray-800 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                Formato: Nome; Salário; Perfil (Gerente ou Equipe)
              </div>
            </div>
            <button onClick={() => setShowAddModal(true)} className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
              Novo Cadastro
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Equipe</h2>
              {employees.length > 0 && (
                <button onClick={clearAllData} className="text-[10px] text-red-500 hover:underline font-bold uppercase tracking-tighter">Limpar Lista</button>
              )}
            </div>
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
              {employees.length === 0 ? (
                <div className="text-center py-10 bg-white border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                  <p className="text-sm">Nenhum colaborador.</p>
                  <p className="text-[10px] mt-1">Importe um CSV ou adicione manualmente.</p>
                </div>
              ) : (
                employees.map(emp => (
                  <EmployeeCard key={emp.id} employee={emp} isSelected={selectedId === emp.id} onSelect={(e) => setSelectedId(e.id)} onDelete={handleDeleteEmployee} />
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            {selectedEmployee ? (
              <div className="animate-in fade-in duration-300">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 mb-8 text-white shadow-lg">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold">{selectedEmployee.name}</h2>
                        <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{selectedEmployee.role}</span>
                      </div>
                      <p className="text-blue-100 mt-1">Salário Base: {formatCurrency(selectedEmployee.baseSalary)}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                      <div className="text-sm uppercase font-bold text-blue-200 tracking-widest">Prêmio Total Estimado</div>
                      <div className="text-3xl font-black mt-1">{formatCurrency(totalBonusForSelected)}</div>
                    </div>
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
              <div className="flex flex-col items-center justify-center py-24 bg-white border border-gray-200 rounded-3xl text-gray-400">
                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <p className="text-xl font-medium">Selecione um colaborador para começar</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* RH Summary Modal */}
      {showRHModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Resumo RH Consolidado</h2>
                <p className="text-gray-500 text-sm mt-1">Valores calculados com base nas tabelas exatas do plano de premiação.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportToCSV} className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm transition-colors shadow-sm">Exportar para Excel</button>
                <button onClick={() => setShowRHModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b sticky top-0 bg-gray-100">Colaborador</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b sticky top-0 bg-gray-100">Perfil</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b sticky top-0 bg-gray-100">Salário Base</th>
                    {Object.values(KPIType).map(type => (
                      <th key={type} className="p-4 text-xs font-bold text-gray-500 uppercase border-b sticky top-0 bg-gray-100 text-center">
                        {KPI_LABELS[type].split('-')[1].trim()}
                      </th>
                    ))}
                    <th className="p-4 text-xs font-bold text-gray-900 uppercase border-b sticky top-0 bg-gray-100 text-right">Total Prêmio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-gray-400">Nenhum dado disponível.</td></tr>
                  ) : (
                    employees.map(emp => {
                      const perf = teamPerformance[emp.id] || {};
                      let rowTotal = 0;
                      return (
                        <tr key={emp.id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="p-4 font-semibold text-gray-900">{emp.name}</td>
                          <td className="p-4"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${emp.role === EmployeeRole.GERENTE ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{emp.role}</span></td>
                          <td className="p-4 text-gray-600">{formatCurrency(emp.baseSalary)}</td>
                          {Object.values(KPIType).map(type => {
                            const bonusPct = getBonusPercentage(type, perf[type] || 0, emp.role);
                            const bonusVal = (emp.baseSalary * bonusPct) / 100;
                            rowTotal += bonusVal;
                            return (
                              <td key={type} className="p-4 text-center">
                                <div className="font-medium text-gray-900">{formatCurrency(bonusVal)}</div>
                                <div className="text-[10px] text-gray-400">{bonusPct.toFixed(1)}%</div>
                              </td>
                            );
                          })}
                          <td className="p-4 text-right"><span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-bold">{formatCurrency(rowTotal)}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Novo Colaborador</h2>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
                <input type="text" required className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={newEmployee.name} onChange={e => setNewEmployee(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Perfil da Escala</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={newEmployee.role} onChange={e => setNewEmployee(prev => ({ ...prev, role: e.target.value as EmployeeRole }))}>
                  <option value={EmployeeRole.EQUIPE}>Equipe (Escala Menor - Tabela 4)</option>
                  <option value={EmployeeRole.GERENTE}>Gerente (Escala Maior - Tabela 2)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Salário Base (R$)</label>
                <input type="number" required step="0.01" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={newEmployee.baseSalary} onChange={e => setNewEmployee(prev => ({ ...prev, baseSalary: e.target.value }))} />
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
