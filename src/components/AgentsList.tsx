import React from 'react';

interface Agent {
  id: string;
  name: string;
  email: string;
}

interface AgentsListProps {
  agents: Agent[];
}

const AgentsList: React.FC<AgentsListProps> = ({ agents }) => {
  if (agents.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        لم يتم العثور على مندوبين.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              اسم المندوب
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              البريد الإلكتروني
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {agents.map((agent) => (
            <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{agent.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{agent.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AgentsList;
