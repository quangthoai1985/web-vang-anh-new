import React from 'react';
import { ArrowRight } from 'lucide-react';
import { DashboardCardData } from '../types';

interface DashboardCardProps {
  data: DashboardCardData;
  onClick: (id: string) => void;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ data, onClick }) => {
  const { id, title, description, icon: Icon, colorClass, bgClass, hoverClass, stats } = data;

  return (
    <div 
      onClick={() => onClick(id)}
      className={`
        group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-8 shadow-lg 
        transition-all duration-500 ease-out 
        cursor-pointer 
        hover:-translate-y-2 hover:shadow-xl
        ${hoverClass}
      `}
    >
      {/* Background Decor - Gradient Blob */}
      <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${bgClass} blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500`}></div>
      
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
          <div className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${bgClass} shadow-sm group-hover:scale-110 transition-transform duration-500`}>
            <Icon className={`h-8 w-8 ${colorClass}`} />
          </div>
          
          <h3 className="mb-3 text-2xl font-bold text-gray-800 group-hover:text-gray-900 tracking-tight">
            {title}
          </h3>
          
          <p className="text-gray-500 leading-relaxed mb-6">
            {description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
           {stats && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full bg-gray-50 text-gray-600 group-hover:bg-white group-hover:shadow-sm transition-all`}>
              {stats}
            </span>
           )}
           
           <div className={`flex items-center gap-2 text-sm font-bold ${colorClass} opacity-0 transform translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300`}>
             Truy cập <ArrowRight className="h-4 w-4" />
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardCard;