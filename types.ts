import { LucideIcon } from 'lucide-react';

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface Stat {
  id: string;
  value: string;
  label: string;
  icon: LucideIcon;
}

export interface Step {
  id: number;
  title: string;
  description: string;
}

export enum NavigationLink {
  Services = 'services',
  Portfolio = 'portfolio', // Visual placeholder
  Process = 'process',
  Contact = 'contact'
}