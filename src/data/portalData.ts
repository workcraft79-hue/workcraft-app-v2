import { Salon, NotificationItem } from '../types/workcraft';

export const LOGO_URL =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo_1080x1080_Transparent-removebg-preview-5mbJ3iqnoAxyGjzoh9Mi5crnBWv566.png';

export const WATERMARK_URL =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Watermark_300x56_Transparent-TiukzFXFvfRuQDpDSWkTnIAkEIxmLx.png';

export const SALONS: Salon[] = [
  {
    name: 'Seven Cuts Salon',
    owner: 'Hamza',
    location: 'Lahore',
    status: 'Pending',
    plan: 'PKR 1,500 (Starter)',
    initials: 'SC',
  },
  {
    name: 'Noor Beauty Lounge',
    owner: 'Ayesha',
    location: 'Karachi',
    status: 'Paid',
    plan: 'PKR 2,000 (Growth)',
    initials: 'NB',
  },
  {
    name: 'The Groom Room',
    owner: 'Bilal',
    location: 'Islamabad',
    status: 'Paid',
    plan: 'PKR 2,500 (VIP)',
    initials: 'GR',
  },
];

export const ARCHIVED_SALONS = [
  { name: 'Elite Cuts Gulberg', owner: 'Zubair', status: 'Archived', plan: 'PKR 1,500 (Starter)' },
  { name: 'Sultan Barber DHA', owner: 'Taimoor', status: 'Archived', plan: 'PKR 2,000 (Growth)' },
  { name: 'Karachi Grooming Hub', owner: 'Farhan', status: 'Archived', plan: 'PKR 2,500 (VIP)' },
  { name: 'Islamabad Fade Studio', owner: 'Rehan', status: 'Archived', plan: 'PKR 2,000 (Growth)' },
];

export const NOTIFICATIONS: NotificationItem[] = [
  {
    title: 'Payment notification',
    description: 'EasyPaisa receipt matched for Noor Beauty Lounge',
    time: '2 min ago',
  },
  {
    title: 'Voice support',
    description: 'Seven Cuts Salon sent a private voice support note',
    time: '18 min ago',
  },
  {
    title: 'System alert',
    description: '3 salons enter the maintenance window today',
    time: '1 hr ago',
  },
];
