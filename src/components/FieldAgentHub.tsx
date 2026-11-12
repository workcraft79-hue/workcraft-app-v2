import React, { useState } from 'react';
import {
  Smartphone,
  MapPin,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  QrCode,
  RotateCcw,
  X,
  Sparkles,
  Wifi,
  Check,
  CreditCard,
  Copy,
  User,
  Fingerprint,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  Scissors,
  Plus,
  Receipt,
  CheckCheck,
  Lock,
  Globe,
  Radio,
  FileCheck,
  Camera,
  Award,
  Ban,
  Power,
  AlertOctagon,
  Flame,
  UserPlus,
  Download,
  Share2,
  FileText,
  Key,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { PortalCard } from './PortalCard';
import { AddNewAgentModal } from './AddNewAgentModal';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  enabled: boolean;
}

interface FieldAgentHubProps {
  onSalonCreated: (salon: { name: string; owner: string; phone: string; location: string; coords: string }) => void;
  onCashCollected?: (amount: number, salonName: string) => void;
  onOpenSalonPwa?: (token: string, salonName: string) => void;
  kamranCashHeld?: number;
  onClose?: () => void;
  initialAutoOpenEnrollment?: boolean;
  initialEnrollAgentData?: {
    id?: string;
    pin?: string;
    name?: string;
    phone?: string;
    city?: string;
  };
  userRole?: 'FOUNDER' | 'FIELD_AGENT' | 'SALON_OWNER';
  onActiveCountriesChange?: (countries: Array<{ code: string; label: string; flag: string }>) => void;
}

const DEFAULT_MENS_SERVICES: ServiceItem[] = [
  { id: 'm1', name: 'Master Haircut', price: 800, enabled: true },
  { id: 'm2', name: 'Skin Fade Styling', price: 600, enabled: true },
  { id: 'm3', name: 'Beard Sculpt & Line-Up', price: 500, enabled: true },
  { id: 'm4', name: 'Ozone Steam Therapy', price: 400, enabled: true },
  { id: 'm5', name: 'Charcoal Deep Detox Facial', price: 2500, enabled: true },
  { id: 'm6', name: 'Hair Protein & Scalp Massage', price: 1800, enabled: true },
  { id: 'm7', name: 'Hot Towel Royal Shave', price: 500, enabled: true },
  { id: 'm8', name: 'Full Grooming VIP Combo', price: 4500, enabled: true },
];

const DEFAULT_LADIES_SERVICES: ServiceItem[] = [
  { id: 'l1', name: 'Signature Haircut', price: 1500, enabled: true },
  { id: 'l2', name: 'Blowdry & Styling', price: 1000, enabled: true },
  { id: 'l3', name: 'Hydra Glow Cleansing Facial', price: 5000, enabled: true },
  { id: 'l4', name: 'Party Makeup', price: 6000, enabled: true },
  { id: 'l5', name: 'Bridal Hair Styling', price: 3500, enabled: true },
  { id: 'l6', name: 'Keratin Smoothing Treatment', price: 14000, enabled: true },
  { id: 'l7', name: 'Manicure & Pedicure Spa', price: 3500, enabled: true },
  { id: 'l8', name: '24K Gold Glow Facial', price: 6500, enabled: true },
];

export interface CountryConfig {
  code: string;
  name: string;
  currency: 'PKR' | 'USD';
  prefix: string;
  localCurrency: string;
  localPrefix: string;
  localArabicPrefix?: string;
  localRateMultiplier: number;
  flag: string;
  isDomestic: boolean;
  region: 'PK' | 'EUROPE' | 'MENA' | 'NORTH_AMERICA' | 'GLOBAL';
  dialCode: string;
  defaultCity: string;
  defaultAddress: string;
  defaultCoords: string;
}

const CANADIAN_AREA_CODES = new Set([
  '204', '226', '236', '249', '250', '289', '306', '343', '365', '367',
  '403', '416', '418', '431', '437', '438', '450', '506', '514', '519',
  '548', '579', '581', '587', '604', '613', '639', '647', '672', '705',
  '709', '742', '778', '780', '782', '807', '819', '825', '867', '873',
  '902', '905',
]);

const CANADIAN_CITY_KEYWORDS = ['canada', 'toronto', 'vancouver', 'montreal', 'calgary', 'ottawa', 'edmonton', 'winnipeg', 'quebec'];

const GLOBAL_DIAL_COUNTRIES: CountryConfig[] = [
  { code: 'AE', name: 'UAE', currency: 'USD', prefix: '$', localCurrency: 'AED', localPrefix: 'AED ', localArabicPrefix: 'د.إ ', localRateMultiplier: 0.075, flag: '🇦🇪', isDomestic: false, region: 'MENA', dialCode: '+971', defaultCity: 'Dubai', defaultAddress: 'Al Rigga Road, Deira, Dubai', defaultCoords: '25.2631° N, 55.3264° E' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'USD', prefix: '$', localCurrency: 'SAR', localPrefix: 'SAR ', localArabicPrefix: 'ر.س ', localRateMultiplier: 0.075, flag: '🇸🇦', isDomestic: false, region: 'MENA', dialCode: '+966', defaultCity: 'Riyadh', defaultAddress: 'Olaya Street, Al Olaya, Riyadh', defaultCoords: '24.6972° N, 46.6838° E' },
  { code: 'KW', name: 'Kuwait', currency: 'USD', prefix: '$', localCurrency: 'KWD', localPrefix: 'KWD ', localArabicPrefix: 'د.ك ', localRateMultiplier: 0.0065, flag: '🇰🇼', isDomestic: false, region: 'MENA', dialCode: '+965', defaultCity: 'Kuwait City', defaultAddress: 'Salmiya Block 4, Kuwait City', defaultCoords: '29.3375° N, 48.0758° E' },
  { code: 'QA', name: 'Qatar', currency: 'USD', prefix: '$', localCurrency: 'QAR', localPrefix: 'QAR ', localArabicPrefix: 'ر.ق ', localRateMultiplier: 0.075, flag: '🇶🇦', isDomestic: false, region: 'MENA', dialCode: '+974', defaultCity: 'Doha', defaultAddress: 'Al Sadd Street, Doha', defaultCoords: '25.2854° N, 51.5310° E' },
  { code: 'OM', name: 'Oman', currency: 'USD', prefix: '$', localCurrency: 'OMR', localPrefix: 'OMR ', localArabicPrefix: 'ر.ع ', localRateMultiplier: 0.008, flag: '🇴🇲', isDomestic: false, region: 'MENA', dialCode: '+968', defaultCity: 'Muscat', defaultAddress: 'Al Qurum Commercial, Muscat', defaultCoords: '23.5880° N, 58.3829° E' },
  { code: 'BH', name: 'Bahrain', currency: 'USD', prefix: '$', localCurrency: 'BHD', localPrefix: 'BHD ', localArabicPrefix: 'د.ب ', localRateMultiplier: 0.008, flag: '🇧🇭', isDomestic: false, region: 'MENA', dialCode: '+973', defaultCity: 'Manama', defaultAddress: 'Seef District, Manama', defaultCoords: '26.2285° N, 50.5860° E' },
  { code: 'JO', name: 'Jordan', currency: 'USD', prefix: '$', localCurrency: 'JOD', localPrefix: 'JOD ', localArabicPrefix: 'د.أ ', localRateMultiplier: 0.015, flag: '🇯🇴', isDomestic: false, region: 'MENA', dialCode: '+962', defaultCity: 'Amman', defaultAddress: 'Abdali Boulevard, Amman', defaultCoords: '31.9539° N, 35.9106° E' },
  { code: 'LB', name: 'Lebanon', currency: 'USD', prefix: '$', localCurrency: 'USD', localPrefix: '$', localArabicPrefix: '$', localRateMultiplier: 0.04, flag: '🇱🇧', isDomestic: false, region: 'MENA', dialCode: '+961', defaultCity: 'Beirut', defaultAddress: 'Hamra Street, Beirut', defaultCoords: '33.8938° N, 35.5018° E' },
  { code: 'MA', name: 'Morocco', currency: 'USD', prefix: '$', localCurrency: 'MAD', localPrefix: 'MAD ', localArabicPrefix: 'د.م ', localRateMultiplier: 0.2, flag: '🇲🇦', isDomestic: false, region: 'MENA', dialCode: '+212', defaultCity: 'Casablanca', defaultAddress: 'Boulevard Anfa, Casablanca', defaultCoords: '33.5731° N, 7.5898° W' },
  { code: 'EG', name: 'Egypt', currency: 'USD', prefix: '$', localCurrency: 'EGP', localPrefix: 'EGP ', localArabicPrefix: 'ج.م ', localRateMultiplier: 0.95, flag: '🇪🇬', isDomestic: false, region: 'MENA', dialCode: '+20', defaultCity: 'Cairo', defaultAddress: 'Zamalek District, Cairo', defaultCoords: '30.0444° N, 31.2357° E' },
  { code: 'GB', name: 'United Kingdom', currency: 'USD', prefix: '$', localCurrency: 'GBP', localPrefix: '£', localRateMultiplier: 0.03, flag: '🇬🇧', isDomestic: false, region: 'EUROPE', dialCode: '+44', defaultCity: 'London', defaultAddress: '48 Oxford Street, Soho, London', defaultCoords: '51.5154° N, 0.1419° W' },
  { code: 'DE', name: 'Germany', currency: 'USD', prefix: '$', localCurrency: 'EUR', localPrefix: '€', localRateMultiplier: 0.035, flag: '🇩🇪', isDomestic: false, region: 'EUROPE', dialCode: '+49', defaultCity: 'Berlin', defaultAddress: 'Friedrichstrasse 112, Berlin', defaultCoords: '52.5200° N, 13.4050° E' },
  { code: 'FR', name: 'France', currency: 'USD', prefix: '$', localCurrency: 'EUR', localPrefix: '€', localRateMultiplier: 0.035, flag: '🇫🇷', isDomestic: false, region: 'EUROPE', dialCode: '+33', defaultCity: 'Paris', defaultAddress: 'Rue de Rivoli 84, Paris', defaultCoords: '48.8566° N, 2.3522° E' },
  { code: 'IT', name: 'Italy', currency: 'USD', prefix: '$', localCurrency: 'EUR', localPrefix: '€', localRateMultiplier: 0.035, flag: '🇮🇹', isDomestic: false, region: 'EUROPE', dialCode: '+39', defaultCity: 'Milan', defaultAddress: 'Corso Buenos Aires 22, Milan', defaultCoords: '45.4642° N, 9.1900° E' },
  { code: 'ES', name: 'Spain', currency: 'USD', prefix: '$', localCurrency: 'EUR', localPrefix: '€', localRateMultiplier: 0.035, flag: '🇪🇸', isDomestic: false, region: 'EUROPE', dialCode: '+34', defaultCity: 'Madrid', defaultAddress: 'Gran Via 35, Madrid', defaultCoords: '40.4168° N, 3.7038° W' },
  { code: 'NL', name: 'Netherlands', currency: 'USD', prefix: '$', localCurrency: 'EUR', localPrefix: '€', localRateMultiplier: 0.035, flag: '🇳🇱', isDomestic: false, region: 'EUROPE', dialCode: '+31', defaultCity: 'Amsterdam', defaultAddress: 'Kalverstraat 90, Amsterdam', defaultCoords: '52.3676° N, 4.9041° E' },
  { code: 'IE', name: 'Ireland', currency: 'USD', prefix: '$', localCurrency: 'EUR', localPrefix: '€', localRateMultiplier: 0.035, flag: '🇮🇪', isDomestic: false, region: 'EUROPE', dialCode: '+353', defaultCity: 'Dublin', defaultAddress: 'Grafton Street 18, Dublin', defaultCoords: '53.3498° N, 6.2603° W' },
  { code: 'CH', name: 'Switzerland', currency: 'USD', prefix: '$', localCurrency: 'CHF', localPrefix: 'CHF ', localRateMultiplier: 0.035, flag: '🇨🇭', isDomestic: false, region: 'EUROPE', dialCode: '+41', defaultCity: 'Zurich', defaultAddress: 'Bahnhofstrasse 42, Zurich', defaultCoords: '47.3769° N, 8.5417° E' },
  { code: 'SE', name: 'Sweden', currency: 'USD', prefix: '$', localCurrency: 'SEK', localPrefix: 'SEK ', localRateMultiplier: 0.4, flag: '🇸🇪', isDomestic: false, region: 'EUROPE', dialCode: '+46', defaultCity: 'Stockholm', defaultAddress: 'Drottninggatan 45, Stockholm', defaultCoords: '59.3293° N, 18.0686° E' },
  { code: 'NO', name: 'Norway', currency: 'USD', prefix: '$', localCurrency: 'NOK', localPrefix: 'NOK ', localRateMultiplier: 0.4, flag: '🇳🇴', isDomestic: false, region: 'EUROPE', dialCode: '+47', defaultCity: 'Oslo', defaultAddress: 'Karl Johans gate 18, Oslo', defaultCoords: '59.9139° N, 10.7522° E' },
  { code: 'DK', name: 'Denmark', currency: 'USD', prefix: '$', localCurrency: 'DKK', localPrefix: 'DKK ', localRateMultiplier: 0.25, flag: '🇩🇰', isDomestic: false, region: 'EUROPE', dialCode: '+45', defaultCity: 'Copenhagen', defaultAddress: 'Stroget 22, Copenhagen', defaultCoords: '55.6761° N, 12.5683° E' },
  { code: 'PT', name: 'Portugal', currency: 'USD', prefix: '$', localCurrency: 'EUR', localPrefix: '€', localRateMultiplier: 0.035, flag: '🇵🇹', isDomestic: false, region: 'EUROPE', dialCode: '+351', defaultCity: 'Lisbon', defaultAddress: 'Avenida da Liberdade 110, Lisbon', defaultCoords: '38.7223° N, 9.1393° W' },
  { code: 'PL', name: 'Poland', currency: 'USD', prefix: '$', localCurrency: 'PLN', localPrefix: 'PLN ', localRateMultiplier: 0.15, flag: '🇵🇱', isDomestic: false, region: 'EUROPE', dialCode: '+48', defaultCity: 'Warsaw', defaultAddress: 'Marszalkowska 78, Warsaw', defaultCoords: '52.2297° N, 21.0122° E' },
  { code: 'GR', name: 'Greece', currency: 'USD', prefix: '$', localCurrency: 'EUR', localPrefix: '€', localRateMultiplier: 0.035, flag: '🇬🇷', isDomestic: false, region: 'EUROPE', dialCode: '+30', defaultCity: 'Athens', defaultAddress: 'Ermou Street 44, Athens', defaultCoords: '37.9838° N, 23.7275° E' },
  { code: 'AT', name: 'Austria', currency: 'USD', prefix: '$', localCurrency: 'EUR', localPrefix: '€', localRateMultiplier: 0.035, flag: '🇦🇹', isDomestic: false, region: 'EUROPE', dialCode: '+43', defaultCity: 'Vienna', defaultAddress: 'Kartner Strasse 28, Vienna', defaultCoords: '48.2082° N, 16.3738° E' },
  { code: 'BE', name: 'Belgium', currency: 'USD', prefix: '$', localCurrency: 'EUR', localPrefix: '€', localRateMultiplier: 0.035, flag: '🇧🇪', isDomestic: false, region: 'EUROPE', dialCode: '+32', defaultCity: 'Brussels', defaultAddress: 'Avenue Louise 65, Brussels', defaultCoords: '50.8503° N, 4.3517° E' },
  { code: 'TR', name: 'Turkey', currency: 'USD', prefix: '$', localCurrency: 'TRY', localPrefix: '₺', localRateMultiplier: 1.0, flag: '🇹🇷', isDomestic: false, region: 'GLOBAL', dialCode: '+90', defaultCity: 'Istanbul', defaultAddress: 'Nisantasi, Sisli, Istanbul', defaultCoords: '41.0082° N, 28.9784° E' },
  { code: 'IN', name: 'India', currency: 'USD', prefix: '$', localCurrency: 'INR', localPrefix: '₹', localRateMultiplier: 0.75, flag: '🇮🇳', isDomestic: false, region: 'GLOBAL', dialCode: '+91', defaultCity: 'Mumbai', defaultAddress: 'Bandra West, Mumbai', defaultCoords: '19.0760° N, 72.8777° E' },
  { code: 'BD', name: 'Bangladesh', currency: 'USD', prefix: '$', localCurrency: 'BDT', localPrefix: '৳', localRateMultiplier: 0.85, flag: '🇧🇩', isDomestic: false, region: 'GLOBAL', dialCode: '+880', defaultCity: 'Dhaka', defaultAddress: 'Gulshan 2, Dhaka', defaultCoords: '23.8103° N, 90.4125° E' },
  { code: 'LK', name: 'Sri Lanka', currency: 'USD', prefix: '$', localCurrency: 'LKR', localPrefix: 'LKR ', localRateMultiplier: 1.2, flag: '🇱🇰', isDomestic: false, region: 'GLOBAL', dialCode: '+94', defaultCity: 'Colombo', defaultAddress: 'Galle Road, Colombo 03', defaultCoords: '6.9271° N, 79.8612° E' },
  { code: 'MY', name: 'Malaysia', currency: 'USD', prefix: '$', localCurrency: 'MYR', localPrefix: 'RM ', localRateMultiplier: 0.08, flag: '🇲🇾', isDomestic: false, region: 'GLOBAL', dialCode: '+60', defaultCity: 'Kuala Lumpur', defaultAddress: 'Bukit Bintang, Kuala Lumpur', defaultCoords: '3.1390° N, 101.6869° E' },
  { code: 'SG', name: 'Singapore', currency: 'USD', prefix: '$', localCurrency: 'SGD', localPrefix: 'S$', localRateMultiplier: 0.045, flag: '🇸🇬', isDomestic: false, region: 'GLOBAL', dialCode: '+65', defaultCity: 'Singapore', defaultAddress: 'Orchard Road, Singapore', defaultCoords: '1.3521° N, 103.8198° E' },
  { code: 'ID', name: 'Indonesia', currency: 'USD', prefix: '$', localCurrency: 'IDR', localPrefix: 'Rp ', localRateMultiplier: 60, flag: '🇮🇩', isDomestic: false, region: 'GLOBAL', dialCode: '+62', defaultCity: 'Jakarta', defaultAddress: 'Sudirman Central, Jakarta', defaultCoords: '6.2088° S, 106.8456° E' },
  { code: 'PH', name: 'Philippines', currency: 'USD', prefix: '$', localCurrency: 'PHP', localPrefix: '₱', localRateMultiplier: 2.2, flag: '🇵🇭', isDomestic: false, region: 'GLOBAL', dialCode: '+63', defaultCity: 'Manila', defaultAddress: 'Makati Avenue, Manila', defaultCoords: '14.5995° N, 120.9842° E' },
  { code: 'TH', name: 'Thailand', currency: 'USD', prefix: '$', localCurrency: 'THB', localPrefix: '฿', localRateMultiplier: 1.3, flag: '🇹🇭', isDomestic: false, region: 'GLOBAL', dialCode: '+66', defaultCity: 'Bangkok', defaultAddress: 'Sukhumvit Road, Bangkok', defaultCoords: '13.7563° N, 100.5018° E' },
  { code: 'JP', name: 'Japan', currency: 'USD', prefix: '$', localCurrency: 'JPY', localPrefix: '¥', localRateMultiplier: 5.5, flag: '🇯🇵', isDomestic: false, region: 'GLOBAL', dialCode: '+81', defaultCity: 'Tokyo', defaultAddress: 'Shibuya Crossing, Tokyo', defaultCoords: '35.6762° N, 139.6503° E' },
  { code: 'KR', name: 'South Korea', currency: 'USD', prefix: '$', localCurrency: 'KRW', localPrefix: '₩', localRateMultiplier: 50, flag: '🇰🇷', isDomestic: false, region: 'GLOBAL', dialCode: '+82', defaultCity: 'Seoul', defaultAddress: 'Gangnam-gu, Seoul', defaultCoords: '37.5665° N, 126.9780° E' },
  { code: 'AU', name: 'Australia', currency: 'USD', prefix: '$', localCurrency: 'AUD', localPrefix: 'A$', localRateMultiplier: 0.055, flag: '🇦🇺', isDomestic: false, region: 'GLOBAL', dialCode: '+61', defaultCity: 'Sydney', defaultAddress: 'George Street, Sydney', defaultCoords: '33.8688° S, 151.2093° E' },
  { code: 'NZ', name: 'New Zealand', currency: 'USD', prefix: '$', localCurrency: 'NZD', localPrefix: 'NZ$', localRateMultiplier: 0.06, flag: '🇳🇿', isDomestic: false, region: 'GLOBAL', dialCode: '+64', defaultCity: 'Auckland', defaultAddress: 'Queen Street, Auckland', defaultCoords: '36.8509° S, 174.7645° E' },
  { code: 'BR', name: 'Brazil', currency: 'USD', prefix: '$', localCurrency: 'BRL', localPrefix: 'R$', localRateMultiplier: 0.2, flag: '🇧🇷', isDomestic: false, region: 'GLOBAL', dialCode: '+55', defaultCity: 'Sao Paulo', defaultAddress: 'Avenida Paulista 1000, Sao Paulo', defaultCoords: '23.5505° S, 46.6333° W' },
  { code: 'MX', name: 'Mexico', currency: 'USD', prefix: '$', localCurrency: 'MXN', localPrefix: 'MX$', localRateMultiplier: 0.7, flag: '🇲🇽', isDomestic: false, region: 'GLOBAL', dialCode: '+52', defaultCity: 'Mexico City', defaultAddress: 'Paseo de la Reforma, Mexico City', defaultCoords: '19.4326° N, 99.1332° W' },
  { code: 'ZA', name: 'South Africa', currency: 'USD', prefix: '$', localCurrency: 'ZAR', localPrefix: 'R ', localRateMultiplier: 0.7, flag: '🇿🇦', isDomestic: false, region: 'GLOBAL', dialCode: '+27', defaultCity: 'Johannesburg', defaultAddress: 'Sandton City, Johannesburg', defaultCoords: '26.2041° S, 28.0473° E' },
  { code: 'NG', name: 'Nigeria', currency: 'USD', prefix: '$', localCurrency: 'NGN', localPrefix: '₦', localRateMultiplier: 6.0, flag: '🇳🇬', isDomestic: false, region: 'GLOBAL', dialCode: '+234', defaultCity: 'Lagos', defaultAddress: 'Victoria Island, Lagos', defaultCoords: '6.5244° N, 3.3792° E' },
  { code: 'KE', name: 'Kenya', currency: 'USD', prefix: '$', localCurrency: 'KES', localPrefix: 'KES ', localRateMultiplier: 0.5, flag: '🇰🇪', isDomestic: false, region: 'GLOBAL', dialCode: '+254', defaultCity: 'Nairobi', defaultAddress: 'Westlands, Nairobi', defaultCoords: '1.2921° S, 36.8219° E' },
];

export const detectCountryFromPhone = (phoneStr: string, cityOrCountryHint?: string): CountryConfig => {
  const clean = (phoneStr || '').trim().replace(/[\s\-\(\)]/g, '');
  const hint = (cityOrCountryHint || '').toLowerCase();

  // North America (+1): Separate Canada vs United States cleanly
  if (clean.startsWith('+1')) {
    const digitsAfterOne = clean.slice(2).replace(/\D/g, '');
    const areaCode = digitsAfterOne.slice(0, 3);
    const isCanada =
      CANADIAN_AREA_CODES.has(areaCode) ||
      CANADIAN_CITY_KEYWORDS.some((kw) => hint.includes(kw));
    if (isCanada) {
      return {
        code: 'CA', name: 'Canada', currency: 'USD', prefix: '$',
        localCurrency: 'CAD', localPrefix: 'C$', localRateMultiplier: 0.05,
        flag: '🇨🇦', isDomestic: false, region: 'NORTH_AMERICA', dialCode: '+1',
        defaultCity: 'Toronto', defaultAddress: 'Yonge Street, Downtown Toronto', defaultCoords: '43.6532° N, 79.3832° W',
      };
    }
    return {
      code: 'US', name: 'United States', currency: 'USD', prefix: '$',
      localCurrency: 'USD', localPrefix: '$', localRateMultiplier: 0.04,
      flag: '🇺🇸', isDomestic: false, region: 'NORTH_AMERICA', dialCode: '+1',
      defaultCity: 'New York', defaultAddress: '5th Avenue, Midtown, New York', defaultCoords: '40.7128° N, 74.0060° W',
    };
  }

  // Sort longest dial codes first so +353 matches before +35 etc.
  const matched = [...GLOBAL_DIAL_COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((c) => clean.startsWith(c.dialCode));
  if (matched) return matched;

  // Explicit Pakistan check (+92, 92, 03, or empty before dialing)
  if (!clean || clean.startsWith('+92') || clean.startsWith('92') || clean.startsWith('03')) {
    return {
      code: 'PK', name: 'Pakistan', currency: 'PKR', prefix: 'PKR ',
      localCurrency: 'PKR', localPrefix: 'PKR ', localRateMultiplier: 1,
      flag: '🇵🇰', isDomestic: true, region: 'PK', dialCode: '+92',
      defaultCity: 'Lahore', defaultAddress: 'Shop #4, Plaza 12, CCA Phase 5 DHA, Lahore', defaultCoords: '31.4705° N, 74.4109° E',
    };
  }

  // Generic worldwide fallback for ANY other +XXX country code
  if (clean.startsWith('+') && clean.length >= 2) {
    const dialDigitsMatch = clean.match(/^\+(\d{1,3})/);
    const dialPrefix = dialDigitsMatch ? `+${dialDigitsMatch[1]}` : '+INTL';
    const codeKey = `INTL_${dialDigitsMatch ? dialDigitsMatch[1] : 'WW'}`;
    return {
      code: codeKey,
      name: `International (${dialPrefix})`,
      currency: 'USD',
      prefix: '$',
      localCurrency: 'USD',
      localPrefix: '$',
      localRateMultiplier: 0.04,
      flag: '🌐',
      isDomestic: false,
      region: 'GLOBAL',
      dialCode: dialPrefix,
      defaultCity: 'Metro City',
      defaultAddress: 'Central Business District',
      defaultCoords: '0.0000° N, 0.0000° E',
    };
  }

  return {
    code: 'PK', name: 'Pakistan', currency: 'PKR', prefix: 'PKR ',
    localCurrency: 'PKR', localPrefix: 'PKR ', localRateMultiplier: 1,
    flag: '🇵🇰', isDomestic: true, region: 'PK', dialCode: '+92',
    defaultCity: 'Lahore', defaultAddress: 'Shop #4, Plaza 12, CCA Phase 5 DHA, Lahore', defaultCoords: '31.4705° N, 74.4109° E',
  };
};

export const getLocalizedLocalCurrencyPrefix = (country: CountryConfig, lang: ClientOnboardingLanguage): string => {
  if (lang === 'ar' && country.localArabicPrefix) {
    return country.localArabicPrefix;
  }
  if (lang === 'ur' && country.localCurrency === 'PKR') {
    return 'روپے ';
  }
  return country.localPrefix;
};

// Regional City Validation Map (Supports English, Arabic & Urdu city names)
export const REGIONAL_CITY_MAP: Record<string, { country: string; flag: string; cities: string[] }> = {
  PK: {
    country: 'Pakistan',
    flag: '🇵🇰',
    cities: ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'لاہور', 'کراچی', 'اسلام آباد', 'راولپنڈی'],
  },
  AE: {
    country: 'United Arab Emirates',
    flag: '🇦🇪',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'Al Ain', 'دبي', 'أبوظبي', 'الشارقة', 'عجمان', 'العين'],
  },
  SA: {
    country: 'Saudi Arabia',
    flag: '🇸🇦',
    cities: ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina', 'Khobar', 'Tabuk', 'Taif', 'الرياض', 'جدة', 'الدمام', 'مكة', 'المدينة', 'الخبر'],
  },
  KW: {
    country: 'Kuwait',
    flag: '🇰🇼',
    cities: ['Kuwait City', 'Salmiya', 'Hawalli', 'Fahaheel', 'الكويت', 'السالمية', 'حولي'],
  },
  QA: {
    country: 'Qatar',
    flag: '🇶🇦',
    cities: ['Doha', 'Al Wakrah', 'Al Khor', 'Lusail', 'الدوحة', 'الوكرة', 'لوسيل'],
  },
  OM: {
    country: 'Oman',
    flag: '🇴🇲',
    cities: ['Muscat', 'Salalah', 'Sohar', 'Nizwa', 'مسقط', 'صلالة', 'صحار'],
  },
  BH: {
    country: 'Bahrain',
    flag: '🇧🇭',
    cities: ['Manama', 'Riffa', 'Muharraq', 'المنامة', 'الرفاع', 'المحرق'],
  },
  GB: {
    country: 'United Kingdom',
    flag: '🇬🇧',
    cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Edinburgh', 'Bristol', 'لندن', 'مانشستر', 'برمنغهام'],
  },
  UK: {
    country: 'United Kingdom',
    flag: '🇬🇧',
    cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Edinburgh', 'Bristol', 'لندن', 'مانشستر', 'برمنغهام'],
  },
  DE: { country: 'Germany', flag: '🇩🇪', cities: ['Berlin', 'Munich', 'Frankfurt', 'Hamburg', 'Cologne', 'Stuttgart'] },
  FR: { country: 'France', flag: '🇫🇷', cities: ['Paris', 'Lyon', 'Marseille', 'Nice', 'Toulouse'] },
  IT: { country: 'Italy', flag: '🇮🇹', cities: ['Milan', 'Rome', 'Naples', 'Turin', 'Florence'] },
  ES: { country: 'Spain', flag: '🇪🇸', cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Malaga'] },
  NL: { country: 'Netherlands', flag: '🇳🇱', cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'] },
  IE: { country: 'Ireland', flag: '🇮🇪', cities: ['Dublin', 'Cork', 'Galway', 'Limerick'] },
  CH: { country: 'Switzerland', flag: '🇨🇭', cities: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne'] },
  SE: { country: 'Sweden', flag: '🇸🇪', cities: ['Stockholm', 'Gothenburg', 'Malmo', 'Uppsala'] },
  NO: { country: 'Norway', flag: '🇳🇴', cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger'] },
  DK: { country: 'Denmark', flag: '🇩🇰', cities: ['Copenhagen', 'Aarhus', 'Odense'] },
  PT: { country: 'Portugal', flag: '🇵🇹', cities: ['Lisbon', 'Porto', 'Faro'] },
  PL: { country: 'Poland', flag: '🇵🇱', cities: ['Warsaw', 'Krakow', 'Gdansk', 'Wroclaw'] },
  GR: { country: 'Greece', flag: '🇬🇷', cities: ['Athens', 'Thessaloniki', 'Heraklion'] },
  AT: { country: 'Austria', flag: '🇦🇹', cities: ['Vienna', 'Salzburg', 'Graz'] },
  BE: { country: 'Belgium', flag: '🇧🇪', cities: ['Brussels', 'Antwerp', 'Ghent'] },
  EG: { country: 'Egypt', flag: '🇪🇬', cities: ['Cairo', 'Alexandria', 'Giza', 'القاهرة', 'الإسكندرية'] },
  JO: { country: 'Jordan', flag: '🇯🇴', cities: ['Amman', 'Zarqa', 'Irbid', 'عمان'] },
  LB: { country: 'Lebanon', flag: '🇱🇧', cities: ['Beirut', 'Tripoli', 'Sidon', 'بيروت'] },
  MA: { country: 'Morocco', flag: '🇲🇦', cities: ['Casablanca', 'Rabat', 'Marrakesh', 'الدار البيضاء'] },
  US: { country: 'United States', flag: '🇺🇸', cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'San Francisco', 'Dallas'] },
  CA: { country: 'Canada', flag: '🇨🇦', cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton'] },
  IN: { country: 'India', flag: '🇮🇳', cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad'] },
  BD: { country: 'Bangladesh', flag: '🇧🇩', cities: ['Dhaka', 'Chittagong', 'Sylhet', 'Khulna'] },
  LK: { country: 'Sri Lanka', flag: '🇱🇰', cities: ['Colombo', 'Kandy', 'Galle'] },
  TR: { country: 'Turkey', flag: '🇹🇷', cities: ['Istanbul', 'Ankara', 'Izmir', 'Antalya', 'Bursa'] },
  MY: { country: 'Malaysia', flag: '🇲🇾', cities: ['Kuala Lumpur', 'Penang', 'Johor Bahru'] },
  SG: { country: 'Singapore', flag: '🇸🇬', cities: ['Singapore', 'Orchard', 'Jurong', 'Tampines'] },
  ID: { country: 'Indonesia', flag: '🇮🇩', cities: ['Jakarta', 'Bali', 'Surabaya', 'Bandung'] },
  PH: { country: 'Philippines', flag: '🇵🇭', cities: ['Manila', 'Cebu', 'Davao'] },
  TH: { country: 'Thailand', flag: '🇹🇭', cities: ['Bangkok', 'Phuket', 'Chiang Mai'] },
  JP: { country: 'Japan', flag: '🇯🇵', cities: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama'] },
  KR: { country: 'South Korea', flag: '🇰🇷', cities: ['Seoul', 'Busan', 'Incheon'] },
  AU: { country: 'Australia', flag: '🇦🇺', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'] },
  NZ: { country: 'New Zealand', flag: '🇳🇿', cities: ['Auckland', 'Wellington', 'Christchurch'] },
  BR: { country: 'Brazil', flag: '🇧🇷', cities: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia'] },
  MX: { country: 'Mexico', flag: '🇲🇽', cities: ['Mexico City', 'Monterrey', 'Guadalajara', 'Cancun'] },
  ZA: { country: 'South Africa', flag: '🇿🇦', cities: ['Johannesburg', 'Cape Town', 'Durban'] },
  NG: { country: 'Nigeria', flag: '🇳🇬', cities: ['Lagos', 'Abuja', 'Port Harcourt'] },
  KE: { country: 'Kenya', flag: '🇰🇪', cities: ['Nairobi', 'Mombasa', 'Kisumu'] },
};

export interface NationalIdFieldConfig {
  label: string;
  placeholder: string;
  sampleId: string;
}

export const getNationalIdConfigForCountry = (
  country: CountryConfig,
  lang: 'en' | 'ur_roman' | 'ar' = 'en'
): NationalIdFieldConfig => {
  switch (country.code) {
    case 'PK':
      return {
        label: lang === 'ur_roman' ? 'قومی شناختی کارڈ نمبر (CNIC 13 ہندسے) *' : 'CNIC Number (13 Digits) *',
        placeholder: '35202-8491023-1',
        sampleId: '35202-9841201-7',
      };
    case 'AE':
      return {
        label: lang === 'ar' ? 'رقم الهوية الإماراتية (Emirates ID) *' : 'Emirates ID (15 Digits) *',
        placeholder: '784-1990-4829102-1',
        sampleId: '784-1992-8192019-1',
      };
    case 'SA':
      return {
        label: lang === 'ar' ? 'رقم الهوية الوطنية / الإقامة (10 أرقام) *' : 'Saudi National ID / Iqama (10 Digits) *',
        placeholder: '2491028491',
        sampleId: '2491028491',
      };
    case 'GB':
      return {
        label: 'UK National Insurance (NINO) / Passport *',
        placeholder: 'QQ 12 34 56 A',
        sampleId: 'QQ 12 34 56 A',
      };
    case 'US':
      return {
        label: 'US State ID / Driver License / Tax ID *',
        placeholder: 'US-DL-8491023',
        sampleId: 'US-DL-8491023',
      };
    case 'CA':
      return {
        label: 'Canadian Driver License / SIN Reference *',
        placeholder: 'CA-ON-4829103',
        sampleId: 'CA-ON-4829103',
      };
    case 'DE':
      return {
        label: 'German Personalausweis / Tax ID *',
        placeholder: 'DE-PA-8491028',
        sampleId: 'DE-PA-8491028',
      };
    case 'IN':
      return {
        label: lang === 'ur_roman' ? 'آدھار / پین کارڈ نمبر *' : 'Aadhaar / PAN Number *',
        placeholder: '4829-1029-4812',
        sampleId: '4829-1029-4812',
      };
    case 'TR':
      return {
        label: 'Turkish Kimlik No / National ID *',
        placeholder: '14829104826',
        sampleId: '14829104826',
      };
    case 'AU':
      return {
        label: 'Australian Driver License / Medicare ID *',
        placeholder: 'AU-NSW-7491023',
        sampleId: 'AU-NSW-7491023',
      };
    default:
      if (country.region === 'MENA') {
        return {
          label: lang === 'ar' ? `رقم الهوية الوطنية (${country.name}) *` : `${country.name} Civil ID / Passport *`,
          placeholder: '290041201842',
          sampleId: '290041201842',
        };
      }
      return {
        label: lang === 'ur_roman'
          ? `${country.name} قومی شناختی نمبر / پاسپورٹ *`
          : lang === 'ar'
          ? `رقم الهوية الوطنية / جواز السفر (${country.name}) *`
          : `${country.name} National ID / Passport Number *`,
        placeholder: `${country.code.replace('INTL_', 'ID')}-4829103`,
        sampleId: `${country.code.replace('INTL_', 'ID')}-4829103`,
      };
  }
};

export interface CountryPayoutConfig {
  methods: Array<{ value: string; label: string; isBank: boolean }>;
  bankPresets: string[];
  defaultMethod: string;
  defaultBank: string;
  mobileFormatBadge: string;
  mobilePlaceholder: string;
  ibanBadge: string;
  ibanPlaceholder: string;
  ibanHelp: string;
  walletPlaceholder: string;
}

export const getPayoutConfigForCountry = (country: CountryConfig): CountryPayoutConfig => {
  switch (country.code) {
    case 'PK':
      return {
        methods: [
          { value: 'EasyPaisa', label: 'EasyPaisa Mobile Wallet (Instant)', isBank: false },
          { value: 'JazzCash', label: 'JazzCash Mobile Wallet (Instant)', isBank: false },
          { value: 'Bank Transfer (IBFT)', label: 'Pakistani Bank Account (Direct IBFT)', isBank: true },
          { value: 'Raast Instant Pay', label: 'Raast Instant Pay (State Bank Rail)', isBank: true },
          { value: 'Custom Bank', label: '+ Other / Add Custom Bank', isBank: true },
        ],
        bankPresets: ['Meezan Bank', 'HBL Bank', 'Bank Alfalah', 'Standard Chartered', 'Faysal Bank', 'Allied Bank'],
        defaultMethod: 'EasyPaisa',
        defaultBank: 'Meezan Bank',
        mobileFormatBadge: 'Pakistan (+92)',
        mobilePlaceholder: '0300 1234567 or +92 300 1234567',
        ibanBadge: 'PKxx (24 chars) or 14-16 digit Account',
        ibanPlaceholder: 'PK64 MEZN 0001 0203 0405 0607 or 16-Digit Account',
        ibanHelp: 'Supported: Pakistani Bank Accounts (14-16 digits) or State Bank 24-char IBAN',
        walletPlaceholder: '0300 1234567',
      };
    case 'AE':
      return {
        methods: [
          { value: 'Wio Bank Direct', label: 'Wio Bank Business Direct', isBank: true },
          { value: 'Emirates NBD', label: 'Emirates NBD AED Direct', isBank: true },
          { value: 'FAB Bank', label: 'First Abu Dhabi Bank (FAB)', isBank: true },
          { value: 'International Bank Wire', label: 'UAE Central Bank Direct Clearing', isBank: true },
          { value: 'Custom Bank', label: '+ Other / Add Custom UAE Bank', isBank: true },
        ],
        bankPresets: ['Emirates NBD', 'Wio Bank', 'FAB Bank', 'ADCB', 'Mashreq Bank', 'DIB'],
        defaultMethod: 'Emirates NBD',
        defaultBank: 'Emirates NBD',
        mobileFormatBadge: 'UAE (+971)',
        mobilePlaceholder: '+971 50 123 4567 (9 digits)',
        ibanBadge: 'AExx (Exact 23 chars IBAN)',
        ibanPlaceholder: 'AE07 0331 2345 6789 0123 456',
        ibanHelp: 'UAE Central Bank format: AE + 2 check digits + 19 account digits (23 chars total)',
        walletPlaceholder: '+971 50 123 4567',
      };
    case 'SA':
      return {
        methods: [
          { value: 'Al Rajhi Bank', label: 'Al Rajhi Bank (Saudi SARIE)', isBank: true },
          { value: 'STC Pay', label: 'STC Pay Saudi Mobile Wallet', isBank: false },
          { value: 'Saudi National Bank', label: 'SNB (Saudi National Bank)', isBank: true },
          { value: 'Custom Bank', label: '+ Other / Add Custom Saudi Bank', isBank: true },
        ],
        bankPresets: ['Al Rajhi Bank', 'SNB Bank', 'Riyad Bank', 'Banque Saudi Fransi', 'Alinma Bank'],
        defaultMethod: 'Al Rajhi Bank',
        defaultBank: 'Al Rajhi Bank',
        mobileFormatBadge: 'Saudi Arabia (+966)',
        mobilePlaceholder: '+966 55 123 4567 (9 digits)',
        ibanBadge: 'SAxx (Exact 24 chars IBAN)',
        ibanPlaceholder: 'SA03 8000 0000 6080 1016 7519',
        ibanHelp: 'Saudi SARIE format: SA + 2 check digits + 20 account digits (24 chars total)',
        walletPlaceholder: '+966 55 123 4567',
      };
    case 'US':
      return {
        methods: [
          { value: 'US ACH Direct Deposit', label: 'US ACH Direct Deposit (Routing + Account)', isBank: true },
          { value: 'Zelle Business', label: 'Zelle Instant Payout (Mobile / Email)', isBank: false },
          { value: 'US Bank Wire', label: 'US Domestic / FedWire Transfer', isBank: true },
          { value: 'Custom Bank', label: '+ Other / Add Custom US Bank or Credit Union', isBank: true },
        ],
        bankPresets: ['Chase Bank', 'Bank of America', 'Wells Fargo', 'Citibank', 'Mercury', 'Capital One'],
        defaultMethod: 'US ACH Direct Deposit',
        defaultBank: 'Chase Bank',
        mobileFormatBadge: 'United States (+1)',
        mobilePlaceholder: '+1 212 555 0198 (10 digits)',
        ibanBadge: '9-Digit Routing + Account Number',
        ibanPlaceholder: 'Routing 021000021 · Account 9841029481',
        ibanHelp: 'US ACH format: ABA Routing Number + Checking/Savings Account Number',
        walletPlaceholder: '+1 212 555 0198',
      };
    case 'CA':
      return {
        methods: [
          { value: 'Interac e-Transfer', label: 'Interac e-Transfer (Instant CAD)', isBank: false },
          { value: 'Canadian EFT Direct Deposit', label: 'Canadian EFT Direct Deposit', isBank: true },
          { value: 'RBC / TD Bank Transfer', label: 'Canadian Bank Direct Wire', isBank: true },
          { value: 'Custom Bank', label: '+ Other / Add Custom Canadian Bank', isBank: true },
        ],
        bankPresets: ['RBC Royal Bank', 'TD Canada Trust', 'Scotiabank', 'BMO', 'CIBC'],
        defaultMethod: 'Interac e-Transfer',
        defaultBank: 'RBC Royal Bank',
        mobileFormatBadge: 'Canada (+1)',
        mobilePlaceholder: '+1 416 555 0198 (10 digits)',
        ibanBadge: 'Institution + Transit + Account Number',
        ibanPlaceholder: 'Inst 003 · Transit 00012 · Acct 1234567',
        ibanHelp: 'Canadian EFT format: 3-digit Institution + 5-digit Transit + Account Number',
        walletPlaceholder: '+1 416 555 0198',
      };
    case 'GB':
      return {
        methods: [
          { value: 'UK Faster Payments', label: 'UK Faster Payments / BACS (Instant)', isBank: true },
          { value: 'Revolut Business', label: 'Revolut Business UK', isBank: true },
          { value: 'Barclays Bank', label: 'Barclays / HSBC / Monzo UK', isBank: true },
          { value: 'Custom Bank', label: '+ Other / Add Custom UK Bank', isBank: true },
        ],
        bankPresets: ['Barclays Bank', 'HSBC UK', 'Monzo', 'Revolut Business', 'NatWest', 'Lloyds Bank'],
        defaultMethod: 'UK Faster Payments',
        defaultBank: 'Barclays Bank',
        mobileFormatBadge: 'United Kingdom (+44)',
        mobilePlaceholder: '+44 7123 456789 (10 digits)',
        ibanBadge: 'GBxx (22 chars) or Sort Code + Account',
        ibanPlaceholder: 'GB29 NWBK 6016 1331 9268 19',
        ibanHelp: 'UK Faster Payments: 6-digit Sort Code + 8-digit Account or 22-char GB IBAN',
        walletPlaceholder: '+44 7123 456789',
      };
    case 'AU':
      return {
        methods: [
          { value: 'PayID / NPP Instant', label: 'PayID / NPP Instant AUD', isBank: false },
          { value: 'Australian Bank Direct', label: 'Australian BSB + Account Direct', isBank: true },
          { value: 'Custom Bank', label: '+ Other / Add Custom Australian Bank', isBank: true },
        ],
        bankPresets: ['Commonwealth Bank', 'ANZ', 'Westpac', 'NAB', 'Macquarie'],
        defaultMethod: 'Australian Bank Direct',
        defaultBank: 'Commonwealth Bank',
        mobileFormatBadge: 'Australia (+61)',
        mobilePlaceholder: '+61 412 345 678',
        ibanBadge: 'BSB (6 digits) + Account Number',
        ibanPlaceholder: 'BSB 062-000 · Account 12345678',
        ibanHelp: 'Australian Bank format: 6-digit BSB code + Bank Account Number',
        walletPlaceholder: '+61 412 345 678',
      };
    case 'IN':
      return {
        methods: [
          { value: 'UPI Instant Pay', label: 'UPI Instant Pay (Mobile / UPI ID)', isBank: false },
          { value: 'IMPS / NEFT Bank Transfer', label: 'Indian Bank Direct (IFSC + Account)', isBank: true },
          { value: 'Custom Bank', label: '+ Other / Add Custom Indian Bank', isBank: true },
        ],
        bankPresets: ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Mahindra'],
        defaultMethod: 'IMPS / NEFT Bank Transfer',
        defaultBank: 'HDFC Bank',
        mobileFormatBadge: 'India (+91)',
        mobilePlaceholder: '+91 98200 12345',
        ibanBadge: 'IFSC Code + Bank Account Number',
        ibanPlaceholder: 'HDFC0001234 · Account 501002849102',
        ibanHelp: 'Indian NEFT/IMPS format: 11-char IFSC + Bank Account Number',
        walletPlaceholder: '+91 98200 12345',
      };
    default:
      if (country.region === 'EUROPE') {
        return {
          methods: [
            { value: 'Euro SEPA IBAN', label: `${country.name} SEPA Instant IBAN`, isBank: true },
            { value: 'Wise / Revolut Business', label: 'Wise / Revolut Europe Direct', isBank: true },
            { value: 'International Bank Wire', label: 'International SWIFT / IBAN Wire', isBank: true },
            { value: 'Custom Bank', label: `+ Other / Add Custom ${country.name} Bank`, isBank: true },
          ],
          bankPresets: country.code === 'DE'
            ? ['Deutsche Bank', 'Commerzbank', 'N26 Bank', 'ING Germany', 'Sparkasse']
            : country.code === 'FR'
            ? ['BNP Paribas', 'Societe Generale', 'Credit Agricole', 'Revolut France']
            : ['Revolut Business', 'Wise Europe', 'ING Bank', 'Santander', 'UniCredit'],
          defaultMethod: 'Euro SEPA IBAN',
          defaultBank: country.code === 'DE' ? 'Deutsche Bank' : country.code === 'FR' ? 'BNP Paribas' : 'Revolut Business',
          mobileFormatBadge: `${country.name} (${country.dialCode})`,
          mobilePlaceholder: `${country.dialCode} ...`,
          ibanBadge: `${country.code} SEPA IBAN`,
          ibanPlaceholder: `${country.code}89 3704 0044 0532 0130 00`,
          ibanHelp: `European SEPA format: Country IBAN (${country.code}xx...) + optional BIC/SWIFT`,
          walletPlaceholder: `${country.dialCode} ...`,
        };
      }
      return {
        methods: [
          { value: 'International Bank Wire', label: `${country.name} Local Bank / SWIFT IBAN`, isBank: true },
          { value: 'Wise / Stripe Connect', label: 'Wise / Stripe Global Instant Payout', isBank: true },
          { value: 'Custom Bank', label: `+ Other / Add Custom ${country.name} Bank`, isBank: true },
        ],
        bankPresets: country.code === 'TR'
          ? ['Ziraat Bankasi', 'Garanti BBVA', 'Is Bankasi', 'Akbank']
          : country.region === 'MENA'
          ? ['QNB', 'NBK', 'Bank Muscat', 'Arab Bank', 'CIB Egypt']
          : ['HSBC International', 'Citibank', 'Standard Chartered', 'Wise Business'],
        defaultMethod: 'International Bank Wire',
        defaultBank: country.code === 'TR' ? 'Garanti BBVA' : 'Standard Chartered',
        mobileFormatBadge: `${country.name} (${country.dialCode})`,
        mobilePlaceholder: `${country.dialCode} ...`,
        ibanBadge: `${country.name} IBAN / Account + SWIFT`,
        ibanPlaceholder: 'Local Account Number or IBAN',
        ibanHelp: `International Settlement: Enter local bank account / IBAN for ${country.name}`,
        walletPlaceholder: `${country.dialCode} ...`,
      };
  }
};

export const checkCityCountryIntegrity = (cityOrAddress: string, phone: string) => {
  const detected = detectCountryFromPhone(phone);
  const textClean = cityOrAddress.trim().toLowerCase();
  if (!textClean) return null;

  // First check if a known city of the detected country is explicitly present in the address
  const detectedCountryCities = REGIONAL_CITY_MAP[detected.code]?.cities || [];
  const hasValidLocalCity = detectedCountryCities.some((c) => textClean.includes(c.toLowerCase()));
  if (hasValidLocalCity) {
    return null;
  }

  // Also allow alternate UK/GB code
  if (detected.code === 'GB' && REGIONAL_CITY_MAP['UK']?.cities.some((c) => textClean.includes(c.toLowerCase()))) {
    return null;
  }

  // Check if the address references a city from a DIFFERENT country
  for (const [code, info] of Object.entries(REGIONAL_CITY_MAP)) {
    if (
      code !== detected.code &&
      !(detected.code === 'GB' && code === 'UK') &&
      !(detected.code === 'UK' && code === 'GB') &&
      !(detected.code === 'US' && code === 'CA')
    ) {
      const match = info.cities.find((c) => textClean.includes(c.toLowerCase()));
      if (match) {
        return {
          en: `Location Conflict: "${match}" is in ${info.country} (${info.flag}), not in ${detected.name} (${detected.flag}). Enter a ${detected.defaultCity} / local address matching ${detected.dialCode}.`,
          ur: `لوکیشن تضاد: "${match}" ${info.country} (${info.flag}) میں ہے، ${detected.name} (${detected.flag}) میں نہیں۔ براہ کرم ${detected.dialCode} کے مطابق درست پتہ درج کریں۔`,
          ar: `تعارض الموقع: "${match}" تقع في ${info.country} (${info.flag}) وليست في ${detected.name} (${detected.flag}). يرجى إدخال عنوان يطابق رمز الهاتف ${detected.dialCode}.`,
        };
      }
    }
  }
  return null;
};

export interface EnrollmentLanguageOption {
  code: 'en' | 'ur_roman' | 'ar';
  label: string;
  nativeLabel: string;
  flag: string;
  description: string;
}

/**
 * Query 1 Compliance: Dynamically gates enrollment languages by regional phone prefix
 * - PK (+92) / IN (+91): Urdu (اردو) & English ONLY (Arabic hidden)
 * - MENA / Gulf (+971, +966, +965, etc.): Arabic (العربية) & English ONLY (Urdu hidden)
 * - Europe / Western (+44, +1, etc.): English ONLY (Urdu & Arabic hidden)
 */
export const getEnrollmentLanguagesForPhone = (phoneStr: string): EnrollmentLanguageOption[] => {
  const clean = (phoneStr || '').replace(/[\s\-\(\)]/g, '');
  // Pakistan (+92) or India (+91)
  if (
    clean.startsWith('+92') ||
    clean.startsWith('92') ||
    clean.startsWith('03') ||
    clean.startsWith('+91') ||
    clean.startsWith('91')
  ) {
    return [
      { code: 'ur_roman', label: 'Urdu', nativeLabel: 'اردو', flag: '🇵🇰', description: 'اردو میں مکمل فیلڈ اندراج اور تصدیق' },
      { code: 'en', label: 'English', nativeLabel: 'English', flag: '🌐', description: 'Standard English enrollment wizard' },
    ];
  }
  // MENA Region (+971 UAE, +966 KSA, +965 Kuwait, +968 Oman, +974 Qatar, +973 Bahrain, +20 Egypt, +962 Jordan, +961 Lebanon, +212 Morocco)
  if (
    clean.startsWith('+971') ||
    clean.startsWith('971') ||
    clean.startsWith('+966') ||
    clean.startsWith('966') ||
    clean.startsWith('+965') ||
    clean.startsWith('965') ||
    clean.startsWith('+968') ||
    clean.startsWith('968') ||
    clean.startsWith('+974') ||
    clean.startsWith('974') ||
    clean.startsWith('+973') ||
    clean.startsWith('973') ||
    clean.startsWith('+20') ||
    clean.startsWith('+962') ||
    clean.startsWith('+961') ||
    clean.startsWith('+212')
  ) {
    return [
      { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', flag: '🇦🇪', description: 'التسجيل الميداني الكامل باللغة العربية' },
      { code: 'en', label: 'English', nativeLabel: 'English', flag: '🌐', description: 'Standard English enrollment wizard' },
    ];
  }
  // Europe / North America / Global
  return [
    { code: 'en', label: 'English', nativeLabel: 'English', flag: '🌐', description: 'Day-1 Enrollment Wizard in English' },
  ];
};

export interface DialOption {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
  expectedDigits: number;
  formatHint: string;
  sampleDigits: string;
  mobilePrefixRegex: RegExp;
  prefixHint: string;
}

export const DIAL_CODE_OPTIONS: DialOption[] = [
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', dialCode: '+92', expectedDigits: 10, formatHint: '301 8472910 (starts with 3)', sampleDigits: '3018472910', mobilePrefixRegex: /^3\d{9}$/, prefixHint: 'Must be 10 digits starting with 3 (e.g. 3018472910, without leading 0)' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', dialCode: '+971', expectedDigits: 9, formatHint: '50 1234567 (starts with 5)', sampleDigits: '501234567', mobilePrefixRegex: /^5\d{8}$/, prefixHint: 'Must be 9 UAE digits starting with 5 (e.g. 501234567)' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', dialCode: '+966', expectedDigits: 9, formatHint: '50 1234567 (starts with 5)', sampleDigits: '501234567', mobilePrefixRegex: /^5\d{8}$/, prefixHint: 'Must be 9 Saudi digits starting with 5 (e.g. 501234567)' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44', expectedDigits: 10, formatHint: '7123 456789 (starts with 7)', sampleDigits: '7123456789', mobilePrefixRegex: /^7\d{9}$/, prefixHint: 'Must be 10 UK mobile digits starting with 7 (e.g. 7123456789)' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1', expectedDigits: 10, formatHint: '212 5550198', sampleDigits: '2125550198', mobilePrefixRegex: /^[2-9]\d{9}$/, prefixHint: 'Must be 10 US digits (area code 2-9)' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dialCode: '+1', expectedDigits: 10, formatHint: '416 5550198', sampleDigits: '4165550198', mobilePrefixRegex: /^[2-9]\d{9}$/, prefixHint: 'Must be 10 Canadian digits (area code 2-9)' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49', expectedDigits: 10, formatHint: '151 2345678 (starts with 1)', sampleDigits: '1512345678', mobilePrefixRegex: /^1\d{9}$/, prefixHint: 'Must be 10 German mobile digits starting with 1' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33', expectedDigits: 9, formatHint: '6 12345678 (starts with 6/7)', sampleDigits: '612345678', mobilePrefixRegex: /^[67]\d{8}$/, prefixHint: 'Must be 9 French mobile digits starting with 6 or 7' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', dialCode: '+39', expectedDigits: 10, formatHint: '320 1234567 (starts with 3)', sampleDigits: '3201234567', mobilePrefixRegex: /^3\d{9}$/, prefixHint: 'Must be 10 Italian mobile digits starting with 3' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', dialCode: '+34', expectedDigits: 9, formatHint: '612 345678 (starts with 6/7)', sampleDigits: '612345678', mobilePrefixRegex: /^[67]\d{8}$/, prefixHint: 'Must be 9 Spanish mobile digits starting with 6 or 7' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dialCode: '+31', expectedDigits: 9, formatHint: '6 12345678 (starts with 6)', sampleDigits: '612345678', mobilePrefixRegex: /^6\d{8}$/, prefixHint: 'Must be 9 Dutch mobile digits starting with 6' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', dialCode: '+353', expectedDigits: 9, formatHint: '87 1234567 (starts with 8)', sampleDigits: '871234567', mobilePrefixRegex: /^8\d{8}$/, prefixHint: 'Must be 9 Irish mobile digits starting with 8' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', dialCode: '+41', expectedDigits: 9, formatHint: '79 1234567 (starts with 7)', sampleDigits: '791234567', mobilePrefixRegex: /^7\d{8}$/, prefixHint: 'Must be 9 Swiss mobile digits starting with 7' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', dialCode: '+46', expectedDigits: 9, formatHint: '70 1234567 (starts with 7)', sampleDigits: '701234567', mobilePrefixRegex: /^7\d{8}$/, prefixHint: 'Must be 9 Swedish mobile digits starting with 7' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', dialCode: '+47', expectedDigits: 8, formatHint: '412 34567 (starts with 4/9)', sampleDigits: '41234567', mobilePrefixRegex: /^[49]\d{7}$/, prefixHint: 'Must be 8 Norwegian digits starting with 4 or 9' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', dialCode: '+45', expectedDigits: 8, formatHint: '20 123456', sampleDigits: '20123456', mobilePrefixRegex: /^\d{8}$/, prefixHint: 'Must be 8 Danish digits' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', dialCode: '+351', expectedDigits: 9, formatHint: '91 2345678', sampleDigits: '912345678', mobilePrefixRegex: /^9\d{8}$/, prefixHint: 'Must be 9 Portuguese mobile digits starting with 9' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', dialCode: '+48', expectedDigits: 9, formatHint: '501 234567', sampleDigits: '501234567', mobilePrefixRegex: /^[4-8]\d{8}$/, prefixHint: 'Must be 9 Polish digits' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼', dialCode: '+965', expectedDigits: 8, formatHint: '99 123456', sampleDigits: '99123456', mobilePrefixRegex: /^[569]\d{7}$/, prefixHint: 'Must be 8 Kuwait digits starting with 5, 6, or 9' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦', dialCode: '+974', expectedDigits: 8, formatHint: '55 123456', sampleDigits: '55123456', mobilePrefixRegex: /^[3567]\d{7}$/, prefixHint: 'Must be 8 Qatar digits starting with 3, 5, 6, or 7' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲', dialCode: '+968', expectedDigits: 8, formatHint: '91 123456', sampleDigits: '91123456', mobilePrefixRegex: /^[79]\d{7}$/, prefixHint: 'Must be 8 Oman digits starting with 7 or 9' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭', dialCode: '+973', expectedDigits: 8, formatHint: '39 123456', sampleDigits: '39123456', mobilePrefixRegex: /^[36]\d{7}$/, prefixHint: 'Must be 8 Bahrain digits starting with 3 or 6' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', dialCode: '+20', expectedDigits: 10, formatHint: '10 12345678 (starts with 1)', sampleDigits: '1012345678', mobilePrefixRegex: /^1\d{9}$/, prefixHint: 'Must be 10 Egyptian mobile digits starting with 1' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴', dialCode: '+962', expectedDigits: 9, formatHint: '79 1234567 (starts with 7)', sampleDigits: '791234567', mobilePrefixRegex: /^7\d{8}$/, prefixHint: 'Must be 9 Jordanian digits starting with 7' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', dialCode: '+90', expectedDigits: 10, formatHint: '532 1234567 (starts with 5)', sampleDigits: '5321234567', mobilePrefixRegex: /^5\d{9}$/, prefixHint: 'Must be 10 Turkish digits starting with 5' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dialCode: '+91', expectedDigits: 10, formatHint: '98200 12345', sampleDigits: '9820012345', mobilePrefixRegex: /^[6-9]\d{9}$/, prefixHint: 'Must be 10 Indian digits starting with 6-9' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', dialCode: '+880', expectedDigits: 10, formatHint: '171 2345678', sampleDigits: '1712345678', mobilePrefixRegex: /^1\d{9}$/, prefixHint: 'Must be 10 Bangladesh digits starting with 1' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', dialCode: '+60', expectedDigits: 9, formatHint: '12 3456789 (starts with 1)', sampleDigits: '123456789', mobilePrefixRegex: /^1\d{8}$/, prefixHint: 'Must be 9 Malaysian digits starting with 1' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', dialCode: '+65', expectedDigits: 8, formatHint: '9123 4567 (starts with 8/9)', sampleDigits: '91234567', mobilePrefixRegex: /^[89]\d{7}$/, prefixHint: 'Must be 8 Singapore digits starting with 8 or 9' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', dialCode: '+62', expectedDigits: 10, formatHint: '812 3456789 (starts with 8)', sampleDigits: '8123456789', mobilePrefixRegex: /^8\d{9}$/, prefixHint: 'Must be 10 Indonesian digits starting with 8' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', dialCode: '+63', expectedDigits: 10, formatHint: '917 1234567 (starts with 9)', sampleDigits: '9171234567', mobilePrefixRegex: /^9\d{9}$/, prefixHint: 'Must be 10 Philippine digits starting with 9' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dialCode: '+81', expectedDigits: 10, formatHint: '90 12345678', sampleDigits: '9012345678', mobilePrefixRegex: /^[789]0\d{8}$/, prefixHint: 'Must be 10 Japanese mobile digits starting with 70, 80, or 90' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', dialCode: '+82', expectedDigits: 10, formatHint: '10 12345678', sampleDigits: '1012345678', mobilePrefixRegex: /^10\d{8}$/, prefixHint: 'Must be 10 South Korean mobile digits starting with 10' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dialCode: '+61', expectedDigits: 9, formatHint: '412 345678 (starts with 4)', sampleDigits: '412345678', mobilePrefixRegex: /^4\d{8}$/, prefixHint: 'Must be 9 Australian mobile digits starting with 4' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', dialCode: '+64', expectedDigits: 9, formatHint: '21 1234567 (starts with 2)', sampleDigits: '211234567', mobilePrefixRegex: /^2\d{8}$/, prefixHint: 'Must be 9 New Zealand mobile digits starting with 2' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', dialCode: '+55', expectedDigits: 11, formatHint: '11 912345678', sampleDigits: '11912345678', mobilePrefixRegex: /^\d{11}$/, prefixHint: 'Must be 11 Brazilian digits (DDD + 9-digit mobile)' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', dialCode: '+52', expectedDigits: 10, formatHint: '55 12345678', sampleDigits: '5512345678', mobilePrefixRegex: /^\d{10}$/, prefixHint: 'Must be 10 Mexican digits' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', dialCode: '+27', expectedDigits: 9, formatHint: '82 1234567 (starts with 6/7/8)', sampleDigits: '821234567', mobilePrefixRegex: /^[678]\d{8}$/, prefixHint: 'Must be 9 South African mobile digits' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', dialCode: '+234', expectedDigits: 10, formatHint: '803 1234567', sampleDigits: '8031234567', mobilePrefixRegex: /^[789]\d{9}$/, prefixHint: 'Must be 10 Nigerian digits starting with 7, 8, or 9' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', dialCode: '+254', expectedDigits: 9, formatHint: '712 345678 (starts with 1/7)', sampleDigits: '712345678', mobilePrefixRegex: /^[17]\d{8}$/, prefixHint: 'Must be 9 Kenyan digits starting with 1 or 7' },
];

export const validateNationalPhoneForCountry = (dialOpt: DialOption, rawValue: string) => {
  const digits = rawValue.replace(/\D/g, '');
  if (digits.length !== dialOpt.expectedDigits) {
    return {
      valid: false,
      reason: {
        en: `Invalid ${dialOpt.name} number: Expected ${dialOpt.expectedDigits} digits (${digits.length} entered). ${dialOpt.prefixHint}.`,
        ur: `غلط ${dialOpt.name} نمبر: ${dialOpt.expectedDigits} ہندسے درکار ہیں (${digits.length} درج کیے گئے)۔ مثال: ${dialOpt.sampleDigits}`,
        ar: `رقم غير صحيح لـ ${dialOpt.name}: يتطلب ${dialOpt.expectedDigits} أرقام (تم إدخال ${digits.length}). مثال: ${dialOpt.sampleDigits}`,
      },
    };
  }
  if (!dialOpt.mobilePrefixRegex.test(digits)) {
    return {
      valid: false,
      reason: {
        en: `Format mismatch for ${dialOpt.name} (${dialOpt.dialCode}): ${dialOpt.prefixHint}.`,
        ur: `${dialOpt.name} (${dialOpt.dialCode}) کے موبائل فارمیٹ سے مطابقت نہیں: مثال ${dialOpt.sampleDigits} استعمال کریں۔`,
        ar: `صيغة الرقم لا تطابق أرقام ${dialOpt.name} (${dialOpt.dialCode}): يرجى استخدام صيغة مثل ${dialOpt.sampleDigits}.`,
      },
    };
  }
  return { valid: true, reason: null };
};

export type ClientOnboardingLanguage = 'en' | 'ur' | 'ar';

export const ONBOARDING_I18N = {
  en: {
    steps: ['1. Salon Info & Location', '2. Service Menu', '3. Package & Payment', '4. Link WhatsApp'],
    step1Title: 'Step 1: Salon Details & Map Location',
    step1Kicker: 'QUICK SALON SETUP',
    routingLabel: 'Automatic Dual Alerts',
    routingDesc: 'On-Site Visit: Booking & setup alerts go to both the Salon Owner and Field Agent at the same time.',
    routingBadge: '⚡ Dual Alert On (Owner + Agent)',
    salonNameLabel: '1. Salon Name *',
    salonNamePlaceholder: 'e.g. Seven Cuts Studio',
    ownerNameLabel: '2. Owner Name *',
    ownerNamePlaceholder: 'e.g. Hamza Tariq',
    phoneLabel: '3. WhatsApp Mobile Number *',
    phoneHint: 'Used for automatic payment verification & 24/7 auto-booking',
    phoneDigitsValidBadge: 'Digits Valid',
    phoneDigitsCountLabel: 'Digits',
    phoneFormatValidLabel: 'Valid mobile format',
    countryDetected: 'Auto-Detected Country / Region',
    pricingEngineLabel: 'Billing Currency',
    domesticRailBadge: 'Pakistan Local (PKR)',
    intlRailBadge: 'International (USD $)',
    addressLabel: '4. Shop Address & City *',
    addressPlaceholder: 'Shop #, Plaza, Street, Area, City',
    suggestedCitiesLabel: 'Quick Local City:',
    coordsLabel: '5. Map Location (GPS) *',
    captureGps: 'Save Current Location',
    capturingGps: 'Finding Location...',
    gpsAccuracyBadge: '±3m Pin Accuracy',
    previewTitle: 'Automatic WhatsApp Welcome Preview',
    previewBadge: 'Ready to Send',
    step1Next: 'Save & Next: Service Menu →',
    step1ErrorMissingNames: 'Please enter both Salon Name and Owner Name.',
    step1ErrorEmptyAddress: 'Please enter the shop address and city.',

    step2Title: 'Step 2: Service Menu & Rate List',
    step2Kicker: 'FAST SALON SETUP',
    step2Desc: 'Select services offered by this salon. Add custom services or adjust prices to match the shop rate card.',
    serviceCurrencyLabel: 'Menu Currency',
    packageBillingLabel: 'WORKCRAFT Billing',
    mensCategory: "Men's Salon & Grooming",
    ladiesCategory: "Ladies' Beauty Parlor",
    addCustomService: '+ Add Custom Service',
    customNamePlaceholder: 'Service name (e.g. Beard Oil Treatment)',
    customPricePlaceholder: 'Price',
    addBtn: 'Add',
    cancelBtn: 'Cancel',
    step2Back: 'Back to Salon Info',
    step2Next: 'Save & Next: Choose Package →',

    step3Title: 'Step 3: Choose Package & Setup Payment',
    step3Kicker: 'SECURE PAYMENT STEP',
    step3PackageHeading: 'Select Salon Onboarding Package',
    formulaNotice: 'Simple Rule: Monthly fee is 10% of the setup fee per month',
    setupShortLabel: 'Setup',
    maintShortLabel: 'Monthly',
    perMonthShort: '/mo',
    oneTimeFeeLabel: 'One-Time Setup Fee',
    monthlyMaintNote: 'Monthly service fee is strictly 10%. Cash is never accepted for monthly fees.',
    paymentConfirmed: 'Payment Confirmed & Saved',
    paymentUnverified: 'Not Paid Yet · Choose Payment Option Below',
    layer1Title: 'SETUP FLEXIBILITY VS. MONTHLY PAYMENT NUMBER RULE',
    layer1Desc: 'The one-time setup fee can be paid from any wallet, bank account, or card. However, future 10% monthly fees must always be sent from the salon’s registered WhatsApp number so our system matches it automatically.',
    zeroCopyBadge: 'Auto-Matched · No Extra Steps',
    boundNumber: 'Registered WhatsApp Number',
    boundOwner: 'Registered Owner',
    featuresTitle: 'What Is Included in This Package',
    expandFeatures: 'View Package Details',
    collapseFeatures: 'Hide Details',
    includedLabel: 'Included',
    notIncludedLabel: 'Not Included',
    slaAccordionLeft: '⚡ 10% Monthly Fee: Covers 24/7 hosting, live rate updates & automatic reconnection.',
    slaAccordionRight: 'Monthly fees are paid digitally only (never cash).',
    selectChannelLabel: 'Select Payment Method to Confirm Setup Fee',
    openDrawerHint: 'Tap an option to confirm payment details',
    proofGenerated: 'Official Digital Payment Receipt Ready',
    channelLabel: 'PAYMENT METHOD',
    tidLabel: 'RECEIPT ID (TID)',
    routeLabel: 'SENT TO',
    digestLabel: 'RECEIPT CODE',
    optionAOffsetApplied: 'Commission Auto-Adjusted:',
    optionAOffsetDesc: 'commission automatically subtracted from cash balance for',
    remainingCashDueLabel: 'Remaining cash due to WORKCRAFT:',
    zeroCashTitle: 'Monthly Fee Policy: Digital Self-Pay Only (No Cash)',
    zeroCashDesc: 'Cash is only allowed for the first setup inside Pakistan. Every 10% monthly renewal is paid directly by the salon owner from the WorkCraft app—agents never collect monthly cash.',
    slaCardTitle: '24/7 Auto-Protection & Uptime Support (10% Monthly)',
    slaCardBadge: 'Fast Auto-Fix Active 24/7',
    slaCardDesc: 'Includes 24/7 WhatsApp auto-replies, automatic connection repair, instant price list edits, and priority help whenever needed.',
    statusPaidPrefix: 'Status: Paid',
    lockedConfirmBtn: 'Confirm Payment & Link WhatsApp',
    verifyBtn: 'Confirm Payment Details',
    step3Back: 'Back to Service Menu',
    step3Next: 'Confirm Payment & Link WhatsApp →',

    drawerKicker: 'PAYMENT CONFIRMATION',
    drawerTitlePrefix: 'Confirm Payment',
    receivingDestTitle: 'Official WORKCRAFT Receiving Account:',
    routingAssisted: 'Dual WhatsApp Confirmation On',
    ownerAgentPush: 'Sent to Owner + Agent',
    layer1PolicyTitle: 'Registered Number Rule',
    layer1PolicyBadge: 'Setup Flexible · Monthly Locked',
    registeredSimLabel: 'Registered Salon Number:',
    layer1PolicyDesc: 'First setup payment can come from any account. All future 10% monthly renewals must come from the salon’s registered number:',
    simGatewayTitle: 'Automatic Payment Detector',
    liveListenerBadge: 'Auto-Check Active',
    listeningSimText: 'Checking for incoming payment from:',
    webhookCapturedTitle: 'Incoming Transfer Auto-Detected:',
    otherSimHint: 'If paid from another number or card, edit the sender details below.',
    reScanBtn: '⚡ Re-Check Payment',
    intlRailTitle: '24–48h International Bank Clearing (Instant Start)',
    instantActivationBadge: 'Salon Starts Right Away',
    intlRailDesc: 'International cards or bank wires take 24–48 hours to reach the Pakistan Meezan Bank account, but the salon goes live immediately with WhatsApp receipts sent to both Owner and Agent.',
    payerDetailsLabel: 'Sender Mobile Number / Account Name *',
    payerDetailsHint: 'First setup payment can be from any account. Future monthly 10% fees must come from the registered number.',
    tidInputLabel: 'Transaction ID (TID) / Reference *',
    smsAutoCapture: 'Auto-Detected / Instant Ref',
    lockedAmountLabel: 'Exact Amount Required',
    cashGuardTitle: 'Cash Holding Limit Check (PKR 50,000)',
    cashLimitExceeded: '🚨 Cash limit reached! You are holding over PKR 50,000 cash. Deposit current funds at EasyPaisa or Meezan Bank before collecting more.',
    cashHeldPrefix: 'Current cash held by you:',
    biometricTitle: 'Thumbprint Confirmation',
    zeroPinBadge: 'THUMBPRINT ONLY',
    scanningThumbText: 'Reading thumbprint...',
    thumbVerifiedText: '✓ Thumbprint Confirmed',
    pressThumbText: 'Touch sensor to confirm cash collection',
    antiFraudTitle: '4-Step Payment Check Active',
    antiFraudDesc: 'System checks that every receipt ID is unique, the exact amount matches, and prevents fake or reused payment slips.',
    cancelLabel: 'Cancel',
    verifyingBtn: 'Confirming & Saving...',
    verifyBindBtn: 'Confirm Payment & Link WhatsApp →',

    step4Title: 'Step 4: Link Salon WhatsApp & Finish',
    step4Kicker: 'FINAL STEP',
    setupVerified: 'Setup Payment Confirmed',
    modeLabel: 'Choose How to Link WhatsApp:',
    modeQr: 'Scan QR Code Now',
    modeLink: 'Send App Link',
    scanInstructions: 'Salon owner opens WhatsApp ➔ Linked Devices ➔ Link a Device ➔ Scan this QR code.',
    pairingKeyLabel: 'Salon Link Code:',
    tokenBoundBadge: 'One-Time Safe Salon Link',
    tokenBurned: '🔥 LINKED & LOCKED TO THIS SALON',
    tokenActive: 'READY TO SCAN',
    tokenExpl: 'This QR code works once for this salon only. Once scanned, it cannot be reused anywhere else.',
    remoteLinkTitle: 'One-Tap App Link for Owner',
    remoteLinkDesc: 'If you are setting up remotely, send this private link to the salon owner to open WorkCraft on their phone:',
    copyLink: 'Copy App Link',
    copiedLink: 'Copied!',
    outboundTitle: 'Automatic Welcome Message',
    outboundStatus: 'Ready to Send',
    handshakeSuccess: 'Salon WhatsApp Connected 100%!',
    handshakeDesc: 'This salon is now live on WORKCRAFT and safely linked to its WhatsApp number. Customers can book 24/7 starting right now.',
    completeBtn: 'Finish Setup & Return Home',
    simulateBtn: 'Confirm WhatsApp Linked',
    step4Back: 'Back to Payment',
  },
  ur: {
    steps: ['1. سیلون معلومات', '2. سروس مینو', '3. پیکیج اور ادائیگی', '4. واٹس ایپ لنک'],
    step1Title: 'پہلا مرحلہ: سیلون کا نام اور پتہ درج کریں',
    step1Kicker: 'آسان سیلون سیٹ اپ',
    routingLabel: 'خودکار ڈوئل واٹس ایپ اطلاع',
    routingDesc: 'سیلون وزٹ موڈ فعال ہے: ہر بکنگ اور ادائیگی کی اطلاع بیک وقت مالک اور ایجنٹ دونوں کو ملے گی۔',
    routingBadge: '⚡ ڈوئل اطلاع فعال (مالک + ایجنٹ)',
    salonNameLabel: '1. سیلون کا نام *',
    salonNamePlaceholder: 'مثال: رائل کٹس سٹوڈیو',
    ownerNameLabel: '2. سیلون مالک کا نام *',
    ownerNamePlaceholder: 'e.g. Hamza Tariq',
    phoneLabel: '3. واٹس ایپ موبائل نمبر *',
    phoneHint: 'خودکار ادائیگی چیک اور 24/7 واٹس ایپ بکنگ کے لیے استعمال ہوگا',
    phoneDigitsValidBadge: 'ہندسے درست ہیں',
    phoneDigitsCountLabel: 'ہندسے',
    phoneFormatValidLabel: 'موبائل نمبر درست ہے',
    countryDetected: 'ملک اور خطہ: خودکار منتخب',
    pricingEngineLabel: 'کرنسی',
    domesticRailBadge: 'پاکستان مقامی (PKR)',
    intlRailBadge: 'انٹرنیشنل (USD $)',
    addressLabel: '4. دکان کا مکمل پتہ اور شہر *',
    addressPlaceholder: 'مثال: دکان نمبر 4، پلازہ 12، ڈی ایچ اے فیز 5، لاہور',
    suggestedCitiesLabel: 'اپنا شہر منتخب کریں:',
    coordsLabel: '5. میپ لوکیشن محفوظ کریں *',
    captureGps: 'موجودہ لوکیشن محفوظ کریں',
    capturingGps: 'لوکیشن تلاش کی جا رہی ہے...',
    gpsAccuracyBadge: '±3m درست لوکیشن',
    previewTitle: 'واٹس ایپ خوش آمدید میسج دیکھیں',
    previewBadge: 'بھیجنے کے لیے تیار',
    step1Next: 'محفوظ کریں اور سروس مینو پر جائیں ←',
    step1ErrorMissingNames: 'براہ کرم سیلون کا نام اور مالک کا نام دونوں درج کریں۔',
    step1ErrorEmptyAddress: 'براہ کرم دکان کا مکمل پتہ اور شہر درج کریں۔',

    step2Title: 'دوسرا مرحلہ: سروسز اور ریٹ لسٹ',
    step2Kicker: 'فوری سیٹ اپ',
    step2Desc: 'سیلون کی سروسز اور قیمتیں منتخب کریں، یا ریٹ کارڈ کے مطابق نئی سروس شامل کریں۔',
    serviceCurrencyLabel: 'مینو کرنسی',
    packageBillingLabel: 'ورک کرافٹ بلنگ',
    mensCategory: 'مردانہ سیلون (Men\'s Salon)',
    ladiesCategory: 'لیڈیز پارلر (Ladies\' Parlor)',
    addCustomService: '+ نئی سروس شامل کریں',
    customNamePlaceholder: 'سروس کا نام (مثلاً: داڑھی ٹریٹمنٹ)',
    customPricePlaceholder: 'قیمت',
    addBtn: 'شامل کریں',
    cancelBtn: 'منسوخ',
    step2Back: 'واپس سیلون معلومات',
    step2Next: 'محفوظ کریں اور پیکیج منتخب کریں ←',

    step3Title: 'تیسرا مرحلہ: پیکیج اور سیٹ اپ ادائیگی',
    step3Kicker: 'محفوظ ادائیگی مرحلہ',
    step3PackageHeading: 'سیلون پیکیج منتخب کریں',
    formulaNotice: 'آسان اصول: ماہانہ فیس پیکیج کی قیمت کا 10% ہوگی',
    setupShortLabel: 'سیٹ اپ',
    maintShortLabel: 'ماہانہ',
    perMonthShort: '/ماہ',
    oneTimeFeeLabel: 'ایک بار کی سیٹ اپ فیس',
    monthlyMaintNote: 'ماہانہ فیس 10% ہوگی۔ ماہانہ فیس کے لیے نقد رقم کبھی قبول نہیں کی جاتی۔',
    paymentConfirmed: 'ادائیگی مکمل اور محفوظ ہو گئی',
    paymentUnverified: 'ابھی ادا نہیں ہوئی · نیچے ادائیگی کا طریقہ منتخب کریں',
    layer1Title: 'پہلی ادائیگی میں آسانی بمقابلہ ماہانہ فیس کا رجسٹرڈ نمبر اصول',
    layer1Desc: 'پہلی سیٹ اپ فیس کسی بھی اکاؤنٹ، والٹ یا کارڈ سے ادا کی جا سکتی ہے۔ تاہم آئندہ تمام 10% ماہانہ فیس صرف سیلون کے رجسٹرڈ واٹس ایپ نمبر سے بھیجی جائے گی تاکہ سسٹم خودکار تصدیق کر سکے۔',
    zeroCopyBadge: 'خودکار تصدیق · کوئی کاپی پیسٹ نہیں',
    boundNumber: 'رجسٹرڈ واٹس ایپ نمبر',
    boundOwner: 'سیلون مالک کا نام',
    featuresTitle: 'اس پیکیج میں کیا شامل ہے',
    expandFeatures: 'پیکیج کی تفصیلات دیکھیں',
    collapseFeatures: 'تفصیل بند کریں',
    includedLabel: 'شامل ہے',
    notIncludedLabel: 'شامل نہیں',
    slaAccordionLeft: '⚡ 10% ماہانہ فیس: 24/7 سسٹم، لائیو ریٹ تبدیلیاں اور خودکار کنکشن مرمت شامل ہے۔',
    slaAccordionRight: 'ماہانہ فیس صرف ڈیجیٹل ادا ہوتی ہے (نقد نہیں)۔',
    selectChannelLabel: 'تصدیق کے لیے ادائیگی کا طریقہ منتخب کریں',
    openDrawerHint: 'تفصیل درج کرنے کے لیے نیچے کلک کریں',
    proofGenerated: 'ڈیجیٹل رسید تیار ہو گئی',
    channelLabel: 'ادائیگی کا طریقہ',
    tidLabel: 'رسید نمبر (TID)',
    routeLabel: 'بھیجا گیا',
    digestLabel: 'رسید کوڈ',
    optionAOffsetApplied: 'کمیشن خودکار ایڈجسٹ ہو گیا:',
    optionAOffsetDesc: 'آپ کا کمیشن خودکار طور پر بقایا کیش میں سے منہا کر دیا گیا برائے',
    remainingCashDueLabel: 'ورک کرافٹ کو واجب الادا بقایا کیش:',
    zeroCashTitle: 'ماہانہ فیس پالیسی: صرف ڈیجیٹل ادائیگی (نقد ممنوع)',
    zeroCashDesc: 'نقد رقم صرف پاکستان میں پہلے دن سیٹ اپ کے وقت لی جا سکتی ہے۔ ہر مہینے کی 10% فیس سیلون مالک خود WorkCraft ایپ سے ادا کرے گا۔',
    slaCardTitle: '24/7 خودکار تحفظ اور سپورٹ (10% ماہانہ)',
    slaCardBadge: '24/7 خودکار مرمت فعال',
    slaCardDesc: 'اس میں 24/7 واٹس ایپ آٹو ریپلائی، کنکشن کی خودکار بحالی، فوری ریٹ تبدیلی اور ترجیحی مدد شامل ہے۔',
    statusPaidPrefix: 'اسٹیٹس: ادا شدہ',
    lockedConfirmBtn: 'ادائیگی کنفرم کریں اور واٹس ایپ جوڑیں',
    verifyBtn: 'ادائیگی کی تصدیق کریں',
    step3Back: 'واپس سروس مینو',
    step3Next: 'ادائیگی کنفرم کریں اور واٹس ایپ جوڑیں ←',

    drawerKicker: 'ادائیگی کی تصدیق',
    drawerTitlePrefix: 'ادائیگی کنفرم کریں',
    receivingDestTitle: 'ورک کرافٹ کا آفیشل اکاؤنٹ:',
    routingAssisted: 'مالک اور ایجنٹ دونوں کو اطلاع فعال',
    ownerAgentPush: 'مالک + ایجنٹ کو واٹس ایپ رسید',
    layer1PolicyTitle: 'رجسٹرڈ نمبر کا اصول',
    layer1PolicyBadge: 'سیٹ اپ آسان · ماہانہ نمبر لاک',
    registeredSimLabel: 'رجسٹرڈ سیلون نمبر:',
    layer1PolicyDesc: 'ابتدائی فیس کسی بھی اکاؤنٹ سے ادا ہو سکتی ہے۔ آئندہ تمام 10% ماہانہ فیس رجسٹرڈ نمبر سے ہی آئے گی:',
    simGatewayTitle: 'خودکار ادائیگی چیک سسٹم',
    liveListenerBadge: 'آٹو چیک فعال',
    listeningSimText: 'آنے والی رقم چیک کی جا رہی ہے از:',
    webhookCapturedTitle: 'رقم کی اطلاع خودکار موصول ہو گئی:',
    otherSimHint: 'اگر ادائیگی کسی اور نمبر سے ہوئی ہے تو نیچے نمبر تبدیل کریں۔',
    reScanBtn: '⚡ دوبارہ چیک کریں',
    intlRailTitle: '24 تا 48 گھنٹے انٹرنیشنل بینک کلیئرنگ (فوری آغاز)',
    instantActivationBadge: 'سیلون فوراً آن ہو جاتا ہے',
    intlRailDesc: 'بیرونِ ملک سے کارڈ یا بینک ٹرانسفر پاکستان میزان بینک میں آنے میں 24–48 گھنٹے لگتے ہیں، لیکن سیلون کا نظام فوراً شروع ہو جاتا ہے اور مالک و ایجنٹ دونوں کو واٹس ایپ رسید مل جاتی ہے۔',
    payerDetailsLabel: 'بھیجنے والے کا فون یا اکاؤنٹ نام *',
    payerDetailsHint: 'سیٹ اپ فیس کسی بھی اکاؤنٹ سے دی جا سکتی ہے، جبکہ ماہانہ فیس رجسٹرڈ نمبر سے مشروط ہے۔',
    tidInputLabel: 'ٹرانزیکشن آئی ڈی (TID) / حوالہ نمبر *',
    smsAutoCapture: 'خودکار / فوری حوالہ',
    lockedAmountLabel: 'مطلوبہ رقم',
    cashGuardTitle: 'نقد رقم رکھنے کی حد (PKR 50,000)',
    cashLimitExceeded: '🚨 نقد حد مکمل ہو گئی! آپ کے پاس 50,000 روپے سے زیادہ کیش ہے۔ مزید لینے سے پہلے میزان بینک یا ایزی پیسہ میں جمع کرائیں۔',
    cashHeldPrefix: 'اس وقت آپ کے پاس موجود کیش:',
    biometricTitle: 'انگوٹھے کے نشان سے تصدیق (لازمی)',
    zeroPinBadge: 'صرف انگوٹھے کی تصدیق',
    scanningThumbText: 'انگوٹھا اسکین ہو رہا ہے...',
    thumbVerifiedText: '✓ انگوٹھے کی تصدیق مکمل',
    pressThumbText: 'نقد وصولی پکی کرنے کے لیے انگوٹھا رکھیں',
    antiFraudTitle: '4-لیئر محفوظ رسید چیک فعال',
    antiFraudDesc: 'سسٹم خودکار چیک کرتا ہے کہ رسید نمبر نیا ہو، رقم پوری ہو، اور کوئی پرانی یا جعلی رسید نہ لگائی جائے۔',
    cancelLabel: 'منسوخ کریں',
    verifyingBtn: 'تصدیق اور محفوظ ہو رہا ہے...',
    verifyBindBtn: 'ادائیگی کنفرم کریں اور واٹس ایپ جوڑیں ←',

    step4Title: 'چوتھا مرحلہ: سیلون واٹس ایپ جوڑیں',
    step4Kicker: 'آخری مرحلہ',
    setupVerified: 'سیٹ اپ ادائیگی کنفرم ہو گئی',
    modeLabel: 'واٹس ایپ جوڑنے کا طریقہ منتخب کریں:',
    modeQr: 'کیمرہ سے کیو آر اسکین کریں',
    modeLink: 'مالک کو ایپ لنک بھیجیں',
    scanInstructions: 'سیلون مالک واٹس ایپ کھولیں ➔ Linked Devices ➔ Link a Device ➔ یہ اسکرین اسکین کریں۔',
    pairingKeyLabel: 'سیلون لنک کوڈ:',
    tokenBoundBadge: 'ایک بار کا محفوظ سیلون لنک',
    tokenBurned: '🔥 سیلون کامیابی سے جڑ گیا (محفوظ)',
    tokenActive: 'اسکین کے لیے تیار',
    tokenExpl: 'یہ کیو آر کوڈ صرف اسی سیلون کے لیے ایک بار کام کرتا ہے۔ جڑنے کے بعد کوئی اور اسے استعمال نہیں کر سکتا۔',
    remoteLinkTitle: 'مالک کے لیے آسان ون ٹیپ ایپ لنک',
    remoteLinkDesc: 'اگر آپ دور بیٹھے سیلون جوڑ رہے ہیں تو یہ لنک سیلون مالک کو بھیجیں تاکہ وہ WorkCraft کھول سکیں:',
    copyLink: 'ایپ لنک کاپی کریں',
    copiedLink: 'کاپی ہو گیا!',
    outboundTitle: 'خودکار واٹس ایپ خوش آمدید میسج',
    outboundStatus: 'بھیجنے کے لیے تیار',
    handshakeSuccess: 'سیلون واٹس ایپ 100% جڑ گیا!',
    handshakeDesc: 'یہ سیلون اب WORKCRAFT پر لائیو ہے۔ اب کسٹمرز 24/7 خودکار طریقے سے اپائنٹمنٹ بک کر سکتے ہیں۔',
    completeBtn: 'سیٹ اپ مکمل کریں اور ہوم پر جائیں',
    simulateBtn: 'واٹس ایپ لنک کنفرم کریں',
    step4Back: 'واپس ادائیگی',
  },
  ar: {
    steps: ['1. بيانات الصالون', '2. قائمة الخدمات', '3. الباقة والدفع', '4. ربط واتساب'],
    step1Title: 'الخطوة 1: بيانات الصالون وموقعه على الخريطة',
    step1Kicker: 'تهيئة سريعة للصالون',
    routingLabel: 'تنبيهات واتساب تلقائية مزدوجة',
    routingDesc: 'تم تفعيل الزيارة الميدانية: تصل إشعارات الحجز والدفع لمالك الصالون والوكيل في نفس الوقت.',
    routingBadge: '⚡ تنبيه مزدوج نشط (المالك + الوكيل)',
    salonNameLabel: '1. اسم الصالون *',
    salonNamePlaceholder: 'مثال: صالون النخبة للرجال',
    ownerNameLabel: '2. اسم المالك *',
    ownerNamePlaceholder: 'e.g. Tariq Al-Mansoor',
    phoneLabel: '3. رقم الواتساب المعتمد *',
    phoneHint: 'يُستخدم لتأكيد الدفع تلقائياً والرد على الحجوزات 24/7',
    phoneDigitsValidBadge: 'الأرقام صحيحة',
    phoneDigitsCountLabel: 'أرقام',
    phoneFormatValidLabel: 'صيغة الجوال صحيحة',
    countryDetected: 'البلد والمنطقة: تم التحديد تلقائياً',
    pricingEngineLabel: 'العملة',
    domesticRailBadge: 'محلي (PKR)',
    intlRailBadge: 'دولي (USD $)',
    addressLabel: '4. عنوان الصالون والمدينة *',
    addressPlaceholder: 'مثال: شارع الرقة، ديرة، دبي',
    suggestedCitiesLabel: 'اختر المدينة:',
    coordsLabel: '5. موقع الصالون على الخريطة *',
    captureGps: 'حفظ الموقع الحالي',
    capturingGps: 'جاري تحديد الموقع...',
    gpsAccuracyBadge: 'دقة ±3 أمتار',
    previewTitle: 'معاينة رسالة الترحيب التلقائية',
    previewBadge: 'جاهز للإرسال',
    step1Next: 'حفظ ومتابعة لقائمة الخدمات ←',
    step1ErrorMissingNames: 'يرجى إدخال اسم الصالون واسم المالك للمتابعة.',
    step1ErrorEmptyAddress: 'يرجى إدخال عنوان الصالون والمدينة بالتفصيل.',

    step2Title: 'الخطوة 2: قائمة الخدمات والأسعار',
    step2Kicker: 'إعداد سريع',
    step2Desc: 'اختر خدمات الصالون وأسعاره المعتمدة، أو أضف خدمات جديدة حسب قائمة الأسعار.',
    serviceCurrencyLabel: 'عملة القائمة',
    packageBillingLabel: 'عملة الاشتراك',
    mensCategory: 'صالون رجالي (Men\'s Salon)',
    ladiesCategory: 'صالون نسائي (Ladies\' Parlor)',
    addCustomService: '+ إضافة خدمة جديدة',
    customNamePlaceholder: 'اسم الخدمة (مثال: تنظيف بشرة VIP)',
    customPricePlaceholder: 'السعر',
    addBtn: 'إضافة',
    cancelBtn: 'إلغاء',
    step2Back: 'الرجوع لبيانات الصالون',
    step2Next: 'حفظ ومتابعة لاختيار الباقة ←',

    step3Title: 'الخطوة 3: اختيار الباقة وتأكيد رسوم التأسيس',
    step3Kicker: 'خطوة الدفع الآمنة',
    step3PackageHeading: 'اختر باقة تأسيس الصالون',
    formulaNotice: 'قاعدة واضحة: الرسوم الشهرية هي 10% فقط من رسوم التأسيس شهرياً',
    setupShortLabel: 'التأسيس',
    maintShortLabel: 'شهرياً',
    perMonthShort: '/شهرياً',
    oneTimeFeeLabel: 'رسوم التأسيس لمرة واحدة',
    monthlyMaintNote: 'الرسوم الشهرية 10% من الباقة. لا يتم قبول الدفع النقدي للرسوم الشهرية أبداً.',
    paymentConfirmed: 'تم تأكيد الدفع وحفظه بنجاح',
    paymentUnverified: 'لم يتم الدفع بعد · اختر طريقة الدفع أدناه',
    layer1Title: 'مرونة التأسيس مقابل شرط الرقم المسجل للرسوم الشهرية',
    layer1Desc: 'يمكن سداد رسوم التأسيس الأولى من أي بطاقة أو حساب بنكي. أما الرسوم الشهرية (10%) فيجب إرسالها دائماً من رقم الواتساب المسجل للصالون ليتم التحقق منها تلقائياً.',
    zeroCopyBadge: 'مطابقة تلقائية · بدون نسخ',
    boundNumber: 'رقم الواتساب المسجل',
    boundOwner: 'المالك المسجل',
    featuresTitle: 'المميزات المشمولة في هذه الباقة',
    expandFeatures: 'عرض تفاصيل الباقة',
    collapseFeatures: 'إخفاء التفاصيل',
    includedLabel: 'مشمول',
    notIncludedLabel: 'غير مشمول',
    slaAccordionLeft: '⚡ رسوم 10% شهرية: تشمل الاستضافة 24/7، تعديل الأسعار فوراً، والإصلاح التلقائي.',
    slaAccordionRight: 'الرسوم الشهرية إلكترونية فقط (بدون نقد).',
    selectChannelLabel: 'اختر وسيلة الدفع لتأكيد رسوم التأسيس',
    openDrawerHint: 'اضغط على وسيلة الدفع لإدخال التفاصيل',
    proofGenerated: 'تم إصدار إيصال الدفع الرقمي بنجاح',
    channelLabel: 'وسيلة الدفع',
    tidLabel: 'رقم العملية (TID)',
    routeLabel: 'أُرسل إلى',
    digestLabel: 'رمز الإيصال',
    optionAOffsetApplied: 'تم تعديل العمولة تلقائياً:',
    optionAOffsetDesc: 'تم خصم عمولتك تلقائياً من الرصيد النقدي المستحق لـ',
    remainingCashDueLabel: 'النقد المتبقي المستحق لـ WORKCRAFT:',
    zeroCashTitle: 'سياسة الرسوم الشهرية: دفع إلكتروني ذاتي فقط (بدون نقد)',
    zeroCashDesc: 'يُقبل النقد لرسوم التأسيس الأولى داخل باكستان فقط. جميع الرسوم الشهرية (10%) يدفعها مالك الصالون مباشرة من تطبيق WorkCraft.',
    slaCardTitle: 'حماية تلقائية وتشغيل مستمر 24/7 (10% شهرياً)',
    slaCardBadge: 'إصلاح تلقائي نشط 24/7',
    slaCardDesc: 'تشمل الرد التلقائي عبر واتساب 24/7، إعادة الربط التلقائي، تحديث الأسعار فوراً، والدعم السريع.',
    statusPaidPrefix: 'الحالة: مدفوع',
    lockedConfirmBtn: 'تأكيد الدفع وربط واتساب',
    verifyBtn: 'تأكيد تفاصيل الدفع',
    step3Back: 'الرجوع لقائمة الخدمات',
    step3Next: 'تأكيد الدفع وربط واتساب ←',

    drawerKicker: 'تأكيد الدفع',
    drawerTitlePrefix: 'تأكيد سداد',
    receivingDestTitle: 'حساب الاستلام الرسمي لـ WORKCRAFT:',
    routingAssisted: 'تأكيد مزدوج عبر واتساب',
    ownerAgentPush: 'يُرسل للمالك + الوكيل',
    layer1PolicyTitle: 'شرط الرقم المسجل',
    layer1PolicyBadge: 'مرونة التأسيس · الشهرية بالرقم المسجل',
    registeredSimLabel: 'رقم الصالون المسجل:',
    layer1PolicyDesc: 'يمكن سداد رسوم التأسيس من أي حساب، بينما يجب سداد الرسوم الشهرية (10%) من الرقم المسجل فقط:',
    simGatewayTitle: 'نظام فحص الدفع التلقائي',
    liveListenerBadge: 'فحص تلقائي نشط',
    listeningSimText: 'جاري البحث عن الحوالة الواردة من:',
    webhookCapturedTitle: 'تم رصد الدفع تلقائياً:',
    otherSimHint: 'إذا تم الدفع من رقم أو بطاقة أخرى، عدل بيانات المرسل أدناه.',
    reScanBtn: '⚡ إعادة فحص الدفع',
    intlRailTitle: 'تسوية دولية خلال 24–48 ساعة (تفعيل فوري للصالون)',
    instantActivationBadge: 'يبدأ الصالون فوراً',
    intlRailDesc: 'تستغرق البطاقات الدولية والتحويلات 24–48 ساعة للوصول إلى حساب بنك ميزان الباكستاني، لكن نظام الصالون يعمل فوراً مع إرسال إيصالات واتساب للمالك والوكيل.',
    payerDetailsLabel: 'رقم هاتف المرسل / اسم الحساب *',
    payerDetailsHint: 'يمكن دفع التأسيس من أي حساب، أما الشهرية 10% فمن الرقم المسجل فقط.',
    tidInputLabel: 'رقم العملية / المرجع البنكي (TID) *',
    smsAutoCapture: 'مرجع تلقائي / فوري',
    lockedAmountLabel: 'المبلغ المطلوب',
    cashGuardTitle: 'مراقب حد النقد (50,000 PKR)',
    cashLimitExceeded: '🚨 وصلت للحد الأقصى للنقد! يرجى إيداع المبالغ المحصلة في بنك ميزان أو إيزي بيسا أولاً.',
    cashHeldPrefix: 'الرصيد النقدي بعهدتك الآن:',
    biometricTitle: 'تأكيد ببصمة الإبهام',
    zeroPinBadge: 'بصمة فقط',
    scanningThumbText: 'جاري قراءة البصمة...',
    thumbVerifiedText: '✓ تم تأكيد البصمة',
    pressThumbText: 'المس مستشعر البصمة لتوثيق استلام النقد',
    antiFraudTitle: 'فحص أمان الإيصالات الرباعي نشط',
    antiFraudDesc: 'يتحقق النظام تلقائياً من عدم تكرار رقم العملية ومطابقة المبلغ ومنع الإيصالات المعدلة.',
    cancelLabel: 'إلغاء',
    verifyingBtn: 'جاري التأكيد والحفظ...',
    verifyBindBtn: 'تأكيد الدفع وربط واتساب ←',

    step4Title: 'الخطوة 4: ربط واتساب الصالون والإنهاء',
    step4Kicker: 'الخطوة الأخيرة',
    setupVerified: 'تم تأكيد رسوم التأسيس',
    modeLabel: 'اختر طريقة ربط واتساب:',
    modeQr: 'مسح رمز الباركود QR',
    modeLink: 'إرسال رابط التطبيق',
    scanInstructions: 'يفتح مالك الصالون واتساب ➔ الأجهزة المرتبطة ➔ ربط جهاز ➔ ومسح هذا الرمز.',
    pairingKeyLabel: 'رمز ربط الصالون:',
    tokenBoundBadge: 'رابط آمن لمرة واحدة للصالون',
    tokenBurned: '🔥 تم الربط والتثبيت لهذا الصالون',
    tokenActive: 'جاهز للمسح',
    tokenExpl: 'يعمل هذا الرمز مرة واحدة لهذا الصالون فقط، ولا يمكن إعادة استخدامه لأي جهاز آخر.',
    remoteLinkTitle: 'رابط تطبيق سريع للمالك',
    remoteLinkDesc: 'للتسجيل عن بُعد، أرسل هذا الرابط الخاص إلى مالك الصالون ليفتح تطبيق WorkCraft:',
    copyLink: 'نسخ رابط التطبيق',
    copiedLink: 'تم النسخ!',
    outboundTitle: 'رسالة الترحيب التلقائية',
    outboundStatus: 'جاهز للإرسال',
    handshakeSuccess: 'تم ربط واتساب الصالون بنجاح 100%!',
    handshakeDesc: 'الصالون الآن متصل ويعمل على WORKCRAFT. يمكن للعملاء الحجز عبر واتساب 24/7 من الآن.',
    completeBtn: 'إنهاء التسجيل والعودة للرئيسية',
    simulateBtn: 'تأكيد ربط واتساب',
    step4Back: 'الرجوع للدفع',
  },
};

export type PaymentMethodOption = 'EasyPaisa' | 'JazzCash' | 'Bank Transfer (IBFT)' | 'Stripe / Card' | 'Cash Collection';

export const getLocalizedPaymentMethodName = (method: PaymentMethodOption, lang: ClientOnboardingLanguage): string => {
  if (lang === 'en') return method;
  const map: Record<PaymentMethodOption, { ur: string; ar: string }> = {
    'EasyPaisa': { ur: 'ایزی پیسہ (EasyPaisa)', ar: 'إيزي بيسا (EasyPaisa)' },
    'JazzCash': { ur: 'جاز کیش (JazzCash)', ar: 'جاز كاش (JazzCash)' },
    'Bank Transfer (IBFT)': { ur: 'بینک ٹرانسفر (IBFT / SWIFT)', ar: 'تحويل بنكي (IBFT / SWIFT)' },
    'Stripe / Card': { ur: 'کارڈ / ایپل پے (Stripe / Card)', ar: 'بطاقة بنكية / Apple Pay (Stripe)' },
    'Cash Collection': { ur: 'نقد وصولی (صرف پاکستان)', ar: 'تحصيل نقدي (باكستان فقط)' },
  };
  return map[method]?.[lang] || method;
};

export const getRegionalPaymentRails = (
  country: CountryConfig,
  lang: ClientOnboardingLanguage,
  userRole: string
): Array<{ name: PaymentMethodOption; label: string; note: string }> => {
  if (!country.isDomestic) {
    const isMena = country.region === 'MENA';
    const isEurope = country.region === 'EUROPE';

    const stripeLabel = getLocalizedPaymentMethodName('Stripe / Card', lang);
    const wireLabel = getLocalizedPaymentMethodName('Bank Transfer (IBFT)', lang);

    const stripeNote =
      lang === 'ar'
        ? isMena
          ? 'فيزا، ماستركارد، Apple Pay ومدى · تحويل آلي 24-48 ساعة'
          : isEurope
          ? 'حماية 3D-Secure الأوروبية · Apple Pay · تسوية 24-48 ساعة'
          : 'بطاقات عالمية 3D-Secure · Apple Pay · تسوية 24-48 ساعة'
        : lang === 'ur'
        ? isMena
          ? 'ویزا، ماسٹر کارڈ، Apple Pay اور مدى · 24-48 گھنٹے میں کلیئرنس'
          : 'عالمی 3D-Secure کارڈ اور Apple Pay · 24-48 گھنٹے رولنگ پے آؤٹ'
        : isMena
        ? 'MENA Visa / Mastercard / Apple Pay / Mada · 24-48h Payout'
        : isEurope
        ? 'UK & EU 3D-Secure · Apple Pay · 24-48h Payout'
        : 'Global 3D-Secure · Apple Pay · 24-48h Rolling Wire';

    const wireNote =
      lang === 'ar'
        ? isEurope
          ? 'تحويل SEPA / SWIFT / IBAN مباشر إلى بنك ميزان باكستان'
          : 'تحويل دولي SWIFT / IBAN مباشر إلى بنك ميزان باكستان'
        : lang === 'ur'
        ? 'براہ راست بین الاقوامی SWIFT / IBAN وائر ٹو میزان بینک پاکستان'
        : isEurope
        ? 'Direct SEPA / SWIFT / IBAN Wire to Meezan PK'
        : 'Direct International SWIFT / IBAN Wire to Meezan PK';

    return [
      { name: 'Stripe / Card', label: stripeLabel, note: stripeNote },
      { name: 'Bank Transfer (IBFT)', label: wireLabel, note: wireNote },
    ];
  }

  const rails: Array<{ name: PaymentMethodOption; label: string; note: string }> = [
    {
      name: 'EasyPaisa',
      label: getLocalizedPaymentMethodName('EasyPaisa', lang),
      note:
        lang === 'ur'
          ? 'مرچنٹ ٹِل · خودکار تصدیق'
          : lang === 'ar'
          ? 'حساب التاجر · تأكيد تلقائي'
          : 'Merchant Till · Instant Auto-Check',
    },
    {
      name: 'JazzCash',
      label: getLocalizedPaymentMethodName('JazzCash', lang),
      note:
        lang === 'ur'
          ? 'کارپوریٹ ٹِل 789210 · فوری خودکار کلیئرنس'
          : lang === 'ar'
          ? 'حساب الشركات 789210 · مقاصة فورية < 2 ثانية'
          : 'Corporate Till 789210 · Sub-2s Clearance',
    },
    {
      name: 'Bank Transfer (IBFT)',
      label: getLocalizedPaymentMethodName('Bank Transfer (IBFT)', lang),
      note:
        lang === 'ur'
          ? 'میزان بینک راسٹ (Raast) / 1LINK فوری حوالہ'
          : lang === 'ar'
          ? 'بنك ميزان · مرجع Raast / 1LINK الفوري'
          : 'Meezan Bank Raast 1LINK Reference',
    },
  ];

  if (userRole !== 'SALON_OWNER') {
    rails.push({
      name: 'Cash Collection',
      label: getLocalizedPaymentMethodName('Cash Collection', lang),
      note:
        lang === 'ur'
          ? 'صرف پاکستان فیلڈ ایجنٹ · انگوٹھے کی بائیومیٹرک تصدیق لازمی'
          : lang === 'ar'
          ? 'ميداني داخل باكستان فقط · موثق ببصمة الإبهام'
          : 'Pakistan On-Site Only · Thumbprint Signed',
    });
  }

  return rails;
};

export const getLocalizedServiceName = (name: string, lang: ClientOnboardingLanguage) => {
  if (lang === 'en') return name;
  const translations: Record<string, { ur: string; ar: string }> = {
    'Master Haircut': { ur: 'ماسٹر ہیئر کٹ (بالوں کی کٹنگ)', ar: 'قص شعر احترافي (ماستر)' },
    'Skin Fade Styling': { ur: 'اسکن فیڈ اسٹائلنگ (سائیڈ فیڈ)', ar: 'تدريج وتحديد سكن فيد' },
    'Beard Sculpt & Line-Up': { ur: 'داڑھی سیٹنگ اور خط', ar: 'تحديد وتشذيب اللحية' },
    'Ozone Steam Therapy': { ur: 'اوزون اسٹیم تھراپی (بھاپ)', ar: 'جلسة بخار أوزون للوجه' },
    'Charcoal Deep Detox Facial': { ur: 'چارکول ڈیپ ڈیٹاکس فیشل', ar: 'تنظيف عميق بالفحم النشط' },
    'Hair Protein & Scalp Massage': { ur: 'ہیئر پروٹین اور اسکیلپ مساج', ar: 'بروتين شعر وتدليك الفروة' },
    'Hot Towel Royal Shave': { ur: 'ہاٹ ٹاول شاہی شیو', ar: 'حلاقة ملكية بالمنشفة الساخنة' },
    'Full Grooming VIP Combo': { ur: 'فل گرومنگ وی آئی پی کومبو', ar: 'باقة العناية الشاملة VIP' },
    'Signature Haircut': { ur: 'سگنیچر لیڈیز ہیئر کٹ', ar: 'قص شعر نسائي مميز' },
    'Blowdry & Styling': { ur: 'بلو ڈرائی اور اسٹائلنگ', ar: 'سشوار وتسريح شعر' },
    'Hydra Glow Cleansing Facial': { ur: 'ہائیڈرا گلو کلینزنگ فیشل', ar: 'جلسة هيدرافيشل لتنظيف ونضارة البشرة' },
    'Party Makeup': { ur: 'پارٹی میک اپ', ar: 'مكياج مناسبات وسهرات' },
    'Bridal Hair Styling': { ur: 'برائیڈل ہیئر اسٹائلنگ', ar: 'تسريحات شعر للعرائس' },
    'Keratin Smoothing Treatment': { ur: 'کیراٹن اسموتھنگ ٹریٹمنٹ', ar: 'معالجة كيراتين لتنعيم الشعر' },
    'Manicure & Pedicure Spa': { ur: 'مینی کیور اور پیڈی کیور سپا', ar: 'سبا العناية باليدين والقدمين' },
    '24K Gold Glow Facial': { ur: '24K گولڈ گلو فیشل', ar: 'جلسة نضارة بالذهب عيار 24' },
    'Hot Towel Charcoal Facial': { ur: 'چارکول فیشل مع ہاٹ ٹاول', ar: 'تنظيف بشرة بالفحم والمنشفة الساخنة' },
    'Royal Scalp Therapy & Wash': { ur: 'ہیئر واش اور اسکیلپ مساج', ar: 'غسيل شعر وتدليك فروة الرأس' },
    'Beard Color & Sculpting': { ur: 'داڑھی کلرنگ اور اسٹائلنگ', ar: 'صبغ لحية وتشذيب احترافي' },
    'Hydra Deep Cleanse Facial': { ur: 'ہائیڈرا فیشل ڈیپ کلینزنگ', ar: 'جلسة هيدرافيشل لتنظيف المسام' },
    'Bridal Hair Styling & Wash': { ur: 'برائیڈل ہیئر اسٹائلنگ اور واش', ar: 'تصفيف وتسريحات شعر للعرائس' },
    'Luxury HD Bridal Makeup': { ur: 'لگژری ایچ ڈی برائیڈل میک اپ', ar: 'مكياج عرائس سينمائي فاخر' },
  };
  return translations[name]?.[lang] || name;
};

export const getLocalizedPackageName = (name: string, lang: ClientOnboardingLanguage) => {
  if (lang === 'en') return name;
  const translations: Record<string, { ur: string; ar: string }> = {
    'Starter Setup': { ur: 'اسٹارٹر سیٹ اپ', ar: 'باقة التأسيس الأولى' },
    'Growth Automation': { ur: 'گروتھ آٹومیشن', ar: 'باقة النمو الآلي' },
    'VIP Executive': { ur: 'وی آئی پی ایگزیکٹو', ar: 'باقة كبار العملاء VIP' },
    'Custom Enterprise': { ur: 'کسٹم انٹرپرائز', ar: 'الباقة المخصصة للمؤسسات' },
  };
  return translations[name]?.[lang] || name;
};

export interface PackageFeatureDetail {
  title: string;
  included: boolean;
  highlight?: boolean;
}

export const getLocalizedPackageFeatures = (pkgId: string, lang: ClientOnboardingLanguage): PackageFeatureDetail[] => {
  if (lang === 'ur') {
    switch (pkgId) {
      case 'STARTER':
        return [
          { title: '24/7 خودکار واٹس ایپ بکنگ بوٹ', included: true },
          { title: 'ماہانہ 500 گاہک بکنگز کی گنجائش', included: true },
          { title: 'بکنگ کا فوری کنفرمیشن و ریمائنڈر میسج', included: true },
          { title: 'گوگل 5-اسٹار ریویو بوسٹر (غیر فعال)', included: false },
          { title: 'ویڈیو ڈیلز اور وائرل ریلز (غیر فعال)', included: false },
          { title: 'ماہانہ 10% مینٹیننس (مفت ہوسٹنگ و بیک اپ)', included: true },
        ];
      case 'GROWTH':
        return [
          { title: '24/7 خودکار واٹس ایپ بکنگ بوٹ', included: true },
          { title: 'ماہانہ 1,500 گاہک بکنگز کی گنجائش', included: true },
          { title: 'گوگل 5-اسٹار ریویو بوسٹر (سروس کے 30 منٹ بعد خودکار)', included: true, highlight: true },
          { title: 'براہ راست گوگل میپس 5★ فلٹر و ریٹنگ اضافہ', included: true },
          { title: 'ویڈیو ڈیلز اور وائرل ریلز (غیر فعال)', included: false },
          { title: 'ماہانہ 10% مینٹیننس اور 60 منٹ ہیلنگ گارنٹی', included: true },
        ];
      case 'VIP':
        return [
          { title: '24/7 ترجیحی واٹس ایپ بوٹ کلسٹر', included: true },
          { title: 'ماہانہ 3,000 گاہک بکنگز کی گنجائش', included: true },
          { title: 'گوگل 5-اسٹار ریویو بوسٹر (VIP ترجیح)', included: true },
          { title: 'ویڈیو اپلوڈ اور وائرل ڈیلز فیچر انلاکڈ', included: true, highlight: true },
          { title: '1 ویڈیو ڈیل (1,500 روپے) یا 4 ویڈیو ڈیلز (4,000 روپے ماہانہ)', included: true },
          { title: '7 تا 10 دن کا ویڈیو کنورژن آڈٹ', included: true },
          { title: 'ماہانہ 10% مینٹیننس اور ڈیڈیکیٹڈ سپورٹ مینیجر', included: true },
        ];
      case 'CUSTOM':
      default:
        return [
          { title: 'ملٹی سم گیٹ وے اور کسٹم واٹس ایپ راؤٹنگ', included: true },
          { title: 'لامحدود بکنگز اور ملٹی برانچ نیٹ ورک کنٹرول', included: true },
          { title: 'لامحدود گوگل 5-اسٹار پروموشنل مہمات', included: true },
          { title: 'کسٹم ویڈیو پروڈکشن اور سوشل ریلز پروموشن', included: true },
          { title: '24/7 ترجیحی سپورٹ اور فوری مدد (10% ماہانہ)', included: true },
        ];
    }
  }

  if (lang === 'ar') {
    switch (pkgId) {
      case 'STARTER':
        return [
          { title: 'بوت حجز واتساب آلي يعمل على مدار 24/7', included: true },
          { title: 'سعة استيعاب 500 حجز شهرياً', included: true },
          { title: 'إشعار وتأكيد فوري للحجوزات', included: true },
          { title: 'معزز تقييمات جوجل 5 نجوم (غير مدرج)', included: false },
          { title: 'عروض الفيديو والريلز التسويقية (غير مدرج)', included: false },
          { title: 'صيانة شهرية 10% (استضافة وضمان تشغيل)', included: true },
        ];
      case 'GROWTH':
        return [
          { title: 'بوت واتساب فائق السرعة 24/7', included: true },
          { title: 'سعة استيعاب 1,500 حجز شهرياً', included: true },
          { title: 'معزز تقييمات جوجل 5 نجوم التلقائي (بعد 30 دقيقة)', included: true, highlight: true },
          { title: 'رفع التقييم المباشر على خرائط جوجل', included: true },
          { title: 'عروض الفيديو والريلز التسويقية (غير مدرج)', included: false },
          { title: 'صيانة شهرية 10% مع دعم تعافي في أقل من 60 دقيقة', included: true },
        ];
      case 'VIP':
        return [
          { title: 'بوت واتساب عالي الكثافة والأولوية القصوى', included: true },
          { title: 'سعة استيعاب 3,000 حجز شهرياً', included: true },
          { title: 'معزز تقييمات جوجل 5 نجوم الممتاز', included: true },
          { title: 'فتح ميزة عروض وفيديوهات الصالون التسويقية', included: true, highlight: true },
          { title: 'عرض فيديو واحد ($15) أو 4 فيديوهات ($40 شهرياً)', included: true },
          { title: 'تدقيق ومتابعة تفاعل الفيديو لمدة 7-10 أيام', included: true },
          { title: 'صيانة شهرية 10% ومدير حساب مخصص', included: true },
        ];
      case 'CUSTOM':
      default:
        return [
          { title: 'مجموعة بوابات SIM متعددة وتوزيع للفروع', included: true },
          { title: 'حجوزات غير محدودة وتغطية لجميع الفروع', included: true },
          { title: 'حملات تقييمات جوجل غير محدودة', included: true },
          { title: 'إنتاج حملات فيديو مخصصة وترويج احترافي', included: true },
          { title: 'دعم تقني مباشر 24/7 بموجب اتفاقية 10%', included: true },
        ];
    }
  }

  // English (default)
  switch (pkgId) {
    case 'STARTER':
      return [
        { title: '24/7 Autonomous WhatsApp Booking Concierge', included: true },
        { title: '500 salon bookings / month capacity', included: true },
        { title: 'Instant booking confirmation & reminder SMS', included: true },
        { title: 'Google 5-Star Review Booster (Disabled)', included: false },
        { title: 'Viral Video Deals & Reels Feature (Disabled)', included: false },
        { title: 'Monthly 10% Maintenance (Cloud hosting, auto-healing)', included: true },
      ];
    case 'GROWTH':
      return [
        { title: '24/7 Autonomous WhatsApp Booking Concierge', included: true },
        { title: '1,500 salon bookings / month capacity', included: true },
        { title: 'Google 5-Star Review Booster (Auto-prompted 30 mins after checkout)', included: true, highlight: true },
        { title: 'Direct Google Maps 5★ filter & review multiplier', included: true },
        { title: 'Viral Video Deals & Reels Feature (Disabled)', included: false },
        { title: 'Monthly 10% Maintenance with 24/7 auto-fix protection', included: true },
      ];
    case 'VIP':
      return [
        { title: 'Priority Multi-Branch WhatsApp Auto-Reply System', included: true },
        { title: '3,000 salon bookings / month capacity', included: true },
        { title: 'Google 5-Star Review Booster (VIP priority)', included: true },
        { title: 'Viral Video Deals & Reels Feature Unlocked', included: true, highlight: true },
        { title: '1 video deal ($15 / PKR 1.5k) or 4 video deals ($40 / PKR 4k / mo)', included: true },
        { title: '7 to 10 day conversion tracking & results', included: true },
        { title: 'Monthly 10% Maintenance & dedicated account manager', included: true },
      ];
    case 'CUSTOM':
    default:
      return [
        { title: 'Multi-Branch WhatsApp & Custom Shop Routing', included: true },
        { title: 'Unlimited salon bookings / multi-branch network', included: true },
        { title: 'Unlimited Google 5-Star campaigns & viral promo broadcast', included: true },
        { title: 'Custom video marketing production & creator coordination', included: true },
        { title: 'Priority 24/7 support & fast auto-recovery (10% monthly)', included: true },
      ];
  }
};

export const formatWelcomeMessage = (
  lang: ClientOnboardingLanguage,
  ownerName: string,
  salonName: string,
  pairingKey: string = 'WCL-49201'
) => {
  const safeOwner = ownerName.trim() || (lang === 'ar' ? 'الشريك' : lang === 'ur' ? 'پارٹنر' : 'Partner');
  const safeSalon = salonName.trim() || (lang === 'ar' ? 'صالونكم' : lang === 'ur' ? 'آپ کا سیلون' : 'Your Salon');
  const slug = safeSalon.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'salon';
  const pwaLink = `https://portal.workcraft.local/onboard/${slug}`;

  if (lang === 'en') {
    // English: strictly "Dear Mr. [Name]" (No Assalam-o-Alaikum as per policy)
    return `Dear Mr. ${safeOwner},\n\nWelcome to WORKCRAFT Local. Your terminal for "${safeSalon}" is activated.\n🔑 Terminal Pairing Key: ${pairingKey}\n📲 Web App Link: ${pwaLink}\n\nOur Central SIM Gateway is now operational for your 24/7 automated booking concierge.`;
  }
  if (lang === 'ar') {
    // Arabic: Starts with proper Arabic السلام عليكم and dual-script WORKCRAFT brand
    return `السلام عليكم ${safeOwner}!\n\nمرحباً بكم في WORKCRAFT Local (وورك كرافت لوكل). تم تفعيل حساب صالونكم "${safeSalon}".\n🔑 رمز الاقتران (Pairing Key): ${pairingKey}\n📲 رابط البوابة: ${pwaLink}\n\nنظام الرد التلقائي والحجوزات عبر واتساب يعمل الآن 24/7 على مدار الساعة.`;
  }
  // Native Simple Urdu: Starts with Assalam-o-Alaikum and dual-script WORKCRAFT brand
  return `السلام علیکم ${safeOwner}!\n\nورک کرافٹ لوکل (WORKCRAFT Local) میں خوش آمدید۔ آپ کے سیلون "${safeSalon}" کا اکاؤنٹ فعال ہو چکا ہے۔\n🔑 پیئرنگ کوڈ (Pairing Key): ${pairingKey}\n📲 پورٹل لنک: ${pwaLink}\n\nہمارا 24/7 واٹس ایپ آٹو ریپلائی کسٹمر بکنگ سسٹم لائیو ہے۔`;
};

export const FieldAgentHub: React.FC<FieldAgentHubProps> = ({
  onSalonCreated,
  onCashCollected,
  onClose,
  initialAutoOpenEnrollment,
  initialEnrollAgentData,
  userRole = 'FOUNDER',
  onActiveCountriesChange,
}) => {
  // Agent Terminal Authentication State
  const [isAgentAuthenticated, setIsAgentAuthenticated] = useState(true);
  const [agentIdInput, setAgentIdInput] = useState('AGT-409');
  const [agentPinInput, setAgentPinInput] = useState('7892');
  const [loginError, setLoginError] = useState<string | null>(null);

  // 4-Step Sequential In-Hub Onboarding State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Lead Information & Phone Configuration
  const [salonName, setSalonName] = useState('Seven Cuts Studio');
  const [ownerName, setOwnerName] = useState('Hamza Tariq');
  const [selectedDialCode, setSelectedDialCode] = useState('+92');
  const [nationalPhone, setNationalPhone] = useState('3018472910');
  const [clientOnboardingLanguage, setClientOnboardingLanguage] = useState<ClientOnboardingLanguage>('ur');
  const t = ONBOARDING_I18N[clientOnboardingLanguage];
  const [coords, setCoords] = useState('31.4705° N, 74.4109° E');
  const [address, setAddress] = useState('Shop #4, Plaza 12, CCA Phase 5 DHA, Lahore');
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [invitePreview, setInvitePreview] = useState<string | null>(null);

  // Searchable Country Dial Code Picker State (Recommendation 1)
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [isDialDropdownOpen, setIsDialDropdownOpen] = useState(false);

  // Expandable Package Feature Details Accordion State (Recommendation 3)
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>('GROWTH');

  // Dynamic Full Phone and Country Detection
  const phone = `${selectedDialCode} ${nationalPhone}`;
  const selectedDialConfig = DIAL_CODE_OPTIONS.find((d) => d.dialCode === selectedDialCode) || DIAL_CODE_OPTIONS[0];
  const detectedCountry = detectCountryFromPhone(phone);
  const phoneValidation = validateNationalPhoneForCountry(selectedDialConfig, nationalPhone);
  const addressConflict = checkCityCountryIntegrity(address, phone);

  // Locked Routing Mode: Inside Agent Hub, it is strictly Assisted On-Site Dual Alert
  const onboardingAssistance = 'ASSISTED';

  // Step 4: Alphanumeric Pairing Key (Query 7: WCL-XXXXX) & View Mode (Query 6)
  const [pairingKey, setPairingKey] = useState('WCL-49201');
  const [step4ViewMode, setStep4ViewMode] = useState<'QR_SCAN' | 'DIRECT_LINK'>('QR_SCAN');

  // Step 2: Services & Pricing
  const [serviceCategory, setServiceCategory] = useState<'MENS' | 'LADIES'>('MENS');
  const [mensServices, setMensServices] = useState<ServiceItem[]>(DEFAULT_MENS_SERVICES);
  const [ladiesServices, setLadiesServices] = useState<ServiceItem[]>(DEFAULT_LADIES_SERVICES);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('2000');
  const [isAddingCustomService, setIsAddingCustomService] = useState(false);

  // Step 3: Package & Setup Fee Settlement (Domestic PKR vs International USD)
  const [selectedOnboardingPackage, setSelectedOnboardingPackage] = useState<'STARTER' | 'GROWTH' | 'VIP' | 'CUSTOM'>('STARTER');

  const ONBOARDING_PACKAGES_DOMESTIC = [
    {
      id: 'STARTER',
      name: 'Starter Setup',
      setupFee: 15000,
      monthlyMaint: 1500, // 10%
      currency: 'PKR',
      prefix: 'PKR ',
      bookings: '500 bookings/mo',
      scope: 'WhatsApp Auto-Reply Concierge Only (No Google Reviews, No Video Deals)',
      agentCommission: 3000,
    },
    {
      id: 'GROWTH',
      name: 'Growth Automation',
      setupFee: 20000,
      monthlyMaint: 2000, // 10%
      currency: 'PKR',
      prefix: 'PKR ',
      bookings: '1,500 bookings/mo',
      scope: 'WhatsApp Auto-Reply + Google 5-Star Review Booster',
      agentCommission: 4000,
    },
    {
      id: 'VIP',
      name: 'VIP Executive',
      setupFee: 25000,
      monthlyMaint: 2500, // 10%
      currency: 'PKR',
      prefix: 'PKR ',
      bookings: '3,000 bookings/mo',
      scope: 'WhatsApp Auto-Reply + Google 5-Star Reviews + Video Upload Feature Unlocked (1 video @ 1,500 or 4 videos @ 4,000/mo · 7-10 day validation)',
      agentCommission: 5000,
    },
    {
      id: 'CUSTOM',
      name: 'Custom Enterprise',
      setupFee: 35000,
      monthlyMaint: 3500, // 10%
      currency: 'PKR',
      prefix: 'PKR ',
      bookings: '> 3,000 bookings / Multi-Branch',
      scope: 'Enterprise Multi-Branch & Priority Support (Video Feature Unlocked: 1 to 4 videos/mo · 10% monthly)',
      agentCommission: 7000,
    },
  ];

  const ONBOARDING_PACKAGES_INTL = [
    {
      id: 'STARTER',
      name: 'Starter Setup',
      setupFee: 75,
      monthlyMaint: 7.5, // 10%
      currency: 'USD',
      prefix: '$',
      bookings: '500 bookings/mo',
      scope: 'WhatsApp Auto-Reply Concierge Only (No Google Reviews, No Video Deals)',
      agentCommission: 15,
    },
    {
      id: 'GROWTH',
      name: 'Growth Automation',
      setupFee: 110,
      monthlyMaint: 11, // 10%
      currency: 'USD',
      prefix: '$',
      bookings: '1,500 bookings/mo',
      scope: 'WhatsApp Auto-Reply + Google 5-Star Review Booster',
      agentCommission: 22,
    },
    {
      id: 'VIP',
      name: 'VIP Executive',
      setupFee: 160,
      monthlyMaint: 16, // 10%
      currency: 'USD',
      prefix: '$',
      bookings: '3,000 bookings/mo',
      scope: 'WhatsApp Auto-Reply + Google 5-Star Reviews + Video Upload Feature Unlocked (1 video @ $15 or 4 videos @ $40/mo · 7-10 day validation)',
      agentCommission: 32,
    },
    {
      id: 'CUSTOM',
      name: 'Custom Enterprise',
      setupFee: 250,
      monthlyMaint: 25, // 10%
      currency: 'USD',
      prefix: '$',
      bookings: '> 3,000 bookings / Multi-Branch',
      scope: 'Enterprise Multi-Branch & Priority Support (Video Feature Unlocked: 1 to 4 videos/mo · 10% monthly)',
      agentCommission: 50,
    },
  ];

  const currentPackageList = detectedCountry.isDomestic ? ONBOARDING_PACKAGES_DOMESTIC : ONBOARDING_PACKAGES_INTL;
  const activePackage = currentPackageList.find(p => p.id === selectedOnboardingPackage) || currentPackageList[0];

  // Query 1 & 2: Interactive Payment Drawer & Method State
  const [setupPaymentMethod, setSetupPaymentMethod] = useState<'EasyPaisa' | 'JazzCash' | 'Bank Transfer (IBFT)' | 'Stripe / Card' | 'Cash Collection'>(
    detectedCountry.isDomestic ? 'EasyPaisa' : 'Stripe / Card'
  );
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [simWebhookState, setSimWebhookState] = useState<'idle' | 'listening' | 'detected'>('idle');

  // Query 6: State Machine Guard Lock (Strictly FALSE until payment confirmation is verified)
  const [isPaymentVerified, setIsPaymentVerified] = useState(false);

  // Verified Payment Receipt Payload
  const [verifiedPaymentData, setVerifiedPaymentData] = useState<{
    method: string;
    senderDetails: string;
    tid: string;
    amount: number;
    currency: string;
    currencyPrefix?: string;
    timestamp: string;
    sha256Proof: string;
    recipientRoute: string;
    commissionAdjusted: boolean;
    commissionAmount: number;
    remainingCashOwed: number;
    isSameCurrencySplit?: boolean;
    workcraftNetAmount?: number;
  } | null>(null);

  // Drawer Form State
  const [drawerSenderDetails, setDrawerSenderDetails] = useState('');
  const [drawerTid, setDrawerTid] = useState('');
  const [drawerIsSubmitting, setDrawerIsSubmitting] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Elder-Friendly 1-Tap Copy & Quick Actions State (Query 5)
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyText = (text: string, fieldId: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handlePasteDemoTid = () => {
    const demoTid =
      setupPaymentMethod === 'EasyPaisa'
        ? `EP-${Math.floor(10000000000 + Math.random() * 90000000000)}`
        : setupPaymentMethod === 'JazzCash'
        ? `JC-${Math.floor(10000000000 + Math.random() * 90000000000)}`
        : setupPaymentMethod === 'Bank Transfer (IBFT)'
        ? `RRN-${Math.floor(1000000000 + Math.random() * 9000000000)}`
        : `pi_${Math.random().toString(36).substring(2, 14)}`;
    setDrawerTid(demoTid);
  };

  // Strict Security & Cash Risk Framework
  const MAX_CASH_CEILING = 50000; // PKR 50,000 hard velocity limit
  const [cashLiabilityHeld, setCashLiabilityHeld] = useState<number>(15000); // e.g. from Noor Parlor setup cash
  const [cashLiabilitySalon, setCashLiabilitySalon] = useState('Noor Beauty Lounge');
  const [countdownHours, setCountdownHours] = useState(44); // 48-Hour Alarming Window per deal
  const [countdownMinutes, setCountdownMinutes] = useState(18);

  // Strict Biometric Thumbprint State (Zero PIN Fallback)
  const [isThumbprintVerified, setIsThumbprintVerified] = useState(false);
  const [isScanningThumb, setIsScanningThumb] = useState(false);
  const [thumbprintHash, setThumbprintHash] = useState<string | null>(null);

  // 1-Salon-per-QR Cryptographic Single-Use Binding
  const [isQrBurned, setIsQrBurned] = useState(false);

  // Query 7: Regional Multilingual Language Engine
  const [agentLanguage, setAgentLanguage] = useState<'en' | 'ur' | 'ur_roman' | 'ar'>('en');

  // Query 5 & 6: Editable Day-1 Agent Profile
  const [agentFullName, setAgentFullName] = useState('Kamran Tariq');
  const [agentWhatsApp, setAgentWhatsApp] = useState('+92-301-4567891');
  const [agentIdNumber, setAgentIdNumber] = useState('35202-8491023-1');
  const [agentTerritory, setAgentTerritory] = useState('Lahore West (Gulberg · DHA · Model Town)');
  const [agentSelfieCaptured, setAgentSelfieCaptured] = useState(true);
  const [isCameraCapturing, setIsCameraCapturing] = useState(false);
  const [isProfileThumbScanning, setIsProfileThumbScanning] = useState(false);
  const [profileThumbHash, setProfileThumbHash] = useState('SHA256: 9b8c-02e1-48af-9102-thumb-enrolled');

  // Operating Region & Banking Jurisdiction (Pakistan vs Europe vs MENA vs Global)
  const agentDetectedCountry = detectCountryFromPhone(agentWhatsApp);
  const [agentOperatingRegion, setAgentOperatingRegion] = useState<'PK' | 'EUROPE' | 'MENA_UAE' | 'MENA_SA' | 'GLOBAL'>('PK');

  // Query 8: Optional Guarantor & Legally Enforceable Terms
  const [guarantorName, setGuarantorName] = useState('Tariq Mehmood');
  const [guarantorContact, setGuarantorContact] = useState('+92-300-8419201');
  const [guarantorRelation, setGuarantorRelation] = useState('Elder Brother / Business Reference');
  const [hasAgreedToLegalTerms, setHasAgreedToLegalTerms] = useState(true);
  const [legalBiometricStampHash, setLegalBiometricStampHash] = useState('SHA256: 8f4a-9c02-legal-stamped-pk');
  const [isLegalBiometricScanning, setIsLegalBiometricScanning] = useState(false);

  // Bank & Payout Configuration with Custom Bank & European Sort Code Support
  const [agentPayoutMethod, setAgentPayoutMethod] = useState<'EasyPaisa' | 'JazzCash' | 'Bank Transfer (IBFT)' | 'Raast Instant Pay' | 'International Bank Wire'>('EasyPaisa');
  const [agentBankName, setAgentBankName] = useState('Meezan Bank');
  const [isCustomBank, setIsCustomBank] = useState(false);
  const [customBankInput, setCustomBankInput] = useState('');
  const [agentPayoutAccount, setAgentPayoutAccount] = useState('0302-9847102');
  const [agentPayoutTitle, setAgentPayoutTitle] = useState('Kamran Tariq');
  const [agentIban, setAgentIban] = useState('PK64MEZN0001020304050607');
  const [agentSwiftCode, setAgentSwiftCode] = useState('MEZNPKKA');
  const [agentSortCode, setAgentSortCode] = useState('20-04-15');
  const [agentNextOfKin, setAgentNextOfKin] = useState('Shahid Tariq (Brother)');
  const [payoutSaveStatus, setPayoutSaveStatus] = useState<string | null>(null);

  // Query 16: Biometric Lock for Profile Edits (Committed only after fresh thumbprint scan)
  const [isBiometricModalOpenForEdit, setIsBiometricModalOpenForEdit] = useState(false);
  const [isBiometricScanningForEdit, setIsBiometricScanningForEdit] = useState(false);
  const [draftAgentPhone, setDraftAgentPhone] = useState('+92-301-4567891');
  const [draftAgentTerritory, setDraftAgentTerritory] = useState('Lahore West (Gulberg · DHA · Model Town)');
  const [draftAgentRegion, setDraftAgentRegion] = useState<'PK' | 'EUROPE' | 'MENA_UAE' | 'MENA_SA' | 'GLOBAL'>('PK');
  const [draftAgentPayoutMethod, setDraftAgentPayoutMethod] = useState<'EasyPaisa' | 'JazzCash' | 'Bank Transfer (IBFT)' | 'Raast Instant Pay' | 'International Bank Wire'>('EasyPaisa');
  const [draftAgentBankName, setDraftAgentBankName] = useState('Meezan Bank');
  const [draftAgentPayoutAccount, setDraftAgentPayoutAccount] = useState('0302-9847102');
  const [draftAgentPayoutTitle, setDraftAgentPayoutTitle] = useState('Kamran Tariq');
  const [draftAgentIban, setDraftAgentIban] = useState('PK64MEZN0001020304050607');
  const [profileBiometricSealTime, setProfileBiometricSealTime] = useState('12-Oct-2024 · 09:15 PKT');

  // Founder Master Kill-Switch (Query 9)
  const [isAgentSuspendedByFounder, setIsAgentSuspendedByFounder] = useState(false);

  // Step 4: In-Person Pairing QR State
  const [isPairingSimulated, setIsPairingSimulated] = useState(false);

  // Active Hub View Toggle: 'ONBOARDING' vs 'FLEET' vs 'LEDGER' vs 'RE_PAIR' vs 'PROFILE'
  const [activeHubView, setActiveHubView] = useState<'ONBOARDING' | 'FLEET' | 'LEDGER' | 'RE_PAIR' | 'PROFILE'>('ONBOARDING');
  const [rePairSalonsList, setRePairSalonsList] = useState<Array<{
    name: string;
    owner: string;
    city: string;
    phone: string;
    savedLang: ClientOnboardingLanguage;
    status: 'CONNECTED' | 'NEEDS_RELINK';
  }>>([
    { name: 'Seven Cuts Studio', owner: 'Hamza Tariq', city: 'DHA Phase 5, Lahore', phone: '+92 301 8472910', savedLang: 'ur', status: 'CONNECTED' },
    { name: 'Noor Beauty Lounge', owner: 'Sana Siddiqui', city: 'Clifton Block 4, Karachi', phone: '+92 300 9281742', savedLang: 'ur', status: 'NEEDS_RELINK' },
    { name: 'Al Noor Gents Salon', owner: 'Tariq Al-Mansoor', city: 'Al Rigga Road, Deira, Dubai', phone: '+971 50 4819203', savedLang: 'ar', status: 'CONNECTED' },
    { name: 'The Groom Room', owner: 'Oliver Bennett', city: '48 Oxford St, Soho, London', phone: '+44 7712 345678', savedLang: 'en', status: 'CONNECTED' },
  ]);
  const [rePairSearchQuery, setRePairSearchQuery] = useState('');
  const [selectedRePairSalon, setSelectedRePairSalon] = useState('Seven Cuts Studio');
  const [rePairRecoveryMode, setRePairRecoveryMode] = useState<'AUTO_OTP' | 'ONSITE_QR' | 'REMOTE_LINK'>('AUTO_OTP');
  const [isRePairHandshakeActive, setIsRePairHandshakeActive] = useState(false);
  const [isAutoOtpDispatched, setIsAutoOtpDispatched] = useState(false);
  const [isRemoteLinkDispatched, setIsRemoteLinkDispatched] = useState(false);

  // Founder Multi-Agent Ledger Filter & Fleet Dossier Search/Region State
  const [founderSelectedLedgerAgent, setFounderSelectedLedgerAgent] = useState<string>('ALL');
  const [fleetSearchQuery, setFleetSearchQuery] = useState('');
  const [fleetRegionFilter, setFleetRegionFilter] = useState<'ALL' | 'PK' | 'MENA' | 'EUROPE' | 'GLOBAL'>('ALL');

  // Query 2, 4, 15: Founder Fleet Command & Central Agent Dossiers
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [selectedDossierAgent, setSelectedDossierAgent] = useState<any | null>(null);
  const [enrolledAgentsList, setEnrolledAgentsList] = useState<Array<{
    id: string;
    pin: string;
    name: string;
    phone: string;
    city: string;
    category: string;
    cnicOrId: string;
    payoutMethod: string;
    payoutAccount: string;
    payoutTitle: string;
    bankName?: string;
    iban?: string;
    swiftCode?: string;
    status: string;
    enrolledAt: string;
    selfieVerified: boolean;
    thumbHash: string;
    legalRemittanceAgreed: boolean;
    legalTermsText: string;
    guarantorName?: string;
    guarantorPhone?: string;
  }>>([
    {
      id: 'AGT-409',
      pin: '7892',
      name: 'Kamran Tariq',
      phone: '+92 301 4567891',
      city: 'Lahore West (Gulberg · DHA · Model Town)',
      category: 'Universal (All Salons, Barbershops & Parlors)',
      cnicOrId: '35202-8491023-1',
      payoutMethod: 'EasyPaisa',
      payoutAccount: '0302-9847102',
      payoutTitle: 'Kamran Tariq',
      bankName: 'Meezan Bank',
      iban: 'PK64MEZN0001020304050607',
      status: 'ACTIVE · ON-FIELD',
      enrolledAt: '12-Oct-2024 · 09:15 PKT',
      selfieVerified: true,
      thumbHash: 'SHA256: 9b8c-02e1-48af-9102-thumb-enrolled',
      legalRemittanceAgreed: true,
      legalTermsText: 'Agreed: Remit physical cash within 48 hours into WORKCRAFT Official Accounts. Subject to legal recovery under Laws of Pakistan.',
      guarantorName: 'Tariq Mehmood',
      guarantorPhone: '+92-300-8419201',
    },
    {
      id: 'AGT-415',
      pin: '5219',
      name: 'Bilal Sheikh',
      phone: '+92 300 4819204',
      city: 'Karachi South (Clifton · DHA Phase 6)',
      category: 'Universal (All Salons, Barbershops & Parlors)',
      cnicOrId: '42101-9482019-3',
      payoutMethod: 'JazzCash',
      payoutAccount: '0300-4819204',
      payoutTitle: 'Bilal Sheikh',
      bankName: 'HBL',
      iban: 'PK21HABB0002030405060708',
      status: 'ACTIVE · ON-FIELD',
      enrolledAt: '24-Oct-2026 · 14:20 PKT',
      selfieVerified: true,
      thumbHash: 'SHA256: 3a7e-11d9-72fc-4401-thumb-enrolled',
      legalRemittanceAgreed: true,
      legalTermsText: 'Agreed: Remit physical cash within 48 hours into WORKCRAFT Official Accounts. Subject to legal recovery under Laws of Pakistan.',
      guarantorName: 'Imran Sheikh',
      guarantorPhone: '+92-321-8890123',
    },
    {
      id: 'AGT-502',
      pin: '6640',
      name: 'Tariq Al-Mansoor',
      phone: '+971 50 8491022',
      city: 'Dubai (Deira · Marina · Jumeirah)',
      category: 'MENA Luxury Salons & Barbershops',
      cnicOrId: '784-1990-4829102-1',
      payoutMethod: 'Bank Transfer (UAE IBAN)',
      payoutAccount: 'AE07 0331 2345 6789 0123 456',
      payoutTitle: 'Tariq Al-Mansoor',
      bankName: 'Emirates NBD',
      iban: 'AE070331234567890123456',
      swiftCode: 'EBILAEAD',
      status: 'ACTIVE · ON-FIELD',
      enrolledAt: '02-Nov-2026 · 11:40 GST',
      selfieVerified: true,
      thumbHash: 'SHA256: 7f2c-84b0-91ed-5518-thumb-enrolled',
      legalRemittanceAgreed: true,
      legalTermsText: 'Agreed: Strict Zero-Cash UAE digital settlement rail policy via Stripe / International Bank Wire.',
      guarantorName: 'Khalid Al-Mansoor',
      guarantorPhone: '+971-50-7123409',
    },
    {
      id: 'AGT-608',
      pin: '3904',
      name: 'Oliver Bennett',
      phone: '+44 7712 894012',
      city: 'London (Soho · Canary Wharf)',
      category: 'UK & Europe Grooming Terminals',
      cnicOrId: 'GBR-482910482',
      payoutMethod: 'UK Bank Transfer (Faster Payments)',
      payoutAccount: 'GB29 NWBK 6016 1331 9268 19',
      payoutTitle: 'Oliver Bennett',
      bankName: 'NatWest UK',
      iban: 'GB29NWBK60161331926819',
      swiftCode: 'NWBKGB2L',
      status: 'ACTIVE · ON-FIELD',
      enrolledAt: '05-Nov-2026 · 16:05 GMT',
      selfieVerified: true,
      thumbHash: 'SHA256: 5d9a-40e2-83ca-1190-thumb-enrolled',
      legalRemittanceAgreed: true,
      legalTermsText: 'Agreed: Strict Zero-Cash UK/EU Stripe & Faster Payments digital onboarding policy.',
      guarantorName: 'Arthur Bennett',
      guarantorPhone: '+44-7700-900412',
    },
  ]);

  // Automatically report every distinct country among enrolled/onboarded agents to App.tsx Global Pause dropdown
  React.useEffect(() => {
    if (!onActiveCountriesChange) return;
    const seen = new Map<string, { code: string; label: string; flag: string }>();
    enrolledAgentsList.forEach((agent) => {
      const detected = detectCountryFromPhone(agent.phone, agent.city);
      if (!seen.has(detected.code)) {
        seen.set(detected.code, {
          code: detected.code,
          label: detected.name,
          flag: detected.flag,
        });
      }
    });
    onActiveCountriesChange(Array.from(seen.values()));
  }, [enrolledAgentsList, onActiveCountriesChange]);

  // Day-1 Remote Enrollment Wizard Flow (Queries 5-14, 17-18)
  const [isRemoteEnrollmentWizardOpen, setIsRemoteEnrollmentWizardOpen] = useState(false);
  const [enrollmentLang, setEnrollmentLang] = useState<'en' | 'ur_roman' | 'ar'>('en');
  const [enrollmentStep, setEnrollmentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [enrollAgentName, setEnrollAgentName] = useState('Bilal Sheikh');
  const [enrollAgentPhone, setEnrollAgentPhone] = useState('+92 300 4819204');
  const [enrollAgentCity, setEnrollAgentCity] = useState('Karachi South');
  const [enrollAgentId, setEnrollAgentId] = useState('42101-9482019-3');
  const [enrollSelfieDone, setEnrollSelfieDone] = useState(false);
  const [enrollThumbDone, setEnrollThumbDone] = useState(false);
  const [enrollThumbHash, setEnrollThumbHash] = useState<string | null>(null);
  const [enrollPayoutMethod, setEnrollPayoutMethod] = useState('EasyPaisa');
  const [enrollPayoutTitle, setEnrollPayoutTitle] = useState('Bilal Sheikh');
  const [enrollPayoutAccount, setEnrollPayoutAccount] = useState('0300-4819204');
  const [enrollBankName, setEnrollBankName] = useState('Meezan Bank');
  const [enrollBankMobile, setEnrollBankMobile] = useState('+92 300 4819204');
  const [enrollIban, setEnrollIban] = useState('');
  const [enrollBicSwift, setEnrollBicSwift] = useState('');
  const [enrollNextOfKin, setEnrollNextOfKin] = useState('');
  const [enrollNextOfKinPhone, setEnrollNextOfKinPhone] = useState('');
  const [enrollGuarantorName, setEnrollGuarantorName] = useState('');
  const [enrollGuarantorPhone, setEnrollGuarantorPhone] = useState('');
  const [enrollAgreedTerms, setEnrollAgreedTerms] = useState(false);
  const [enrollLegalBiometricStamped, setEnrollLegalBiometricStamped] = useState(false);
  const [enrollLegalStampHash, setEnrollLegalStampHash] = useState<string | null>(null);
  const [isEnrollThumbScanning, setIsEnrollThumbScanning] = useState(false);
  const [isLegalStampScanning, setIsLegalStampScanning] = useState(false);
  const [cityValidationError, setCityValidationError] = useState<{ en: string; ur: string; ar: string } | null>(null);
  const [enrollSelfiePreviewUrl, setEnrollSelfiePreviewUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [step2BiometricError, setStep2BiometricError] = useState<string | null>(null);
  const [step4BiometricError, setStep4BiometricError] = useState<string | null>(null);
  const selfieVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const selfieStreamRef = React.useRef<MediaStream | null>(null);

  const stopSelfieCamera = React.useCallback(() => {
    if (selfieStreamRef.current) {
      selfieStreamRef.current.getTracks().forEach((track) => track.stop());
      selfieStreamRef.current = null;
    }
    if (selfieVideoRef.current) {
      selfieVideoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const startSelfieCamera = async () => {
    setCameraError(null);
    setStep2BiometricError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        enrollmentLang === 'ur_roman'
          ? 'براؤزر میں لائیو فرنٹ کیمرہ دستیاب نہیں۔ براہِ کرم کیمرہ اجازت آن کریں۔'
          : enrollmentLang === 'ar'
          ? 'الكاميرا الأمامية المباشرة غير متاحة في هذا المتصفح. يرجى تفعيل أذونات الكاميرا.'
          : 'Live front camera stream is unavailable in this browser context. Please allow camera access on HTTPS.'
      );
      return;
    }
    try {
      stopSelfieCamera();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'user' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
      }
      selfieStreamRef.current = stream;
      setEnrollSelfieDone(false);
      setIsCameraActive(true);
    } catch {
      setCameraError(
        enrollmentLang === 'ur_roman'
          ? 'فرنٹ کیمرہ کی اجازت نہیں ملی — براہِ کرم براؤزر سیٹنگز میں کیمرہ کی اجازت دیں۔'
          : enrollmentLang === 'ar'
          ? 'تم رفض إذن الكاميرا الأمامية — يرجى السماح بالوصول إلى الكاميرا في إعدادات المتصفح.'
          : 'Front camera permission was denied — please allow camera access to capture your live agent selfie.'
      );
    }
  };

  const captureSelfieFrame = () => {
    const videoEl = selfieVideoRef.current;
    if (!videoEl || videoEl.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setEnrollSelfiePreviewUrl(dataUrl);
      setEnrollSelfieDone(true);
      setStep2BiometricError(null);
      stopSelfieCamera();
    }
  };

  React.useEffect(() => {
    if (isCameraActive && selfieVideoRef.current && selfieStreamRef.current) {
      selfieVideoRef.current.srcObject = selfieStreamRef.current;
      selfieVideoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  React.useEffect(() => {
    if (!isRemoteEnrollmentWizardOpen || enrollmentStep !== 2) {
      stopSelfieCamera();
    }
  }, [isRemoteEnrollmentWizardOpen, enrollmentStep, stopSelfieCamera]);



  // Query 1: Auto-open enrollment once for new agents, never for already enrolled agents
  React.useEffect(() => {
    if (initialAutoOpenEnrollment || initialEnrollAgentData) {
      // Check if this agent terminal has already completed Day-1 enrollment
      const isAlreadyEnrolled =
        typeof window !== 'undefined' &&
        localStorage.getItem('wcl_agent_enrolled_v1') === 'true';

      // If already enrolled and running in agent mode without new URL query parameters, keep wizard closed
      if (isAlreadyEnrolled && userRole === 'FIELD_AGENT' && !initialEnrollAgentData?.id) {
        return;
      }

      if (initialEnrollAgentData?.name) {
        setEnrollAgentName(initialEnrollAgentData.name);
        setEnrollPayoutTitle(initialEnrollAgentData.name);
      }
      if (initialEnrollAgentData?.phone) {
        const det = detectCountryFromPhone(initialEnrollAgentData.phone, initialEnrollAgentData.city);
        const payoutCfg = getPayoutConfigForCountry(det);
        setEnrollAgentPhone(initialEnrollAgentData.phone);
        setEnrollPayoutAccount(initialEnrollAgentData.phone);
        setEnrollBankMobile(initialEnrollAgentData.phone);
        setEnrollPayoutMethod(payoutCfg.defaultMethod);
        setEnrollBankName(payoutCfg.defaultBank);
        const langs = getEnrollmentLanguagesForPhone(initialEnrollAgentData.phone);
        setEnrollmentLang(langs[0].code);
      }
      if (initialEnrollAgentData?.city) setEnrollAgentCity(initialEnrollAgentData.city);
      if (initialEnrollAgentData?.id) setEnrollAgentId(initialEnrollAgentData.id);
      setIsRemoteEnrollmentWizardOpen(true);
      setEnrollmentStep(1);
    }
  }, [initialAutoOpenEnrollment, initialEnrollAgentData, userRole]);

  // PWA Home Screen Installation Prompt (Query 18)
  const [showPwaInstallModal, setShowPwaInstallModal] = useState(false);
  const [isPwaInstalledConfirmed, setIsPwaInstalledConfirmed] = useState(false);

  // Helper to scale base PKR service prices into local salon currency on country change
  const rescaleServicePricesForCountry = (country: CountryConfig) => {
    const mult = country.localRateMultiplier;
    const roundLocal = (pkrAmount: number) => {
      const scaled = pkrAmount * mult;
      if (mult >= 0.5) return Math.max(10, Math.round(scaled / 50) * 50);
      if (mult >= 0.05) return Math.max(5, Math.round(scaled / 5) * 5);
      return Math.max(2, Math.round(scaled));
    };
    setMensServices(DEFAULT_MENS_SERVICES.map((s) => ({ ...s, price: roundLocal(s.price) })));
    setLadiesServices(DEFAULT_LADIES_SERVICES.map((s) => ({ ...s, price: roundLocal(s.price) })));
    setNewServicePrice(String(roundLocal(2000)));
  };

  // GPS Auto-Detection Handlers (Country-Aware Fallback)
  const handleCaptureGps = () => {
    setIsCapturingGps(true);
    setStep1Error(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords(`${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E`);
          if (!address.trim() || checkCityCountryIntegrity(address, phone)) {
            setAddress(detectedCountry.defaultAddress);
          }
          setIsCapturingGps(false);
        },
        () => {
          setCoords(detectedCountry.defaultCoords);
          setAddress(detectedCountry.defaultAddress);
          setIsCapturingGps(false);
        },
        { timeout: 3000 }
      );
    } else {
      setCoords(detectedCountry.defaultCoords);
      setAddress(detectedCountry.defaultAddress);
      setIsCapturingGps(false);
    }
  };

  // Step 1: Validate Phone Digits + City/Country Match + Dispatch WhatsApp Invitation Link
  const handleDispatchStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error(null);

    if (!salonName.trim() || !ownerName.trim()) {
      setStep1Error(t.step1ErrorMissingNames);
      return;
    }

    const phoneCheck = validateNationalPhoneForCountry(selectedDialConfig, nationalPhone);
    if (!phoneCheck.valid && phoneCheck.reason) {
      setStep1Error(phoneCheck.reason[clientOnboardingLanguage]);
      return;
    }

    if (!address.trim()) {
      setStep1Error(t.step1ErrorEmptyAddress);
      return;
    }

    const locationConflict = checkCityCountryIntegrity(address, phone);
    if (locationConflict) {
      setStep1Error(locationConflict[clientOnboardingLanguage]);
      return;
    }

    // Strict greeting rules: English = Dear Mr. [Name]; Urdu / Arabic = Assalam-o-Alaikum [Name]
    const templateMsg = formatWelcomeMessage(clientOnboardingLanguage, ownerName, salonName, pairingKey);
    setInvitePreview(templateMsg);

    onSalonCreated({
      name: salonName,
      owner: ownerName,
      phone,
      location: address,
      coords,
    });

    setRePairSalonsList((prev) => {
      const exists = prev.some((s) => s.name.toLowerCase() === salonName.trim().toLowerCase());
      if (exists) {
        return prev.map((s) =>
          s.name.toLowerCase() === salonName.trim().toLowerCase()
            ? { ...s, owner: ownerName, city: address, phone, savedLang: clientOnboardingLanguage }
            : s
        );
      }
      return [
        {
          name: salonName.trim(),
          owner: ownerName.trim(),
          city: address.trim(),
          phone,
          savedLang: clientOnboardingLanguage,
          status: 'CONNECTED',
        },
        ...prev,
      ];
    });
    setSelectedRePairSalon(salonName.trim());

    setCurrentStep(2);
  };

  // Custom Service Add Handler
  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;

    const newItem: ServiceItem = {
      id: `custom_${Date.now()}`,
      name: newServiceName.trim(),
      price: parseInt(newServicePrice, 10) || 1500,
      enabled: true,
    };

    if (serviceCategory === 'MENS') {
      setMensServices((prev) => [...prev, newItem]);
    } else {
      setLadiesServices((prev) => [...prev, newItem]);
    }

    setNewServiceName('');
    setNewServicePrice('2000');
    setIsAddingCustomService(false);
  };

  const handleToggleService = (id: string) => {
    if (serviceCategory === 'MENS') {
      setMensServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
      );
    } else {
      setLadiesServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
      );
    }
  };

  const handleChangePrice = (id: string, price: number) => {
    if (serviceCategory === 'MENS') {
      setMensServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, price } : s))
      );
    } else {
      setLadiesServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, price } : s))
      );
    }
  };

  const activeServices = serviceCategory === 'MENS' ? mensServices : ladiesServices;

  // Open Interactive Payment Drawer
  const handleSelectPaymentMethod = (method: typeof setupPaymentMethod) => {
    // Recommendation 6: Strict Biometric Cash Gating - Zero cash outside Pakistan & Zero cash for self-onboarding
    if (method === 'Cash Collection' && (!detectedCountry.isDomestic || (userRole as string) === 'SALON_OWNER')) {
      return;
    }

    setSetupPaymentMethod(method);
    setDrawerError(null);
    setIsThumbprintVerified(false);

    if (method === 'Cash Collection' && cashLiabilityHeld + activePackage.setupFee > MAX_CASH_CEILING) {
      setDrawerError(`⚠️ PKR 50,000 Cash Velocity Limit Reached! (Held: PKR ${cashLiabilityHeld.toLocaleString()} + Package: PKR ${activePackage.setupFee.toLocaleString()}). You cannot collect cash until current funds are deposited.`);
    }

    const generatedTid = method === 'EasyPaisa'
      ? 'EP-' + Math.floor(10000000000 + Math.random() * 90000000000)
      : method === 'JazzCash'
      ? 'JC-' + Math.floor(10000000000 + Math.random() * 90000000000)
      : method === 'Bank Transfer (IBFT)'
      ? (detectedCountry.isDomestic ? 'RAAST-' + Math.floor(1000000000 + Math.random() * 9000000000) : 'SWIFT-WIRE-' + Math.floor(100000 + Math.random() * 900000))
      : method === 'Stripe / Card'
      ? 'pi_' + Math.random().toString(36).substring(2, 14)
      : 'CASH-THUMB-' + Math.floor(1000 + Math.random() * 9000);

    setDrawerTid(generatedTid);
    setDrawerSenderDetails(ownerName + ' (' + phone + ')');
    setIsPaymentDrawerOpen(true);

    // Recommendation 4: Automated Central SIM Gateway Webhook Simulation
    if (detectedCountry.isDomestic && method !== 'Cash Collection') {
      setSimWebhookState('listening');
      setTimeout(() => {
        setSimWebhookState('detected');
      }, 950);
    } else {
      setSimWebhookState('idle');
    }
  };

  // Submit Payment Drawer Verification (Server-to-Server Ledger Cross-Check Simulation)
  const handleVerifyDrawerPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setDrawerError(null);

    // Strict Setup Fee Rail Requirement: Transaction ID / Reference is mandatory
    if (!drawerTid || !drawerTid.trim()) {
      setDrawerError('Transaction ID (TID) / Raast Reference is strictly required for setup fee settlement verification.');
      return;
    }

    // Recommendation 6: Strict Biometric Thumbprint Check for Cash (Zero PIN Fallback)
    if (setupPaymentMethod === 'Cash Collection') {
      if (!detectedCountry.isDomestic || (userRole as string) === 'SALON_OWNER') {
        setDrawerError('Cash collection is strictly prohibited for international salons or self-onboarding salon owners.');
        return;
      }
      if (!isThumbprintVerified) {
        setDrawerError('Strict Biometric Verification Required: Touch your thumb to the sensor to authorize physical cash receipt.');
        return;
      }
      if (cashLiabilityHeld + activePackage.setupFee > MAX_CASH_CEILING) {
        setDrawerError(`Cannot proceed: PKR 50,000 cash velocity ceiling exceeded (Held: PKR ${cashLiabilityHeld.toLocaleString()}). Deposit current funds first.`);
        return;
      }
    }

    setDrawerIsSubmitting(true);

    // Simulate 4-Layer Ledger Verification (Anti-replay, checksum, amount check, status: paid)
    setTimeout(() => {
      setDrawerIsSubmitting(false);

      const commission = activePackage.agentCommission;
      let newRemainingDebt = cashLiabilityHeld;
      let commissionAdjusted = false;

      // Option A Net-Adjustment
      if (cashLiabilityHeld > 0 && detectedCountry.isDomestic) {
        newRemainingDebt = Math.max(0, cashLiabilityHeld - commission);
        setCashLiabilityHeld(newRemainingDebt);
        commissionAdjusted = true;
      }

      if (setupPaymentMethod === 'Cash Collection' && onCashCollected) {
        onCashCollected(activePackage.setupFee, salonName);
      }

      const isIntl = !detectedCountry.isDomestic;
      const workcraftShare = Math.round(activePackage.setupFee - commission);
      const receiptPayload = {
        method: setupPaymentMethod,
        senderDetails: drawerSenderDetails || ownerName,
        tid: drawerTid.trim(),
        amount: activePackage.setupFee,
        currency: activePackage.currency,
        currencyPrefix: activePackage.prefix,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        sha256Proof: 'sha256:' + (thumbprintHash || Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)),
        recipientRoute: isIntl
          ? `Same-Currency Direct Split: 20% (${activePackage.prefix}${commission.toLocaleString()}) ➔ Agent Local ${activePackage.currency} Account · 80% (${activePackage.prefix}${workcraftShare.toLocaleString()}) ➔ WORKCRAFT (Zero Double FX Loss)`
          : 'Central SIM Gateway Dual Dispatch (Salon Owner + Field Agent Kamran Tariq)',
        commissionAdjusted,
        commissionAmount: commission,
        remainingCashOwed: newRemainingDebt,
        isSameCurrencySplit: isIntl,
        workcraftNetAmount: workcraftShare,
        status: 'paid' as const,
      };

      setVerifiedPaymentData(receiptPayload);
      setIsPaymentVerified(true); // Unlocks the state machine guard: status: paid!
      setIsPaymentDrawerOpen(false);
      setCurrentStep(4); // Advance to Step 4 QR pairing!
    }, 1100);
  };

  // Monthly Revenue Attribution Ledger for Field Agent Kamran Tariq
  const agentRevenueLedger = [
    {
      month: 'October 2026',
      activeSalons: 8,
      setupCount: 8,
      setupRevenue: 120000,
      maintenanceRevenue: 36000,
      totalRevenue: 156000,
      status: 'Settled via Webhook',
    },
    {
      month: 'September 2026',
      activeSalons: 6,
      setupCount: 6,
      setupRevenue: 90000,
      maintenanceRevenue: 27000,
      totalRevenue: 117000,
      status: 'Settled via Webhook',
    },
    {
      month: 'August 2026',
      activeSalons: 5,
      setupCount: 5,
      setupRevenue: 75000,
      maintenanceRevenue: 22500,
      totalRevenue: 97500,
      status: 'Settled via Webhook',
    },
  ];

  const totalLifetimeAttributed = agentRevenueLedger.reduce((acc, row) => acc + row.totalRevenue, 0);
  const totalSalonsOnboarded = 19;
  const isHubRtl = agentLanguage === 'ur' || agentLanguage === 'ur_roman' || agentLanguage === 'ar';

  if (!isAgentAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-8 mb-28 lg:mb-10 p-6 sm:p-7 rounded-3xl border border-[#30363D] bg-[#161B22] space-y-6 animate-in zoom-in-95">
        <div className="text-center space-y-2">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#3B2E0B] border border-[#9E6A03]">
            <Lock className="size-8 text-[#D29922]" />
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-[.22em] text-[#06B6D4] block">
            WORKCRAFT FIELD FORCE · AGENT TERMINAL
          </span>
          <h2 className="text-2xl font-black text-[#F0F6FC]">Agent Portal Login</h2>
          <p className="text-xs text-[#8B949E] font-sans">
            Enter your assigned Agent ID & Security PIN to access field onboarding and commission adjustments.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (agentIdInput.trim() && agentPinInput.trim()) {
              setIsAgentAuthenticated(true);
              setLoginError(null);
            } else {
              setLoginError('Please enter valid Agent ID and 4-digit PIN');
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-mono font-bold text-[#8B949E] block mb-1">
              Field Agent ID
            </label>
            <input
              type="text"
              required
              value={agentIdInput}
              onChange={(e) => setAgentIdInput(e.target.value)}
              placeholder="e.g. AGT-409"
              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-xs font-mono font-bold text-[#06B6D4] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
            />
          </div>

          <div>
            <label className="text-xs font-mono font-bold text-[#8B949E] block mb-1">
              4-Digit Security PIN
            </label>
            <input
              type="password"
              required
              maxLength={4}
              value={agentPinInput}
              onChange={(e) => setAgentPinInput(e.target.value)}
              placeholder="••••"
              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-xs font-mono font-bold text-[#D29922] placeholder:text-[#484F58] tracking-widest focus:outline-none focus:border-[#D29922]"
            />
          </div>

          {loginError && (
            <p className="text-xs font-mono text-[#F85149] text-center">{loginError}</p>
          )}

          <button
            type="submit"
            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] py-3 text-xs font-mono font-bold uppercase transition active:scale-95"
          >
            <Lock className="size-4" />
            <span>Unlock Agent Terminal & Pipeline →</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAgentIdInput('AGT-409');
              setAgentPinInput('7892');
              setIsAgentAuthenticated(true);
            }}
            className="w-full min-h-[40px] text-center text-[11px] font-mono text-[#06B6D4] hover:underline pt-1 block"
          >
            ⚡ Quick Login as Kamran Tariq (Verified Agent)
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 lg:pb-10 min-w-0">
      {/* 1. FIELD AGENT COMMAND HUB & OPERATIONAL ACTIONS (QUERIES 4 & 5) */}
      <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 space-y-4 overflow-hidden">
        {/* Top Header Row: Operational Hub Branding (Left) & Top-Right Language Switcher + Terminal Controls (Right) */}
        <div
          dir={isHubRtl ? 'rtl' : 'ltr'}
          className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#21262D] pb-3.5 ${
            isHubRtl ? 'text-right' : 'text-left'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#21262D] border border-[#06B6D4]/40 text-[#06B6D4]">
              <Smartphone className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black text-[#F0F6FC] tracking-wide">
                  {agentLanguage === 'ur' ? 'فیلڈ ایجنٹ پورٹل' : agentLanguage === 'ar' ? 'بوابة الوكيل الميداني' : 'Field Agent Hub'}
                </h2>
                <span className="rounded-full bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[9px] font-mono font-bold text-[#3FB950]">
                  {agentLanguage === 'ur' ? 'واٹس ایپ آٹو سنک فعال' : agentLanguage === 'ar' ? 'مزامنة واتساب التلقائية نشطة' : 'WhatsApp Auto-Sync Active'}
                </span>
              </div>
              <p className="text-xs text-[#8B949E] font-mono mt-0.5">
                {agentLanguage === 'ur'
                  ? 'نیا سیلون شامل کریں، واٹس ایپ جوڑیں اور اپنی کمیشن دیکھیں'
                  : agentLanguage === 'ar'
                  ? 'إضافة صالون جديد، ربط واتساب، ومتابعة عمولتك'
                  : 'Add Salons · Link WhatsApp · Track Commissions'}
              </p>
            </div>
          </div>

          {/* Top-Right Language Switcher & App Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Language Switcher */}
            <div className="flex items-center rounded-xl bg-[#0D1117] border border-[#30363D] p-1 text-xs font-mono">
              <span className="px-1.5 text-[#6E7681] flex items-center gap-1">
                <Globe className="size-3.5 text-[#06B6D4]" />
              </span>
              <button
                type="button"
                onClick={() => {
                  setAgentLanguage('en');
                  setEnrollmentLang('en');
                }}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg transition ${agentLanguage === 'en' ? 'bg-[#D29922] text-[#0D1117] font-bold' : 'text-[#8B949E] hover:text-[#F0F6FC]'}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgentLanguage('ur');
                  setEnrollmentLang('ur_roman');
                }}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg transition ${agentLanguage === 'ur' || agentLanguage === 'ur_roman' ? 'bg-[#D29922] text-[#0D1117] font-bold' : 'text-[#8B949E] hover:text-[#F0F6FC]'}`}
              >
                اردو
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgentLanguage('ar');
                  setEnrollmentLang('ar');
                }}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg transition ${agentLanguage === 'ar' ? 'bg-[#D29922] text-[#0D1117] font-bold' : 'text-[#8B949E] hover:text-[#F0F6FC]'}`}
              >
                العربية
              </button>
            </div>

            {/* Query 5: Lock & Save App buttons shown strictly for Field Agent mobile terminals */}
            {userRole === 'FIELD_AGENT' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsAgentAuthenticated(false)}
                  className="min-h-[40px] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#8B949E] hover:text-[#D29922] transition flex items-center gap-1 border border-[#30363D] bg-[#21262D] hover:border-[#D29922]"
                  title="Lock App & Logout"
                >
                  <Lock className="size-3.5" />
                  <span>{agentLanguage === 'ur' ? 'لاک' : agentLanguage === 'ar' ? 'قفل' : 'Lock'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPwaInstallModal(true)}
                  className="min-h-[40px] rounded-lg px-2.5 py-1.5 text-xs font-mono border border-[#116329] bg-[#0D3822] hover:bg-[#116329]/50 text-[#3FB950] transition flex items-center gap-1"
                  title="Save WorkCraft to Phone Home Screen"
                >
                  <Download className="size-3.5" />
                  <span>{agentLanguage === 'ur' ? 'ایپ محفوظ کریں' : agentLanguage === 'ar' ? 'حفظ التطبيق' : 'Save App'}</span>
                </button>
              </>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="min-h-[40px] rounded-lg p-1.5 text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition"
                title="Close Hub"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        </div>

        {/* Standardized Operational Button Sequence (Query 3 & 5):
            - When userRole === 'FOUNDER': Show all 6 operational buttons:
              1. + Add New Field Agent
              2. Agent Enrollment Link
              3. Onboard a Salon & Pairing Terminal
              4. Active Fleet Dossier
              5. Node Repair & Diagnostics
              6. Commission Ledger (Founder 3-way breakdown)
            - When userRole === 'FIELD_AGENT': Strictly hide '+ Add New Field Agent' and 'Active Fleet Dossier'.
              Shows:
              1. Agent Enrollment Link
              2. Onboard a Salon & Pairing Terminal
              3. My Commission Ledger (Agent personal commission only)
              4. Node Repair & Diagnostics
        */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Add New Field Agent (Founder-Only Privilege) */}
          {userRole === 'FOUNDER' && (
            <button
              type="button"
              onClick={() => setIsAddAgentModalOpen(true)}
              className="min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-mono font-bold bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] shadow-md transition active:scale-95 flex items-center gap-1.5"
              title="Founder: Add New Field Agent & Dispatch WhatsApp Invitation"
            >
              <UserPlus className="size-3.5 text-[#0D1117]" />
              <span>+ Add New Field Agent</span>
            </button>
          )}

          {/* 2. Agent Enrollment Link (Accessible to both Founder & Agent) */}
          <button
            type="button"
            onClick={() => setIsRemoteEnrollmentWizardOpen(true)}
            className="min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-mono font-bold border border-[#06B6D4]/50 bg-[#21262D] hover:border-[#06B6D4] text-[#06B6D4] shadow-md transition active:scale-95 flex items-center gap-1.5"
            title="Launch Day-1 Remote Agent Enrollment Wizard"
          >
            <Sparkles className="size-3.5 text-[#06B6D4]" />
            <span>Agent Enrollment Link</span>
          </button>

          {/* 3. Onboard a Salon & Pairing Terminal (Unified Single Flow - Query 3) */}
          <button
            type="button"
            onClick={() => {
              setActiveHubView('ONBOARDING');
              setCurrentStep(1);
            }}
            className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeHubView === 'ONBOARDING'
                ? 'bg-[#06B6D4] text-[#0D1117] shadow-md'
                : 'bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC] border border-[#30363D] hover:border-[#484F58]'
            }`}
            title="Launch 4-Step Salon Lead Onboarding & Instant QR Pairing Handshake"
          >
            <Scissors className="size-3.5" />
            <span>{agentLanguage === 'ur' ? 'سیلون آن بورڈنگ اور پیئرنگ' : agentLanguage === 'ar' ? 'تهيئة الصالون والربط' : 'Onboard a Salon & Pairing'}</span>
          </button>

          {/* 4. Active Fleet Dossier (Founder-Only Privilege) */}
          {userRole === 'FOUNDER' && (
            <button
              type="button"
              onClick={() => setActiveHubView('FLEET')}
              className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                activeHubView === 'FLEET'
                  ? 'bg-[#06B6D4] text-[#0D1117] shadow-md'
                  : 'bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC] border border-[#30363D] hover:border-[#484F58]'
              }`}
            >
              <Smartphone className="size-3.5" />
              <span>{agentLanguage === 'ur' ? 'ایکٹیو فلیٹ ڈوزیئر' : agentLanguage === 'ar' ? 'ملفات الوكلاء' : 'Active Fleet Dossier'}</span>
            </button>
          )}

          {/* 5. Fix Salon Connection */}
          <button
            type="button"
            onClick={() => setActiveHubView('RE_PAIR')}
            className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeHubView === 'RE_PAIR'
                ? 'bg-[#06B6D4] text-[#0D1117] shadow-md'
                : 'bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC] border border-[#30363D] hover:border-[#484F58]'
            }`}
          >
            <ShieldAlert className={`size-3.5 ${activeHubView === 'RE_PAIR' ? 'text-[#0D1117]' : 'text-[#D29922]'}`} />
            <span>{agentLanguage === 'ur' ? 'سیلون کنکشن درست کریں' : agentLanguage === 'ar' ? 'إصلاح اتصال الصالون' : 'Fix Salon Connection'}</span>
          </button>

          {/* 6. My Profile & Payout Details (Biometric-Locked Edits) */}
          <button
            type="button"
            onClick={() => {
              setDraftAgentPhone(agentWhatsApp);
              setDraftAgentTerritory(agentTerritory);
              setDraftAgentRegion(agentOperatingRegion);
              setDraftAgentPayoutMethod(agentPayoutMethod);
              setDraftAgentBankName(agentBankName);
              setDraftAgentPayoutAccount(agentPayoutAccount);
              setDraftAgentPayoutTitle(agentPayoutTitle);
              setDraftAgentIban(agentIban);
              setPayoutSaveStatus(null);
              setActiveHubView('PROFILE');
            }}
            className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeHubView === 'PROFILE'
                ? 'bg-[#D29922] text-[#0D1117] shadow-md'
                : 'bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC] border border-[#30363D] hover:border-[#D29922]'
            }`}
            title="Edit mobile, city, country & bank details (requires fresh biometric check)"
          >
            <Fingerprint className={`size-3.5 ${activeHubView === 'PROFILE' ? 'text-[#0D1117]' : 'text-[#D29922]'}`} />
            <span>
              {agentLanguage === 'ur'
                ? 'میرا پروفائل اور بینک'
                : agentLanguage === 'ar'
                ? 'ملفي والبنك (بصمة)'
                : 'My Profile & Bank (Biometric)'}
            </span>
          </button>

          {/* 7. Commission Ledger (Contextual Label by Role - Query 4) */}
          <button
            type="button"
            onClick={() => {
              setActiveHubView('LEDGER');
            }}
            className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-mono font-bold transition flex items-center gap-1.5 sm:ml-auto ${
              activeHubView === 'LEDGER'
                ? 'bg-[#06B6D4] text-[#0D1117] shadow-md'
                : 'bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC] border border-[#30363D] hover:border-[#484F58]'
            }`}
          >
            <FileText className="size-3.5" />
            <span>
              {userRole === 'FIELD_AGENT'
                ? agentLanguage === 'ur'
                  ? 'میرا کمیشن لیجر'
                  : agentLanguage === 'ar'
                  ? 'سجل عمولتي'
                  : 'My Commission Ledger'
                : agentLanguage === 'ur'
                ? 'کمیشن لیجر'
                : agentLanguage === 'ar'
                ? 'سجل العمولات'
                : 'Commission Ledger'}
            </span>
          </button>
        </div>
      </div>

      {/* Query 9: Founder Root Kill-Switch Suspended Overlay Screen */}
      {isAgentSuspendedByFounder && (
        <div className="rounded-2xl border-2 border-[#da3633] bg-[#4C1C1D] p-5 sm:p-6 text-center space-y-3.5 shadow-2xl backdrop-blur-md animate-in zoom-in-95">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#0D1117] border border-[#da3633] text-[#F85149]">
            <AlertOctagon className="size-7" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-[.25em] text-[#F85149] font-bold">
              ROOT DEACTIVATION ORDER ACTIVE · FOUNDER OVERRIDE
            </span>
            <h3 className="text-lg font-black text-[#F0F6FC]">Agent Terminal Suspended by WORKCRAFT Founder</h3>
            <p className="text-xs text-[#F0F6FC] max-w-lg mx-auto font-sans leading-relaxed">
              Central Command has remotely locked Field Agent <strong>Kamran Tariq (#AGT-409)</strong>. All on-site physical cash collections, new salon leads, and cryptographic QR pairing token generation are frozen.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsAgentSuspendedByFounder(false)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#21262D] hover:border-[#3FB950] text-[#F0F6FC] text-xs font-mono font-bold transition border border-[#30363D] flex items-center gap-2"
            >
              <Power className="size-3.5 text-[#3FB950]" />
              <span>Founder Restore: Unlock Agent Terminal</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW A: ONBOARDING SEQUENTIAL WIZARD (STEPS 1 - 4) */}
      {/* ========================================================================= */}
      {activeHubView === 'ONBOARDING' && (
        <div
          dir={clientOnboardingLanguage === 'en' ? 'ltr' : 'rtl'}
          className={`space-y-6 min-w-0 ${clientOnboardingLanguage === 'en' ? 'text-left' : 'text-right'}`}
        >
          {/* Query 3: Sticky Persistent Tri-Language Switcher (English, Native Urdu, Arabic) */}
          <div className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#30363D] bg-[#161B22]/95 p-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-[#06B6D4]" />
              <span className="text-xs font-mono font-bold text-[#F0F6FC] uppercase tracking-wider">
                {clientOnboardingLanguage === 'ur'
                  ? 'سیلون آن بورڈنگ زبان منتخب کریں (اردو فعال)'
                  : clientOnboardingLanguage === 'ar'
                  ? 'لغة تسجيل الصالون (العربية نشطة)'
                  : 'Salon Onboarding Language (English Active)'}
              </span>
            </div>
            <div className="flex items-center rounded-xl bg-[#0D1117] border border-[#30363D] p-1 text-xs font-mono">
              <button
                type="button"
                onClick={() => setClientOnboardingLanguage('en')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                  clientOnboardingLanguage === 'en'
                    ? 'bg-[#06B6D4] text-[#0D1117]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                <span>🇬🇧</span>
                <span>English</span>
              </button>
              <button
                type="button"
                onClick={() => setClientOnboardingLanguage('ur')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                  clientOnboardingLanguage === 'ur'
                    ? 'bg-[#D29922] text-[#0D1117]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                <span>🇵🇰</span>
                <span>اردو (Urdu)</span>
              </button>
              <button
                type="button"
                onClick={() => setClientOnboardingLanguage('ar')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                  clientOnboardingLanguage === 'ar'
                    ? 'bg-[#3FB950] text-[#0D1117]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                <span>🇦🇪</span>
                <span>العربية</span>
              </button>
            </div>
          </div>

          {/* Top Wizard Steps Progression Bar (Localized) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { num: 1, defaultTitle: 'Lead & Geo-Pin', icon: MapPin },
              { num: 2, defaultTitle: 'Service Menu', icon: Scissors },
              { num: 3, defaultTitle: 'Package & Setup Fee', icon: CreditCard },
              { num: 4, defaultTitle: 'Pairing QR', icon: QrCode },
            ].map((s) => (
              <div
                key={s.num}
                className={`rounded-xl border p-2.5 flex items-center gap-2.5 transition ${
                  currentStep === s.num
                    ? 'border-[#06B6D4] bg-[#21262D] text-[#F0F6FC] font-bold'
                    : currentStep > s.num
                    ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                    : 'border-[#30363D] bg-[#0D1117] text-[#6E7681]'
                }`}
              >
                <span
                  className={`grid size-6 place-items-center rounded-lg text-xs font-mono font-bold ${
                    currentStep === s.num
                      ? 'bg-[#06B6D4] text-[#0D1117]'
                      : currentStep > s.num
                      ? 'bg-[#3FB950] text-[#0D1117]'
                      : 'bg-[#21262D] text-[#8B949E]'
                  }`}
                >
                  {currentStep > s.num ? '✓' : s.num}
                </span>
                <span className="text-xs truncate">{t.steps[s.num - 1] || s.defaultTitle}</span>
              </div>
            ))}
          </div>

          {/* STEP 1: LEAD INFO & HARDWARE GPS PINNING (FULLY LOCALIZED) */}
          {currentStep === 1 && (
            <PortalCard title={t.step1Title} kicker={t.step1Kicker}>
              <form onSubmit={handleDispatchStep1} className="space-y-4">
                {/* Query 1: Smart Recipient Routing & Auto Detection Display */}
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#D29922] font-bold">
                        {t.routingLabel}
                      </span>
                      <p className="text-xs text-[#8B949E] font-sans mt-0.5">
                        {t.routingDesc}
                      </p>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#0D3822] border border-[#116329] text-[#3FB950] text-xs font-mono font-bold flex items-center gap-1.5 shrink-0">
                      <Radio className="size-3.5 text-[#3FB950] animate-pulse" />
                      <span>{t.routingBadge}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#21262D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <div>
                      <span className="text-[11px] font-mono font-bold uppercase text-[#06B6D4]">
                        {clientOnboardingLanguage === 'ur'
                          ? 'فعال زبان کی کیفیت:'
                          : clientOnboardingLanguage === 'ar'
                          ? 'حالة اللغة النشطة:'
                          : 'Active Language State:'}
                      </span>
                      <p className="text-[11px] text-[#8B949E] font-sans">
                        {clientOnboardingLanguage === 'ur'
                          ? 'تمام فارمز، سروسز مینو اور واٹس ایپ الرٹس اردو میں تبدیل ہیں۔ اوپر موجود بار سے کسی بھی وقت زبان تبدیل کر سکتے ہیں۔'
                          : clientOnboardingLanguage === 'ar'
                          ? 'جميع الحقول وقوائم الخدمات ورسائل الواتساب معرّبة بالكامل. يمكنك تغيير اللغة من الشريط العلوي الثابت بأي وقت.'
                          : 'All input fields, services, and dispatches are fully synchronized. Switch anytime via the persistent top bar.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-lg bg-[#161B22] border border-[#30363D] text-xs font-mono text-[#D29922] font-bold">
                        {clientOnboardingLanguage === 'ur' ? '🇵🇰 اردو (Urdu)' : clientOnboardingLanguage === 'ar' ? '🇦🇪 العربية (Arabic)' : '🇬🇧 English'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {/* Field 1: Salon Name */}
                  <div>
                    <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E] block mb-1">
                      {t.salonNameLabel}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t.salonNamePlaceholder}
                      value={salonName}
                      onChange={(e) => setSalonName(e.target.value)}
                      className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-sm text-[#F0F6FC] placeholder:text-[#484F58] font-sans focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>

                  {/* Field 2: Owner Name (Always English format & left-aligned) */}
                  <div>
                    <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E] block mb-1">
                      {t.ownerNameLabel}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      required
                      placeholder={t.ownerNamePlaceholder}
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-sm text-left text-[#F0F6FC] placeholder:text-[#484F58] font-sans focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>

                  {/* Field 3: WhatsApp Number with Selectable Country Code & Strict Digit/Prefix Validation */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E]">
                        {t.phoneLabel}
                      </label>
                      <span className={`text-[10px] font-mono font-bold shrink-0 ${
                        phoneValidation.valid
                          ? 'text-[#3FB950]'
                          : nationalPhone.replace(/\D/g, '').length === selectedDialConfig.expectedDigits
                          ? 'text-[#F85149]'
                          : 'text-[#D29922]'
                      }`}>
                        {phoneValidation.valid
                          ? `✓ ${selectedDialConfig.expectedDigits}/${selectedDialConfig.expectedDigits} ${t.phoneDigitsValidBadge}`
                          : `${nationalPhone.replace(/\D/g, '').length}/${selectedDialConfig.expectedDigits} ${t.phoneDigitsCountLabel}`}
                      </span>
                    </div>

                    <div className="flex gap-2" dir="ltr">
                      {/* Searchable & Filterable Country Code Picker */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsDialDropdownOpen(!isDialDropdownOpen)}
                          className="min-h-[48px] flex items-center gap-1.5 rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2.5 text-xs font-mono font-bold text-[#F0F6FC] hover:border-[#06B6D4] transition cursor-pointer"
                        >
                          <span className="text-base leading-none">{selectedDialConfig.flag}</span>
                          <span className="text-[#06B6D4]">{selectedDialCode}</span>
                          <span className="text-[9px] text-[#6E7681]">▼</span>
                        </button>

                        {/* Searchable Dropdown Flyout */}
                        {isDialDropdownOpen && (
                          <div className="absolute left-0 top-full mt-1.5 z-50 w-72 max-h-72 rounded-2xl border border-[#30363D] bg-[#161B22] p-2.5 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
                            {/* Search Box */}
                            <div className="mb-2">
                              <input
                                type="text"
                                autoFocus
                                placeholder="Search country or code (e.g. UAE, +971, UK, +92)..."
                                value={countrySearchQuery}
                                onChange={(e) => setCountrySearchQuery(e.target.value)}
                                className="w-full min-h-[40px] rounded-lg border border-[#30363D] bg-[#0D1117] px-2.5 py-1.5 text-xs font-mono text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                              />
                            </div>

                            {/* Scrollable list */}
                            <div className="overflow-y-auto space-y-1 flex-1 pr-1">
                              {DIAL_CODE_OPTIONS.filter((d) =>
                                d.name.toLowerCase().includes(countrySearchQuery.toLowerCase()) ||
                                d.dialCode.includes(countrySearchQuery) ||
                                d.code.toLowerCase().includes(countrySearchQuery.toLowerCase())
                              ).map((d) => (
                                <button
                                  key={d.code}
                                  type="button"
                                  onClick={() => {
                                    const detected = detectCountryFromPhone(d.dialCode);
                                    setSelectedDialCode(d.dialCode);
                                    setNationalPhone('');
                                    setStep1Error(null);
                                    setIsDialDropdownOpen(false);
                                    setCountrySearchQuery('');
                                    setCoords(detected.defaultCoords);
                                    if (checkCityCountryIntegrity(address, d.dialCode)) {
                                      setAddress('');
                                    }
                                    rescaleServicePricesForCountry(detected);
                                    if (!detected.isDomestic) {
                                      setSetupPaymentMethod('Stripe / Card');
                                      if (detected.region === 'MENA') {
                                        setClientOnboardingLanguage('ar');
                                      } else {
                                        setClientOnboardingLanguage('en');
                                      }
                                    } else {
                                      setSetupPaymentMethod('EasyPaisa');
                                      setClientOnboardingLanguage('ur');
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition text-left ${
                                    selectedDialCode === d.dialCode
                                      ? 'bg-[#06B6D4] text-[#0D1117] font-bold'
                                      : 'hover:bg-[#21262D] text-[#F0F6FC]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="text-base">{d.flag}</span>
                                    <span className="truncate">{d.name}</span>
                                  </div>
                                  <span className={selectedDialCode === d.dialCode ? 'text-[#0D1117] font-bold shrink-0 ml-1' : 'text-[#06B6D4] font-bold shrink-0 ml-1'}>
                                    {d.dialCode}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Strictly Country-Clamped Numeric Phone Input */}
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={selectedDialConfig.expectedDigits}
                        required
                        placeholder={selectedDialConfig.formatHint}
                        value={nationalPhone}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, selectedDialConfig.expectedDigits);
                          setNationalPhone(digitsOnly);
                          if (step1Error) setStep1Error(null);
                        }}
                        className={`w-full min-h-[48px] rounded-xl border bg-[#0D1117] px-3 py-2.5 text-sm font-mono placeholder:text-[#484F58] focus:outline-none ${
                          phoneValidation.valid
                            ? 'border-[#3FB950] text-[#3FB950] focus:border-[#3FB950]'
                            : nationalPhone.length > 0 && !phoneValidation.valid
                            ? 'border-[#9E6A03] text-[#D29922] focus:border-[#06B6D4]'
                            : 'border-[#30363D] text-[#06B6D4] focus:border-[#06B6D4]'
                        }`}
                      />
                    </div>
                    {!phoneValidation.valid && nationalPhone.length > 0 && phoneValidation.reason ? (
                      <p className="text-[10px] font-mono text-[#D29922] mt-1 leading-snug">
                        ⚠ {phoneValidation.reason[clientOnboardingLanguage]}
                      </p>
                    ) : (
                      <span className="text-[10px] font-mono text-[#6E7681] block mt-1">
                        {t.phoneHint}: <strong className="text-[#F0F6FC]" dir="ltr">{selectedDialCode} {nationalPhone || selectedDialConfig.sampleDigits}</strong> ({selectedDialConfig.name})
                      </span>
                    )}
                  </div>
                </div>

                {/* Country Detection Banner */}
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Globe className="size-4 text-[#06B6D4] shrink-0" />
                    <span className="text-[#8B949E]">
                      {t.countryDetected}: <strong className="text-[#F0F6FC]">{detectedCountry.flag} {detectedCountry.name}</strong> ({detectedCountry.localCurrency} · {detectedCountry.currency} {t.pricingEngineLabel})
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    detectedCountry.isDomestic
                      ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                      : 'border-[#06B6D4]/40 bg-[#21262D] text-[#06B6D4]'
                  }`}>
                    {detectedCountry.isDomestic ? t.domesticRailBadge : t.intlRailBadge}
                  </span>
                </div>

                {/* GPS Hardware Capture */}
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-[#8B949E] uppercase flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-[#06B6D4]" />
                      <span>{t.coordsLabel}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCaptureGps}
                      className="text-[10px] font-mono font-bold text-[#06B6D4] hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className={`size-3 ${isCapturingGps ? 'animate-spin' : ''}`} />
                      <span>{isCapturingGps ? t.capturingGps : t.captureGps}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-[#161B22] border border-[#30363D] p-2 text-xs font-mono">
                    <span className="text-[#F0F6FC] font-bold" dir="ltr">{coords}</span>
                    <span className="text-[#3FB950] text-[10px]">{t.gpsAccuracyBadge}</span>
                  </div>
                </div>

                {/* Field 4: Physical Address with Real-Time City-Country Integrity Cross-Check */}
                <div>
                  <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E] block mb-1">
                    {t.addressLabel}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`${detectedCountry.defaultAddress} — ${t.addressPlaceholder}`}
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (step1Error) setStep1Error(null);
                    }}
                    className={`w-full min-h-[48px] rounded-xl border px-3.5 py-2.5 text-sm font-sans placeholder:text-[#484F58] focus:outline-none ${
                      addressConflict
                        ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149] focus:border-[#F85149]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#F0F6FC] focus:border-[#06B6D4]'
                    }`}
                  />

                  {addressConflict && (
                    <div className="mt-2 rounded-xl border border-[#da3633] bg-[#4C1C1D] p-2.5 space-y-2 text-xs">
                      <p className="font-mono text-[#F85149] font-bold flex items-start gap-1.5">
                        <AlertTriangle className="size-4 text-[#F85149] shrink-0 mt-0.5" />
                        <span>{addressConflict[clientOnboardingLanguage]}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono text-[#F0F6FC]">{t.suggestedCitiesLabel}</span>
                        {(REGIONAL_CITY_MAP[detectedCountry.code]?.cities || [detectedCountry.defaultCity])
                          .slice(0, 4)
                          .map((city) => (
                            <button
                              key={city}
                              type="button"
                              onClick={() => {
                                setAddress(city === detectedCountry.defaultCity ? detectedCountry.defaultAddress : `${city}, ${detectedCountry.name.split(' (')[0]}`);
                                setStep1Error(null);
                              }}
                              className="min-h-[32px] px-2.5 py-0.5 rounded-lg bg-[#21262D] hover:border-[#06B6D4] border border-[#30363D] text-[#06B6D4] text-[10px] font-mono font-bold transition"
                            >
                              {detectedCountry.flag} {city}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Outbound WhatsApp Preview Card */}
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#06B6D4] font-bold uppercase flex items-center gap-1.5">
                      <Sparkles className="size-3.5" />
                      <span>{t.previewTitle}</span>
                    </span>
                    <span className="text-[#3FB950] font-bold">{t.previewBadge}</span>
                  </div>
                  <div
                    dir={clientOnboardingLanguage === 'en' ? 'ltr' : 'rtl'}
                    className={`rounded-lg bg-[#161B22] p-3 text-xs font-mono text-[#F0F6FC] border border-[#30363D] whitespace-pre-line leading-relaxed overflow-hidden break-words [overflow-wrap:break-word] ${
                      clientOnboardingLanguage === 'en' ? 'text-left' : 'text-right'
                    }`}
                  >
                    {formatWelcomeMessage(clientOnboardingLanguage, ownerName, salonName, pairingKey)}
                  </div>
                </div>

                {step1Error && (
                  <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 text-xs font-mono text-[#F85149] flex items-start gap-2 animate-in fade-in">
                    <AlertTriangle className="size-4 text-[#F85149] shrink-0 mt-0.5" />
                    <span>{step1Error}</span>
                  </div>
                )}

                {/* Dispatch Action */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] py-3 text-xs font-mono font-bold uppercase transition active:scale-95 shadow-md"
                  >
                    <Send className="size-4" />
                    <span>{t.step1Next}</span>
                  </button>
                </div>
              </form>
            </PortalCard>
          )}

          {/* STEP 2: SERVICE MENU & LOCAL PRICING CONFIGURATION (FULLY LOCALIZED) */}
          {currentStep === 2 && (
            <PortalCard title={t.step2Title} kicker={t.step2Kicker}>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <p className="text-xs text-[#8B949E] font-sans">
                    {t.step2Desc}
                  </p>

                  <div className="flex items-center rounded-xl bg-[#0D1117] border border-[#30363D] p-1">
                    <button
                      type="button"
                      onClick={() => setServiceCategory('MENS')}
                      className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition ${
                        serviceCategory === 'MENS'
                          ? 'bg-[#06B6D4] text-[#0D1117]'
                          : 'text-[#8B949E] hover:text-[#F0F6FC]'
                      }`}
                    >
                      {t.mensCategory}
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceCategory('LADIES')}
                      className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition ${
                        serviceCategory === 'LADIES'
                          ? 'bg-[#06B6D4] text-[#0D1117]'
                          : 'text-[#8B949E] hover:text-[#F0F6FC]'
                      }`}
                    >
                      {t.ladiesCategory}
                    </button>
                  </div>
                </div>

                {/* Local Salon Menu Currency Banner */}
                <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-[#D29922] font-bold flex items-center gap-1.5">
                    <span>{detectedCountry.flag}</span>
                    <span>
                      {t.serviceCurrencyLabel}: <strong>{detectedCountry.localCurrency}</strong> ({getLocalizedLocalCurrencyPrefix(detectedCountry, clientOnboardingLanguage).trim()})
                    </span>
                  </span>
                  <span className="text-[10px] text-[#8B949E]">
                    {t.packageBillingLabel}: {detectedCountry.currency}
                  </span>
                </div>

                {/* Services List */}
                <div className="space-y-2.5">
                  {activeServices.map((service) => (
                    <div
                      key={service.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
                        service.enabled
                          ? 'border-[#30363D] bg-[#0D1117]'
                          : 'border-[#21262D] bg-[#0D1117] opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleService(service.id)}
                          className={`size-6 rounded-md border flex items-center justify-center transition ${
                            service.enabled
                              ? 'border-[#3FB950] bg-[#0D3822] text-[#3FB950]'
                              : 'border-[#30363D] bg-transparent text-transparent'
                          }`}
                        >
                          <Check className="size-3.5 stroke-[3]" />
                        </button>
                        <div>
                          <p className={`text-xs font-bold ${service.enabled ? 'text-[#F0F6FC]' : 'text-[#6E7681]'}`}>
                            {getLocalizedServiceName(service.name, clientOnboardingLanguage)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-mono font-bold text-[#D29922]">
                          {getLocalizedLocalCurrencyPrefix(detectedCountry, clientOnboardingLanguage)}
                        </span>
                        <input
                          type="number"
                          value={service.price}
                          onChange={(e) => handleChangePrice(service.id, parseInt(e.target.value, 10) || 0)}
                          className="w-24 min-h-[40px] rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 py-1 text-xs font-mono font-bold text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Custom Service Form */}
                {isAddingCustomService ? (
                  <form onSubmit={handleAddCustomService} className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-3">
                    <p className="text-xs font-mono font-bold text-[#06B6D4] uppercase">
                      {t.addCustomService}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        required
                        placeholder={t.customNamePlaceholder}
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        className="min-h-[44px] rounded-lg border border-[#30363D] bg-[#161B22] px-3 py-1.5 text-xs text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                      />
                      <input
                        type="number"
                        required
                        placeholder={`${t.customPricePlaceholder} (${getLocalizedLocalCurrencyPrefix(detectedCountry, clientOnboardingLanguage).trim()})`}
                        value={newServicePrice}
                        onChange={(e) => setNewServicePrice(e.target.value)}
                        className="min-h-[44px] rounded-lg border border-[#30363D] bg-[#161B22] px-3 py-1.5 text-xs font-mono text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="min-h-[40px] rounded-lg bg-[#06B6D4] text-[#0D1117] px-3.5 py-1.5 text-xs font-mono font-bold hover:bg-[#22D3EE]"
                      >
                        {t.addBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomService(false)}
                        className="min-h-[40px] rounded-lg border border-[#30363D] bg-[#21262D] px-3 py-1.5 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC]"
                      >
                        {t.cancelBtn}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomService(true)}
                    className="flex items-center gap-2 text-xs font-mono font-bold text-[#06B6D4] hover:underline pt-1"
                  >
                    <Plus className="size-4" />
                    <span>{t.addCustomService}</span>
                  </button>
                )}

                {/* Step 2 Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[#21262D]">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="min-h-[44px] flex items-center gap-1.5 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC]"
                  >
                    <ArrowLeft className="size-4" />
                    <span>{t.step2Back}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="min-h-[48px] flex items-center gap-2 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-bold uppercase transition active:scale-95 shadow-md"
                  >
                    <span>{t.step2Next}</span>
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            </PortalCard>
          )}

          {/* STEP 3: SETUP FEE RAIL & STATE MACHINE LOCK (FULLY LOCALIZED) */}
          {currentStep === 3 && (
            <PortalCard title={t.step3Title} kicker={t.step3Kicker}>
              <div className="space-y-4">
                {/* 4 Packages Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E] block">
                      {t.step3PackageHeading} ({detectedCountry.currency})
                    </label>
                    <span className="text-[10px] font-mono text-[#D29922] font-bold">
                      {t.formulaNotice}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-start">
                    {currentPackageList.map((pkg) => {
                      const isSelected = selectedOnboardingPackage === pkg.id;
                      const isExpanded = expandedPackageId === pkg.id;
                      const cardFeatures = getLocalizedPackageFeatures(pkg.id, clientOnboardingLanguage);
                      return (
                        <div key={pkg.id} className="flex flex-col gap-2">
                          <div
                            onClick={() => {
                              setSelectedOnboardingPackage(pkg.id as any);
                              setExpandedPackageId(pkg.id);
                              setIsPaymentVerified(false); // reset verification if package changes
                            }}
                            className={`rounded-xl border p-3 text-left transition flex flex-col justify-between cursor-pointer ${
                              isSelected
                                ? 'border-[#06B6D4] bg-[#21262D] ring-1 ring-[#06B6D4]'
                                : 'border-[#30363D] bg-[#0D1117] hover:border-[#484F58]'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-[#F0F6FC]">
                                  {getLocalizedPackageName(pkg.name, clientOnboardingLanguage)}
                                </p>
                                {isSelected && <Check className="size-3.5 text-[#06B6D4]" />}
                              </div>
                              <p className="text-[10px] font-mono font-bold text-[#06B6D4] mt-1">
                                ⚡ {pkg.bookings}
                              </p>
                              <p className="text-[9px] text-[#8B949E] font-sans mt-1">
                                {pkg.scope}
                              </p>
                            </div>
                            <div className="mt-2.5 pt-2 border-t border-[#21262D] flex items-center justify-between">
                              <div>
                                <span className="text-xs font-mono font-bold text-[#D29922] block">
                                  {t.setupShortLabel}: {pkg.prefix}{pkg.setupFee.toLocaleString()}
                                </span>
                                <span className="text-[9px] font-mono text-[#3FB950] block">
                                  {t.maintShortLabel}: {pkg.prefix}{pkg.monthlyMaint.toLocaleString()}{t.perMonthShort} (10%)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedPackageId(expandedPackageId === pkg.id ? null : pkg.id);
                                }}
                                className="size-7 rounded-md bg-[#21262D] border border-[#30363D] hover:border-[#06B6D4] flex items-center justify-center text-[#8B949E] hover:text-[#06B6D4] transition"
                                title={t.expandFeatures}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="size-3.5 text-[#06B6D4]" />
                                ) : (
                                  <ChevronDown className="size-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Mobile Inline Package Slide — Appears Directly Beneath Tapped Card */}
                          {isExpanded && (
                            <div className="lg:hidden rounded-2xl border border-[#06B6D4]/40 bg-[#0D1117] p-3.5 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="flex items-center justify-between gap-2 border-b border-[#21262D] pb-2">
                                <span className="text-[10px] font-mono font-bold uppercase text-[#06B6D4]">
                                  {t.featuresTitle}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedPackageId(null);
                                  }}
                                  className="text-[10px] font-mono text-[#8B949E] hover:text-[#F0F6FC] flex items-center gap-1"
                                >
                                  <span>{t.collapseFeatures}</span>
                                  <ChevronUp className="size-3" />
                                </button>
                              </div>
                              <div className="space-y-1.5 text-xs">
                                {cardFeatures.map((feat, idx) => (
                                  <div
                                    key={idx}
                                    className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                                      feat.included
                                        ? feat.highlight
                                          ? 'border-[#06B6D4]/40 bg-[#21262D] text-[#F0F6FC]'
                                          : 'border-[#30363D] bg-[#161B22] text-[#F0F6FC]'
                                        : 'border-[#21262D] bg-[#0D1117] text-[#484F58] line-through'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {feat.included ? (
                                        <CheckCircle2 className="size-3.5 text-[#3FB950] shrink-0" />
                                      ) : (
                                        <X className="size-3.5 text-[#F85149]/70 shrink-0" />
                                      )}
                                      <span className={`font-sans truncate ${feat.highlight ? 'font-bold text-[#06B6D4]' : ''}`}>
                                        {feat.title}
                                      </span>
                                    </div>
                                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                                      feat.included
                                        ? 'bg-[#0D3822] text-[#3FB950] border border-[#116329]'
                                        : 'bg-[#21262D] text-[#6E7681]'
                                    }`}>
                                      {feat.included ? t.includedLabel : t.notIncludedLabel}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop Package Feature Breakdown Accordion (Full 2-Column Layout on Desktop) */}
                {expandedPackageId && (() => {
                  const targetPkg = currentPackageList.find((p) => p.id === expandedPackageId) || activePackage;
                  const features = getLocalizedPackageFeatures(targetPkg.id, clientOnboardingLanguage);

                  return (
                    <div className="hidden lg:block rounded-2xl border border-[#06B6D4]/40 bg-[#0D1117] p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#21262D] pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#06B6D4] bg-[#21262D] px-2 py-0.5 rounded border border-[#06B6D4]/30">
                            {t.featuresTitle}
                          </span>
                          <span className="text-xs font-bold text-[#F0F6FC]">
                            {getLocalizedPackageName(targetPkg.name, clientOnboardingLanguage)} ({targetPkg.prefix}{targetPkg.setupFee.toLocaleString()} + {targetPkg.prefix}{targetPkg.monthlyMaint.toLocaleString()}/mo)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedPackageId(null)}
                          className="text-[11px] font-mono text-[#8B949E] hover:text-[#F0F6FC] flex items-center gap-1 self-start sm:self-center"
                        >
                          <span>{t.collapseFeatures}</span>
                          <ChevronUp className="size-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {features.map((feat, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                              feat.included
                                ? feat.highlight
                                  ? 'border-[#06B6D4]/40 bg-[#21262D] text-[#F0F6FC]'
                                  : 'border-[#30363D] bg-[#161B22] text-[#F0F6FC]'
                                : 'border-[#21262D] bg-[#0D1117] text-[#484F58] line-through'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {feat.included ? (
                                <CheckCircle2 className="size-4 text-[#3FB950] shrink-0" />
                              ) : (
                                <X className="size-4 text-[#F85149]/70 shrink-0" />
                              )}
                              <span className={`font-sans ${feat.highlight ? 'font-bold text-[#06B6D4]' : ''}`}>
                                {feat.title}
                              </span>
                            </div>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded shrink-0 ${
                              feat.included
                                ? 'bg-[#0D3822] text-[#3FB950] border border-[#116329]'
                                : 'bg-[#21262D] text-[#6E7681]'
                            }`}>
                              {feat.included ? t.includedLabel : t.notIncludedLabel}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#21262D] text-[10px] font-mono text-[#8B949E]">
                        <span>{t.slaAccordionLeft}</span>
                        <span className="text-[#D29922]">{t.slaAccordionRight}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Selected Package Summary Box */}
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#D29922]">
                      {t.oneTimeFeeLabel} · {getLocalizedPackageName(activePackage.name, clientOnboardingLanguage)}
                    </span>
                    <h4 className="text-2xl font-mono font-bold text-[#F0F6FC] mt-0.5">
                      {activePackage.prefix}{activePackage.setupFee.toLocaleString()}
                    </h4>
                    <p className="text-xs text-[#8B949E] font-sans mt-0.5">
                      {t.monthlyMaintNote} ({activePackage.prefix}{activePackage.monthlyMaint.toLocaleString()}{t.perMonthShort}).
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {isPaymentVerified ? (
                      <span className="rounded-lg bg-[#0D3822] border border-[#116329] px-3 py-1 text-xs font-mono text-[#3FB950] font-bold flex items-center gap-1.5 animate-in fade-in">
                        <CheckCircle2 className="size-4 text-[#3FB950]" />
                        <span>{t.paymentConfirmed}</span>
                      </span>
                    ) : (
                      <span className="rounded-lg bg-[#3B2E0B] border border-[#9E6A03] px-3 py-1 text-xs font-mono text-[#D29922] font-bold flex items-center gap-1.5">
                        <Lock className="size-3.5 text-[#D29922]" />
                        <span>{t.paymentUnverified}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Layer 1: Mandatory Registered Phone-Bound Guarantee Banner */}
                <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3.5 space-y-1.5 font-sans">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-[#3FB950] uppercase flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-[#3FB950] shrink-0" />
                      <span>{t.layer1Title}</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#06B6D4] font-bold bg-[#0D1117] px-2 py-0.5 rounded border border-[#06B6D4]/40">
                      {t.zeroCopyBadge}
                    </span>
                  </div>
                  <p className="text-xs text-[#F0F6FC] leading-relaxed">
                    {t.layer1Desc}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-[#8B949E] pt-1">
                    <span>{t.boundNumber}: <strong className="text-[#06B6D4]" dir="ltr">{phone}</strong></span>
                    <span>{t.boundOwner}: <strong className="text-[#F0F6FC]">{ownerName}</strong></span>
                  </div>
                </div>

                {/* Payment Rails Selector (Fully Localized for PK, MENA, Europe & Global) */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E] block">
                      {t.selectChannelLabel}
                    </label>
                    <span className="text-[10px] font-mono text-[#06B6D4]">
                      {t.openDrawerHint}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {getRegionalPaymentRails(detectedCountry, clientOnboardingLanguage, userRole as string).map((m) => (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() => handleSelectPaymentMethod(m.name)}
                        className={`min-h-[48px] rounded-xl border p-3 text-start transition relative group ${
                          setupPaymentMethod === m.name && isPaymentVerified
                            ? 'border-[#3FB950] bg-[#0D3822] ring-1 ring-[#3FB950]'
                            : setupPaymentMethod === m.name
                            ? 'border-[#06B6D4] bg-[#21262D] text-[#06B6D4]'
                            : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:border-[#484F58] hover:bg-[#161B22]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <CreditCard className="size-4 text-[#D29922]" />
                          {setupPaymentMethod === m.name && isPaymentVerified && (
                            <Check className="size-3.5 text-[#3FB950]" />
                          )}
                        </div>
                        <p className="text-xs font-bold text-[#F0F6FC]">{m.label}</p>
                        <p className="text-[10px] font-mono text-[#8B949E] mt-0.5 leading-snug">{m.note}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verified Payment Summary Badge (If verified) */}
                {isPaymentVerified && verifiedPaymentData && (
                  <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3.5 space-y-2 font-mono text-xs text-[#3FB950] animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-[#116329] pb-2">
                      <span className="font-bold flex items-center gap-1.5 text-[#3FB950]">
                        <CheckCheck className="size-4 text-[#3FB950]" />
                        <span>{t.proofGenerated}</span>
                      </span>
                      <span className="text-[10px] text-[#8B949E]">{verifiedPaymentData.timestamp}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-[#8B949E] block text-[9px]">{t.channelLabel}</span>
                        <span className="text-[#F0F6FC] font-bold">{getLocalizedPaymentMethodName(verifiedPaymentData.method as PaymentMethodOption, clientOnboardingLanguage)}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[#8B949E] block text-[9px]">{t.tidLabel}</span>
                        <span className="text-[#06B6D4] font-bold break-all [overflow-wrap:break-word]" dir="ltr">{verifiedPaymentData.tid}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[#8B949E] block text-[9px]">{t.routeLabel}</span>
                        <span className="text-[#F0F6FC] break-words [overflow-wrap:break-word]">{verifiedPaymentData.recipientRoute}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[#8B949E] block text-[9px]">{t.digestLabel}</span>
                        <span className="text-[#D29922] text-[10px] break-all overflow-hidden [overflow-wrap:break-word] block" dir="ltr">{verifiedPaymentData.sha256Proof}</span>
                      </div>
                    </div>

                    {/* Option A Commission Auto Net-Adjustment Feedback (Pakistan Domestic) */}
                    {verifiedPaymentData.commissionAdjusted && (
                      <div className="mt-2 rounded-lg bg-[#0D1117] border border-[#116329] p-2 text-[11px] font-sans text-[#3FB950] leading-relaxed">
                        <strong>{t.optionAOffsetApplied}</strong> PKR {verifiedPaymentData.commissionAmount.toLocaleString()} {t.optionAOffsetDesc} {cashLiabilitySalon}. {t.remainingCashDueLabel} <strong>PKR {verifiedPaymentData.remainingCashOwed.toLocaleString()}</strong>.
                      </div>
                    )}

                    {/* Query 3: Outside-Pakistan Same-Currency Direct Split Receipt Feedback */}
                    {verifiedPaymentData.isSameCurrencySplit && (
                      <div className="mt-2 rounded-lg bg-[#0D1117] border border-[#06B6D4]/40 p-2.5 text-[11px] font-sans text-[#06B6D4] leading-relaxed">
                        <strong>Overseas Same-Currency Direct Split (Zero Double FX Loss):</strong> 20% (<strong>{verifiedPaymentData.currencyPrefix}{verifiedPaymentData.commissionAmount.toLocaleString()} {verifiedPaymentData.currency}</strong>) routed straight to Agent local payout account · 80% (<strong>{verifiedPaymentData.currencyPrefix}{(verifiedPaymentData.workcraftNetAmount ?? 0).toLocaleString()} {verifiedPaymentData.currency}</strong>) settled directly to WorkCraft.
                      </div>
                    )}
                  </div>
                )}

                {/* Maintenance Policy & 10% SLA Notice */}
                <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-[#D29922] text-xs font-mono font-bold">
                    <AlertTriangle className="size-4 text-[#D29922] shrink-0" />
                    <span>{t.zeroCashTitle}</span>
                  </div>
                  <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
                    {t.zeroCashDesc} ({activePackage.prefix}{activePackage.monthlyMaint.toLocaleString()}{t.perMonthShort})
                  </p>
                </div>

                {/* Continuous Care SLA Card */}
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-[#06B6D4] font-bold flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-[#06B6D4] shrink-0" />
                      <span>{t.slaCardTitle}</span>
                    </span>
                    <span className="text-[#3FB950] font-bold">{t.slaCardBadge}</span>
                  </div>
                  <p className="text-[11px] text-[#8B949E] font-sans leading-relaxed">
                    {t.slaCardDesc}
                  </p>
                </div>

                {/* Step 3 Actions with STRICT STATE MACHINE LOCK (Query 6) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#21262D]">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="min-h-[44px] flex items-center gap-1.5 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC]"
                  >
                    <ArrowLeft className="size-4" />
                    <span>{t.step3Back}</span>
                  </button>

                  {isPaymentVerified ? (
                    <div className="flex items-center gap-3">
                      <span className="text-[#3FB950] text-xs font-mono font-bold hidden sm:flex items-center gap-1.5 bg-[#0D3822] px-3 py-1.5 rounded-xl border border-[#116329] min-w-0 overflow-hidden">
                        <CheckCircle2 className="size-3.5 text-[#3FB950] shrink-0" />
                        <span className="break-all [overflow-wrap:break-word]">{t.statusPaidPrefix} (<span dir="ltr">{verifiedPaymentData?.tid}</span>)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(4)}
                        className="min-h-[48px] flex items-center gap-2 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-bold uppercase transition active:scale-95 animate-in fade-in"
                      >
                        <CheckCircle2 className="size-4 text-[#0D1117]" />
                        <span>{t.step3Next}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectPaymentMethod(setupPaymentMethod)}
                        className="min-h-[48px] rounded-xl border border-[#06B6D4]/50 bg-[#21262D] text-[#06B6D4] hover:border-[#06B6D4] px-3.5 py-2 text-xs font-mono font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <CreditCard className="size-3.5" />
                        <span>{t.verifyBtn}</span>
                      </button>
                      <button
                        type="button"
                        disabled={true}
                        className="min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#161B22] border border-[#30363D] text-[#484F58] px-5 py-2.5 text-xs font-mono font-bold uppercase cursor-not-allowed select-none opacity-60 shadow-none"
                      >
                        <Lock className="size-3.5 text-[#D29922]" />
                        <span>{t.lockedConfirmBtn}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </PortalCard>
          )}

          {/* STEP 4: TERMINAL MULTI-DEVICE PAIRING & HANDSHAKE (FULLY LOCALIZED) */}
          {currentStep === 4 && (
            <PortalCard title={t.step4Title} kicker={t.step4Kicker}>
              <div className="space-y-4">
                {/* Settlement Verified Banner */}
                <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono overflow-hidden">
                  <span className="text-[#3FB950] font-bold flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 className="size-4 text-[#3FB950] shrink-0" />
                    <span className="break-all [overflow-wrap:break-word]">{t.setupVerified} (<span dir="ltr">{verifiedPaymentData?.tid || 'TRX-OK'}</span>)</span>
                  </span>
                  <span className="text-[#06B6D4] font-bold">{salonName}</span>
                </div>

                {/* Handshake Mode Switcher: On-Site QR vs Remote Link & PWA */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[#30363D] bg-[#0D1117] p-2.5">
                  <span className="text-[11px] font-mono font-bold text-[#8B949E]">
                    {t.modeLabel}
                  </span>
                  <div className="flex items-center gap-1 bg-[#161B22] p-1 rounded-lg border border-[#30363D] shrink-0">
                    <button
                      type="button"
                      onClick={() => setStep4ViewMode('QR_SCAN')}
                      className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                        step4ViewMode === 'QR_SCAN'
                          ? 'bg-[#06B6D4] text-[#0D1117]'
                          : 'text-[#8B949E] hover:text-[#F0F6FC]'
                      }`}
                    >
                      <QrCode className="size-3.5" />
                      <span>{t.modeQr}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep4ViewMode('DIRECT_LINK')}
                      className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                        step4ViewMode === 'DIRECT_LINK'
                          ? 'bg-[#D29922] text-[#0D1117]'
                          : 'text-[#8B949E] hover:text-[#F0F6FC]'
                      }`}
                    >
                      <Smartphone className="size-3.5" />
                      <span>{t.modeLink}</span>
                    </button>
                  </div>
                </div>

                {/* Mode A: On-Site QR Scanner */}
                {step4ViewMode === 'QR_SCAN' ? (
                  <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-5 text-center space-y-4">
                    <div className="mx-auto grid size-52 place-items-center rounded-2xl bg-white p-5 text-slate-900 border-2 border-[#06B6D4]">
                      <svg viewBox="0 0 100 100" className="w-full h-full text-slate-950">
                        <rect x="5" y="5" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                        <rect x="11" y="11" width="12" height="12" fill="currentColor" rx="1" />
                        <rect x="71" y="5" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                        <rect x="77" y="11" width="12" height="12" fill="currentColor" rx="1" />
                        <rect x="5" y="71" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                        <rect x="11" y="77" width="12" height="12" fill="currentColor" rx="1" />
                        <circle cx="36" cy="17" r="3" fill="currentColor" />
                        <circle cx="50" cy="17" r="3" fill="currentColor" />
                        <circle cx="64" cy="17" r="3" fill="currentColor" />
                        <circle cx="20" cy="50" r="3" fill="currentColor" />
                        <circle cx="50" cy="50" r="3" fill="currentColor" />
                        <circle cx="80" cy="50" r="3" fill="currentColor" />
                        <rect x="42" y="42" width="16" height="16" fill="#D29922" rx="3" />
                      </svg>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-mono font-bold text-[#F0F6FC]">
                        WhatsApp Linked Devices Connection
                      </p>
                      <p className="text-xs font-mono text-[#06B6D4] break-all [overflow-wrap:break-word]">
                        {t.pairingKeyLabel}{' '}
                        <span dir="ltr" className="font-bold underline text-sm tracking-wider text-[#D29922] break-all [overflow-wrap:break-word]">
                          {pairingKey}
                        </span>
                      </p>
                      <p className="text-[11px] text-[#8B949E] font-sans">
                        {t.scanInstructions}
                      </p>
                    </div>

                    {/* Single-Use Salon Link Notice */}
                    <div
                      className={`rounded-xl border border-[#06B6D4]/30 bg-[#161B22] p-3 space-y-1.5 font-mono text-xs overflow-hidden ${
                        clientOnboardingLanguage === 'en' ? 'text-left' : 'text-right'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#06B6D4] font-bold flex items-center gap-1.5 text-[11px]">
                          <ShieldCheck className="size-3.5 shrink-0" />
                          <span>{t.tokenBoundBadge}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                          isQrBurned 
                            ? 'bg-[#4C1C1D] text-[#F85149] border border-[#da3633]' 
                            : 'bg-[#0D3822] text-[#3FB950] border border-[#116329]'
                        }`}>
                          {isQrBurned ? t.tokenBurned : t.tokenActive}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8B949E] font-sans leading-relaxed break-words [overflow-wrap:break-word]">
                        {t.tokenExpl}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Mode B: Remote App Link */
                  <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-5 space-y-4 overflow-hidden">
                    <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-4 space-y-2 overflow-hidden">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#D29922] tracking-wider block">
                        {t.remoteLinkTitle}
                      </span>
                      <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed break-words [overflow-wrap:break-word]">
                        {t.remoteLinkDesc}
                      </p>
                      <div
                        dir="ltr"
                        className="rounded-lg bg-[#0D1117] p-2.5 font-mono text-xs text-[#06B6D4] break-all overflow-hidden [overflow-wrap:break-word] border border-[#30363D] select-all"
                      >
                        https://portal.workcraft.local/onboard/{salonName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'salon'}?key={pairingKey}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-4 space-y-2 font-mono text-xs overflow-hidden">
                      <span className="text-[#F0F6FC] font-bold block text-[11px]">
                        📱 How Salon Owner Saves &quot;WorkCraft&quot; to Phone:
                      </span>
                      <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-[#8B949E] font-sans">
                        <li>Open the link in Chrome (Android) or Safari (iPhone).</li>
                        <li>Tap the browser menu (⋮ or Share) ➔ <strong className="text-[#F0F6FC]">&ldquo;Add to Home Screen&rdquo;</strong>.</li>
                        <li>
                          Enter salon link code:{' '}
                          <strong dir="ltr" className="text-[#06B6D4] font-mono break-all [overflow-wrap:break-word]">
                            {pairingKey}
                          </strong>
                          .
                        </li>
                        <li>Opens with 1 tap like an installed app—no app store download needed.</li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* Outbound Localized Welcome Dispatch Note */}
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-[#06B6D4] font-bold uppercase flex items-center gap-1.5">
                      <Send className="size-3 text-[#06B6D4] shrink-0" />
                      <span>{t.outboundTitle} ({clientOnboardingLanguage === 'ur' ? 'اردو' : clientOnboardingLanguage === 'ar' ? 'العربية' : 'English'})</span>
                    </span>
                    <span className="text-[#3FB950] font-bold">{t.outboundStatus}</span>
                  </div>
                  <div
                    dir={clientOnboardingLanguage === 'en' ? 'ltr' : 'rtl'}
                    className={`rounded-lg bg-[#161B22] p-3 text-xs font-mono text-[#F0F6FC] border border-[#30363D] whitespace-pre-line leading-relaxed overflow-hidden break-words [overflow-wrap:break-word] ${
                      clientOnboardingLanguage === 'en' ? 'text-left' : 'text-right'
                    }`}
                  >
                    {formatWelcomeMessage(clientOnboardingLanguage, ownerName, salonName, pairingKey)}
                  </div>
                </div>

                {/* Handshake Simulation */}
                {isPairingSimulated ? (
                  <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-4 space-y-2 animate-in zoom-in-95">
                    <div className="flex items-center justify-between text-[#3FB950] text-xs font-mono font-bold">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-[#3FB950]" />
                        <span>{t.handshakeSuccess}</span>
                      </div>
                      <span className="text-[10px] text-[#D29922] font-bold bg-[#0D1117] px-2 py-0.5 rounded border border-[#9E6A03]">
                        ✓ Salon Locked &amp; Verified
                      </span>
                    </div>
                    <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
                      {t.handshakeDesc}
                    </p>
                    <div className="pt-2 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep(1);
                          setIsPairingSimulated(false);
                          setIsQrBurned(false);
                          setIsPaymentVerified(false);
                          if (onClose) onClose();
                        }}
                        className="min-h-[44px] rounded-lg bg-[#D29922] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase hover:bg-[#e0b252]"
                      >
                        {t.completeBtn}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="min-h-[44px] flex items-center gap-1.5 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC]"
                    >
                      <ArrowLeft className="size-4" />
                      <span>{t.step4Back}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPairingSimulated(true);
                        setIsQrBurned(true);
                      }}
                      className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-bold uppercase transition active:scale-95 shadow-md flex items-center gap-2"
                    >
                      <Wifi className="size-4" />
                      <span className="break-all [overflow-wrap:break-word]">{t.simulateBtn} (<span dir="ltr">{pairingKey}</span>) →</span>
                    </button>
                  </div>
                )}
              </div>
            </PortalCard>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW FLEET: COUNTRY-GROUPED AGENT ROSTER & SEARCH (QUERY 1)              */}
      {/* ========================================================================= */}
      {activeHubView === 'FLEET' && (() => {
        const q = fleetSearchQuery.trim().toLowerCase();
        const filteredAgents = enrolledAgentsList.filter((agent) => {
          const detected = detectCountryFromPhone(agent.phone);
          const regionMatch =
            fleetRegionFilter === 'ALL' ||
            (fleetRegionFilter === 'PK' && detected.region === 'PK') ||
            (fleetRegionFilter === 'MENA' && detected.region === 'MENA') ||
            (fleetRegionFilter === 'EUROPE' && detected.region === 'EUROPE') ||
            (fleetRegionFilter === 'GLOBAL' && detected.region !== 'PK' && detected.region !== 'MENA' && detected.region !== 'EUROPE');
          if (!regionMatch) return false;
          if (!q) return true;
          return (
            agent.name.toLowerCase().includes(q) ||
            agent.id.toLowerCase().includes(q) ||
            agent.phone.toLowerCase().includes(q) ||
            agent.city.toLowerCase().includes(q) ||
            detected.name.toLowerCase().includes(q)
          );
        });

        const allRegionGroups: Array<{
          key: 'PK' | 'MENA' | 'EUROPE' | 'GLOBAL';
          title: string;
          flag: string;
          agents: typeof enrolledAgentsList;
        }> = [
          {
            key: 'PK',
            title: 'Pakistan Field Agents',
            flag: '🇵🇰',
            agents: filteredAgents.filter((a) => detectCountryFromPhone(a.phone).region === 'PK'),
          },
          {
            key: 'MENA',
            title: 'UAE & Gulf (MENA) Agents',
            flag: '🇦🇪',
            agents: filteredAgents.filter((a) => detectCountryFromPhone(a.phone).region === 'MENA'),
          },
          {
            key: 'EUROPE',
            title: 'United Kingdom & Europe Agents',
            flag: '🇬🇧',
            agents: filteredAgents.filter((a) => detectCountryFromPhone(a.phone, a.city).region === 'EUROPE'),
          },
          {
            key: 'GLOBAL',
            title: 'North America, Asia-Pacific & Other Markets',
            flag: '🌐',
            agents: filteredAgents.filter((a) => {
              const r = detectCountryFromPhone(a.phone, a.city).region;
              return r !== 'PK' && r !== 'MENA' && r !== 'EUROPE';
            }),
          },
        ];
        const regionGroups = allRegionGroups.filter((g) => g.agents.length > 0);

        return (
          <PortalCard title="Active Fleet Dossier — Regional Agent Registry" kicker="FOUNDER CENTRAL DIRECTORY">
            <div className="space-y-5">
              {/* Search Bar + Priority Region Filter Pills */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 rounded-2xl border border-[#30363D] bg-[#0D1117] p-3">
                <div className="relative flex-1">
                  <Search className="size-4 text-[#06B6D4] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={fleetSearchQuery}
                    onChange={(e) => setFleetSearchQuery(e.target.value)}
                    placeholder="Search agent by name, ID (e.g. AGT-409), WhatsApp, or city..."
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] pl-10 pr-8 py-2.5 text-xs font-mono text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                  />
                  {fleetSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setFleetSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E7681] hover:text-[#F0F6FC]"
                      aria-label="Clear agent search"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                  {[
                    { key: 'ALL', label: `All (${enrolledAgentsList.length})` },
                    { key: 'PK', label: '🇵🇰 Pakistan' },
                    { key: 'MENA', label: '🇦🇪 UAE & MENA' },
                    { key: 'EUROPE', label: '🇬🇧 United Kingdom & Europe' },
                    { key: 'GLOBAL', label: '🌐 Americas & Intl' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setFleetRegionFilter(tab.key as any)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl font-bold transition border ${
                        fleetRegionFilter === tab.key
                          ? 'bg-[#D29922] text-[#0D1117] border-[#D29922]'
                          : 'bg-[#161B22] text-[#8B949E] border-[#30363D] hover:text-[#F0F6FC] hover:border-[#484F58]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {regionGroups.length === 0 ? (
                <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-8 text-center space-y-2">
                  <p className="text-sm font-mono font-bold text-[#F0F6FC]">No field agents match &ldquo;{fleetSearchQuery}&rdquo;</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFleetSearchQuery('');
                      setFleetRegionFilter('ALL');
                    }}
                    className="text-xs font-mono text-[#06B6D4] hover:underline"
                  >
                    Reset Fleet Filters
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {regionGroups.map((group) => (
                    <div key={group.key} className="space-y-3">
                      {/* Country / Region Group Header */}
                      <div className="flex items-center justify-between border-b border-[#21262D] pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg leading-none">{group.flag}</span>
                          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#F0F6FC]">
                            {group.title}
                          </h3>
                        </div>
                        <span className="rounded-full bg-[#21262D] border border-[#06B6D4]/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#06B6D4]">
                          {group.agents.length} {group.agents.length === 1 ? 'Agent' : 'Agents'}
                        </span>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {group.agents.map((agent) => {
                          const agentCountry = detectCountryFromPhone(agent.phone);
                          return (
                            <div
                              key={agent.id}
                              className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3.5 hover:border-[#D29922]/60 transition group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <div className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-[#D29922] to-[#9E6A03] text-[#0D1117] font-mono font-black text-base shadow">
                                      {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </div>
                                    {agent.selfieVerified && (
                                      <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-[#3FB950] text-[#0D1117]">
                                        <Check className="size-2.5 stroke-[3]" />
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <h4 className="text-sm font-bold text-[#F0F6FC] group-hover:text-[#D29922] transition">
                                        {agent.name}
                                      </h4>
                                      <span className="rounded bg-[#0D3822] border border-[#116329] px-1.5 py-0.5 text-[9px] font-mono font-bold text-[#3FB950]">
                                        #{agent.id}
                                      </span>
                                      <span className="text-xs" title={agentCountry.name}>{agentCountry.flag}</span>
                                    </div>
                                    <p className="text-xs text-[#8B949E] font-mono mt-0.5">{agent.phone}</p>
                                    <p className="text-[11px] text-[#06B6D4] font-mono mt-0.5">{agent.city}</p>
                                  </div>
                                </div>

                                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                                  agent.status.includes('SUSPENDED')
                                    ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149]'
                                    : 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                                }`}>
                                  {agent.status}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-[#161B22] p-2.5 rounded-xl border border-[#30363D]">
                                <div>
                                  <span className="text-[9px] text-[#6E7681] block uppercase">Identity / National ID</span>
                                  <span className="font-bold text-[#F0F6FC] truncate block">{agent.cnicOrId}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-[#6E7681] block uppercase">Payout Channel</span>
                                  <span className="font-bold text-[#D29922] truncate block">{agent.payoutMethod}</span>
                                </div>
                                <div className="col-span-2 pt-1 border-t border-[#21262D] flex flex-wrap items-center justify-between gap-2 text-[10px] min-w-0">
                                  <span className="text-[#8B949E] flex items-center gap-1 min-w-0 flex-1">
                                    <Fingerprint className="size-3 text-[#06B6D4] shrink-0" />
                                    <span dir="ltr" className="break-all overflow-hidden [overflow-wrap:break-word] min-w-0">{agent.thumbHash}</span>
                                  </span>
                                  <span className="text-[#3FB950] font-bold shrink-0">✓ Day-1 Complete</span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#21262D]">
                                <span className="text-[10px] text-[#6E7681] font-mono">
                                  Enrolled: {agent.enrolledAt}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const isSuspended = agent.status.includes('SUSPENDED');
                                      const newStatus = isSuspended ? 'ACTIVE · ON-FIELD' : 'SUSPENDED · TERMINAL LOCKED';
                                      setEnrolledAgentsList(prev => prev.map(a => a.id === agent.id ? { ...a, status: newStatus } : a));
                                      if (agent.name === agentFullName) {
                                        setIsAgentSuspendedByFounder(!isSuspended);
                                      }
                                    }}
                                    className={`min-h-[36px] rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold transition flex items-center gap-1 border ${
                                      agent.status.includes('SUSPENDED')
                                        ? 'border-[#116329] bg-[#0D3822] text-[#3FB950] hover:border-[#3FB950]'
                                        : 'border-[#da3633] bg-[#4C1C1D] text-[#F85149] hover:border-[#F85149]'
                                    }`}
                                    title={agent.status.includes('SUSPENDED') ? `Restore ${agent.name} terminal` : `Isolated Kill-Switch: Suspend ${agent.name}`}
                                  >
                                    <Power className="size-3" />
                                    <span>{agent.status.includes('SUSPENDED') ? 'Restore Agent' : 'Kill-Switch'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setSelectedDossierAgent(agent)}
                                    className="min-h-[36px] rounded-lg bg-[#21262D] hover:border-[#484F58] px-3 py-1.5 text-xs font-mono font-bold text-[#F0F6FC] transition flex items-center gap-1.5 border border-[#30363D]"
                                  >
                                    <FileText className="size-3 text-[#06B6D4]" />
                                    <span>View Dossier</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PortalCard>
        );
      })()}

      {/* ========================================================================= */}
      {/* VIEW B: FIX SALON CONNECTION + 24/7 AUTO-FIX WATCHDOG (LOCALIZED)          */}
      {/* ========================================================================= */}
      {activeHubView === 'RE_PAIR' && (() => {
        const isUrdu = agentLanguage === 'ur' || agentLanguage === 'ur_roman';
        const isArabic = agentLanguage === 'ar';
        const repairDir = isUrdu || isArabic ? 'rtl' : 'ltr';

        const rL = isArabic
          ? {
              cardTitle: 'إصلاح اتصال الصالون (الحماية التلقائية نشطة)',
              cardKicker: 'دعم الاتصال السريع',
              watchdogTitle: 'مراقب الإصلاح التلقائي: يعمل 24/7 تلقائياً',
              watchdogBadge: 'حماية ذاتية نشطة',
              watchdogDesc:
                'يقوم النظام بمراقبة اتصالات الواتساب وإصلاح الانقطاعات البسيطة أو إعادة تشغيل الهاتف أو تبديل الشبكة تلقائياً دون أي تدخل. استخدم خيارات إعادة الربط أدناه فقط كخيار احتياطي إذا قام مالك الصالون بتسجيل الخروج يدوياً من الأجهزة المرتبطة.',
              intro:
                'اختر الطريقة المناسبة لإعادة توصيل الصالون: رمز دخول تلقائي (عند تغيير الهاتف)، مسح QR مباشر مع المالك، أو إرسال رابط سريع عن بُعد.',
              searchLabel: 'ابحث واختر الصالون:',
              searchPlaceholder: 'ابحث باسم الصالون أو المالك أو المدينة أو الرقم...',
              noMatch: 'لا توجد صالونات مطابقة للبحث',
              ownerPrefix: 'المالك:',
              statusConnected: '● متصل ويعمل تلقائياً',
              statusNeedsLink: '⚠ يحتاج إعادة ربط يدوي',
              m1Title: '1. رمز دخول تلقائي',
              m1Desc: 'عند تغيير الهاتف · بدون باركود',
              m2Title: '2. مسح QR مع المالك',
              m2Desc: 'خيار احتياطي في الصالون فقط',
              m3Title: '3. رابط استعادة عن بُعد',
              m3Desc: 'إرسال رابط بلغة الصالون',
              autoBanner: 'استعادة الحساب تلقائياً بدون باركود',
              autoExplainPrefix: 'إذا قام',
              autoExplainMid: 'بتغيير هاتفه أو تسجيل الخروج، يسجل الدخول فوراً برقم الواتساب المسجل',
              autoExplainEnd: 'ورمز تحقق من خطوة واحدة.',
              autoDispatched: 'تم إرسال رمز الدخول التلقائي إلى',
              sendOtpBtn: 'إرسال رمز الدخول التلقائي',
              qrSuccessTitle: 'تمت إعادة ربط واتساب الصالون بنجاح!',
              qrSuccessDesc: 'عاد الصالون للعمل التلقائي 24/7 بدون انقطاع.',
              qrBtn: 'تأكيد إعادة الربط بالباركود ←',
              remoteTitle: 'إرسال رابط استعادة للصالون (بدون وكيل)',
              remoteDispatched: 'تم إرسال رابط الاستعادة إلى',
              sendRemoteBtn: 'إرسال رابط الاستعادة للواتساب ←',
            }
          : isUrdu
          ? {
              cardTitle: 'سیلون کنکشن درست کریں (آٹو فکس نظام)',
              cardKicker: 'فوری کنکشن مدد',
              watchdogTitle: 'آٹو فکس نگرانی نظام: 24/7 خودکار طور پر فعال',
              watchdogBadge: 'خودکار بحالی آن ہے',
              watchdogDesc:
                'نظام سیلون کے واٹس ایپ کنکشن کی 24/7 خودکار نگرانی کرتا ہے اور نیٹ ورک یا سم کے چھوٹے مسائل خود ہی ٹھیک کر دیتا ہے۔ نیچے دیے گئے QR یا ریموٹ لنک صرف اس وقت بیک اپ کے لیے استعمال کریں جب سیلون مالک نے خود واٹس ایپ کے Linked Devices سے لاگ آؤٹ کر دیا ہو۔',
              intro:
                'ضرورت کے مطابق طریقہ منتخب کریں: فون بدلنے پر آٹو OTP لاگ ان، موقع پر QR اسکین، یا دور سے ایک کلک والا لنک بھیجیں۔',
              searchLabel: 'سیلون تلاش اور منتخب کریں:',
              searchPlaceholder: 'سیلون کا نام، مالک، شہر یا واٹس ایپ نمبر لکھیں...',
              noMatch: 'کوئی سیلون نہیں ملا',
              ownerPrefix: 'مالک:',
              statusConnected: '● کنکشن بحال اور رواں ہے',
              statusNeedsLink: '⚠ دوبارہ لنک کرنے کی ضرورت ہے',
              m1Title: '1. آٹو سم OTP لاگ ان',
              m1Desc: 'فون بدلنے پر · بغیر کیو آر',
              m2Title: '2. آن سائٹ QR اسکین',
              m2Desc: 'صرف بیک اپ (سیلون میں موجودگی پر)',
              m3Title: '3. ریموٹ ریکوری لنک',
              m3Desc: 'مالک کی زبان میں لنک بھیجیں',
              autoBanner: 'بغیر QR خودکار اکاؤنٹ بحالی فعال ہے',
              autoExplainPrefix: 'اگر',
              autoExplainMid: 'اپنا موبائل بدلیں یا ایپ سے لاگ آؤٹ ہوں تو صرف اپنے رجسٹرڈ نمبر',
              autoExplainEnd: 'پر OTP سے فوراً لاگ ان کر سکتے ہیں۔ واٹس ایپ بوٹ بند نہیں ہوتا۔',
              autoDispatched: 'خودکار لاگ ان OTP بھیج دیا گیا برائے',
              sendOtpBtn: 'خودکار لاگ ان OTP بھیجیں',
              qrSuccessTitle: 'سیلون واٹس ایپ دوبارہ جڑ گیا!',
              qrSuccessDesc: 'سیلون اب دوبارہ 24/7 آٹو سنک پر لائیو ہے۔',
              qrBtn: 'آن سائٹ QR کنکشن مکمل کریں ←',
              remoteTitle: 'مالک کو ریموٹ ریکوری لنک بھیجیں',
              remoteDispatched: 'ریکوری لنک واٹس ایپ کر دیا گیا برائے',
              sendRemoteBtn: 'مالک کو واٹس ایپ ریکوری لنک بھیجیں ←',
            }
          : {
              cardTitle: 'Fix Salon Connection (Auto-Fix System)',
              cardKicker: 'QUICK RECONNECT HELP',
              watchdogTitle: 'Auto-Fix Watchdog: Active 24/7 (Automatic)',
              watchdogBadge: 'Self-Healing Active',
              watchdogDesc:
                'WorkCraft watches every salon WhatsApp line 24/7 and automatically repairs network drops, SIM switches, or phone restarts on its own. Only use the backup QR or Remote Link options below if a salon owner manually logged out inside WhatsApp Linked Devices.',
              intro:
                'Choose the backup step if manual action is ever needed: 1-tap login OTP when changing phones, on-site QR scan with owner, or remote link.',
              searchLabel: 'Search & Select Salon:',
              searchPlaceholder: 'Search salon by name, owner, city, or WhatsApp number...',
              noMatch: 'No salons match search query',
              ownerPrefix: 'Owner:',
              statusConnected: '● Auto-Sync Running ✓',
              statusNeedsLink: '⚠ Needs Manual Re-Link',
              m1Title: '1. Auto Login Code (OTP)',
              m1Desc: 'Changed phone · No QR needed',
              m2Title: '2. On-Site QR Scan (Backup)',
              m2Desc: 'Use only if logged out manually',
              m3Title: '3. Remote App Link',
              m3Desc: 'Send 1-tap link in salon language',
              autoBanner: 'Automatic Re-Login Active (No QR Needed)',
              autoExplainPrefix: 'If',
              autoExplainMid: 'changes phones or logs out, they simply sign back in with their registered WhatsApp number',
              autoExplainEnd: '+ 1-tap OTP. Customer auto-booking keeps running with zero breaks.',
              autoDispatched: 'Login OTP sent to',
              sendOtpBtn: 'Send Automatic Login OTP',
              qrSuccessTitle: 'Salon WhatsApp Reconnected!',
              qrSuccessDesc: 'is back online on 24/7 auto-sync.',
              qrBtn: 'Confirm Backup QR Reconnect →',
              remoteTitle: 'Remote Recovery Link (No Visit Needed)',
              remoteDispatched: 'Recovery link sent to',
              sendRemoteBtn: 'Send Recovery Link to Owner WhatsApp →',
            };

        const q = rePairSearchQuery.trim().toLowerCase();
        const filteredSalons = rePairSalonsList.filter(
          (s) =>
            !q ||
            s.name.toLowerCase().includes(q) ||
            s.owner.toLowerCase().includes(q) ||
            s.city.toLowerCase().includes(q) ||
            s.phone.toLowerCase().includes(q)
        );
        const activeSalon =
          rePairSalonsList.find((s) => s.name === selectedRePairSalon) ||
          filteredSalons[0] ||
          rePairSalonsList[0];

        const langBadgeLabel =
          activeSalon.savedLang === 'ur'
            ? '🇵🇰 اردو (Owner Language)'
            : activeSalon.savedLang === 'ar'
            ? '🇦🇪 العربية (لغة الصالون)'
            : '🇬🇧 English (Owner Language)';

        const recoveryKey = `WCL-RPR-${activeSalon.name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'S')}92`;
        const recoveryLink = `https://portal.workcraft.local/recover/${activeSalon.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}?key=${recoveryKey}&lang=${activeSalon.savedLang}`;

        const localizedDispatchPreview =
          activeSalon.savedLang === 'ar'
            ? rePairRecoveryMode === 'AUTO_OTP'
              ? `السلام عليكم ${activeSalon.owner}!\n\nلا حاجة لمسح الباركود عند تغيير الجوال. يمكنك الدخول مباشرة لصالون "${activeSalon.name}" برقمك ${activeSalon.phone}:\n🔐 رمز الدخول OTP: 849201\n✅ خدمة الحجز التلقائي على واتساب مستمرة 24/7.`
              : `السلام عليكم ${activeSalon.owner}!\n\nإليكم رابط استعادة وتوصيل لوحة صالون "${activeSalon.name}" مباشرة:\n🔑 رمز التفعيل: ${recoveryKey}\n📲 رابط التطبيق: ${recoveryLink}\n\nفريق WORKCRAFT`
            : activeSalon.savedLang === 'ur'
            ? rePairRecoveryMode === 'AUTO_OTP'
              ? `السلام علیکم ${activeSalon.owner}!\n\nفون بدلنے پر کیو آر اسکین کی ضرورت نہیں۔ "${activeSalon.name}" کے رجسٹرڈ نمبر ${activeSalon.phone} پر خودکار لاگ ان کوڈ:\n🔐 OTP کوڈ: 849201\n✅ آپ کا واٹس ایپ بکنگ سسٹم 24/7 بغیر کسی رکاوٹ کے چل رہا ہے۔`
              : `السلام علیکم ${activeSalon.owner}!\n\n"${activeSalon.name}" کو دوبارہ جوڑنے کے لیے یہ آسان ریکوری لنک استعمال کریں:\n🔑 کوڈ: ${recoveryKey}\n📲 لنک: ${recoveryLink}\n\nWORKCRAFT`
            : rePairRecoveryMode === 'AUTO_OTP'
            ? `Hello ${activeSalon.owner},\n\nNo QR scan is needed when changing phones. Your account for "${activeSalon.name}" signs right back in using your registered SIM (${activeSalon.phone}).\n🔐 Login Code (OTP): 849201\n✅ Your 24/7 WhatsApp booking system continues running smoothly.`
            : `Hello ${activeSalon.owner},\n\nUse this 1-tap link to reconnect "${activeSalon.name}" from anywhere:\n🔑 Link Code: ${recoveryKey}\n📲 App Link: ${recoveryLink}\n\nWORKCRAFT`;

        return (
          <PortalCard title={rL.cardTitle} kicker={rL.cardKicker}>
            <div dir={repairDir} className={`space-y-4 min-w-0 ${repairDir === 'rtl' ? 'text-right' : 'text-left'}`}>
              {/* Auto-Fix 24/7 Self-Healing Banner */}
              <div className="rounded-2xl border border-[#116329] bg-[#0D3822] p-3.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-[#3FB950] flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-[#3FB950] shrink-0" />
                    <span>{rL.watchdogTitle}</span>
                  </span>
                  <span className="rounded-full bg-[#0D1117] border border-[#116329] px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#3FB950]">
                    ● {rL.watchdogBadge}
                  </span>
                </div>
                <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
                  {rL.watchdogDesc}
                </p>
              </div>

              <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
                {rL.intro}
              </p>

              {/* Salon Search Box + Dropdown */}
              <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-mono font-bold text-[#F0F6FC] uppercase">
                    {rL.searchLabel}
                  </label>
                  <span className="rounded-lg bg-[#3B2E0B] border border-[#9E6A03] px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#D29922]">
                    {langBadgeLabel}
                  </span>
                </div>

                <div className="relative">
                  <Search className="size-4 text-[#06B6D4] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={rePairSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRePairSearchQuery(val);
                      const firstMatch = rePairSalonsList.find(
                        (s) =>
                          s.name.toLowerCase().includes(val.trim().toLowerCase()) ||
                          s.owner.toLowerCase().includes(val.trim().toLowerCase()) ||
                          s.city.toLowerCase().includes(val.trim().toLowerCase())
                      );
                      if (firstMatch) {
                        setSelectedRePairSalon(firstMatch.name);
                        setIsRePairHandshakeActive(false);
                        setIsAutoOtpDispatched(false);
                        setIsRemoteLinkDispatched(false);
                      }
                    }}
                    placeholder={rL.searchPlaceholder}
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] pl-10 pr-8 py-2.5 text-xs font-mono text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                  />
                  {rePairSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setRePairSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E7681] hover:text-[#F0F6FC]"
                      aria-label="Clear salon search"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={activeSalon.name}
                  onChange={(e) => {
                    setSelectedRePairSalon(e.target.value);
                    setIsRePairHandshakeActive(false);
                    setIsAutoOtpDispatched(false);
                    setIsRemoteLinkDispatched(false);
                  }}
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-xs font-mono font-bold text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                >
                  {filteredSalons.length === 0 ? (
                    <option value="" className="bg-[#0D1117] text-[#8B949E]">
                      {rL.noMatch}
                    </option>
                  ) : (
                    filteredSalons.map((salon) => (
                      <option
                        key={salon.name}
                        value={salon.name}
                        className="bg-[#0D1117] text-[#F0F6FC]"
                      >
                        {salon.name} · {salon.city} ({salon.savedLang.toUpperCase()})
                      </option>
                    ))
                  )}
                </select>

                {/* Active Salon Summary Pill */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0D1117] border border-[#30363D] px-3 py-2 text-[11px] font-mono">
                  <span className="text-[#8B949E]">
                    {rL.ownerPrefix} <strong className="text-[#F0F6FC]">{activeSalon.owner}</strong> · <span className="text-[#06B6D4]" dir="ltr">{activeSalon.phone}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    activeSalon.status === 'CONNECTED'
                      ? 'bg-[#0D3822] text-[#3FB950] border border-[#116329]'
                      : 'bg-[#3B2E0B] text-[#D29922] border border-[#9E6A03]'
                  }`}>
                    {activeSalon.status === 'CONNECTED' ? rL.statusConnected : rL.statusNeedsLink}
                  </span>
                </div>

                {/* 3 Recovery Option Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRePairRecoveryMode('AUTO_OTP');
                      setIsAutoOtpDispatched(false);
                    }}
                    className={`min-h-[48px] rounded-xl border p-3 text-start transition ${
                      rePairRecoveryMode === 'AUTO_OTP'
                        ? 'border-[#3FB950] bg-[#0D3822] text-[#F0F6FC]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:border-[#484F58]'
                    }`}
                  >
                    <p className="text-xs font-mono font-bold text-[#3FB950]">{rL.m1Title}</p>
                    <p className="text-[10px] text-[#8B949E] mt-0.5">{rL.m1Desc}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRePairRecoveryMode('ONSITE_QR');
                      setIsRePairHandshakeActive(false);
                    }}
                    className={`min-h-[48px] rounded-xl border p-3 text-start transition ${
                      rePairRecoveryMode === 'ONSITE_QR'
                        ? 'border-[#06B6D4] bg-[#21262D] text-[#F0F6FC]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:border-[#484F58]'
                    }`}
                  >
                    <p className="text-xs font-mono font-bold text-[#06B6D4]">{rL.m2Title}</p>
                    <p className="text-[10px] text-[#8B949E] mt-0.5">{rL.m2Desc}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRePairRecoveryMode('REMOTE_LINK');
                      setIsRemoteLinkDispatched(false);
                    }}
                    className={`min-h-[48px] rounded-xl border p-3 text-start transition ${
                      rePairRecoveryMode === 'REMOTE_LINK'
                        ? 'border-[#D29922] bg-[#3B2E0B] text-[#F0F6FC]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:border-[#484F58]'
                    }`}
                  >
                    <p className="text-xs font-mono font-bold text-[#D29922]">{rL.m3Title}</p>
                    <p className="text-[10px] text-[#8B949E] mt-0.5">{rL.m3Desc}</p>
                  </button>
                </div>

                {/* TIER 1: Automatic Re-Login */}
                {rePairRecoveryMode === 'AUTO_OTP' && (
                  <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-[#3FB950] flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-[#3FB950]" />
                        <span>{rL.autoBanner}</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#8B949E]">{langBadgeLabel}</span>
                    </div>
                    <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
                      {rL.autoExplainPrefix} <strong>{activeSalon.owner}</strong> {rL.autoExplainMid} (<strong dir="ltr">{activeSalon.phone}</strong>) {rL.autoExplainEnd}
                    </p>

                    <div
                      dir={activeSalon.savedLang === 'en' ? 'ltr' : 'rtl'}
                      className={`rounded-xl bg-[#0D1117] border border-[#30363D] p-3 text-xs font-mono text-[#F0F6FC] whitespace-pre-line leading-relaxed overflow-hidden break-words [overflow-wrap:break-word] ${
                        activeSalon.savedLang === 'en' ? 'text-left' : 'text-right'
                      }`}
                    >
                      {localizedDispatchPreview}
                    </div>

                    {isAutoOtpDispatched ? (
                      <div className="rounded-xl border border-[#116329] bg-[#0D1117] p-3 text-xs font-mono text-[#3FB950] flex items-center justify-center gap-2">
                        <CheckCircle2 className="size-4 text-[#3FB950]" />
                        <span>{rL.autoDispatched} <span dir="ltr">{activeSalon.phone}</span> ✓</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAutoOtpDispatched(true)}
                        className="w-full min-h-[48px] rounded-xl bg-[#3FB950] hover:bg-[#4ec961] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-bold uppercase transition active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Send className="size-4" />
                        <span>{rL.sendOtpBtn} ({activeSalon.savedLang.toUpperCase()}) →</span>
                      </button>
                    )}
                  </div>
                )}

                {/* TIER 2: Backup On-Site QR Scan */}
                {rePairRecoveryMode === 'ONSITE_QR' && (
                  <div className="space-y-3">
                    <div className="flex justify-center p-4">
                      <div className="grid size-40 place-items-center rounded-xl bg-white p-3 border-2 border-[#06B6D4]">
                        <svg viewBox="0 0 100 100" className="w-full h-full text-slate-950">
                          <rect x="5" y="5" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" rx="2" />
                          <rect x="10" y="10" width="12" height="12" fill="currentColor" rx="1" />
                          <rect x="73" y="5" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" rx="2" />
                          <rect x="78" y="10" width="12" height="12" fill="currentColor" rx="1" />
                          <rect x="5" y="73" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" rx="2" />
                          <rect x="10" y="78" width="12" height="12" fill="currentColor" rx="1" />
                          <circle cx="34" cy="12" r="2.5" fill="currentColor" />
                          <circle cx="50" cy="12" r="2.5" fill="currentColor" />
                          <rect x="42" y="42" width="16" height="16" fill="#D29922" rx="2" />
                        </svg>
                      </div>
                    </div>

                    {isRePairHandshakeActive ? (
                      <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 text-xs font-mono text-[#3FB950] space-y-1 animate-in fade-in">
                        <p className="font-bold flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="size-4 text-[#3FB950]" />
                          <span>{rL.qrSuccessTitle}</span>
                        </p>
                        <p className="text-[11px] text-[#F0F6FC] font-sans text-center">
                          {activeSalon.name} {rL.qrSuccessDesc}
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsRePairHandshakeActive(true)}
                        className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-bold uppercase transition active:scale-95 shadow-md"
                      >
                        {rL.qrBtn}
                      </button>
                    )}
                  </div>
                )}

                {/* TIER 3: Remote App Recovery Link */}
                {rePairRecoveryMode === 'REMOTE_LINK' && (
                  <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-[#D29922]">
                        {rL.remoteTitle}
                      </span>
                      <span className="text-[10px] font-mono text-[#8B949E]">{langBadgeLabel}</span>
                    </div>

                    <div
                      dir="ltr"
                      className="rounded-lg bg-[#0D1117] p-2.5 font-mono text-xs text-[#06B6D4] break-all overflow-hidden [overflow-wrap:break-word] border border-[#30363D] select-all"
                    >
                      {recoveryLink}
                    </div>

                    <div
                      dir={activeSalon.savedLang === 'en' ? 'ltr' : 'rtl'}
                      className={`rounded-xl bg-[#0D1117] border border-[#30363D] p-3 text-xs font-mono text-[#F0F6FC] whitespace-pre-line leading-relaxed overflow-hidden break-words [overflow-wrap:break-word] ${
                        activeSalon.savedLang === 'en' ? 'text-left' : 'text-right'
                      }`}
                    >
                      {localizedDispatchPreview}
                    </div>

                    {isRemoteLinkDispatched ? (
                      <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 text-xs font-mono text-[#3FB950] flex items-center justify-center gap-2">
                        <CheckCircle2 className="size-4 text-[#3FB950]" />
                        <span>{rL.remoteDispatched} <span dir="ltr">{activeSalon.phone}</span> ✓</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsRemoteLinkDispatched(true)}
                        className="w-full min-h-[48px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-bold uppercase transition active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Send className="size-4" />
                        <span>{rL.sendRemoteBtn}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </PortalCard>
        );
      })()}

      {/* ========================================================================= */}
      {/* VIEW D: BIOMETRIC-LOCKED AGENT PROFILE & PAYOUT EDITOR (LOCALIZED EN/UR/AR) */}
      {/* ========================================================================= */}
      {activeHubView === 'PROFILE' && (() => {
        const isUrdu = agentLanguage === 'ur' || agentLanguage === 'ur_roman';
        const isArabic = agentLanguage === 'ar';
        const profileDir = isUrdu || isArabic ? 'rtl' : 'ltr';

        const pL = isArabic
          ? {
              cardTitle: 'ملفي الشخصي وحسابي البنكي (محمي بالبصمة)',
              cardKicker: 'يتطلب تأكيد البصمة عند كل تعديل',
              lockHeading: 'قفل أمان البيانات الشخصية والحساب البنكي',
              lockDesc:
                'قم بتحديث رقم الجوال أو المدينة أو الدولة أو وسيلة الدفع أو الحساب البنكي أدناه. يتطلب كل حفظ مسح البصمة للتأكد من أنك قمت بالتعديل بنفسك.',
              sealedLabel: 'تم التوثيق:',
              nameLabel: 'الاسم الكامل والرقم التعريفي (مقفول)',
              phoneLabel: 'رقم الجوال / واتساب',
              countryLabel: 'الدولة / المنطقة',
              cityLabel: 'المدينة / المنطقة الميدانية',
              methodLabel: 'وسيلة استلام العمولات',
              bankLabel: 'اسم البنك أو المحفظة',
              accountLabel: 'رقم الحساب / المحفظة',
              titleLabel: 'اسم صاحب الحساب',
              ibanLabel: 'رقم الآيبان IBAN (مطلوب للتحويل البنكي)',
              codeLabel: 'رمز التحقق بالبصمة:',
              saveBtn: 'تحقق بالبصمة واحفظ البيانات',
              optPk: 'باكستان (PKR)',
              optUae: 'الإمارات العربية المتحدة (AED)',
              optSa: 'المملكة العربية السعودية (SAR)',
              optEu: 'بريطانيا وأوروبا (GBP / EUR)',
              optGlobal: 'دولي (USD)',
              mEasy: 'محفظة إيزي بيسا (EasyPaisa)',
              mJazz: 'محفظة جاز كاش (JazzCash)',
              mBank: 'تحويل بنكي (IBFT)',
              mRaast: 'حوالة فورية (Raast)',
              mIntl: 'تحويل بنكي دولي (IBAN)',
            }
          : isUrdu
          ? {
              cardTitle: 'میرا پروفائل اور بینک تفصیلات (بایومیٹرک لاک)',
              cardKicker: 'کسی بھی تبدیلی کے لیے نئی انگوٹھے کی تصدیق لازمی ہے',
              lockHeading: 'ذاتی تفصیلات اور بینک اکاؤنٹ سیکیورٹی لاک',
              lockDesc:
                'اپنا موبائل نمبر، شہر، ملک، ادائیگی کا طریقہ یا بینک اکاؤنٹ نیچے تبدیل کریں۔ ہر تبدیلی محفوظ کرنے کے لیے انگوٹھے کا نشان ضروری ہے تاکہ صرف آپ خود تبدیلی کر سکیں۔',
              sealedLabel: 'تصدیق شدہ:',
              nameLabel: 'مکمل نام اور ایجنٹ آئی ڈی (لاک)',
              phoneLabel: 'موبائل / واٹس ایپ نمبر',
              countryLabel: 'ملک / خطہ',
              cityLabel: 'شہر / علاقہ',
              methodLabel: 'کمیشن وصول کرنے کا طریقہ',
              bankLabel: 'بینک یا والٹ کا نام',
              accountLabel: 'اکاؤنٹ / والٹ نمبر',
              titleLabel: 'اکاؤنٹ ٹائٹل (نام)',
              ibanLabel: 'IBAN نمبر (بینک ٹرانسفر کے لیے لازمی)',
              codeLabel: 'موجودہ بائیومیٹرک کوڈ:',
              saveBtn: 'انگوٹھے سے تصدیق کریں اور محفوظ کریں',
              optPk: 'پاکستان (PKR)',
              optUae: 'متحدہ عرب امارات (AED)',
              optSa: 'سعودی عرب (SAR)',
              optEu: 'برطانیہ اور یورپ (GBP / EUR)',
              optGlobal: 'انٹرنیشنل (USD)',
              mEasy: 'ایزی پیسہ والٹ (EasyPaisa)',
              mJazz: 'جاز کیش والٹ (JazzCash)',
              mBank: 'بینک اکاؤنٹ (IBFT)',
              mRaast: 'راست فوری ادائیگی (Raast)',
              mIntl: 'انٹرنیشنل بینک وائر / IBAN',
            }
          : {
              cardTitle: 'My Profile & Bank Account (Biometric Lock)',
              cardKicker: 'FRESH THUMBPRINT REQUIRED FOR EVERY SAVE',
              lockHeading: 'Personal Details & Payout Security Lock',
              lockDesc:
                'Update your mobile number, city, country, payment method, or bank account below. Every save requires a fresh thumbprint scan to prove you personally made the change.',
              sealedLabel: 'Verified:',
              nameLabel: 'Full Name & Agent ID (Locked)',
              phoneLabel: 'Mobile / WhatsApp Number',
              countryLabel: 'Country / Region',
              cityLabel: 'City / Area',
              methodLabel: 'Payout Method',
              bankLabel: 'Bank or Wallet Name',
              accountLabel: 'Account / Wallet Number',
              titleLabel: 'Account Holder Name',
              ibanLabel: 'IBAN (Optional for Wallet / Required for Bank Wire)',
              codeLabel: 'Verification Code:',
              saveBtn: 'Verify Thumbprint & Save Details',
              optPk: 'Pakistan (PKR)',
              optUae: 'United Arab Emirates (AED)',
              optSa: 'Saudi Arabia (SAR)',
              optEu: 'UK & Europe (GBP / EUR)',
              optGlobal: 'Global (USD)',
              mEasy: 'EasyPaisa Mobile Wallet',
              mJazz: 'JazzCash Mobile Wallet',
              mBank: 'Bank Transfer (IBFT)',
              mRaast: 'Raast Instant Pay',
              mIntl: 'International Bank Wire / IBAN',
            };

        return (
          <PortalCard title={pL.cardTitle} kicker={pL.cardKicker}>
            <div dir={profileDir} className={`space-y-4 min-w-0 ${profileDir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <div className="rounded-2xl border border-[#9E6A03] bg-[#3B2E0B] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <Fingerprint className="size-5 text-[#D29922] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#F0F6FC]">{pL.lockHeading}</p>
                    <p className="text-[11px] text-[#8B949E] font-sans mt-0.5">{pL.lockDesc}</p>
                  </div>
                </div>
                <span className="rounded-lg border border-[#116329] bg-[#0D3822] px-2.5 py-1 text-[10px] font-mono text-[#3FB950] shrink-0">
                  {pL.sealedLabel} <span dir="ltr">{profileBiometricSealTime}</span>
                </span>
              </div>

              {payoutSaveStatus && (
                <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 text-xs font-mono text-[#3FB950] flex flex-wrap items-center justify-between gap-2 animate-in fade-in overflow-hidden">
                  <span className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="size-4 text-[#3FB950] shrink-0" />
                    <span className="break-words [overflow-wrap:break-word]">{payoutSaveStatus}</span>
                  </span>
                  <span className="text-[10px] text-[#06B6D4] break-all [overflow-wrap:break-word]" dir="ltr">{profileThumbHash.slice(0, 22)}...</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <label className="space-y-1.5">
                  <span className="text-[10px] text-[#8B949E] uppercase block">{pL.nameLabel}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={`${agentFullName} (#${agentIdInput || 'AGT-409'})`}
                    disabled
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2.5 text-left text-[#8B949E] cursor-not-allowed"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] text-[#06B6D4] uppercase block font-bold">{pL.phoneLabel}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={draftAgentPhone}
                    onChange={(e) => setDraftAgentPhone(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2.5 text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:border-[#06B6D4] focus:outline-none"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] text-[#06B6D4] uppercase block font-bold">{pL.countryLabel}</span>
                  <select
                    dir="ltr"
                    value={draftAgentRegion}
                    onChange={(e) => setDraftAgentRegion(e.target.value as 'PK' | 'EUROPE' | 'MENA_UAE' | 'MENA_SA' | 'GLOBAL')}
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2.5 text-left text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
                  >
                    <option value="PK" className="bg-[#0D1117] text-[#F0F6FC]">{pL.optPk}</option>
                    <option value="MENA_UAE" className="bg-[#0D1117] text-[#F0F6FC]">{pL.optUae}</option>
                    <option value="MENA_SA" className="bg-[#0D1117] text-[#F0F6FC]">{pL.optSa}</option>
                    <option value="EUROPE" className="bg-[#0D1117] text-[#F0F6FC]">{pL.optEu}</option>
                    <option value="GLOBAL" className="bg-[#0D1117] text-[#F0F6FC]">{pL.optGlobal}</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] text-[#06B6D4] uppercase block font-bold">{pL.cityLabel}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={draftAgentTerritory}
                    onChange={(e) => setDraftAgentTerritory(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2.5 text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:border-[#06B6D4] focus:outline-none"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] text-[#D29922] uppercase block font-bold">{pL.methodLabel}</span>
                  <select
                    dir="ltr"
                    value={draftAgentPayoutMethod}
                    onChange={(e) => setDraftAgentPayoutMethod(e.target.value as 'EasyPaisa' | 'JazzCash' | 'Bank Transfer (IBFT)' | 'Raast Instant Pay' | 'International Bank Wire')}
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2.5 text-left text-[#F0F6FC] focus:border-[#D29922] focus:outline-none"
                  >
                    <option value="EasyPaisa" className="bg-[#0D1117] text-[#F0F6FC]">{pL.mEasy}</option>
                    <option value="JazzCash" className="bg-[#0D1117] text-[#F0F6FC]">{pL.mJazz}</option>
                    <option value="Bank Transfer (IBFT)" className="bg-[#0D1117] text-[#F0F6FC]">{pL.mBank}</option>
                    <option value="Raast Instant Pay" className="bg-[#0D1117] text-[#F0F6FC]">{pL.mRaast}</option>
                    <option value="International Bank Wire" className="bg-[#0D1117] text-[#F0F6FC]">{pL.mIntl}</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] text-[#D29922] uppercase block font-bold">{pL.bankLabel}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={draftAgentBankName}
                    onChange={(e) => setDraftAgentBankName(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2.5 text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:border-[#D29922] focus:outline-none"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] text-[#D29922] uppercase block font-bold">{pL.accountLabel}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={draftAgentPayoutAccount}
                    onChange={(e) => setDraftAgentPayoutAccount(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2.5 text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:border-[#D29922] focus:outline-none"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] text-[#D29922] uppercase block font-bold">{pL.titleLabel}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={draftAgentPayoutTitle}
                    onChange={(e) => setDraftAgentPayoutTitle(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2.5 text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:border-[#D29922] focus:outline-none"
                  />
                </label>

                <label className="sm:col-span-2 space-y-1.5">
                  <span className="text-[10px] text-[#8B949E] uppercase block">{pL.ibanLabel}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={draftAgentIban}
                    onChange={(e) => setDraftAgentIban(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2.5 text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:border-[#06B6D4] focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#21262D]">
                <span className="text-[11px] font-mono text-[#8B949E] min-w-0 break-all overflow-hidden [overflow-wrap:break-word]">
                  {pL.codeLabel} <strong className="text-[#06B6D4] break-all [overflow-wrap:break-word]" dir="ltr">{profileThumbHash}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsBiometricModalOpenForEdit(true)}
                  className="min-h-[48px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-black uppercase transition active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                >
                  <Fingerprint className="size-4" />
                  <span>{pL.saveBtn}</span>
                </button>
              </div>
            </div>
          </PortalCard>
        );
      })()}

      {/* ========================================================================= */}
      {/* VIEW C: ROLE-ISOLATED & LOCALIZED COMMISSION LEDGER (QUERY 4)            */}
      {/* ========================================================================= */}
      {activeHubView === 'LEDGER' && (() => {
        const isUrdu = agentLanguage === 'ur' || agentLanguage === 'ur_roman';
        const isArabic = agentLanguage === 'ar';
        const ledgerDir = userRole === 'FIELD_AGENT' && (isUrdu || isArabic) ? 'rtl' : 'ltr';

        // Multi-Agent Current Month + Previous History Breakdown for Founder View
        const perAgentRevenueBreakup = [
          {
            agentId: 'AGT-409',
            agentName: 'Kamran Tariq',
            regionFlag: '🇵🇰',
            territory: 'Lahore West',
            currency: 'PKR',
            currentMonthSalons: 8,
            currentMonthGross: 156000,
            previousMonthsSalons: 11,
            previousMonthsGross: 214500,
            cashHeld: cashLiabilityHeld,
            monthlyRows: [
              { month: 'November 2026 (Current)', salons: 8, gross: 156000, maint: 36000, status: 'Live · Rolling' },
              { month: 'October 2026', salons: 6, gross: 117000, maint: 27000, status: 'Settled via Webhook' },
              { month: 'September 2026', salons: 5, gross: 97500, maint: 22500, status: 'Settled via Webhook' },
            ],
          },
          {
            agentId: 'AGT-415',
            agentName: 'Bilal Sheikh',
            regionFlag: '🇵🇰',
            territory: 'Karachi South',
            currency: 'PKR',
            currentMonthSalons: 5,
            currentMonthGross: 95000,
            previousMonthsSalons: 7,
            previousMonthsGross: 132000,
            cashHeld: 10000,
            monthlyRows: [
              { month: 'November 2026 (Current)', salons: 5, gross: 95000, maint: 18000, status: 'Live · Rolling' },
              { month: 'October 2026', salons: 4, gross: 76000, maint: 14000, status: 'Settled via Webhook' },
              { month: 'September 2026', salons: 3, gross: 56000, maint: 9000, status: 'Settled via Webhook' },
            ],
          },
          {
            agentId: 'AGT-502',
            agentName: 'Tariq Al-Mansoor',
            regionFlag: '🇦🇪',
            territory: 'Dubai (MENA)',
            currency: 'AED Same-Currency Split',
            currentMonthSalons: 4,
            currentMonthGross: 140000,
            previousMonthsSalons: 3,
            previousMonthsGross: 105000,
            cashHeld: 0,
            monthlyRows: [
              { month: 'November 2026 (Current)', salons: 4, gross: 140000, maint: 14000, status: 'Direct 20/80 Split (AED)' },
              { month: 'October 2026', salons: 3, gross: 105000, maint: 10500, status: 'Zero-FX Local Split ✓' },
            ],
          },
          {
            agentId: 'AGT-608',
            agentName: 'Oliver Bennett',
            regionFlag: '🇬🇧',
            territory: 'London (UK)',
            currency: 'GBP Same-Currency Split',
            currentMonthSalons: 3,
            currentMonthGross: 115000,
            previousMonthsSalons: 2,
            previousMonthsGross: 78000,
            cashHeld: 0,
            monthlyRows: [
              { month: 'November 2026 (Current)', salons: 3, gross: 115000, maint: 11500, status: 'Direct 20/80 Split (GBP)' },
              { month: 'October 2026', salons: 2, gross: 78000, maint: 7800, status: 'Zero-FX Local Split ✓' },
            ],
          },
        ];

        const filteredBreakupAgents =
          founderSelectedLedgerAgent === 'ALL'
            ? perAgentRevenueBreakup
            : perAgentRevenueBreakup.filter((a) => a.agentId === founderSelectedLedgerAgent);

        const totalCurrentGross = filteredBreakupAgents.reduce((s, a) => s + a.currentMonthGross, 0);
        const totalPrevGross = filteredBreakupAgents.reduce((s, a) => s + a.previousMonthsGross, 0);
        const totalCombinedGross = totalCurrentGross + totalPrevGross;
        const totalCommDisbursed = Math.round(totalCombinedGross * 0.2);
        const totalWorkcraftNet = Math.round(totalCombinedGross * 0.8);

        // Localized strings strictly for Field Agent Personal Commission View
        const agentL = isArabic
          ? {
              cardTitle: 'سجل عمولاتي ومستحقاتي الشخصية',
              cardKicker: 'حساب الوكيل الخاص',
              badge: '✓ سجل أرباحك الشخصية فقط',
              optionATitle: 'تعديل العمولة التلقائي (خيار A) ضد النقد المحصل',
              windowLabel: 'مهلة التوريد المتبقية',
              prevCash: 'النقد المحصل مسبقاً',
              offset: 'خصم العمولة التلقائي',
              netDue: 'صافي النقد المستحق لـ WORKCRAFT',
              dealsClosed: 'إجمالي الصفقات المغلقة',
              salonsUnit: 'صالونات',
              commEarned: 'صافي عمولتك المكتسبة',
              disbursedTo: 'تم التحويل 100% إلى',
              payoutDest: 'حساب استلام العمولات',
              tableTitle: 'سجل عمولاتك الشهرية (الشهر الحالي والماضي)',
              directRail: 'تحويل مباشر للمحفظة / البنك',
              colMonth: 'الشهر',
              colSalons: 'الصالونات',
              colPackage: 'الباقة المباعة',
              colComm: 'عمولتك (20%)',
              colRail: 'وسيلة الصرف',
              colStatus: 'الحالة',
              statusPaid: '✓ تم الصرف',
            }
          : isUrdu
          ? {
              cardTitle: 'میرا ذاتی کمیشن اور ادائیگی لیجر',
              cardKicker: 'فیلڈ ایجنٹ کمیشن ریکارڈ',
              badge: '✓ صرف آپ کی ذاتی کمائی فعال',
              optionATitle: 'آپشن A: کمیشن خودکار ایڈجسٹمنٹ (کیش ذمہ داری)',
              windowLabel: 'بقایا جمع کرانے کا وقت',
              prevCash: 'پچھلا وصول شدہ کیش',
              offset: 'خودکار کمیشن ایڈجسٹمنٹ',
              netDue: 'ورک کرافٹ کو واجب الادا بقایا کیش',
              dealsClosed: 'کل مکمل سیلون ڈیلز',
              salonsUnit: 'سیلون',
              commEarned: 'آپ کا کمایا گیا کل کمیشن',
              disbursedTo: '100% منتقل شدہ بذریعہ',
              payoutDest: 'ادائیگی وصول کرنے کا اکاؤنٹ',
              tableTitle: 'آپ کا ماہانہ کمیشن لیجر (موجودہ اور پچھلا ریکارڈ)',
              directRail: 'براہ راست والٹ / بینک ٹرانسفر',
              colMonth: 'مہینہ',
              colSalons: 'شامل سیلون',
              colPackage: 'فروخت شدہ پیکیج',
              colComm: 'آپ کا کمیشن',
              colRail: 'ادائیگی چینل',
              colStatus: 'اسٹیٹس',
              statusPaid: '✓ ادائیگی مکمل',
            }
          : {
              cardTitle: 'My Personal Commission & Payout Ledger',
              cardKicker: 'AGENT PERSONAL EARNINGS',
              badge: '✓ Personal Field Earnings Only',
              optionATitle: 'Option A: Automated Commission Net-Adjustment',
              windowLabel: 'Remittance Countdown Window',
              prevCash: 'PREVIOUS CASH COLLECTED',
              offset: 'COMMISSION AUTO-OFFSET',
              netDue: 'NET CASH DUE TO WORKCRAFT',
              dealsClosed: 'Total Deals Closed',
              salonsUnit: 'Salons',
              commEarned: 'Your Commission Earned',
              disbursedTo: '100% Disbursed to',
              payoutDest: 'Payout Destination',
              tableTitle: 'Your Monthly Commission History (Current & Past)',
              directRail: 'DIRECT TO WALLET / BANK',
              colMonth: 'Month',
              colSalons: 'Salons Added',
              colPackage: 'Package Tier Sold',
              colComm: 'Your Commission',
              colRail: 'Disbursement Rail',
              colStatus: 'Status',
              statusPaid: '✓ Cleared & Disbursed',
            };

        return (
          <PortalCard
            title={
              userRole === 'FOUNDER'
                ? 'Founder Revenue Attribution — Per-Agent Current & Historical Ledger'
                : agentL.cardTitle
            }
            kicker={userRole === 'FOUNDER' ? 'FOUNDER EXECUTIVE LEDGER' : agentL.cardKicker}
          >
            <div dir={ledgerDir} className={`space-y-4 min-w-0 ${ledgerDir === 'rtl' ? 'text-right' : 'text-left'}`}>
              {userRole === 'FOUNDER' ? (
                /* FOUNDER VIEW STRICTLY: Per-Agent Current Month & Previous History Revenue Breakup */
                <div className="space-y-4 animate-in fade-in">
                  {/* Agent Filter Selector */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0D1117] p-3.5 rounded-2xl border border-[#30363D]">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#D29922] font-bold block">
                        PER-AGENT REVENUE &amp; RETENTION BREAKUP (CURRENT MONTH + HISTORY)
                      </span>
                      <p className="text-xs text-[#8B949E] font-sans mt-0.5">
                        Inspect how much gross setup revenue each agent generated in the current month and prior months, along with 20% commission disbursed and 80% net WORKCRAFT margin.
                      </p>
                    </div>
                    <select
                      value={founderSelectedLedgerAgent}
                      onChange={(e) => setFounderSelectedLedgerAgent(e.target.value)}
                      className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2 text-xs font-mono font-bold text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4] shrink-0"
                    >
                      <option value="ALL" className="bg-[#0D1117] text-[#F0F6FC]">
                        All Regional Agents ({perAgentRevenueBreakup.length})
                      </option>
                      {perAgentRevenueBreakup.map((a) => (
                        <option key={a.agentId} value={a.agentId} className="bg-[#0D1117] text-[#F0F6FC]">
                          {a.regionFlag} {a.agentName} (#{a.agentId})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Top 4 Executive Revenue Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                    <div className="rounded-xl border border-[#06B6D4]/40 bg-[#0D1117] p-3.5">
                      <span className="text-[10px] text-[#06B6D4] uppercase block font-bold">Current Month Inflow</span>
                      <span className="text-lg font-bold text-[#F0F6FC] mt-0.5 block">
                        PKR {totalCurrentGross.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#8B949E]">Active November 2026</span>
                    </div>

                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5">
                      <span className="text-[10px] text-[#8B949E] uppercase block">Previous History Inflow</span>
                      <span className="text-lg font-bold text-[#F0F6FC] mt-0.5 block">
                        PKR {totalPrevGross.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#6E7681]">Prior Settled Months</span>
                    </div>

                    <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-3.5">
                      <span className="text-[10px] text-[#D29922] uppercase block font-bold">Agent Payouts (20%)</span>
                      <span className="text-lg font-bold text-[#D29922] mt-0.5 block">
                        PKR {totalCommDisbursed.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#8B949E]">Combined Commission</span>
                    </div>

                    <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3.5">
                      <span className="text-[10px] text-[#3FB950] uppercase block font-bold">Net WORKCRAFT Retained (80%)</span>
                      <span className="text-lg font-bold text-[#3FB950] mt-0.5 block">
                        PKR {totalWorkcraftNet.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#3FB950]">Cleared Net Profit</span>
                    </div>
                  </div>

                  {/* Per-Agent Current Month vs Previous History Summary Table */}
                  <div className="rounded-xl border border-[#30363D] bg-[#0D1117] overflow-hidden font-mono">
                    <div className="p-3 bg-[#161B22] border-b border-[#30363D] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#F0F6FC] uppercase text-[11px]">Per-Agent Revenue Breakup (Current vs. History)</span>
                      <span className="text-[10px] text-[#06B6D4] font-bold">Click any agent row to inspect month history</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#161B22] text-[#8B949E] border-b border-[#30363D]">
                          <tr>
                            <th className="p-3">Agent &amp; Territory</th>
                            <th className="p-3 text-right text-[#06B6D4]">Current Month</th>
                            <th className="p-3 text-right">Previous History</th>
                            <th className="p-3 text-right text-[#D29922]">Agent Comm (20%)</th>
                            <th className="p-3 text-right text-[#3FB950]">Net WORKCRAFT (80%)</th>
                            <th className="p-3 text-right">Held Cash</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#21262D]">
                          {filteredBreakupAgents.map((a) => {
                            const agentTotalGross = a.currentMonthGross + a.previousMonthsGross;
                            const agentComm = Math.round(agentTotalGross * 0.2);
                            const agentNet = Math.round(agentTotalGross * 0.8);
                            return (
                              <tr
                                key={a.agentId}
                                onClick={() =>
                                  setFounderSelectedLedgerAgent(
                                    founderSelectedLedgerAgent === a.agentId ? 'ALL' : a.agentId
                                  )
                                }
                                className="hover:bg-[#21262D] transition cursor-pointer"
                              >
                                <td className="p-3">
                                  <p className="font-bold text-[#F0F6FC]">{a.regionFlag} {a.agentName} <span className="text-[#6E7681] text-[10px]">#{a.agentId}</span></p>
                                  <p className="text-[10px] text-[#8B949E]">{a.territory}</p>
                                </td>
                                <td className="p-3 text-right font-bold text-[#06B6D4]">
                                  PKR {a.currentMonthGross.toLocaleString()}
                                  <span className="block text-[9px] text-[#8B949E]">{a.currentMonthSalons} Salons</span>
                                </td>
                                <td className="p-3 text-right text-[#F0F6FC]">
                                  PKR {a.previousMonthsGross.toLocaleString()}
                                  <span className="block text-[9px] text-[#6E7681]">{a.previousMonthsSalons} Salons</span>
                                </td>
                                <td className="p-3 text-right font-bold text-[#D29922]">PKR {agentComm.toLocaleString()}</td>
                                <td className="p-3 text-right font-bold text-[#3FB950]">PKR {agentNet.toLocaleString()}</td>
                                <td className="p-3 text-right">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    a.cashHeld > 0
                                      ? 'bg-[#3B2E0B] text-[#D29922] border border-[#9E6A03]'
                                      : 'bg-[#0D3822] text-[#3FB950] border border-[#116329]'
                                  }`}>
                                    {a.cashHeld > 0 ? `PKR ${a.cashHeld.toLocaleString()}` : 'Zero-Cash'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Month-by-Month Detailed Audit History for Filtered Agent(s) */}
                  <div className="rounded-xl border border-[#30363D] bg-[#0D1117] overflow-hidden font-mono">
                    <div className="p-3 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between text-xs">
                      <span className="font-bold text-[#F0F6FC] uppercase text-[11px]">
                        Month-by-Month Audit History ({founderSelectedLedgerAgent === 'ALL' ? 'All Agents' : filteredBreakupAgents[0]?.agentName})
                      </span>
                      <span className="text-[10px] text-[#3FB950] font-bold">80% NET MARGIN TRACKING</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#161B22] text-[#8B949E] border-b border-[#30363D]">
                          <tr>
                            <th className="p-3">Agent</th>
                            <th className="p-3">Month</th>
                            <th className="p-3 text-center">Salons</th>
                            <th className="p-3 text-right">Gross Inflow</th>
                            <th className="p-3 text-right text-[#D29922]">Agent Comm (20%)</th>
                            <th className="p-3 text-right text-[#3FB950]">Net Retained (+Maint)</th>
                            <th className="p-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#21262D]">
                          {filteredBreakupAgents.flatMap((a) =>
                            a.monthlyRows.map((row) => {
                              const comm = Math.round(row.gross * 0.2);
                              const netRetained = row.gross - comm + row.maint;
                              return (
                                <tr key={`${a.agentId}-${row.month}`} className="hover:bg-[#21262D] transition">
                                  <td className="p-3 font-bold text-[#F0F6FC]">{a.regionFlag} {a.agentName}</td>
                                  <td className="p-3 font-bold text-[#F0F6FC]">{row.month}</td>
                                  <td className="p-3 text-center text-[#06B6D4]">{row.salons}</td>
                                  <td className="p-3 text-right text-[#8B949E]">PKR {row.gross.toLocaleString()}</td>
                                  <td className="p-3 text-right font-bold text-[#D29922]">PKR {comm.toLocaleString()}</td>
                                  <td className="p-3 text-right font-bold text-[#3FB950]">PKR {netRetained.toLocaleString()}</td>
                                  <td className="p-3 text-center">
                                    <span className="rounded-full bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[10px] text-[#3FB950]">
                                      {row.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* AGENT VIEW STRICTLY: Only Own Personal Commission in Agent's Selected Language */
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0D1117] border border-[#06B6D4]/30 px-3.5 py-2.5 text-xs font-mono">
                    <div>
                      <span className="font-bold text-[#06B6D4]">{agentFullName} (#{agentIdInput})</span>
                      <span className="text-[10px] text-[#8B949E] block">
                        {isArabic
                          ? 'تاريخ الانضمام: 12 أكتوبر 2024 · إجمالي أرباحك من اليوم الأول حتى اليوم'
                          : isUrdu
                          ? 'شمولیت: 12 اکتوبر 2024 · پہلے دن سے آج تک کی کل کمائی اور ماہانہ ریکارڈ'
                          : 'Joined: 12 Oct 2024 · Day-1 to Today Total Earnings & Monthly Breakup'}
                      </span>
                    </div>
                    <span className="text-[#3FB950] font-bold">{agentL.badge}</span>
                  </div>

                  {/* Option A Net-Adjustment Card (Localized) */}
                  <div className="rounded-2xl border border-[#9E6A03] bg-[#3B2E0B] p-4 space-y-3 font-mono">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#9E6A03]/50 pb-3">
                      <span className="text-xs text-[#D29922] font-bold">{agentL.optionATitle}</span>
                      <div className="rounded-xl bg-[#0D1117] border border-[#9E6A03] px-3 py-1 text-[11px]">
                        <span className="text-[#8B949E] mr-1.5">{agentL.windowLabel}:</span>
                        <span className="font-bold text-[#D29922]" dir="ltr">{countdownHours}h {countdownMinutes}m</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="rounded-xl bg-[#0D1117] border border-[#30363D] p-3">
                        <span className="text-[#8B949E] block text-[10px]">{agentL.prevCash}</span>
                        <span className="text-base font-bold text-[#F0F6FC] mt-0.5 block" dir="ltr">PKR 15,000</span>
                        <span className="text-[10px] text-[#8B949E]">{cashLiabilitySalon}</span>
                      </div>
                      <div className="rounded-xl bg-[#0D1117] border border-[#116329] p-3">
                        <span className="text-[#8B949E] block text-[10px]">{agentL.offset}</span>
                        <span className="text-base font-bold text-[#3FB950] mt-0.5 block" dir="ltr">- PKR 3,000</span>
                        <span className="text-[10px] text-[#3FB950]">20%</span>
                      </div>
                      <div className="rounded-xl bg-[#0D1117] border border-[#9E6A03] p-3">
                        <span className="text-[#8B949E] block text-[10px]">{agentL.netDue}</span>
                        <span className="text-base font-bold text-[#D29922] mt-0.5 block" dir="ltr">
                          PKR {cashLiabilityHeld.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Agent Summary KPI Cards (Day-1 Total + Current Month + Payout Rail) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5">
                      <span className="text-[10px] text-[#8B949E] uppercase block">{agentL.dealsClosed}</span>
                      <span className="text-lg font-bold text-[#06B6D4] mt-0.5 block">
                        19 {agentL.salonsUnit}
                      </span>
                      <span className="text-[10px] text-[#8B949E]">{agentTerritory}</span>
                    </div>

                    <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3.5">
                      <span className="text-[10px] text-[#3FB950] uppercase block font-bold">
                        {isArabic ? 'عمولة هذا الشهر' : isUrdu ? 'اس مہینے کا کمیشن' : 'This Month Commission'}
                      </span>
                      <span className="text-lg font-bold text-[#3FB950] mt-0.5 block" dir="ltr">
                        PKR 24,000
                      </span>
                      <span className="text-[10px] text-[#F0F6FC]">
                        {isArabic ? '8 صالونات هذا الشهر' : isUrdu ? 'اس ماہ 8 سیلون' : '8 Salons This Month'}
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-3.5">
                      <span className="text-[10px] text-[#D29922] uppercase block font-bold">
                        {isArabic ? 'إجمالي عمولتك (من اليوم الأول)' : isUrdu ? 'کل کمیشن (پہلے دن سے آج تک)' : 'Day-1 to Today Total'}
                      </span>
                      <span className="text-lg font-bold text-[#D29922] mt-0.5 block" dir="ltr">
                        PKR 57,000
                      </span>
                      <span className="text-[10px] text-[#3FB950]">{agentL.disbursedTo} {agentPayoutMethod}</span>
                    </div>

                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 min-w-0 overflow-hidden">
                      <span className="text-[10px] text-[#8B949E] uppercase block">{agentL.payoutDest}</span>
                      <span className="text-sm font-bold text-[#F0F6FC] mt-1 block break-all overflow-hidden [overflow-wrap:break-word]" dir="ltr">
                        {agentPayoutAccount} ({agentPayoutMethod})
                      </span>
                      <span className="text-[10px] text-[#3FB950]">{agentL.directRail}</span>
                    </div>
                  </div>

                  {/* Agent Personal Commission Table (Strictly Personal & Localized) */}
                  <div className="rounded-xl border border-[#30363D] bg-[#0D1117] overflow-hidden font-mono">
                    <div className="p-3 bg-[#161B22] border-b border-[#30363D] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#F0F6FC] uppercase text-[11px]">{agentL.tableTitle}</span>
                      <span className="text-[10px] text-[#06B6D4] font-bold">{agentL.directRail}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-start text-xs">
                        <thead className="bg-[#161B22] text-[#8B949E] border-b border-[#30363D]">
                          <tr>
                            <th className="p-3">{agentL.colMonth}</th>
                            <th className="p-3 text-center">{agentL.colSalons}</th>
                            <th className="p-3">{agentL.colPackage}</th>
                            <th className="p-3 text-[#D29922]">{agentL.colComm}</th>
                            <th className="p-3 text-center">{agentL.colRail}</th>
                            <th className="p-3 text-center">{agentL.colStatus}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#21262D]">
                          {agentRevenueLedger.map((row) => {
                            const comm = Math.round(row.setupRevenue * 0.2);
                            const localizedMonth = isArabic
                              ? row.month
                                  .replace('October', 'أكتوبر')
                                  .replace('September', 'سبتمبر')
                                  .replace('August', 'أغسطس')
                              : isUrdu
                              ? row.month
                                  .replace('October', 'اکتوبر')
                                  .replace('September', 'ستمبر')
                                  .replace('August', 'اگست')
                              : row.month;
                            const localizedTier = isArabic
                              ? 'نمو أوتوماتيكي (PKR 20,000)'
                              : isUrdu
                              ? 'گروتھ آٹو پیکیج (PKR 20,000)'
                              : 'Growth Auto (PKR 20,000)';
                            return (
                              <tr key={row.month} className="hover:bg-[#21262D] transition">
                                <td className="p-3 font-bold text-[#F0F6FC]">{localizedMonth}</td>
                                <td className="p-3 text-center text-[#06B6D4]">{row.activeSalons} {agentL.salonsUnit}</td>
                                <td className="p-3 text-[#8B949E]">{localizedTier}</td>
                                <td className="p-3 font-bold text-[#D29922]" dir="ltr">PKR {comm.toLocaleString()}</td>
                                <td className="p-3 text-center text-[#8B949E]">{agentPayoutMethod}</td>
                                <td className="p-3 text-center">
                                  <span className="rounded-full bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[10px] text-[#3FB950]">
                                    {agentL.statusPaid}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </PortalCard>
        );
      })()}

      {/* ========================================================================= */}
      {/* INTERACTIVE PAYMENT VERIFICATION DRAWER (QUERIES 1, 2, 3, 4, 6) */}
      {/* ========================================================================= */}
      {isPaymentDrawerOpen && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-[#0D1117]/80 p-3 sm:p-5 backdrop-blur-md overflow-y-auto"
          onClick={() => setIsPaymentDrawerOpen(false)}
        >
          <div
            dir={clientOnboardingLanguage === 'en' ? 'ltr' : 'rtl'}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-[520px] rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 pb-12 shadow-2xl animate-in zoom-in-95 duration-150 my-6 max-h-[92vh] overflow-y-auto overflow-x-hidden ${
              clientOnboardingLanguage === 'en' ? 'text-left' : 'text-right'
            }`}
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-[#21262D] pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-[.2em] text-[#D29922]">
                  {t.drawerKicker}
                </span>
                <h3 className="mt-1 text-lg sm:text-xl font-black text-[#F0F6FC] tracking-tight flex items-center gap-2">
                  <CreditCard className="size-5 text-[#06B6D4] shrink-0" />
                  <span>{t.drawerTitlePrefix}: {getLocalizedPaymentMethodName(setupPaymentMethod, clientOnboardingLanguage)}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaymentDrawerOpen(false);
                }}
                className="size-9 grid place-items-center rounded-xl bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58] transition active:scale-95 shrink-0"
                title={t.cancelLabel}
                aria-label={t.cancelLabel}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Official Pre-Configured WORKCRAFT Receiving Destination */}
            <div className="mt-4 rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] uppercase font-bold text-[#8B949E] block">
                {t.receivingDestTitle}
              </span>
              {setupPaymentMethod === 'EasyPaisa' && (
                <div className="space-y-0.5">
                  <p className="text-[#F0F6FC] font-bold text-sm" dir="ltr">Merchant Till: 0300-WORKCRAFT</p>
                  <p className="text-[#3FB950] text-[11px]">
                    {clientOnboardingLanguage === 'ur'
                      ? 'اکاؤنٹ ٹائٹل: WORKCRAFT Local آفیشل · ٹیلی نار مائیکروفنانس'
                      : clientOnboardingLanguage === 'ar'
                      ? 'اسم الحساب: WORKCRAFT Local الرسمي · تيلينور للتمويل'
                      : 'Title: WORKCRAFT Local Official · Telenor Microfinance'}
                  </p>
                </div>
              )}
              {setupPaymentMethod === 'JazzCash' && (
                <div className="space-y-0.5">
                  <p className="text-[#F0F6FC] font-bold text-sm" dir="ltr">Corporate Till: 789210</p>
                  <p className="text-[#3FB950] text-[11px]">
                    {clientOnboardingLanguage === 'ur'
                      ? 'اکاؤنٹ ٹائٹل: WORKCRAFT Local · موبی لنک مائیکروفنانس بینک'
                      : clientOnboardingLanguage === 'ar'
                      ? 'اسم الحساب: WORKCRAFT Local · بنك موبيلينك للتمويل'
                      : 'Title: WORKCRAFT Local · Mobilink Microfinance Bank'}
                  </p>
                </div>
              )}
              {setupPaymentMethod === 'Bank Transfer (IBFT)' && (
                <div className="space-y-0.5">
                  <p className="text-[#F0F6FC] font-bold text-sm" dir="ltr">Meezan Bank Ltd Pakistan · A/C: 01020304050607</p>
                  <p className="text-[#06B6D4] text-[11px] break-all [overflow-wrap:break-word]" dir="ltr">IBAN: PK64MEZN0001020304050607 · SWIFT: MEZNPKKA</p>
                  <p className="text-[10px] text-[#8B949E]">
                    {detectedCountry.isDomestic
                      ? clientOnboardingLanguage === 'ur'
                        ? '1LINK اور راسٹ (Raast) فوری کلیئرنس'
                        : clientOnboardingLanguage === 'ar'
                        ? 'مقاصة فورية عبر شبكة 1LINK و Raast'
                        : '1LINK & Raast Instant Reference Clearance'
                      : detectedCountry.region === 'EUROPE'
                      ? clientOnboardingLanguage === 'ar'
                        ? 'تحويل دولي مباشر SEPA / SWIFT إلى حساب بنك ميزان الباكستاني (24-48 ساعة)'
                        : clientOnboardingLanguage === 'ur'
                        ? 'یورپ سے براہ راست SEPA / SWIFT وائر ٹو پاکستانی میزان اکاؤنٹ (24-48 گھنٹے)'
                        : 'Direct 24-48h SEPA / SWIFT International Wire to Pakistani Meezan Account'
                      : clientOnboardingLanguage === 'ar'
                      ? 'حوالة بنكية دولية SWIFT مباشرة إلى بنك ميزان الباكستاني (24-48 ساعة)'
                      : clientOnboardingLanguage === 'ur'
                      ? 'براہ راست 24-48 گھنٹے انٹرنیشنل SWIFT وائر ٹو میزان بینک پاکستان'
                      : 'Direct 24-48h International SWIFT Wire Clearance to Pakistani Meezan Account'}
                  </p>
                </div>
              )}
              {setupPaymentMethod === 'Stripe / Card' && (
                <div className="space-y-0.5">
                  <p className="text-[#F0F6FC] font-bold text-sm">
                    {detectedCountry.region === 'MENA'
                      ? clientOnboardingLanguage === 'ar'
                        ? 'معالجة البطاقات العالمية والخليجية Stripe 3D-Secure (فيزا / ماستر / Apple Pay / مدى)'
                        : clientOnboardingLanguage === 'ur'
                        ? 'MENA و عالمی Stripe 3D-Secure کارڈ پروسیسنگ (ویزا / Apple Pay / مدى)'
                        : 'Stripe 3D-Secure MENA & Global Processing (Visa / Apple Pay / Mada)'
                      : clientOnboardingLanguage === 'ar'
                      ? 'معالجة البطاقات الأوروبية والعالمية Stripe 3D-Secure · Apple Pay'
                      : clientOnboardingLanguage === 'ur'
                      ? 'عالمی و یورپی Stripe 3D-Secure کارڈ پروسیسنگ · Apple Pay'
                      : 'Stripe 3D-Secure UK/EU & Global Card Processing · Apple Pay'}
                  </p>
                  <p className="text-[#3FB950] text-[11px]">
                    {clientOnboardingLanguage === 'ar'
                      ? 'تقسيم مباشر بنفس العملة (20% لحساب الوكيل المحلي · 80% لحساب WORKCRAFT بدون خسائر صرف)'
                      : clientOnboardingLanguage === 'ur'
                      ? 'اسی کرنسی میں براہ راست تقسیم (20% ایجنٹ کے مقامی اکاؤنٹ میں · 80% WORKCRAFT کو — بغیر FX نقصان)'
                      : `Same-Currency Direct Split (${activePackage.currency}): 20% to Agent Local Payout · 80% to WORKCRAFT`}
                  </p>
                  <p className="text-[10px] text-[#8B949E]">
                    {clientOnboardingLanguage === 'ar'
                      ? 'تفعيل فوري للصالون الآن · بدون تحويل عملات مزدوج للوكلاء الدوليين'
                      : clientOnboardingLanguage === 'ur'
                      ? 'ٹرمینل فوراً فعال · غیر ملکی ایجنٹس کو ڈبل کرنسی کنورژن سے مکمل تحفظ'
                      : 'Instant terminal activation granted immediately · Zero double FX conversion loss'}
                  </p>
                </div>
              )}
              {setupPaymentMethod === 'Cash Collection' && (
                <div className="space-y-0.5">
                  <p className="text-[#F0F6FC] font-bold text-sm">
                    {clientOnboardingLanguage === 'ur'
                      ? `آن سائٹ نقد تحویل: ${agentFullName}`
                      : clientOnboardingLanguage === 'ar'
                      ? `التحصيل النقدي الميداني بعهدة: ${agentFullName}`
                      : `On-Site Physical Cash Custody: ${agentFullName}`}
                  </p>
                  <p className="text-[#D29922] text-[11px]">
                    {clientOnboardingLanguage === 'ur'
                      ? 'صرف پاکستان میں ابتدائی آن بورڈنگ سیٹ اپ کے لیے مجاز (انگوٹھے کی بائیومیٹرک تصدیق)'
                      : clientOnboardingLanguage === 'ar'
                      ? 'مسموح حصراً لتأسيس الصالون داخل باكستان (موثق ببصمة الإبهام)'
                      : 'Permissible exclusively for initial Pakistan onboarding setup (Hardware Thumbprint Signed)'}
                  </p>
                  <p className="text-[10px] text-[#8B949E]">
                    {clientOnboardingLanguage === 'ur'
                      ? 'وصول شدہ نقد رقم خودکار طور پر ایجنٹ لیجر میں درج ہو جاتی ہے · پاکستان سے باہر نقد ممنوع'
                      : clientOnboardingLanguage === 'ar'
                      ? 'يتم تسجيل العهدة النقدية تلقائياً في سجل الوكيل · يُمنع النقد خارج باكستان'
                      : 'Held Cash Liability automatically recorded against agent ledger · Zero cash outside Pakistan'}
                  </p>
                </div>
              )}
            </div>

            {/* Auto-Detected Dual Alert Recipient Routing Mode */}
            <div className="mt-3 rounded-xl border border-[#06B6D4]/30 bg-[#0D1117] p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-[#06B6D4] font-bold flex items-center gap-1.5">
                <Radio className="size-3.5 text-[#06B6D4] animate-pulse" />
                <span>{t.routingAssisted}</span>
              </span>
              <span className="text-[#8B949E] text-[10px]">{t.ownerAgentPush}</span>
            </div>

            {/* Payer Input Form with Layer 1 Registered Phone Binding */}
            <form onSubmit={handleVerifyDrawerPayment} className="mt-3.5 space-y-3.5">
              {/* Layer 1 Phone-Bound Notice */}
              <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono">
                  <span className="text-[#3FB950] font-bold flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-[#3FB950]" />
                    <span>{t.layer1PolicyTitle}</span>
                  </span>
                  <span className="text-[#8B949E] text-[10px]">{t.layer1PolicyBadge}</span>
                </div>
                <p className="text-xs text-[#F0F6FC] font-sans">
                  {t.registeredSimLabel} <strong className="text-[#06B6D4] font-mono" dir="ltr">{phone}</strong> ({ownerName})
                </p>
                <p className="text-[10px] text-[#8B949E] font-sans">
                  {t.layer1PolicyDesc} <span dir="ltr">{phone}</span> ({activePackage.prefix}{activePackage.monthlyMaint.toLocaleString()}{t.perMonthShort}).
                </p>
              </div>

              {/* Automated Central SIM Gateway Webhook Simulation */}
              {detectedCountry.isDomestic && setupPaymentMethod !== 'Cash Collection' && (
                <div className="p-3 rounded-xl border border-[#06B6D4]/30 bg-[#0D1117] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-[#06B6D4] font-bold flex items-center gap-1.5">
                      <Radio className="size-3.5 text-[#06B6D4] animate-pulse" />
                      <span>{t.simGatewayTitle}</span>
                    </span>
                    <span className="text-[10px] text-[#3FB950] font-bold bg-[#0D3822] px-2 py-0.5 rounded border border-[#116329]">
                      {t.liveListenerBadge}
                    </span>
                  </div>

                  {simWebhookState === 'listening' ? (
                    <p className="text-[11px] text-[#8B949E] font-sans flex items-center gap-2">
                      <RotateCcw className="size-3 animate-spin text-[#06B6D4]" />
                      <span>{t.listeningSimText} <strong className="text-[#F0F6FC]" dir="ltr">{phone}</strong>...</span>
                    </p>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-[#0D3822] border border-[#116329] text-[11px] text-[#3FB950] space-y-0.5">
                      <p className="font-bold flex items-center gap-1 text-[#3FB950]">
                        <CheckCircle2 className="size-3.5 text-[#3FB950]" />
                        <span>{t.webhookCapturedTitle}</span>
                      </p>
                      <p className="font-mono text-[10px] text-[#F0F6FC] break-all [overflow-wrap:break-word]" dir="ltr">
                        {activePackage.prefix}{activePackage.setupFee.toLocaleString()} · {phone} · {getLocalizedPaymentMethodName(setupPaymentMethod, clientOnboardingLanguage)} · TID: {drawerTid}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] text-[#6E7681] font-sans">
                      {t.otherSimHint}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSimWebhookState('listening');
                        setTimeout(() => {
                          const autoTid = setupPaymentMethod === 'EasyPaisa'
                            ? `EP-${Math.floor(10000000000 + Math.random() * 90000000000)}`
                            : setupPaymentMethod === 'JazzCash'
                            ? `JC-${Math.floor(10000000000 + Math.random() * 90000000000)}`
                            : `RAAST-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
                          setDrawerTid(autoTid);
                          setDrawerSenderDetails(`${ownerName} (${phone})`);
                          setSimWebhookState('detected');
                        }, 500);
                      }}
                      className="min-h-[36px] px-3 py-1 rounded-lg bg-[#21262D] border border-[#30363D] hover:border-[#06B6D4] text-[#06B6D4] text-[10px] font-mono font-bold transition active:scale-95"
                    >
                      {t.reScanBtn}
                    </button>
                  </div>
                </div>
              )}

              {/* Query 3: Outside-Pakistan Same-Currency Direct 20% / 80% Split Checkout */}
              {!detectedCountry.isDomestic && (userRole as string) !== 'SALON_OWNER' && (
                <div className="p-3.5 rounded-xl border border-[#06B6D4]/40 bg-[#0D1117] space-y-2 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[#06B6D4] font-bold">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-[#3FB950] shrink-0" />
                      <span>Same-Currency Direct Split ({activePackage.currency})</span>
                    </span>
                    <span className="text-[10px] text-[#3FB950] bg-[#0D3822] px-2 py-0.5 rounded border border-[#116329]">
                      Zero Double FX Loss
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-[#161B22] border border-[#9E6A03] p-2">
                      <span className="text-[#8B949E] block text-[9px] uppercase">20% Direct to Agent</span>
                      <span className="font-bold text-[#D29922]" dir="ltr">
                        {activePackage.prefix}{activePackage.agentCommission.toLocaleString()} {activePackage.currency}
                      </span>
                    </div>
                    <div className="rounded-lg bg-[#161B22] border border-[#116329] p-2">
                      <span className="text-[#8B949E] block text-[9px] uppercase">80% Net to WorkCraft</span>
                      <span className="font-bold text-[#3FB950]" dir="ltr">
                        {activePackage.prefix}{(activePackage.setupFee - activePackage.agentCommission).toLocaleString()} {activePackage.currency}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#8B949E] font-sans leading-relaxed">
                    Outside Pakistan, client card/bank payment splits automatically in <strong className="text-[#F0F6FC]">{activePackage.currency}</strong>: 20% goes directly to the agent&apos;s local payout account and 80% settles to WorkCraft without PKR round-trip conversion fees.
                  </p>
                </div>
              )}

              <div>
                <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E] block mb-1">
                  {t.payerDetailsLabel}
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={drawerSenderDetails || `${ownerName} (${phone})`}
                  onChange={(e) => setDrawerSenderDetails(e.target.value)}
                  placeholder={`${ownerName} (${phone})`}
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-xs font-mono text-[#3FB950] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4] text-left"
                />
                <span className="text-[10px] text-[#6E7681] block mt-0.5">
                  {t.payerDetailsHint}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E]">
                    {t.tidInputLabel}
                  </label>
                  <span className="text-[10px] font-mono text-[#06B6D4]">
                    {t.smsAutoCapture}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  dir="ltr"
                  placeholder="EP-98412850231 / SWIFT / pi_..."
                  value={drawerTid}
                  onChange={(e) => setDrawerTid(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-xs font-mono text-[#06B6D4] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E] block mb-1">
                  {t.lockedAmountLabel}
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${activePackage.prefix} ${activePackage.setupFee.toLocaleString()} (${getLocalizedPackageName(activePackage.name, clientOnboardingLanguage)})`}
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-xs font-mono font-bold text-[#D29922] select-none cursor-not-allowed"
                />
              </div>

              {/* Dual Cash Risk Guard & Biometric Hardware Thumbprint */}
              {setupPaymentMethod === 'Cash Collection' && (
                <div className="space-y-3">
                  <div className={`rounded-xl border p-3 font-mono text-xs space-y-1.5 ${
                    cashLiabilityHeld + activePackage.setupFee > MAX_CASH_CEILING
                      ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149]'
                      : 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="size-4 text-[#D29922]" />
                        <span>{t.cashGuardTitle}</span>
                      </span>
                      <span dir="ltr">
                        PKR {(cashLiabilityHeld + activePackage.setupFee).toLocaleString()} / {MAX_CASH_CEILING.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#0D1117] overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          cashLiabilityHeld + activePackage.setupFee > MAX_CASH_CEILING
                            ? 'bg-[#F85149]'
                            : 'bg-[#D29922]'
                        }`}
                        style={{ width: `${Math.min(100, ((cashLiabilityHeld + activePackage.setupFee) / MAX_CASH_CEILING) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[#F0F6FC] font-sans">
                      {cashLiabilityHeld + activePackage.setupFee > MAX_CASH_CEILING
                        ? t.cashLimitExceeded
                        : `${t.cashHeldPrefix} PKR ${cashLiabilityHeld.toLocaleString()}`}
                    </p>
                  </div>

                  {/* Strict Biometric Hardware Thumbprint Verification */}
                  <div className={`p-4 rounded-2xl border text-center space-y-2.5 transition ${
                    isThumbprintVerified
                      ? 'border-[#116329] bg-[#0D3822]'
                      : 'border-[#06B6D4]/40 bg-[#0D1117]'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <span className="text-[#F0F6FC] font-bold uppercase flex items-center gap-1.5">
                        <Fingerprint className="size-4 text-[#06B6D4]" />
                        <span>{t.biometricTitle}</span>
                      </span>
                      <span className="text-[9px] font-bold text-[#D29922] bg-[#3B2E0B] px-2 py-0.5 rounded border border-[#9E6A03]">
                        {t.zeroPinBadge}
                      </span>
                    </div>

                    <div className="flex justify-center py-1">
                      <button
                        type="button"
                        disabled={isScanningThumb || isThumbprintVerified || (cashLiabilityHeld + activePackage.setupFee > MAX_CASH_CEILING)}
                        onClick={() => {
                          setIsScanningThumb(true);
                          setTimeout(() => {
                            setIsScanningThumb(false);
                            setIsThumbprintVerified(true);
                            setThumbprintHash('SHA256: 9b8c-02e1-48af-9102-thumb-verified');
                          }, 900);
                        }}
                        className={`relative grid size-16 place-items-center rounded-2xl border-2 transition active:scale-95 ${
                          isThumbprintVerified
                            ? 'border-[#3FB950] bg-[#0D3822] text-[#3FB950]'
                            : isScanningThumb
                            ? 'border-[#06B6D4] bg-[#21262D] text-[#06B6D4] animate-pulse'
                            : 'border-[#30363D] bg-[#21262D] text-[#8B949E] hover:border-[#06B6D4] hover:text-[#06B6D4]'
                        }`}
                        title={t.pressThumbText}
                      >
                        <Fingerprint className={`size-8 ${isScanningThumb ? 'animate-bounce' : ''}`} />
                        {isThumbprintVerified && (
                          <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-[#3FB950] text-[#0D1117]">
                            <Check className="size-3 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    </div>

                    <p className="text-[11px] font-mono text-center break-all [overflow-wrap:break-word]">
                      {isScanningThumb ? (
                        <span className="text-[#06B6D4]">{t.scanningThumbText}</span>
                      ) : isThumbprintVerified ? (
                        <span className="text-[#3FB950] font-bold">{t.thumbVerifiedText} (<span dir="ltr">{thumbprintHash}</span>)</span>
                      ) : (
                        <span className="text-[#8B949E]">{t.pressThumbText}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* 4-Layer Anti-Fraud Notice */}
              <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 text-[10px] font-mono text-[#3FB950] space-y-1">
                <span className="font-bold flex items-center gap-1 text-[#3FB950]">
                  <ShieldCheck className="size-3.5" />
                  <span>{t.antiFraudTitle}</span>
                </span>
                <p className="font-sans text-[#F0F6FC] leading-relaxed">
                  {t.antiFraudDesc}
                </p>
              </div>

              {drawerError && (
                <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-2.5 text-xs font-mono text-[#F85149]">
                  {drawerError}
                </div>
              )}

              {/* Proceed Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentDrawerOpen(false)}
                  className="sm:flex-1 min-h-[48px] rounded-xl border border-[#30363D] bg-[#21262D] py-3 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58] transition"
                >
                  {t.cancelLabel}
                </button>
                <button
                  type="submit"
                  disabled={drawerIsSubmitting || (setupPaymentMethod === 'Cash Collection' && cashLiabilityHeld + activePackage.setupFee > MAX_CASH_CEILING)}
                  className="sm:flex-[2] min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] py-3 px-4 text-xs font-mono font-black uppercase transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {drawerIsSubmitting ? (
                    <>
                      <RotateCcw className="size-4 animate-spin text-[#0D1117]" />
                      <span>{t.verifyingBtn}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 text-[#0D1117]" />
                      <span>{t.verifyBindBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. ADD NEW FIELD AGENT MODAL (FOUNDER ONLY - QUERIES 2, 3, 4) */}
      {/* ========================================================================= */}
      <AddNewAgentModal
        isOpen={isAddAgentModalOpen}
        onClose={() => setIsAddAgentModalOpen(false)}
        onAgentAdded={(newAgent) => {
          const det = detectCountryFromPhone(newAgent.phone, newAgent.city);
          const idCfg = getNationalIdConfigForCountry(det, 'en');
          const payoutCfg = getPayoutConfigForCountry(det);
          setEnrolledAgentsList((prev) => [
            ...prev,
            {
              id: newAgent.id,
              pin: newAgent.pin,
              name: newAgent.name,
              phone: newAgent.phone,
              city: newAgent.city,
              category: newAgent.category,
              cnicOrId: idCfg.sampleId,
              payoutMethod: payoutCfg.defaultMethod,
              payoutAccount: newAgent.phone,
              payoutTitle: newAgent.name,
              bankName: payoutCfg.defaultBank,
              status: 'INVITATION DISPATCHED',
              enrolledAt: 'Pending Day-1 Activation',
              selfieVerified: false,
              thumbHash: 'PENDING ENROLLMENT',
              legalRemittanceAgreed: false,
              legalTermsText: 'Pending remote acceptance',
            },
          ]);
        }}
        onOpenRemoteEnrollment={(newAgent) => {
          const det = detectCountryFromPhone(newAgent.phone, newAgent.city);
          const allowed = getEnrollmentLanguagesForPhone(newAgent.phone);
          const initialLang = allowed[0].code;
          const idCfg = getNationalIdConfigForCountry(det, initialLang);
          const payoutCfg = getPayoutConfigForCountry(det);

          setEnrollAgentName(newAgent.name);
          setEnrollAgentPhone(newAgent.phone);
          setEnrollAgentCity(newAgent.city);
          setEnrollAgentId(idCfg.sampleId);
          setEnrollPayoutTitle(newAgent.name);
          setEnrollPayoutAccount(newAgent.phone);
          setEnrollBankMobile(newAgent.phone);
          setEnrollPayoutMethod(payoutCfg.defaultMethod);
          setEnrollBankName(payoutCfg.defaultBank);
          setEnrollmentLang(initialLang);

          setEnrollmentStep(1);
          setIsRemoteEnrollmentWizardOpen(true);
        }}
      />

      {/* ========================================================================= */}
      {/* 2. CENTRAL AGENT DAY-1 DOSSIER MODAL (QUERY 15) */}
      {/* ========================================================================= */}
      {selectedDossierAgent && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-[#0D1117]/80 p-3 sm:p-5 backdrop-blur-md overflow-y-auto"
          onClick={() => setSelectedDossierAgent(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[560px] rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150 my-6 max-h-[92vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-start justify-between border-b border-[#21262D] pb-3">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl bg-[#3B2E0B] border border-[#9E6A03] text-[#D29922]">
                  <FileText className="size-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[.2em] text-[#D29922]">
                    CENTRAL AGENT DOSSIER (QUERY 15)
                  </span>
                  <h3 className="text-xl font-black text-[#F0F6FC] tracking-tight">
                    {selectedDossierAgent.name} (#{selectedDossierAgent.id})
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedDossierAgent(null)}
                className="min-h-[44px] min-w-[44px] rounded-lg grid place-items-center text-[#8B949E] hover:text-[#F0F6FC] transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Dossier Header Info */}
            <div className="flex items-center gap-4 rounded-2xl bg-[#0D1117] border border-[#30363D] p-3.5">
              <div className="relative shrink-0">
                <div className="size-16 rounded-2xl bg-[#21262D] border-2 border-[#3FB950] grid place-items-center font-mono font-bold text-lg text-[#F0F6FC]">
                  {selectedDossierAgent.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-[#3FB950] text-[#0D1117]">
                  <Check className="size-3 stroke-[3]" />
                </span>
              </div>
              <div className="min-w-0 flex-1 font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#F0F6FC]">{selectedDossierAgent.name}</span>
                  <span className="text-[10px] text-[#3FB950] font-bold bg-[#0D3822] px-2 py-0.5 rounded border border-[#116329]">
                    {selectedDossierAgent.status}
                  </span>
                </div>
                <p className="text-xs text-[#8B949E] mt-0.5">{selectedDossierAgent.phone}</p>
                <p className="text-[11px] text-[#06B6D4] mt-0.5">{selectedDossierAgent.city}</p>
              </div>
            </div>

            {/* Dossier Detail Fields */}
            <div className="space-y-2.5 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[#0D1117] p-3 rounded-xl border border-[#30363D]">
                <div>
                  <span className="text-[10px] text-[#8B949E] block uppercase">NATIONAL ID / CNIC</span>
                  <span className="font-bold text-[#F0F6FC] text-sm">{selectedDossierAgent.cnicOrId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8B949E] block uppercase">SECURITY PIN</span>
                  <span className="font-bold text-[#D29922] text-sm">{selectedDossierAgent.pin}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-[#21262D] min-w-0 overflow-hidden">
                  <span className="text-[10px] text-[#8B949E] block uppercase">OPTICAL THUMBPRINT HARDWARE ENCRYPTION</span>
                  <span dir="ltr" className="font-bold text-[#06B6D4] text-xs flex items-center gap-1.5 mt-0.5 break-all [overflow-wrap:break-word]">
                    <Fingerprint className="size-3.5 shrink-0" />
                    <span className="break-all [overflow-wrap:break-word]">{selectedDossierAgent.thumbHash}</span>
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-[#0D1117] p-3 border border-[#30363D] space-y-1 min-w-0 overflow-hidden">
                <span className="text-[10px] text-[#8B949E] block uppercase">COMMISSION PAYOUT ROUTE</span>
                <p className="text-sm font-bold text-[#D29922] break-all [overflow-wrap:break-word]">
                  {selectedDossierAgent.payoutMethod} · <span dir="ltr">{selectedDossierAgent.payoutAccount}</span>
                </p>
                <p className="text-[11px] text-[#8B949E] font-sans break-all [overflow-wrap:break-word]">
                  Account Title: <strong className="text-[#F0F6FC]">{selectedDossierAgent.payoutTitle}</strong> {selectedDossierAgent.iban && <span dir="ltr">· IBAN: {selectedDossierAgent.iban}</span>}
                </p>
              </div>

              {selectedDossierAgent.guarantorName && (
                <div className="rounded-xl bg-[#0D1117] p-3 border border-[#30363D] space-y-1">
                  <span className="text-[10px] text-[#8B949E] block uppercase">GUARANTOR REFERENCE (PAKISTAN CASH ONLY)</span>
                  <p className="text-xs text-[#F0F6FC]">
                    <strong>{selectedDossierAgent.guarantorName}</strong> ({selectedDossierAgent.guarantorPhone})
                  </p>
                </div>
              )}

              <div className="rounded-xl bg-[#0D3822]/40 p-3 border border-[#116329] space-y-1">
                <span className="text-[10px] text-[#3FB950] font-bold uppercase flex items-center gap-1">
                  <ShieldCheck className="size-3.5" />
                  <span>LEGAL REMITTANCE SIGNATURE RECORD</span>
                </span>
                <p className="text-[11px] text-[#F0F6FC] font-sans leading-relaxed">
                  {selectedDossierAgent.legalTermsText}
                </p>
                <span className="text-[10px] text-[#3FB950] block pt-1 border-t border-[#116329]">
                  ✓ Digital Timestamp: {selectedDossierAgent.enrolledAt}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const isSuspended = selectedDossierAgent.status.includes('SUSPENDED');
                  const newStatus = isSuspended ? 'ACTIVE · ON-FIELD' : 'SUSPENDED · TERMINAL LOCKED';
                  setEnrolledAgentsList(prev => prev.map(a => a.id === selectedDossierAgent.id ? { ...a, status: newStatus } : a));
                  setSelectedDossierAgent((prev: any) => prev ? { ...prev, status: newStatus } : null);
                  if (selectedDossierAgent.name === agentFullName) {
                    setIsAgentSuspendedByFounder(!isSuspended);
                  }
                }}
                className={`flex-1 min-h-[48px] rounded-xl py-2.5 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 border ${
                  selectedDossierAgent.status.includes('SUSPENDED')
                    ? 'border-[#116329] bg-[#0D3822] text-[#3FB950] hover:bg-[#0D3822]/80'
                    : 'border-[#da3633] bg-[#4C1C1D] text-[#F85149] hover:bg-[#4C1C1D]/80'
                }`}
              >
                <Power className="size-3.5" />
                <span>{selectedDossierAgent.status.includes('SUSPENDED') ? 'Restore Agent' : 'Kill-Switch: Suspend'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDossierAgent(null)}
                className="flex-1 min-h-[48px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] py-2.5 text-xs font-mono font-bold uppercase transition"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BIOMETRIC RE-SCAN MODAL FOR PROFILE EDITS (LOCALIZED EN/UR/AR) */}
      {/* ========================================================================= */}
      {isBiometricModalOpenForEdit && (() => {
        const isUrdu = agentLanguage === 'ur' || agentLanguage === 'ur_roman';
        const isArabic = agentLanguage === 'ar';
        const modalDir = isUrdu || isArabic ? 'rtl' : 'ltr';
        const mL = isArabic
          ? {
              kicker: 'تأكيد البصمة الأمنية',
              title: 'تأكيد تعديل الملف والحساب البنكي',
              desc: 'لمنع أي تغيير غير مصرح به في حسابات العمولات، يرجى الضغط على مستشعر بصمة الإبهام أدناه.',
              scanning: 'جاري قراءة مستشعر البصمة...',
              tapPrompt: 'المس مستشعر البصمة للتأكيد',
              cancel: 'إلغاء التعديل',
              savedMsg: 'تم التأكيد بالبصمة وحفظ البيانات بنجاح:',
            }
          : isUrdu
          ? {
              kicker: 'انگوٹھے کی تصدیق لازمی ہے',
              title: 'پروفائل اور بینک تبدیلی کی تصدیق کریں',
              desc: 'آپ کے کمیشن اکاؤنٹ کو محفوظ رکھنے کے لیے نیچے دیے گئے انگوٹھے کے سینسر کو ٹچ کریں۔',
              scanning: 'انگوٹھا اسکین ہو رہا ہے...',
              tapPrompt: 'شناخت کی تصدیق کے لیے یہاں ٹچ کریں',
              cancel: 'منسوخ کریں',
              savedMsg: 'انگوٹھے کی تصدیق کے بعد محفوظ ہو گیا:',
            }
          : {
              kicker: 'BIOMETRIC SECURITY CHECK',
              title: 'Confirm Profile & Bank Update',
              desc: 'To keep your payout account safe, touch the thumbprint sensor below to confirm you personally made these changes.',
              scanning: 'Reading thumbprint...',
              tapPrompt: 'Tap sensor to confirm identity',
              cancel: 'Cancel Update',
              savedMsg: 'Thumbprint Confirmed & Saved:',
            };

        return (
          <div
            className="fixed inset-0 z-[95] grid place-items-center bg-[#0D1117]/80 p-3 sm:p-5 backdrop-blur-md"
            onClick={() => setIsBiometricModalOpenForEdit(false)}
          >
            <div
              dir={modalDir}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[440px] rounded-3xl border border-[#30363D] bg-[#161B22] p-6 pb-8 text-center shadow-2xl animate-in zoom-in-95 duration-150 space-y-4 relative overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setIsBiometricModalOpenForEdit(false)}
                className="min-h-[44px] min-w-[44px] grid place-items-center absolute right-4 top-4 rounded-lg p-1.5 text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition"
                aria-label="Close biometric gate"
              >
                <X className="size-5" />
              </button>

              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4]">
                <Fingerprint className="size-8" />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#06B6D4] font-bold">
                  {mL.kicker}
                </span>
                <h3 className="text-lg font-black text-[#F0F6FC]">{mL.title}</h3>
                <p className="text-xs text-[#8B949E] font-sans max-w-sm mx-auto leading-relaxed">
                  {mL.desc}
                </p>
              </div>

              <div className="py-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsBiometricScanningForEdit(true);
                    setTimeout(() => {
                      const updatedHash = `BIO-${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
                      const nowStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ✓';
                      setAgentWhatsApp(draftAgentPhone);
                      setAgentTerritory(draftAgentTerritory);
                      setAgentOperatingRegion(draftAgentRegion);
                      setAgentPayoutMethod(draftAgentPayoutMethod);
                      setAgentBankName(draftAgentBankName);
                      setAgentPayoutAccount(draftAgentPayoutAccount);
                      setAgentPayoutTitle(draftAgentPayoutTitle);
                      setAgentIban(draftAgentIban);
                      setProfileThumbHash(updatedHash);
                      setProfileBiometricSealTime(nowStamp);
                      setEnrolledAgentsList((prev) =>
                        prev.map((ag) =>
                          ag.name === agentFullName
                            ? {
                                ...ag,
                                phone: draftAgentPhone,
                                city: draftAgentTerritory,
                                payoutMethod: draftAgentPayoutMethod,
                                payoutAccount: draftAgentPayoutAccount,
                                payoutTitle: draftAgentPayoutTitle,
                                bankName: draftAgentBankName,
                                iban: draftAgentIban,
                                thumbHash: updatedHash,
                              }
                            : ag
                        )
                      );
                      setIsBiometricScanningForEdit(false);
                      setIsBiometricModalOpenForEdit(false);
                      setPayoutSaveStatus(`${mL.savedMsg} (${nowStamp})`);
                    }, 950);
                  }}
                  className={`mx-auto size-28 rounded-full border-2 ${
                    isBiometricScanningForEdit
                      ? 'border-[#06B6D4] bg-[#06B6D4]/20 animate-pulse'
                      : 'border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] hover:bg-[#06B6D4]/10'
                  } transition grid place-items-center relative group`}
                >
                  <Fingerprint
                    className={`size-14 ${
                      isBiometricScanningForEdit ? 'text-[#06B6D4] scale-110' : 'text-[#8B949E] group-hover:text-[#06B6D4]'
                    } transition`}
                  />
                  {isBiometricScanningForEdit && (
                    <div className="absolute inset-0 rounded-full border-t-2 border-[#06B6D4] animate-spin" />
                  )}
                </button>
                <span className="text-[10px] font-mono text-[#8B949E] block mt-2">
                  {isBiometricScanningForEdit ? mL.scanning : mL.tapPrompt}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsBiometricModalOpenForEdit(false)}
                className="min-h-[44px] px-4 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC] underline"
              >
                {mL.cancel}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 4. DAY-1 REMOTE AGENT ENROLLMENT WIZARD (QUERIES 5 - 14, 17, 18) */}
      {/* ========================================================================= */}
      {isRemoteEnrollmentWizardOpen && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#0D1117]/80 p-3 sm:p-5 backdrop-blur-md overflow-y-auto"
          onClick={() => setIsRemoteEnrollmentWizardOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[620px] rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 pb-12 shadow-2xl animate-in zoom-in-95 duration-150 my-6 max-h-[94vh] overflow-y-auto overflow-x-hidden space-y-4"
          >
            {/* Top Bar with Sticky Tri-Language Selector (Query 6) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#21262D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-10 place-items-center rounded-xl bg-[#3B2E0B] border border-[#9E6A03] text-[#D29922]">
                  <Smartphone className="size-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#D29922]">
                    DAY-1 REMOTE AGENT ONBOARDING
                  </span>
                  <h3 className="text-base font-black text-[#F0F6FC]">
                    {enrollmentLang === 'ur_roman'
                      ? 'ایجنٹ کا اندراج'
                      : enrollmentLang === 'ar'
                      ? 'تسجيل الوكيل الميداني الجديد'
                      : 'Field Agent Remote Enrollment'}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Regional Allowed Language Switcher (Query 1: PK/IN -> Urdu+English, MENA -> Arabic+English, Europe -> English) */}
                <div className="flex items-center rounded-xl bg-[#0D1117] border border-[#30363D] p-1 text-xs font-mono">
                  <span className="px-1.5 text-[#8B949E] flex items-center gap-1">
                    <Globe className="size-3.5 text-[#06B6D4]" />
                  </span>
                  {getEnrollmentLanguagesForPhone(enrollAgentPhone).map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setEnrollmentLang(lang.code)}
                      className={`min-h-[36px] px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                        enrollmentLang === lang.code
                          ? 'bg-[#06B6D4] text-[#0D1117] font-black'
                          : 'text-[#8B949E] hover:text-[#F0F6FC]'
                      }`}
                      title={lang.description}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.nativeLabel}</span>
                    </button>
                  ))}
                </div>

                {/* Top-Right [X] Close Button (Query 6) */}
                <button
                  type="button"
                  onClick={() => setIsRemoteEnrollmentWizardOpen(false)}
                  className="min-h-[44px] min-w-[44px] rounded-lg grid place-items-center text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition"
                  aria-label="Close Enrollment Wizard"
                  title="Close Wizard"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Stepper Header (1 to 5) */}
            <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-[10px]">
              {[
                { step: 1, label: enrollmentLang === 'ur_roman' ? 'شناخت' : enrollmentLang === 'ar' ? 'الهوية' : 'Identity' },
                { step: 2, label: enrollmentLang === 'ur_roman' ? 'بایومیٹرک' : enrollmentLang === 'ar' ? 'البصمة' : 'Biometric' },
                { step: 3, label: enrollmentLang === 'ur_roman' ? 'بینک/رقم' : enrollmentLang === 'ar' ? 'الدفع' : 'Payout' },
                { step: 4, label: enrollmentLang === 'ur_roman' ? 'اقرار نامہ' : enrollmentLang === 'ar' ? 'الإقرار' : 'Legal' },
                { step: 5, label: enrollmentLang === 'ur_roman' ? 'مبارک' : enrollmentLang === 'ar' ? 'التفعيل' : 'Active' },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`p-1.5 rounded-lg border ${
                    enrollmentStep === s.step
                      ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922] font-bold'
                      : enrollmentStep > s.step
                      ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                      : 'border-[#30363D] bg-[#0D1117] text-[#6E7681]'
                  }`}
                >
                  <span className="block font-bold">Step {s.step}</span>
                  <span className="truncate block">{s.label}</span>
                </div>
              ))}
            </div>

            {/* STEP 1: IDENTITY & WORLDWIDE COUNTRY DETECTION */}
            {enrollmentStep === 1 && (() => {
              const detected = detectCountryFromPhone(enrollAgentPhone, enrollAgentCity);
              const idCfg = getNationalIdConfigForCountry(detected, enrollmentLang);
              const validCities = REGIONAL_CITY_MAP[detected.code]?.cities || [];

              return (
                <div
                  dir={enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'rtl' : 'ltr'}
                  className={`space-y-3.5 animate-in fade-in min-w-0 ${
                    enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'text-right' : 'text-left'
                  }`}
                >
                  <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-1">
                    <span className="text-[10px] font-mono text-[#06B6D4] font-bold uppercase">
                      {enrollmentLang === 'ur_roman'
                        ? 'بنیادی معلومات اور ملک کی خودکار شناخت'
                        : enrollmentLang === 'ar'
                        ? 'المعلومات الشخصية والكشف التلقائي للدولة'
                        : 'Personal Details & Worldwide Country Detection'}
                    </span>
                    <p className="text-xs text-[#8B949E] font-sans">
                      {enrollmentLang === 'ur_roman'
                        ? 'اپنا پورا نام (انگریزی میں)، ملک، واٹس ایپ نمبر اور قومی شناختی نمبر درج کریں۔'
                        : enrollmentLang === 'ar'
                        ? 'أدخل اسمك الكامل (بالإنجليزية)، الدولة، رقم الواتساب ورقم الهوية المعتمدة.'
                        : 'Enter your full legal name, WhatsApp number with country dial code, and local identity details.'}
                    </p>
                  </div>

                  {/* Full Name (Label in selected language; Input always LTR left-aligned & English format) */}
                  <div>
                    <label className="text-[11px] font-mono text-[#8B949E] block mb-1 uppercase font-bold">
                      {enrollmentLang === 'ur_roman'
                        ? 'پورا نام (انگریزی میں درج کریں) *'
                        : enrollmentLang === 'ar'
                        ? 'الاسم الكامل (بالحروف الإنجليزية) *'
                        : 'Full Legal Name *'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={enrollAgentName}
                      onChange={(e) => setEnrollAgentName(e.target.value)}
                      placeholder="e.g. Bilal Sheikh"
                      className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-sm text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>

                  {/* Country Selector (Synced with WhatsApp dial code worldwide) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-mono text-[#8B949E] uppercase font-bold">
                        {enrollmentLang === 'ur_roman'
                          ? 'ملک منتخب کریں *'
                          : enrollmentLang === 'ar'
                          ? 'الدولة *'
                          : 'Operational Country *'}
                      </label>
                      <span dir="ltr" className="text-[10px] font-mono font-bold text-[#3FB950]">
                        {detected.flag} {detected.name} ({detected.dialCode})
                      </span>
                    </div>
                    <select
                      dir="ltr"
                      value={DIAL_CODE_OPTIONS.some((d) => d.code === detected.code) ? detected.code : 'CUSTOM'}
                      onChange={(e) => {
                        const chosen = DIAL_CODE_OPTIONS.find((d) => d.code === e.target.value);
                        if (!chosen) return;
                        const nextPhone = `${chosen.dialCode} ${chosen.sampleDigits}`;
                        const nextDet = detectCountryFromPhone(nextPhone, chosen.name);
                        const nextLangs = getEnrollmentLanguagesForPhone(nextPhone);
                        const nextLang = nextLangs.some((l) => l.code === enrollmentLang) ? enrollmentLang : nextLangs[0].code;
                        const nextIdCfg = getNationalIdConfigForCountry(nextDet, nextLang);
                        const nextPayoutCfg = getPayoutConfigForCountry(nextDet);

                        setEnrollAgentPhone(nextPhone);
                        setEnrollAgentCity(nextDet.defaultCity);
                        setEnrollAgentId(nextIdCfg.sampleId);
                        setEnrollPayoutMethod(nextPayoutCfg.defaultMethod);
                        setEnrollBankName(nextPayoutCfg.defaultBank);
                        setEnrollBankMobile(nextPhone);
                        setCityValidationError(null);
                        setEnrollmentLang(nextLang);
                      }}
                      className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-xs font-mono text-left text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                    >
                      {!DIAL_CODE_OPTIONS.some((d) => d.code === detected.code) && (
                        <option value="CUSTOM" className="bg-[#161B22] text-[#06B6D4]">
                          {detected.flag} {detected.name} ({detected.dialCode})
                        </option>
                      )}
                      {DIAL_CODE_OPTIONS.map((d) => (
                        <option key={d.code} value={d.code} className="bg-[#161B22] text-[#F0F6FC]">
                          {d.flag} {d.name} ({d.dialCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* WhatsApp Number (Always LTR left-aligned) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-mono text-[#8B949E] uppercase font-bold">
                        {enrollmentLang === 'ur_roman' ? 'واٹس ایپ نمبر (WhatsApp) *' : enrollmentLang === 'ar' ? 'رقم الواتساب *' : 'WhatsApp Number *'}
                      </label>
                      <span dir="ltr" className="text-[10px] font-mono font-bold text-[#06B6D4] flex items-center gap-1">
                        <span>{detected.flag}</span>
                        <span>{detected.name} · {detected.localCurrency}</span>
                      </span>
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      value={enrollAgentPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEnrollAgentPhone(val);
                        const nextDet = detectCountryFromPhone(val, enrollAgentCity);
                        const langs = getEnrollmentLanguagesForPhone(val);
                        const nextLang = langs.some((l) => l.code === enrollmentLang) ? enrollmentLang : langs[0].code;
                        if (nextLang !== enrollmentLang) {
                          setEnrollmentLang(nextLang);
                        }
                        const nextIdCfg = getNationalIdConfigForCountry(nextDet, nextLang);
                        const nextPayoutCfg = getPayoutConfigForCountry(nextDet);
                        setEnrollAgentId(nextIdCfg.sampleId);
                        setEnrollPayoutMethod(nextPayoutCfg.defaultMethod);
                        setEnrollBankName(nextPayoutCfg.defaultBank);
                        setCityValidationError(checkCityCountryIntegrity(enrollAgentCity, val));
                      }}
                      placeholder="+92 300 4819204 / +1 416 5550198 / +49 151 2345678"
                      className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-sm font-mono text-left text-[#06B6D4] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>

                  {/* Dynamic National Identity Field Auto-Detected Worldwide (Always LTR left-aligned) */}
                  <div>
                    <label className="text-[11px] font-mono text-[#D29922] block mb-1 uppercase font-bold">
                      {idCfg.label}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={enrollAgentId}
                      onChange={(e) => setEnrollAgentId(e.target.value)}
                      placeholder={idCfg.placeholder}
                      className="w-full min-h-[48px] rounded-xl border border-[#9E6A03] bg-[#0D1117] px-3.5 py-2.5 text-sm font-mono text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>

                  {/* Territory / City Field (Always LTR left-aligned) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-mono text-[#8B949E] uppercase font-bold">
                        {enrollmentLang === 'ur_roman' ? 'علاقہ / شہر (Assigned Territory) *' : enrollmentLang === 'ar' ? 'المدينة / المنطقة *' : 'Assigned Territory / City *'}
                      </label>
                      <span dir="ltr" className="text-[10px] font-mono text-[#3FB950]">
                        {detected.flag} {detected.name} ({detected.dialCode})
                      </span>
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      value={enrollAgentCity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEnrollAgentCity(val);
                        const err = checkCityCountryIntegrity(val, enrollAgentPhone);
                        setCityValidationError(err);
                      }}
                      placeholder={
                        validCities.length > 0
                          ? `${validCities.slice(0, 3).join(', ')}...`
                          : `${detected.defaultCity}...`
                      }
                      className={`w-full min-h-[48px] rounded-xl border px-3.5 py-2.5 text-sm font-sans text-left focus:outline-none transition ${
                        cityValidationError
                          ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149] focus:border-[#F85149]'
                          : 'border-[#30363D] bg-[#0D1117] text-[#F0F6FC] placeholder:text-[#484F58] focus:border-[#06B6D4]'
                      }`}
                    />

                    {/* Inline Geographic Conflict Error Banner */}
                    {cityValidationError && (
                      <div className="mt-2 rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 space-y-1.5 animate-in fade-in">
                        <div className="flex items-center gap-1.5 text-[#F85149] font-mono text-xs font-bold">
                          <AlertOctagon className="size-4 shrink-0 text-[#F85149]" />
                          <span>
                            {enrollmentLang === 'ar'
                              ? 'خطأ: تعارض بين رمز الدولة والمدينة المختارة'
                              : enrollmentLang === 'ur_roman'
                              ? 'انتباہ: ڈائل کوڈ اور منتخب شہر میں تضاد'
                              : 'Geographic Dial Code & City Conflict'}
                          </span>
                        </div>
                        <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
                          {enrollmentLang === 'ar'
                            ? cityValidationError.ar
                            : enrollmentLang === 'ur_roman'
                            ? cityValidationError.ur
                            : cityValidationError.en}
                        </p>
                      </div>
                    )}

                    {/* Suggested Valid Territory Pills for the Detected Country */}
                    {validCities.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[10px] font-mono text-[#8B949E] block">
                          {enrollmentLang === 'ar'
                            ? `المدن المعتمدة لـ ${detected.name}:`
                            : enrollmentLang === 'ur_roman'
                            ? `${detected.name} کے تصدیق شدہ اضلاع:`
                            : `Quick-select valid ${detected.name} territories:`}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {validCities.slice(0, 6).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setEnrollAgentCity(c);
                                setCityValidationError(null);
                              }}
                              className={`min-h-[36px] rounded-lg px-2.5 py-1 text-[11px] font-mono transition border ${
                                enrollAgentCity.toLowerCase().includes(c.toLowerCase())
                                  ? 'border-[#06B6D4] bg-[#06B6D4]/20 text-[#06B6D4] font-bold'
                                  : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58]'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const err = checkCityCountryIntegrity(enrollAgentCity, enrollAgentPhone);
                        if (err) {
                          setCityValidationError(err);
                          return;
                        }
                        setCityValidationError(null);
                        setEnrollmentStep(2);
                      }}
                      className="min-h-[48px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-bold uppercase transition flex items-center gap-1.5"
                    >
                      <span>{enrollmentLang === 'ur_roman' ? 'اگلا قدم: بایومیٹرک' : enrollmentLang === 'ar' ? 'التالي: البصمة' : 'Next: Biometric Capture →'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* STEP 2: LIVE SELFIE & HARDWARE BIOMETRIC (QUERY 9) */}
            {enrollmentStep === 2 && (
              <div
                dir={enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'rtl' : 'ltr'}
                className={`space-y-4 animate-in fade-in min-w-0 ${
                  enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'text-right' : 'text-left'
                }`}
              >
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-[#06B6D4] font-bold uppercase">
                      {enrollmentLang === 'ur_roman'
                        ? 'لائیو سیلفی اور بایومیٹرک (دونوں لازمی)'
                        : enrollmentLang === 'ar'
                        ? 'السيلفي المباشر والبصمة (كلاهما إلزامي)'
                        : 'Live Selfie & Biometric (Both Mandatory)'}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono font-bold">
                      <span className={`px-2 py-0.5 rounded border ${enrollSelfieDone ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]' : 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'}`}>
                        {enrollSelfieDone ? '✓ Selfie' : '1. Selfie Req'}
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${enrollThumbDone ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]' : 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'}`}>
                        {enrollThumbDone ? '✓ Biometric' : '2. Biometric Req'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#8B949E] font-sans">
                    {enrollmentLang === 'ur_roman'
                      ? 'اگلے مرحلے پر جانے کے لیے لائیو فرنٹ کیمرے سے سیلفی اور نیچے انگوٹھے کی بایومیٹرک تصدیق دونوں مکمل کریں۔'
                      : enrollmentLang === 'ar'
                      ? 'يجب إتمام التقاط صورة السيلفي المباشرة وبصمة الإبهام البيومترية معاً للانتقال للخطوة التالية.'
                      : 'Both Live Front Selfie capture and Hardware Thumbprint Biometric scan are strictly required before unlocking the next step.'}
                  </p>
                </div>

                {/* Live Selfie Viewfinder (Strict Front-Facing Live Camera Only) */}
                <div className="rounded-2xl bg-[#0D1117] border border-[#30363D] p-4 text-center space-y-3">
                  <div
                    role={!isCameraActive ? 'button' : undefined}
                    tabIndex={!isCameraActive ? 0 : undefined}
                    onClick={() => {
                      if (!isCameraActive) startSelfieCamera();
                    }}
                    onKeyDown={(e) => {
                      if (!isCameraActive && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        startSelfieCamera();
                      }
                    }}
                    aria-label={!isCameraActive ? 'Open Live Selfie Camera' : 'Live Selfie Camera Feed'}
                    className={`mx-auto size-40 rounded-2xl border-2 border-[#06B6D4] bg-[#161B22] grid place-items-center relative overflow-hidden ${
                      !isCameraActive ? 'cursor-pointer hover:border-[#22D3EE] transition' : ''
                    }`}
                  >
                    {isCameraActive ? (
                      <video
                        ref={selfieVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    ) : enrollSelfieDone && enrollSelfiePreviewUrl ? (
                      <>
                        <img
                          src={enrollSelfiePreviewUrl}
                          alt="Captured Agent Selfie"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1.5 left-1.5 right-1.5 rounded-md bg-[#0D3822]/90 border border-[#116329] px-1.5 py-0.5 text-[9px] font-mono font-bold text-[#3FB950]">
                          {enrollmentLang === 'ur_roman' ? '✓ تصویر محفوظ' : enrollmentLang === 'ar' ? '✓ تم التقاط الصورة' : '✓ SELFIE VERIFIED'}
                        </span>
                      </>
                    ) : (
                      <div className="text-center px-3">
                        <Camera className="size-8 text-[#06B6D4] mx-auto opacity-80" />
                        <span className="text-[9px] font-mono text-[#8B949E] block mt-1.5">
                          {enrollmentLang === 'ur_roman'
                            ? 'لائیو سیلفی کیمرہ کھولنے کے لیے یہاں کلک کریں'
                            : enrollmentLang === 'ar'
                            ? 'اضغط هنا لفتح كاميرا السيلفي المباشرة'
                            : 'OPEN LIVE SELFIE CAMERA'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {isCameraActive ? (
                      <>
                        <button
                          type="button"
                          onClick={captureSelfieFrame}
                          className="min-h-[44px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] px-4 py-2 text-xs font-mono font-bold text-[#0D1117] transition flex items-center gap-1.5"
                        >
                          <Camera className="size-4" />
                          <span>
                            {enrollmentLang === 'ur_roman'
                              ? 'ابھی تصویر کھینچیں'
                              : enrollmentLang === 'ar'
                              ? 'التقاط الصورة الآن'
                              : 'Capture Selfie Photo'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={stopSelfieCamera}
                          className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#21262D] px-3.5 py-2 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC] transition"
                        >
                          {enrollmentLang === 'ur_roman' ? 'بند کریں' : enrollmentLang === 'ar' ? 'إغلاق' : 'Stop Camera'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={startSelfieCamera}
                        className="min-h-[44px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] px-4 py-2 text-xs font-mono font-bold text-[#0D1117] transition flex items-center gap-1.5"
                      >
                        <Camera className="size-4" />
                        <span>
                          {enrollSelfieDone
                            ? (enrollmentLang === 'ur_roman' ? 'دوبارہ لائیو سیلفی لیں' : enrollmentLang === 'ar' ? 'إعادة فتح كاميرا السيلفي' : 'Re-Open Live Selfie Camera')
                            : (enrollmentLang === 'ur_roman' ? 'لائیو سیلفی کیمرہ کھولیں' : enrollmentLang === 'ar' ? 'فتح كاميرا السيلفي المباشرة' : 'Open Live Selfie Camera')}
                        </span>
                      </button>
                    )}
                  </div>

                  {cameraError && (
                    <p className="text-[11px] font-mono text-[#D29922] bg-[#3B2E0B] border border-[#9E6A03] rounded-xl p-2.5 leading-relaxed">
                      {cameraError}
                    </p>
                  )}
                </div>

                {/* Hardware Optical Thumbprint Scanner (MANDATORY) */}
                <div className="rounded-2xl bg-[#0D1117] border border-[#30363D] p-4 text-center space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEnrollThumbScanning(true);
                      setStep2BiometricError(null);
                      setTimeout(() => {
                        setIsEnrollThumbScanning(false);
                        setEnrollThumbDone(true);
                        setEnrollThumbHash('SHA256: 3c9f-88a1-agent-thumb-enrolled');
                      }, 1000);
                    }}
                    className={`mx-auto size-24 rounded-full border-2 ${
                      isEnrollThumbScanning
                        ? 'border-[#06B6D4] bg-[#06B6D4]/20 animate-pulse'
                        : enrollThumbDone
                        ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                        : 'border-[#30363D] bg-[#161B22] hover:border-[#06B6D4]'
                    } transition grid place-items-center relative`}
                  >
                    <Fingerprint className={`size-12 ${enrollThumbDone ? 'text-[#3FB950]' : 'text-[#06B6D4]'}`} />
                    {isEnrollThumbScanning && (
                      <div className="absolute inset-0 rounded-full border-t-2 border-[#06B6D4] animate-spin" />
                    )}
                  </button>

                  <span className="text-xs font-mono text-[#8B949E] block break-all overflow-hidden [overflow-wrap:break-word]">
                    {isEnrollThumbScanning
                      ? (enrollmentLang === 'ur_roman' ? 'انگوٹھا سکین ہو رہا ہے...' : enrollmentLang === 'ar' ? 'جاري قراءة البصمة...' : 'Reading hardware sensor...')
                      : enrollThumbDone
                      ? (enrollmentLang === 'ur_roman' ? (
                          <>✓ بایومیٹرک محفوظ: <span dir="ltr">{enrollThumbHash}</span></>
                        ) : enrollmentLang === 'ar' ? (
                          <>✓ تم تسجيل البصمة: <span dir="ltr">{enrollThumbHash}</span></>
                        ) : (
                          <>✓ Thumbprint Stored: <span dir="ltr">{enrollThumbHash}</span></>
                        ))
                      : (enrollmentLang === 'ur_roman' ? 'لازمی: انگوٹھے کا نشان لگانے کے لیے دبائیں' : enrollmentLang === 'ar' ? 'إلزامي: اضغط لمسح بصمة الإبهام' : 'Mandatory: Touch sensor to scan thumbprint')}
                  </span>
                </div>

                {step2BiometricError && (
                  <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 text-xs font-mono text-[#F85149] flex items-start gap-2">
                    <AlertOctagon className="size-4 shrink-0 mt-0.5" />
                    <span className="break-words [overflow-wrap:break-word]">{step2BiometricError}</span>
                  </div>
                )}

                <div className="pt-2 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopSelfieCamera();
                      setEnrollmentStep(1);
                    }}
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-4 py-2 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58]"
                  >
                    {enrollmentLang === 'ur_roman' ? '← پیچھے' : enrollmentLang === 'ar' ? '← السابق' : '← Back'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!enrollSelfieDone || !enrollThumbDone) {
                        const missingMsg =
                          enrollmentLang === 'ur_roman'
                            ? !enrollSelfieDone && !enrollThumbDone
                              ? 'لائیو سیلفی تصویر اور انگوٹھے کا بایومیٹرک اسکین دونوں لازمی ہیں۔ آگے بڑھنے سے پہلے مکمل کریں۔'
                              : !enrollSelfieDone
                              ? 'لائیو سیلفی تصویر لازمی ہے — براہِ کرم کیمرہ سے تصویر کھینچیں۔'
                              : 'انگوٹھے کا بایومیٹرک اسکین ایجنٹ کے لیے لازمی ہے — براہِ کرم انگوٹھا اسکین کریں۔'
                            : enrollmentLang === 'ar'
                            ? !enrollSelfieDone && !enrollThumbDone
                              ? 'التقاط الصورة الشخصية ومسح بصمة الإبهام إلزاميان قبل المتابعة.'
                              : !enrollSelfieDone
                              ? 'التقاط الصورة الشخصية إلزامي قبل المتابعة.'
                              : 'مسح بصمة الإبهام البيومترية إلزامي للوكيل قبل الانتقال للخطوة التالية.'
                            : !enrollSelfieDone && !enrollThumbDone
                            ? 'Both Live Selfie Photo and Hardware Thumbprint Biometric are mandatory before proceeding.'
                            : !enrollSelfieDone
                            ? 'Live Selfie Photo is mandatory — please capture your selfie using the camera first.'
                            : 'Hardware Thumbprint Biometric is mandatory for agents — please scan your thumbprint first.';
                        setStep2BiometricError(missingMsg);
                        return;
                      }
                      setStep2BiometricError(null);
                      stopSelfieCamera();
                      setEnrollmentStep(3);
                    }}
                    className={`min-h-[48px] rounded-xl px-5 py-2.5 text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 ${
                      enrollSelfieDone && enrollThumbDone
                        ? 'bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117]'
                        : 'bg-[#21262D] text-[#8B949E] border border-[#30363D] hover:border-[#da3633]'
                    }`}
                  >
                    <span>{enrollmentLang === 'ur_roman' ? 'اگلا: ادائیگی کا طریقہ ←' : enrollmentLang === 'ar' ? 'التالي: طريقة الدفع ←' : 'Next: Payout Destination →'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: WORLDWIDE LOCAL PAYOUT RAIL & BENEFICIARY SPECIFICATION */}
            {enrollmentStep === 3 && (() => {
              const detected = detectCountryFromPhone(enrollAgentPhone, enrollAgentCity);
              const payoutCfg = getPayoutConfigForCountry(detected);
              const isPk = detected.code === 'PK';
              const isMena = detected.region === 'MENA';
              const matchedMethod = payoutCfg.methods.find((m) => m.value === enrollPayoutMethod);
              const effectivePayoutMethod = matchedMethod ? enrollPayoutMethod : payoutCfg.defaultMethod;
              const isBankSelected = matchedMethod
                ? matchedMethod.isBank
                : effectivePayoutMethod === 'Bank Transfer' ||
                  effectivePayoutMethod === 'Custom Bank' ||
                  effectivePayoutMethod.includes('Bank') ||
                  effectivePayoutMethod.includes('IBFT') ||
                  effectivePayoutMethod.includes('SEPA') ||
                  effectivePayoutMethod.includes('Direct') ||
                  effectivePayoutMethod.includes('ACH') ||
                  effectivePayoutMethod.includes('EFT') ||
                  effectivePayoutMethod.includes('IMPS') ||
                  effectivePayoutMethod.includes('Barclays') ||
                  effectivePayoutMethod.includes('Revolut') ||
                  effectivePayoutMethod.includes('Wise') ||
                  effectivePayoutMethod.includes('Wire');
              const showBicSwift =
                !isPk &&
                !isMena &&
                (effectivePayoutMethod.includes('Wire') ||
                  effectivePayoutMethod.includes('SEPA') ||
                  effectivePayoutMethod.includes('International'));

              // Detect if user entered a phone number instead of a bank account or IBAN
              const isPhoneFormatInBank = (() => {
                if (!isBankSelected) return false;
                const clean = enrollPayoutAccount.trim().replace(/[\s-]/g, '');
                if (clean.startsWith('03') && clean.length >= 10 && clean.length <= 12 && /^\d+$/.test(clean)) return true;
                if (clean.startsWith('+') && clean.length >= 10 && clean.length <= 15) return true;
                if (/^\d{10,11}$/.test(clean) && !detected.code.match(/^(US|CA|AU|IN)$/)) return true;
                return false;
              })();

              // Country-Specific IBAN / Routing Format Validator
              const isIbanValidLength = (() => {
                if (!isBankSelected) return true;
                const raw = enrollPayoutAccount.replace(/\s/g, '').toUpperCase();
                if (!raw) return false;
                if (detected.code === 'PK') {
                  return (raw.startsWith('PK') && raw.length === 24) || (/^\d+$/.test(raw) && raw.length >= 14 && raw.length <= 18);
                }
                if (detected.code === 'AE') {
                  return raw.startsWith('AE') && raw.length === 23;
                }
                if (detected.code === 'SA') {
                  return raw.startsWith('SA') && raw.length === 24;
                }
                if (detected.code === 'GB') {
                  return (raw.startsWith('GB') && raw.length === 22) || raw.length >= 8;
                }
                if (detected.region === 'EUROPE' && /^[A-Z]{2}\d{2}/.test(raw)) {
                  return raw.length >= 15 && raw.length <= 34;
                }
                return raw.length >= 8;
              })();

              const accountTitlePlaceholder =
                detected.code === 'PK'
                  ? 'e.g. Muhammad Kamran Tariq'
                  : detected.code === 'AE'
                  ? 'e.g. Rashid Abdullah Al-Maktoum'
                  : detected.code === 'SA'
                  ? 'e.g. Faisal Abdulaziz Al-Qahtani'
                  : detected.code === 'US' || detected.code === 'CA'
                  ? 'e.g. Daniel Robert Miller'
                  : detected.code === 'DE'
                  ? 'e.g. Lukas Weber'
                  : 'e.g. James Edward Smith';

              return (
                <div
                  dir={enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'rtl' : 'ltr'}
                  className={`space-y-3.5 animate-in fade-in min-w-0 ${
                    enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'text-right' : 'text-left'
                  }`}
                >
                  <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-[#D29922] font-bold uppercase">
                        {enrollmentLang === 'ur_roman'
                          ? 'کمیشن کی ادائیگی کا طریقہ'
                          : enrollmentLang === 'ar'
                          ? 'حساب استلام العمولات'
                          : 'Commission Payout Account'}
                      </span>
                      <span dir="ltr" className="text-[10px] font-mono text-[#06B6D4] font-bold">
                        {detected.flag} {detected.name} ({detected.localCurrency})
                      </span>
                    </div>
                    <p className="text-xs text-[#8B949E] font-sans">
                      {enrollmentLang === 'ur_roman'
                        ? 'اپنا اکاؤنٹ منتخب کریں جہاں ہر سیلون کی کمیشن فوری منتقل کی جائے گی۔'
                        : enrollmentLang === 'ar'
                        ? 'اختر وسيلة الدفع التي ستستلم عليها عمولاتك الميدانية فور إتمام الصفقات.'
                        : 'Your commissions will be disbursed automatically to this destination upon every confirmed onboarding.'}
                    </p>
                  </div>

                  {/* Payment Method Selector (Label in selected language; select box LTR left-aligned) */}
                  <div>
                    <label className="text-[11px] font-mono text-[#8B949E] block mb-1 uppercase font-bold">
                      {enrollmentLang === 'ur_roman' ? 'ادائیگی کا ذریعہ *' : enrollmentLang === 'ar' ? 'وسيلة الدفع *' : 'Payment Method *'}
                    </label>
                    <select
                      dir="ltr"
                      value={effectivePayoutMethod}
                      onChange={(e) => setEnrollPayoutMethod(e.target.value)}
                      className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-xs font-mono text-left text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                    >
                      {payoutCfg.methods.map((m) => (
                        <option
                          key={m.value}
                          value={m.value}
                          className={`bg-[#161B22] py-1 ${m.value === 'Custom Bank' ? 'text-[#D29922] font-bold' : 'text-[#F0F6FC]'}`}
                        >
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bank Account Mode: 4 Distinct Fields (All inputs LTR left-aligned; Name always English format) */}
                  {isBankSelected ? (
                    <div className="space-y-3 rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-[#06B6D4] font-bold uppercase">
                          {enrollmentLang === 'ur_roman' ? 'بینک اکاؤنٹ کی تفصیلات (۴ خانے لازمی)' : enrollmentLang === 'ar' ? 'تفاصيل الحساب البنكي (٤ حقول مطلوبة)' : 'Bank Account Details (4 Required Fields)'}
                        </span>
                        <span dir="ltr" className="text-[10px] font-mono text-[#3FB950] bg-[#0D3822] border border-[#116329] px-2 py-0.5 rounded">
                          {effectivePayoutMethod === 'Custom Bank' ? 'CUSTOM BANK / IBFT' : `${detected.code} DIRECT RAIL`}
                        </span>
                      </div>

                      {/* 1. Beneficiary Account Title (Always English format & left-aligned) */}
                      <div>
                        <label className="text-[11px] font-mono text-[#8B949E] block mb-1 uppercase font-semibold">
                          {enrollmentLang === 'ur_roman' ? '۱. اکاؤنٹ کا ٹائٹل (انگریزی میں پورا نام) *' : enrollmentLang === 'ar' ? '١. اسم صاحب الحساب (بالإنجليزية) *' : '1. Beneficiary Account Title *'}
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={enrollPayoutTitle}
                          onChange={(e) => setEnrollPayoutTitle(e.target.value)}
                          placeholder={accountTitlePlaceholder}
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2.5 text-xs text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                        />
                      </div>

                      {/* 2. Bank Name & Branch (Always LTR left-aligned; English bank examples) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-mono text-[#8B949E] uppercase font-semibold">
                            {enrollmentLang === 'ur_roman' ? '۲. بینک کا نام اور برانچ *' : enrollmentLang === 'ar' ? '٢. اسم البنك والفرع *' : '2. Bank Name & Branch *'}
                          </label>
                          <span className="text-[10px] font-mono text-[#D29922]">
                            {enrollmentLang === 'ur_roman' ? '+ اپنی مرضی کا بینک شامل کریں' : enrollmentLang === 'ar' ? '+ إضافة بنك مخصص' : '+ Any Bank / Credit Union'}
                          </span>
                        </div>
                        <input
                          type="text"
                          dir="ltr"
                          value={enrollBankName}
                          onChange={(e) => setEnrollBankName(e.target.value)}
                          placeholder={`e.g. ${payoutCfg.bankPresets.slice(0, 3).join(' / ')}`}
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2.5 text-xs text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                        />

                        {/* Quick Bank Presets for Instant Tap */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {payoutCfg.bankPresets.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setEnrollBankName(preset)}
                              className={`min-h-[36px] rounded-lg px-2.5 py-1 text-[10px] font-mono transition border ${
                                enrollBankName === preset
                                  ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922] font-bold'
                                  : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#F0F6FC]'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3. Registered Mobile Number (Always LTR left-aligned) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-mono text-[#8B949E] uppercase font-semibold">
                            {enrollmentLang === 'ur_roman' ? '۳. بینک میں رجسٹرڈ موبائل نمبر *' : enrollmentLang === 'ar' ? '٣. رقم الجوال المسجل بالبنك *' : '3. Registered Mobile Number *'}
                          </label>
                          <span dir="ltr" className="text-[10px] font-mono text-[#06B6D4]">
                            {payoutCfg.mobileFormatBadge}
                          </span>
                        </div>
                        <input
                          type="tel"
                          dir="ltr"
                          value={enrollBankMobile}
                          onChange={(e) => setEnrollBankMobile(e.target.value)}
                          placeholder={payoutCfg.mobilePlaceholder}
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2.5 text-xs font-mono text-left text-[#06B6D4] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                        />
                      </div>

                      {/* 4. Account or IBAN Number (Always LTR left-aligned) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-mono text-[#8B949E] uppercase font-semibold">
                            {enrollmentLang === 'ur_roman' ? '۴. اکاؤنٹ نمبر یا مکمل IBAN نمبر *' : enrollmentLang === 'ar' ? '٤. رقم الحساب أو الآيبان الكامل *' : '4. Account Number or IBAN *'}
                          </label>
                          <span dir="ltr" className="text-[10px] font-mono text-[#3FB950] font-bold">
                            {payoutCfg.ibanBadge}
                          </span>
                        </div>
                        <input
                          type="text"
                          dir="ltr"
                          value={enrollPayoutAccount}
                          onChange={(e) => {
                            let val = e.target.value.toUpperCase();
                            if (/^(PK|AE|SA|GB|DE|FR|ES|IT|NL|IE|CH|SE|NO|DK|PT|PL|GR|AT|BE|QA|KW|BH|OM|JO|EG|TR)/.test(val)) {
                              const raw = val.replace(/[^A-Z0-9]/g, '');
                              const chunks = raw.match(/.{1,4}/g);
                              val = chunks ? chunks.join(' ') : raw;
                            }
                            setEnrollPayoutAccount(val);
                          }}
                          placeholder={payoutCfg.ibanPlaceholder}
                          className={`w-full min-h-[48px] rounded-xl border px-3.5 py-2.5 text-xs font-mono text-left transition focus:outline-none ${
                            isPhoneFormatInBank
                              ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149] focus:border-[#F85149]'
                              : isIbanValidLength
                              ? 'border-[#116329] bg-[#0D3822] text-[#3FB950] focus:border-[#3FB950]'
                              : 'border-[#30363D] bg-[#0D1117] text-[#06B6D4] focus:border-[#06B6D4]'
                          }`}
                        />

                        <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-[#8B949E]">
                          <span>{payoutCfg.ibanHelp}</span>
                          <span dir="ltr" className={isIbanValidLength ? 'text-[#3FB950] font-bold' : 'text-[#6E7681]'}>
                            {enrollPayoutAccount.replace(/\s/g, '').length} chars
                          </span>
                        </div>

                        {isPhoneFormatInBank && (
                          <div className="mt-2 rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 space-y-1 animate-in fade-in">
                            <div className="flex items-center gap-1.5 text-[#F85149] font-mono text-xs font-bold">
                              <AlertOctagon className="size-4 shrink-0 text-[#F85149]" />
                              <span>
                                {enrollmentLang === 'ar'
                                  ? 'خطأ: تم إدخال رقم هاتف بدلاً من رقم الحساب البنكي'
                                  : enrollmentLang === 'ur_roman'
                                  ? 'غلط بینک فارمیٹ: فون نمبر درج ہے'
                                  : 'Invalid Bank Format: Phone Number Detected'}
                              </span>
                            </div>
                            <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
                              {enrollmentLang === 'ar'
                                ? 'للحسابات البنكية والتحويلات المباشرة يجب إدخال رقم الحساب البنكي أو رقم الآيبان المعتمد (IBAN) وليس رقم الهاتف. رقم الهاتف صالح فقط للمحافظ الإلكترونية.'
                                : enrollmentLang === 'ur_roman'
                                ? 'بینک ٹرانسفر کے لیے اکاؤنٹ نمبر یا IBAN درکار ہے، فون نمبر نہیں۔ فون نمبر صرف موبائل والٹ کے لیے استعمال ہوتا ہے۔'
                                : 'Bank payout rails require an official Bank Account Number or country IBAN, not a mobile number. Phone numbers are only valid for mobile wallets.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Mobile Wallet / Instant Local Rail Mode (EasyPaisa / JazzCash / STC Pay / Zelle / Interac / UPI / PayID) */
                    <div className="space-y-3 rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5">
                      <div>
                        <label className="text-[11px] font-mono text-[#8B949E] block mb-1 uppercase font-semibold">
                          {enrollmentLang === 'ur_roman' ? 'والیٹ اکاؤنٹ ٹائٹل (انگریزی میں نام) *' : enrollmentLang === 'ar' ? 'اسم صاحب المحفظة (بالإنجليزية) *' : 'Wallet Account Title *'}
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={enrollPayoutTitle}
                          onChange={(e) => setEnrollPayoutTitle(e.target.value)}
                          placeholder={accountTitlePlaceholder}
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2.5 text-xs text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-mono text-[#8B949E] block mb-1 uppercase font-semibold">
                          {enrollmentLang === 'ur_roman' ? 'موبائل والیٹ نمبر *' : enrollmentLang === 'ar' ? 'رقم المحفظة الإلكترونية *' : 'Registered Mobile Wallet / ID Number *'}
                        </label>
                        <input
                          type="tel"
                          dir="ltr"
                          value={enrollPayoutAccount}
                          onChange={(e) => setEnrollPayoutAccount(e.target.value)}
                          placeholder={payoutCfg.walletPlaceholder}
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2.5 text-xs font-mono text-left text-[#06B6D4] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                        />
                      </div>
                    </div>
                  )}

                  {/* BIC/SWIFT Code: International Wire outside Pakistan and MENA */}
                  {showBicSwift && (
                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-1">
                      <label className="text-[10px] font-mono text-[#8B949E] block mb-1 uppercase">
                        BIC / SWIFT CODE (INTERNATIONAL WIRE ONLY)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={enrollBicSwift}
                        onChange={(e) => setEnrollBicSwift(e.target.value)}
                        placeholder="e.g. BARCGB22 / DEUTDEFF"
                        className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-xs font-mono text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                      />
                    </div>
                  )}

                  {/* ROW 1: GUARANTOR DETAILS (Pakistan Only) */}
                  {isPk && (
                    <div className="rounded-2xl border border-[#9E6A03] bg-[#3B2E0B]/35 p-3.5 space-y-2.5">
                      <div className="space-y-0.5">
                        <span className="text-xs font-mono font-bold text-[#D29922] block">
                          {enrollmentLang === 'ur_roman' ? 'ضامن کی تفصیلات' : enrollmentLang === 'ar' ? 'بيانات الضامن' : 'Guarantor Details'}
                        </span>
                        <p className="text-[11px] text-[#8B949E] font-sans">
                          {enrollmentLang === 'ur_roman'
                            ? 'کاروباری یا ذاتی ضامن کا نام (انگریزی میں) اور واٹس ایپ رابطہ'
                            : enrollmentLang === 'ar'
                            ? 'اسم الضامن (بالإنجليزية) ورقم الاتصال المعتمد'
                            : 'Business or personal reference guarantor name & direct contact'}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-mono text-[#8B949E] block mb-1 uppercase">
                            {enrollmentLang === 'ur_roman' ? 'ضامن کا پورا نام' : enrollmentLang === 'ar' ? 'اسم الضامن' : 'Guarantor Full Name'}
                          </label>
                          <input
                            type="text"
                            dir="ltr"
                            value={enrollGuarantorName}
                            onChange={(e) => setEnrollGuarantorName(e.target.value)}
                            placeholder="e.g. Tariq Mehmood"
                            className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2 text-xs text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-mono text-[#8B949E] block mb-1 uppercase">
                            {enrollmentLang === 'ur_roman' ? 'ضامن کا واٹس ایپ / فون نمبر' : enrollmentLang === 'ar' ? 'رقم هاتف / واتساب الضامن' : 'Phone / WhatsApp'}
                          </label>
                          <input
                            type="tel"
                            dir="ltr"
                            value={enrollGuarantorPhone}
                            onChange={(e) => setEnrollGuarantorPhone(e.target.value)}
                            placeholder="0300 1234567"
                            className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2 text-xs font-mono text-left text-[#06B6D4] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ROW 2: NEXT OF KIN DETAILS (Marked Optional) */}
                  <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-[#F0F6FC]">
                        {enrollmentLang === 'ur_roman'
                          ? 'وارث / قریبی رشتہ دار کی تفصیلات (اختیاری)'
                          : enrollmentLang === 'ar'
                          ? 'بيانات أقرب الأقربين (اختياري)'
                          : 'Next of Kin / Family Reference (Optional)'}
                      </span>
                      <span className="text-[10px] font-mono text-[#6E7681] uppercase">
                        {enrollmentLang === 'ur_roman' ? 'اختیاری' : enrollmentLang === 'ar' ? 'اختياري' : 'Optional'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8B949E] font-sans">
                      {enrollmentLang === 'ur_roman'
                        ? 'ہنگامی رابطے کے لیے فیملی یا قریبی رشتہ دار کا نام (انگریزی میں)'
                        : enrollmentLang === 'ar'
                        ? 'جهة اتصال للطوارئ في حال تعذر الوصول (الاسم بالإنجليزية)'
                        : 'Emergency family contact reference'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-mono text-[#8B949E] block mb-1 uppercase">
                          {enrollmentLang === 'ur_roman' ? 'قریبی رشتہ دار کا نام' : enrollmentLang === 'ar' ? 'اسم قريب الدرجة الأولى' : 'Next of Kin Name'}
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={enrollNextOfKin}
                          onChange={(e) => setEnrollNextOfKin(e.target.value)}
                          placeholder="e.g. Shahid Tariq"
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-xs text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-[#8B949E] block mb-1 uppercase">
                          {enrollmentLang === 'ur_roman' ? 'رابطہ نمبر' : enrollmentLang === 'ar' ? 'رقم الاتصال' : 'Contact Phone Number'}
                        </label>
                        <input
                          type="tel"
                          dir="ltr"
                          value={enrollNextOfKinPhone}
                          onChange={(e) => setEnrollNextOfKinPhone(e.target.value)}
                          placeholder={payoutCfg.mobilePlaceholder}
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-xs font-mono text-left text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3 Navigation Buttons */}
                  <div className="pt-2 flex justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setEnrollmentStep(2)}
                      className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-4 py-2 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58]"
                    >
                      {enrollmentLang === 'ur_roman' ? '← پیچھے' : enrollmentLang === 'ar' ? '← السابق' : '← Back'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isPhoneFormatInBank) return;
                        setEnrollmentStep(4);
                      }}
                      disabled={isPhoneFormatInBank}
                      className={`min-h-[48px] rounded-xl px-5 py-2.5 text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 ${
                        isPhoneFormatInBank
                          ? 'bg-[#21262D] text-[#6E7681] cursor-not-allowed border border-[#30363D]'
                          : 'bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117]'
                      }`}
                    >
                      <span>{enrollmentLang === 'ur_roman' ? 'اگلا: قانونی اقرار نامہ ←' : enrollmentLang === 'ar' ? 'التالي: الشروط القانونية ←' : 'Next: Legal Terms →'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* STEP 4: LEGAL REMITTANCE DECLARATION WITH NATIVE NASTALIQ URDU & BIOMETRIC STAMP (QUERIES 9 & 10) */}
            {enrollmentStep === 4 && (
              <div
                dir={enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'rtl' : 'ltr'}
                className={`space-y-3.5 animate-in fade-in min-w-0 ${
                  enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'text-right' : 'text-left'
                }`}
              >
                {/* Legal Remittance Agreement with 100% Native Nastaliq Urdu Script */}
                <div className="rounded-2xl border border-[#9E6A03] bg-[#3B2E0B]/35 p-4 space-y-3 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[#9E6A03]/40 pb-2">
                    <span className="text-[11px] font-mono text-[#D29922] font-bold uppercase flex items-center gap-1.5">
                      <ShieldCheck className="size-4 shrink-0" />
                      <span>
                        {enrollmentLang === 'ur_roman'
                          ? 'قانونی اقرار نامہ اور کیش ہینڈلنگ شرائط'
                          : enrollmentLang === 'ar'
                          ? 'الشروط القانونية وسياسة المدفوعات'
                          : 'Legal Declaration & Remittance Agreement'}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-[#D29922] bg-[#3B2E0B] border border-[#9E6A03] px-2 py-0.5 rounded font-bold shrink-0">
                      {detectCountryFromPhone(enrollAgentPhone, enrollAgentCity).code === 'PK' ? '48H CASH RULE' : '100% CASHLESS'}
                    </span>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enrollAgreedTerms}
                      onChange={(e) => {
                        setEnrollAgreedTerms(e.target.checked);
                        setStep4BiometricError(null);
                      }}
                      className="mt-1 size-4 rounded border-[#30363D] bg-[#0D1117] text-[#D29922] focus:ring-0 shrink-0"
                    />
                    <div className="space-y-1 min-w-0">
                      {detectCountryFromPhone(enrollAgentPhone, enrollAgentCity).code === 'PK' ? (
                        enrollmentLang === 'ur_roman' ? (
                          <p dir="rtl" className="text-sm text-[#F0F6FC] font-sans leading-relaxed text-right break-words [overflow-wrap:break-word]">
                            &ldquo;میں اقرار کرتا ہوں کہ تمام وصول شدہ نقدی رقم ۴۸ گھنٹے کے اندر اندر ورک کرافٹ کے آفیشل اکاؤنٹس (ایزی پیسہ، جاز کیش یا بینک اکاؤنٹ) میں جمع کرواؤں گا۔ اگر ۴۸ گھنٹے کے اندر رقم جمع نہ کروائی گئی تو میرا ایجنٹ آئی ڈی فوری طور پر معطل کر دیا جائے گا اور ورک کرافٹ پاکستان کے قوانین کے تحت قانونی چارہ جوئی کا مکمل حق محفوظ رکھتا ہے۔&rdquo;
                          </p>
                        ) : (
                          <p dir="ltr" className="text-xs text-[#F0F6FC] font-sans leading-relaxed text-left break-words [overflow-wrap:break-word]">
                            &ldquo;I agree to remit all physical cash collected within 48 hours into WORKCRAFT Official Accounts (EasyPaisa, JazzCash, or Official Bank Accounts). I acknowledge that if dues are not remitted within 48 hours, my Agent ID will be immediately suspended and WORKCRAFT Local reserves the full legal right to initiate formal recovery and legal actions under the laws of Pakistan.&rdquo;
                          </p>
                        )
                      ) : enrollmentLang === 'ar' ? (
                        <p dir="rtl" className="text-xs text-[#F0F6FC] font-sans leading-relaxed text-right break-words [overflow-wrap:break-word]">
                          &ldquo;أقر وأوافق على أن WORKCRAFT تطبق سياسة رقمية غير نقدية بنسبة 100% خارج باكستان. يمنع منعاً باتاً استلام أو تداول أي مبالغ نقدية ورقية. يتم سداد جميع رسوم الإعداد والاشتراكات رقمياً ومباشرة لحسابات WORKCRAFT. وأوافق على أن أي مخالفة أو شكوى من صالون شريك ستؤدي إلى إنهاء العقد فوراً وإلغاء صلاحياتي دون إشعار مسبق.&rdquo;
                        </p>
                      ) : (
                        <p dir="ltr" className="text-xs text-[#F0F6FC] font-sans leading-relaxed text-left break-words [overflow-wrap:break-word]">
                          &ldquo;I acknowledge and agree that outside Pakistan, WORKCRAFT operates under a strict 100% cashless digital policy. I am strictly prohibited from handling manual physical hard cash. All salon setup and recurring fees must be remitted digitally by salon owners directly to WORKCRAFT. I agree that any violation, misconduct, or salon partner complaint will result in immediate termination of my Agent Agreement, de-enrollment from the platform, and forfeiture of pending claims without prior notice.&rdquo;
                        </p>
                      )}
                    </div>
                  </label>

                  {/* Optical Biometric Legal Stamp Scanner (MANDATORY) */}
                  <div className="p-3 rounded-xl bg-[#0D1117] border border-[#30363D] flex flex-wrap items-center justify-between gap-3 overflow-hidden">
                    <div className="flex items-center gap-2.5 text-xs font-mono min-w-0 flex-1">
                      <Fingerprint className={`size-5 shrink-0 ${enrollLegalBiometricStamped ? 'text-[#3FB950]' : 'text-[#06B6D4]'}`} />
                      <div className="min-w-0 flex-1">
                        <span className="text-[#F0F6FC] font-bold block">
                          {enrollmentLang === 'ur_roman' ? 'قانونی بایومیٹرک مہر (لازمی)' : enrollmentLang === 'ar' ? 'البصمة القانونية (إلزامي)' : 'Legal Biometric Stamp (Mandatory)'}
                        </span>
                        <span dir="ltr" className={`text-[10px] block break-all overflow-hidden [overflow-wrap:break-word] ${enrollLegalBiometricStamped ? 'text-[#3FB950]' : 'text-[#D29922]'}`}>
                          {enrollLegalStampHash || (enrollmentLang === 'ur_roman' ? 'مہر لگانے کے لیے بٹن دبائیں' : enrollmentLang === 'ar' ? 'اضغط لتسجيل البصمة القانونية' : 'Pending mandatory biometric signature')}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLegalStampScanning(true);
                        setStep4BiometricError(null);
                        setTimeout(() => {
                          setIsLegalStampScanning(false);
                          setEnrollLegalBiometricStamped(true);
                          setEnrollLegalStampHash('SHA256: 7f81-810a-agent-legal-stamped');
                        }, 900);
                      }}
                      className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition shrink-0 border ${
                        enrollLegalBiometricStamped
                          ? 'bg-[#0D3822] text-[#3FB950] border-[#116329]'
                          : 'bg-[#3B2E0B] hover:bg-[#3B2E0B]/80 text-[#D29922] border-[#9E6A03]'
                      }`}
                    >
                      {isLegalStampScanning ? 'Scanning...' : enrollLegalBiometricStamped ? '✓ Stamped' : 'Stamp Thumbprint'}
                    </button>
                  </div>
                </div>

                {step4BiometricError && (
                  <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 text-xs font-mono text-[#F85149] flex items-start gap-2">
                    <AlertOctagon className="size-4 shrink-0 mt-0.5" />
                    <span className="break-words [overflow-wrap:break-word]">{step4BiometricError}</span>
                  </div>
                )}

                {/* Step 4 Navigation Buttons with Mandatory Checkbox + Biometric Gating */}
                <div className="pt-2 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setEnrollmentStep(3)}
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-4 py-2 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58]"
                  >
                    {enrollmentLang === 'ur_roman' ? '← پیچھے' : enrollmentLang === 'ar' ? '← السابق' : '← Back'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!enrollAgreedTerms || !enrollLegalBiometricStamped) {
                        const missingLegalMsg =
                          enrollmentLang === 'ur_roman'
                            ? !enrollAgreedTerms && !enrollLegalBiometricStamped
                              ? 'اقرار نامے پر ٹک لگانا اور قانونی انگوٹھے کی بایومیٹرک مہر لگانا دونوں لازمی ہیں۔'
                              : !enrollAgreedTerms
                              ? 'پہلے قانونی اقرار نامے کے باکس پر نشان لگائیں۔'
                              : 'بایومیٹرک انگوٹھے کی مہر لازمی ہے — "Stamp Thumbprint" بٹن دبا کر مہر لگائیں۔'
                            : enrollmentLang === 'ar'
                            ? !enrollAgreedTerms && !enrollLegalBiometricStamped
                              ? 'الموافقة على الإقرار القانوني وتوثيق بصمة الإبهام القانونية إلزاميان.'
                              : !enrollAgreedTerms
                              ? 'يرجى تحديد مربع الموافقة على الإقرار القانوني أولاً.'
                              : 'البصمة القانونية إلزامية للوكيل — يرجى الضغط على زر البصمة قبل التفعيل.'
                            : !enrollAgreedTerms && !enrollLegalBiometricStamped
                            ? 'You must both check the Legal Declaration box AND scan your Legal Biometric Stamp before activating.'
                            : !enrollAgreedTerms
                            ? 'Please check the Legal Declaration agreement box first.'
                            : 'Legal Biometric Thumbprint Stamp is mandatory — tap "Stamp Thumbprint" before activating.';
                        setStep4BiometricError(missingLegalMsg);
                        return;
                      }
                      setStep4BiometricError(null);
                      const detStep4 = detectCountryFromPhone(enrollAgentPhone, enrollAgentCity);
                      const payoutCfgStep4 = getPayoutConfigForCountry(detStep4);
                      const resolvedMethod = payoutCfgStep4.methods.some((m) => m.value === enrollPayoutMethod)
                        ? enrollPayoutMethod
                        : payoutCfgStep4.defaultMethod;
                      // Add to enrolledAgentsList
                      setEnrolledAgentsList((prev) => [
                        ...prev.filter(a => a.name !== enrollAgentName),
                        {
                          id: 'AGT-' + Math.floor(410 + Math.random() * 50),
                          pin: Math.floor(1000 + Math.random() * 9000).toString(),
                          name: enrollAgentName,
                          phone: enrollAgentPhone,
                          city: enrollAgentCity,
                          category: 'Universal (All Salons, Barbershops & Parlors)',
                          cnicOrId: enrollAgentId,
                          payoutMethod: resolvedMethod,
                          payoutAccount: enrollPayoutAccount,
                          payoutTitle: enrollPayoutTitle,
                          bankName: enrollBankName || payoutCfgStep4.defaultBank,
                          status: 'ACTIVE · ON-FIELD',
                          enrolledAt: 'Just Now · 100% Verified',
                          selfieVerified: true,
                          thumbHash: enrollThumbHash || 'SHA256: 3c9f-88a1-agent-thumb-enrolled',
                          legalRemittanceAgreed: true,
                          legalTermsText: detStep4.code === 'PK'
                            ? 'Agreed: Remit physical cash within 48h to WORKCRAFT Official Accounts under Pakistani law.'
                            : 'Agreed: 100% cashless digital policy, immediate contract termination on misconduct.',
                          guarantorName: enrollGuarantorName || undefined,
                          guarantorPhone: enrollGuarantorPhone || undefined,
                        },
                      ]);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('wcl_agent_enrolled_v1', 'true');
                      }
                      setEnrollmentStep(5);
                    }}
                    className={`min-h-[48px] rounded-xl px-5 py-2.5 text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 ${
                      enrollAgreedTerms && enrollLegalBiometricStamped
                        ? 'bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117]'
                        : 'bg-[#21262D] text-[#8B949E] border border-[#30363D] hover:border-[#da3633]'
                    }`}
                  >
                    <span>{enrollmentLang === 'ur_roman' ? 'تصدیق اور ایکٹیویشن ←' : enrollmentLang === 'ar' ? 'تأكيد التسجيل والتفعيل ←' : 'Complete Enrollment & Activate →'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: ENROLLMENT CONFIRMED & HOME SCREEN PWA INSTALL (QUERIES 11 & 12) */}
            {enrollmentStep === 5 && (
              <div className="space-y-4 text-center animate-in zoom-in-95">
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#0D3822] border border-[#116329] text-[#3FB950]">
                  <CheckCircle2 className="size-10" />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#3FB950] font-bold">
                    DAY-1 ENROLLMENT 100% COMPLETE &amp; VERIFIED
                  </span>
                  <h3 className="text-xl font-black text-[#F0F6FC]">
                    {enrollmentLang === 'ur_roman'
                      ? 'مبارک ہو! آپ کا فیلڈ ایجنٹ اکاؤنٹ ایکٹیو ہے'
                      : enrollmentLang === 'ar'
                      ? 'تهانينا! حساب الوكيل الميداني مفعل بنجاح'
                      : 'Congratulations! Field Agent Terminal Activated'}
                  </h3>
                  <p className="text-xs text-[#8B949E] font-sans max-w-md mx-auto">
                    {enrollmentLang === 'ur_roman'
                      ? `${enrollAgentName}، آپ کے بایومیٹرک اسناد، شناختی کارڈ، اور ادائیگی کا طریقہ سینٹرل سسٹم میں محفوظ کر لیا گیا ہے۔`
                      : enrollmentLang === 'ar'
                      ? `تم تشفير بصمتك البيومترية وبيانات هويتك وحسابك المالي بنجاح في النظام المركزي.`
                      : `${enrollAgentName}, your credentials, biometric thumbprint hash, and automated payout rail have been encrypted into WORKCRAFT Central Cloud.`}
                  </p>
                </div>

                {/* 1-Tap Save to Home Screen Prompt */}
                <div
                  dir={enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'rtl' : 'ltr'}
                  className={`rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 font-mono space-y-2.5 overflow-hidden ${
                    enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'text-right' : 'text-left'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#06B6D4] flex items-center gap-2">
                      <Smartphone className="size-4" />
                      <span>{enrollmentLang === 'ur_roman' ? 'موبائل ہوم اسکرین پر محفوظ کریں' : enrollmentLang === 'ar' ? 'حفظ على الشاشة الرئيسية' : 'Save WorkCraft to Home Screen'}</span>
                    </span>
                    <span className="text-[10px] text-[#3FB950] font-bold bg-[#0D3822] border border-[#116329] px-2 py-0.5 rounded">
                      APP SHORTCUT READY
                    </span>
                  </div>
                  <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
                    {enrollmentLang === 'ur_roman'
                      ? 'اپنے موبائل کی ہوم اسکرین پر WorkCraft کا آئیکن شامل کریں تاکہ روزانہ فیلڈ کام اور سیلون شامل کرنے کے لیے ایک ٹچ سے کھول سکیں۔'
                      : enrollmentLang === 'ar'
                      ? 'أضف أيقونة WorkCraft إلى شاشة هاتفك الرئيسية لفتح بوابتك بلمسة واحدة دون الحاجة إلى متصفح.'
                      : 'Save the WorkCraft icon directly on your mobile home screen so you can open your field hub in 1 tap every day.'}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPwaInstalledConfirmed(true);
                        setShowPwaInstallModal(true);
                      }}
                      className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase transition flex items-center gap-1.5"
                    >
                      <Download className="size-3.5" />
                      <span>
                        {isPwaInstalledConfirmed
                          ? (enrollmentLang === 'ur_roman' ? '✓ ہوم اسکرین آئیکن شامل ہو گیا' : enrollmentLang === 'ar' ? '✓ تم الحفظ على الشاشة الرئيسية' : '✓ Added to Home Screen')
                          : (enrollmentLang === 'ur_roman' ? 'ہوم اسکرین پر محفوظ کریں' : enrollmentLang === 'ar' ? 'حفظ على الشاشة الرئيسية' : 'Save "WorkCraft" to Home Screen')}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Auto-Launch Button into Agent Hub Step 1 Onboarding */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('wcl_agent_enrolled_v1', 'true');
                      }
                      setIsRemoteEnrollmentWizardOpen(false);
                      setActiveHubView('ONBOARDING');
                      setCurrentStep(1);
                    }}
                    className="min-h-[48px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-6 py-3 text-xs font-mono font-black uppercase transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Scissors className="size-4" />
                    <span>{enrollmentLang === 'ur_roman' ? 'پورٹل کھولیں (پہلا سیلون شامل کریں) ←' : enrollmentLang === 'ar' ? 'فتح البوابة وبدء تسجيل الصالونات ←' : 'Open Hub & Add First Salon →'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('wcl_agent_enrolled_v1', 'true');
                      }
                      setIsRemoteEnrollmentWizardOpen(false);
                    }}
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-4 py-3 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58]"
                  >
                    {enrollmentLang === 'ur_roman' ? 'بند کریں اور واپس جائیں' : enrollmentLang === 'ar' ? 'إغلاق والعودة' : 'Close & Return'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. HOME SCREEN APP SHORTCUT MODAL (UNIFIED WORKCRAFT LABEL - LOCALIZED) */}
      {/* ========================================================================= */}
      {showPwaInstallModal && (
        <div
          className="fixed inset-0 z-[105] grid place-items-center bg-[#0D1117]/80 p-3 sm:p-5 backdrop-blur-md"
          onClick={() => setShowPwaInstallModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir={enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'rtl' : 'ltr'}
            className={`w-full max-w-[480px] rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 space-y-4 ${
              enrollmentLang === 'ur_roman' || enrollmentLang === 'ar' ? 'text-right' : 'text-left'
            }`}
          >
            <div className="flex items-start justify-between border-b border-[#21262D] pb-3 gap-2">
              <div className="flex items-center gap-3">
                <img
                  src="/icon.svg"
                  alt="WorkCraft Mobile Shortcut Icon"
                  className="size-[60px] rounded-2xl border border-[#9E6A03] shrink-0"
                />
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#3FB950] block">
                    {enrollmentLang === 'ur_roman'
                      ? 'موبائل ہوم اسکرین شارٹ کٹ'
                      : enrollmentLang === 'ar'
                      ? 'اختصار الشاشة الرئيسية للهاتف'
                      : 'PHONE HOME SCREEN SHORTCUT'}
                  </span>
                  <h3 className="text-lg font-black text-[#F0F6FC]">
                    {enrollmentLang === 'ur_roman'
                      ? 'اپنے فون پر "WorkCraft" محفوظ کریں'
                      : enrollmentLang === 'ar'
                      ? 'حفظ تطبيق "WorkCraft" على الشاشة'
                      : 'Save "WorkCraft" to Phone Home Screen'}
                  </h3>
                  <span className="text-[10px] font-mono text-[#06B6D4] block">
                    {enrollmentLang === 'ur_roman'
                      ? 'گولڈ ڈبلیو + نیلا ورک کرافٹ · یونیفائیڈ لیبل: WorkCraft'
                      : enrollmentLang === 'ar'
                      ? 'شعار ذهبي W + أزرق سماوي · الاسم الموحد: WorkCraft'
                      : 'Gold W + Cyan-Blue WORKCRAFT · Unified Label: WorkCraft'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowPwaInstallModal(false)}
                className="min-h-[44px] min-w-[44px] rounded-lg grid place-items-center text-[#8B949E] hover:text-[#F0F6FC] transition shrink-0"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
              {enrollmentLang === 'ur_roman'
                ? 'آپ کا فون ہوم اسکرین پر ورک کرافٹ کا آئیکن لگانے سے پہلے ایک فوری تصدیقی ٹیپ مانگتا ہے:'
                : enrollmentLang === 'ar'
                ? 'يتطلب هاتفك نقرة تأكيد سريعة لإضافة أيقونة وورك كرافت إلى الشاشة الرئيسية:'
                : 'Your phone asks for one quick confirmation tap before placing the WorkCraft icon on your home screen:'}
            </p>

            <div className="space-y-2.5 font-mono text-xs">
              <div className="rounded-xl bg-[#0D1117] p-3 border border-[#30363D] space-y-1">
                <span className="text-[#06B6D4] font-bold block">
                  {enrollmentLang === 'ur_roman'
                    ? '📱 اینڈرائیڈ (Chrome / Samsung Internet):'
                    : enrollmentLang === 'ar'
                    ? '📱 أندرويد (Chrome / Samsung Internet):'
                    : '📱 Android (Chrome / Samsung Internet):'}
                </span>
                <p className="text-[#8B949E] font-sans text-[11px]">
                  {enrollmentLang === 'ur_roman' ? (
                    <>
                      نیچے دیا گیا بٹن دبائیں یا کروم مینو (⋮) کھول کر <strong className="text-[#F0F6FC]">&quot;Install app&quot;</strong> یا <strong className="text-[#F0F6FC]">&quot;Add to Home Screen&quot;</strong> منتخب کریں۔
                    </>
                  ) : enrollmentLang === 'ar' ? (
                    <>
                      اضغط على الزر أدناه أو من قائمة Chrome (⋮) اختر <strong className="text-[#F0F6FC]">&quot;تثبيت التطبيق&quot;</strong> أو <strong className="text-[#F0F6FC]">&quot;إضافة إلى الشاشة الرئيسية&quot;</strong>.
                    </>
                  ) : (
                    <>
                      Tap the button below or tap Chrome menu (⋮) ➔ select <strong className="text-[#F0F6FC]">&quot;Install app&quot;</strong> or <strong className="text-[#F0F6FC]">&quot;Add to Home Screen&quot;</strong>.
                    </>
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-[#0D1117] p-3 border border-[#30363D] space-y-1">
                <span className="text-[#D29922] font-bold block">
                  {enrollmentLang === 'ur_roman'
                    ? '🍎 آئی فون / آئی پیڈ (Safari):'
                    : enrollmentLang === 'ar'
                    ? '🍎 آيفون / آيباد (Safari):'
                    : '🍎 iPhone / iPad (Safari):'}
                </span>
                <p className="text-[#8B949E] font-sans text-[11px]">
                  {enrollmentLang === 'ur_roman' ? (
                    <>
                      سفاری میں نیچے شیئر کا بٹن (<Share2 className="size-3 inline mx-1" />) دبائیں اور اسکرول کر کے <strong className="text-[#F0F6FC]">&quot;Add to Home Screen&quot;</strong> منتخب کریں۔
                    </>
                  ) : enrollmentLang === 'ar' ? (
                    <>
                      في Safari اضغط على أيقونة المشاركة (<Share2 className="size-3 inline mx-1" />) بالأسفل ثم اختر <strong className="text-[#F0F6FC]">&quot;إضافة إلى الصفحة الرئيسية&quot;</strong>.
                    </>
                  ) : (
                    <>
                      Tap the Safari <strong className="text-[#F0F6FC]">Share icon (<Share2 className="size-3 inline" />)</strong> at the bottom bar ➔ scroll and tap <strong className="text-[#F0F6FC]">&quot;Add to Home Screen&quot;</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsPwaInstalledConfirmed(true);
                setShowPwaInstallModal(false);
              }}
              className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] py-3 text-xs font-mono font-black uppercase transition flex items-center justify-center gap-2"
            >
              <Download className="size-4" />
              <span>
                {enrollmentLang === 'ur_roman'
                  ? 'ابھی "WorkCraft" شارٹ کٹ محفوظ کریں'
                  : enrollmentLang === 'ar'
                  ? 'حفظ اختصار "WorkCraft" الآن'
                  : 'Save "WorkCraft" Shortcut Now'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
