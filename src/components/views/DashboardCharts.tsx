import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart as ReBarChart, PieChart, Pie, Cell } from 'recharts';

interface DashboardChartsProps {
  userPerformance: Array<{
    name: string;
    total: number;
    concluidas: number;
    atrasadas: number;
  }>;
  statusData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  total: number;
  primaryChartColor: string;
}

export function DashboardCharts({ userPerformance, statusData, total, primaryChartColor }: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2">
        <h2 className="font-bold text-gray-700 mb-5 flex items-center gap-2">
          👥 Performance por Usuário
          <span className="ml-auto text-xs text-gray-400 font-normal">{userPerformance.length} membro{userPerformance.length !== 1 ? 's' : ''} ativos</span>
        </h2>
        {userPerformance.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">Nenhum usuário com tarefas no período.</div>
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={userPerformance} barGap={4} barCategoryGap={userPerformance.length === 1 ? '60%' : '20%'}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" />
                <YAxis fontSize={11} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(val: unknown, name: string) => [val, name === 'total' ? 'Total' : name === 'concluidas' ? 'Concluídas' : 'Atrasadas']}
                />
                <Bar dataKey="total" fill={primaryChartColor} radius={[4,4,0,0]} name="total" />
                <Bar dataKey="concluidas" fill="#10b981" radius={[4,4,0,0]} name="concluidas" />
                <Bar dataKey="atrasadas" fill="#ef4444" radius={[4,4,0,0]} name="atrasadas" />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        )}
        {userPerformance.length > 0 && (
          <div className="flex items-center gap-5 mt-3 justify-center">
            {[[primaryChartColor, 'Total'], ['#10b981', 'Concluídas'], ['#ef4444', 'Atrasadas']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: c }} />{l}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="font-bold text-gray-700 mb-5">🎯 Distribuição de Status</h2>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {statusData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip formatter={(val: unknown, name: string) => [val, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {statusData.map((d) => {
            const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
            return (
              <div key={d.name} className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="truncate max-w-[130px]">{d.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-gray-400">{pct}%</span>
                  <span className="font-bold w-8 text-right">{d.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

