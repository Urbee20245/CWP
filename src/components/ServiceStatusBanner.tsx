"use client";

import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Briefcase } from 'lucide-react';

interface ServiceStatusBannerProps {
  status: 'active' | 'paused' | 'onboarding' | 'completed' | 'awaiting_payment';
  type: 'client' | 'project';
}

const ServiceStatusBanner: React.FC<ServiceStatusBannerProps> = ({ status, type }) => {
  let icon: React.ReactNode;
  let bgColor: string;
  let textColor: string;
  let title: string;
  let message: string;

  switch (status) {
    case 'paused':
      icon = <Clock className="w-5 h-5 flex-shrink-0" />;
      bgColor = 'bg-amber-50 border-amber-200';
      textColor = 'text-amber-800';
      title = type === 'project' ? 'Project Work Temporarily Paused' : 'Service Status: Paused';
      message = 'Your portal remains fully accessible. Active work is currently paused. Please contact us if you have questions regarding the service status.';
      break;
    case 'awaiting_payment':
      icon = <AlertTriangle className="w-5 h-5 flex-shrink-0" />;
      bgColor = 'bg-red-50 border-red-200';
      textColor = 'text-red-800';
      title = 'Awaiting Payment to Resume Work';
      message = 'This project is currently on hold pending payment of a required deposit or milestone invoice. Please check the Billing section to proceed.';
      break;
    case 'onboarding':
      icon = <Briefcase className="w-5 h-5 flex-shrink-0" />;
      bgColor = 'bg-blue-50 border-blue-200';
      textColor = 'text-blue-800';
      title = 'Onboarding in Progress';
      message = 'We are currently setting up your account and project environment. You will be notified when active work begins.';
      break;
    case 'completed':
      icon = <CheckCircle2 className="w-5 h-5 flex-shrink-0" />;
      bgColor = 'bg-emerald-50 border-emerald-200';
      textColor = 'text-emerald-800';
      title = type === 'project' ? 'Project Completed' : 'All Services Completed';
      message = 'This project has been successfully completed and delivered. Thank you for your business!';
      break;
    case 'active':
    default:
      return null; // Do not show banner if active
  }

  return (
    <div className={`p-4 mb-8 rounded-xl flex items-start gap-3 ${bgColor} border`}>
      <div className={textColor}>{icon}</div>
      <div>
        <p className={`font-bold text-sm mb-1 ${textColor}`}>{title}</p>
        <p className={`text-xs ${textColor}`}>{message}</p>
      </div>
    </div>
  );
};

export default ServiceStatusBanner;