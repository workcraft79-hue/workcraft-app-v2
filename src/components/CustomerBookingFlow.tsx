import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  MapPin,
  Phone,
  RefreshCw,
  RotateCcw,
  Scissors,
  Sparkles,
  Tag,
  User,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AdAttributionChannel,
  ClientPreferredLang,
  CustomerAvailabilityResponse,
  CustomerExperienceConfig,
  CustomerFlowBookingResponse,
  SalonDeal,
} from '../types/concierge';
import { LOGO_URL } from '../data/portalData';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface CustomerBookingFlowProps {
  salonId: string;
  salonCode?: string;
  cToken?: string;
  adSource?: AdAttributionChannel;
  initialDealId?: string | null;
  initialLang?: ClientPreferredLang;
  initialClientPhone?: string;
  isDemo?: boolean;
  demoForceNewCustomer?: boolean;
  demoSavedCustomerName?: string;
  demoBusyBarber?: string;
  demoBusyTimeSlot?: string;
  standalone?: boolean;
  onNavigate?: (path: string) => void;
  onBookingConfirmed?: (res: CustomerFlowBookingResponse) => void;
  onClose?: () => void;
}

interface FlowCopy {
  flowTitle: string;
  demoBadge: string;
  selectServices: string;
  selectDate: string;
  selectTime: string;
  selectBarber: string;
  yourDetails: string;
  yourNamePlaceholder: string;
  yourPhoneLabel: string;
  returningWelcome: string;
  howCanIHelp: string;
  menuBookBtn: string;
  menuServicesBtn: string;
  menuHoursBtn: string;
  menuDealsBtn: string;
  noActiveDealsText: string;
  applyDealBtn: string;
  visitsLabel: string;
  rebookLastBtn: string;
  firstTimeTitle: string;
  firstTimeSubtitle: string;
  saveDetailsBtn: string;
  savingDetailsBtn: string;
  installAppBtn: string;
  appInstalledMsg: string;
  installManualHint: string;
  detailsSavedMsg: string;
  summaryTitle: string;
  clientNameRow: string;
  phoneRow: string;
  dateTimeRow: string;
  barberRow: string;
  servicesRow: string;
  totalAmountLabel: string;
  totalTimeLabel: string;
  confirmBtn: string;
  confirmingBtn: string;
  changeBtn: string;
  noSlotsForDate: string;
  closedOnDate: string;
  noBarberAtSlot: string;
  availableLabel: string;
  freeShort: string;
  checkingSlots: string;
  confirmedTitle: string;
  confirmedSubtitle: string;
  canceledTitle: string;
  canceledSubtitle: string;
  rescheduledNotice: string;
  rescheduleBtn: string;
  cancelBookingBtn: string;
  confirmRescheduleBtn: string;
  updatingRescheduleBtn: string;
  confirmCancelQuestion: string;
  yesCancelBtn: string;
  keepBookingBtn: string;
  cancelingBtn: string;
  demoNoPersistNote: string;
  bookingIdLabel: string;
  addToCalendarBtn: string;
  openMapsBtn: string;
  copyLocationBtn: string;
  copiedBtn: string;
  doneBtn: string;
  bookAnotherBtn: string;
  dealAppliedLabel: string;
  minShort: string;
  todayLabel: string;
  tomorrowLabel: string;
  weekdaysShort: string[];
  monthsShort: string[];
  errSelectService: string;
  errSelectSlotBarber: string;
  errEnterName: string;
  errEnterPhone: string;
  callSalonLabel: string;
  demoHiddenBarberNote: (barber: string, slot: string) => string;
}

const EN_FLOW_COPY: FlowCopy = {
  flowTitle: 'Book Appointment',
  demoBadge: 'LIVE DEMO FLOW',
  selectServices: '1. Select Services',
  selectDate: '2. Choose Date',
  selectTime: '3. Arrival Time',
  selectBarber: '4. Available Barber',
  yourDetails: '5. Your Details',
  yourNamePlaceholder: 'Enter your full name',
  yourPhoneLabel: 'Mobile Number',
  returningWelcome: 'Welcome back',
  howCanIHelp: 'How can I help you today?',
  menuBookBtn: '1. Book Appointment',
  menuServicesBtn: '2. Services & Prices',
  menuHoursBtn: '3. Opening Hours & Location',
  menuDealsBtn: '4. Current Deals & Offers',
  noActiveDealsText: 'No special deals active right now — regular rates apply.',
  applyDealBtn: 'Apply Deal & Book',
  visitsLabel: 'visits',
  rebookLastBtn: 'Rebook Last Visit',
  firstTimeTitle: 'First-Time Visit? Save Your Profile',
  firstTimeSubtitle:
    'Enter your full name and mobile number once to recognize you on your next visit.',
  saveDetailsBtn: 'Save My Details',
  savingDetailsBtn: 'Saving...',
  installAppBtn: 'Install Salon App',
  appInstalledMsg: 'Salon app prompt triggered. Add to your home screen for 1-tap booking.',
  installManualHint:
    'In your browser menu, tap "Add to Home Screen" or "Install App" for instant 1-tap access.',
  detailsSavedMsg:
    'Profile saved. Copy your personal booking link or install this salon app:',
  summaryTitle: 'Booking Summary',
  clientNameRow: 'Client Name',
  phoneRow: 'Phone Number',
  dateTimeRow: 'Date & Arrival Time',
  barberRow: 'Barber',
  servicesRow: 'Services',
  totalAmountLabel: 'Total Amount',
  totalTimeLabel: 'Total Time',
  confirmBtn: 'Confirm Appointment',
  confirmingBtn: 'Confirming...',
  changeBtn: 'Change',
  noSlotsForDate: 'No open slots left for this date & duration. Try another date.',
  closedOnDate: 'Salon is closed on this date.',
  noBarberAtSlot:
    'Everyone is booked at this exact time. Please pick another time slot above — a slot right before or after is usually open.',
  availableLabel: 'Available',
  freeShort: 'free',
  checkingSlots: 'Checking live salon slots...',
  confirmedTitle: 'Appointment Confirmed',
  confirmedSubtitle:
    'Your chair is reserved. You can reschedule or cancel directly below anytime.',
  canceledTitle: 'Appointment Canceled',
  canceledSubtitle:
    'Your slot has been released and the salon counter has been notified.',
  rescheduledNotice: 'Appointment rescheduled & salon notified.',
  rescheduleBtn: 'Reschedule',
  cancelBookingBtn: 'Cancel Booking',
  confirmRescheduleBtn: 'Confirm New Time & Stylist',
  updatingRescheduleBtn: 'Updating Slot...',
  confirmCancelQuestion:
    'Are you sure you want to cancel this appointment? Your chair will be freed immediately.',
  yesCancelBtn: 'Yes, Cancel Booking',
  keepBookingBtn: 'Keep Booking',
  cancelingBtn: 'Canceling...',
  demoNoPersistNote: 'DEMO MODE · Real salon appointments were NOT changed.',
  bookingIdLabel: 'Booking Ref',
  addToCalendarBtn: 'Add to Calendar (.ics)',
  openMapsBtn: 'Google Maps Directions',
  copyLocationBtn: 'Copy',
  copiedBtn: 'Copied',
  doneBtn: 'Done',
  bookAnotherBtn: 'Book Another Slot',
  dealAppliedLabel: 'Deal Applied',
  minShort: 'min',
  todayLabel: 'Today',
  tomorrowLabel: 'Tomorrow',
  weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  errSelectService: 'Please select at least one service.',
  errSelectSlotBarber: 'Please select an available date, arrival time, and barber.',
  errEnterName: 'Please enter your complete name before confirming.',
  errEnterPhone: 'Please enter a valid mobile number.',
  callSalonLabel: 'Call Salon Directly',
  demoHiddenBarberNote: (barber, slot) =>
    `${barber} is busy at ${slot}. You can pick another available stylist below, or choose an earlier or later time slot.`,
};

const FLOW_COPY: Record<ClientPreferredLang, FlowCopy> = {
  en: EN_FLOW_COPY,
  roman_ur: {
    ...EN_FLOW_COPY,
    flowTitle: 'Appointment Book Karein',
    selectServices: '1. Services Chunein',
    selectDate: '2. Tareekh (Date) Chunein',
    selectTime: '3. Aane Ka Waqt (Arrival)',
    selectBarber: '4. Dastyab Barber Chunein',
    yourDetails: '5. Aap Ki Maloomat',
    yourNamePlaceholder: 'Apna mukammal naam likhein',
    yourPhoneLabel: 'Mobile Number',
    returningWelcome: 'Khush amdeed',
    howCanIHelp: 'Aaj hum aap ki kya madad kar sakte hain?',
    menuBookBtn: '1. Book Appointment',
    menuServicesBtn: '2. Services aur Qeemat',
    menuHoursBtn: '3. Auqaat aur Pata',
    menuDealsBtn: '4. Maujooda Deals aur Offers',
    noActiveDealsText: 'Abhi koi khaas deal faal nahi — normal rates laagu hain.',
    applyDealBtn: 'Deal Laagu Karein aur Book Karein',
    rebookLastBtn: 'Pichli Service Dobara Book Karein',
    firstTimeTitle: 'Pehli Martaba Tashreef Laye Hain?',
    firstTimeSubtitle:
      'Apna mukammal naam aur mobile number ek dafa save karein taake agli baar aap ko pehchana ja sake.',
    saveDetailsBtn: 'Maloomat Mehfooz Karein',
    savingDetailsBtn: 'Mehfooz ho raha hai...',
    installAppBtn: 'Salon App Install Karein',
    appInstalledMsg: 'Home screen par 1-tap booking ke liye salon app shamil karein.',
    installManualHint:
      'Browser menu mein "Add to Home Screen" ya "Install App" par click karein.',
    detailsSavedMsg:
      'Profile mehfooz ho gayi. Apna zaati booking link copy karein ya salon app install karein:',
    summaryTitle: 'Booking Summary',
    clientNameRow: 'Client Naam',
    phoneRow: 'Phone Number',
    dateTimeRow: 'Tareekh aur Waqt',
    barberRow: 'Barber',
    servicesRow: 'Services',
    totalAmountLabel: 'Kul Raqam',
    totalTimeLabel: 'Kul Waqt',
    confirmBtn: 'Confirm Appointment',
    confirmingBtn: 'Confirm ho raha hai...',
    changeBtn: 'Tabdeel',
    noSlotsForDate: 'Is tareekh par koi slot khali nahi. Doosri tareekh dekhein.',
    closedOnDate: 'Is din salon band hai.',
    noBarberAtSlot:
      'Is waqt tamam stylists masroof hain. Upar se thora aage ya peeche ka waqt chunein.',
    checkingSlots: 'Khali slots check ho rahe hain...',
    confirmedTitle: 'Appointment Confirm Ho Gayi',
    confirmedSubtitle:
      'Aap ki chair reserve ho chuki hai. Neeche se kisi bhi waqt tabdeel ya cancel karein.',
    canceledTitle: 'Appointment Cancel Ho Gayi',
    canceledSubtitle:
      'Aap ka waqt khali kar diya gaya hai aur salon ko ittila de di gayi hai.',
    rescheduledNotice: 'Naya waqt save ho gaya aur salon ko ittila mil gayi.',
    rescheduleBtn: 'Reschedule',
    cancelBookingBtn: 'Cancel Booking',
    confirmRescheduleBtn: 'Naya Waqt Confirm Karein',
    updatingRescheduleBtn: 'Tabdeel ho raha hai...',
    confirmCancelQuestion:
      'Kya aap waqai yeh booking cancel karna chahte hain? Chair foran khali ho jayegi.',
    yesCancelBtn: 'Haan, Cancel Karein',
    keepBookingBtn: 'Booking Rakhein',
    cancelingBtn: 'Cancel ho raha hai...',
    addToCalendarBtn: 'Calendar Mein Save Karein (.ics)',
    bookAnotherBtn: 'Naya Slot Book Karein',
    dealAppliedLabel: 'Deal Laagu',
    todayLabel: 'Aaj',
    tomorrowLabel: 'Kal',
    weekdaysShort: ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumerat', 'Jumma', 'Hafta'],
    errSelectService: 'Kam az kam aik service chunein.',
    errSelectSlotBarber: 'Tareekh, waqt aur barber muntakhib karein.',
    errEnterName: 'Confirm karne se pehle apna mukammal naam likhein.',
    errEnterPhone: 'Sahih mobile number darj karein.',
    callSalonLabel: 'Salon Ko Call Karein',
    demoHiddenBarberNote: (barber, slot) =>
      `${barber} is waqt (${slot}) masroof hain. Aap neeche se kisi doosre stylist ko chunein ya time slot aage peeche kar lein.`,
  },
  ur: {
    ...EN_FLOW_COPY,
    flowTitle: 'اپائنٹمنٹ بک کریں',
    demoBadge: 'لائیو ڈیمو فلو',
    selectServices: '1. سروسز منتخب کریں',
    selectDate: '2. تاریخ منتخب کریں',
    selectTime: '3. آنے کا وقت منتخب کریں',
    selectBarber: '4. دستیاب باربر منتخب کریں',
    yourDetails: '5. آپ کی تفصیلات',
    yourNamePlaceholder: 'اپنا مکمل نام لکھیں',
    yourPhoneLabel: 'موبائل نمبر',
    returningWelcome: 'خوش آمدید',
    howCanIHelp: 'آج ہم آپ کی کیا مدد کر سکتے ہیں؟',
    menuBookBtn: '1. اپائنٹمنٹ بک کریں',
    menuServicesBtn: '2. سروسز اور قیمتیں',
    menuHoursBtn: '3. کھلنے کے اوقات اور پتہ',
    menuDealsBtn: '4. موجودہ ڈیلز اور آفرز',
    noActiveDealsText: 'اس وقت کوئی خاص ڈیل فعال نہیں ہے — معمول کے ریٹس لاگو ہیں۔',
    applyDealBtn: 'ڈیل لاگو کریں اور بک کریں',
    visitsLabel: 'وزٹس',
    rebookLastBtn: 'پچھلی سروس دوبارہ بک کریں',
    firstTimeTitle: 'پہلی بار تشریف لائے ہیں؟ پروفائل محفوظ کریں',
    firstTimeSubtitle:
      'اپنا نام اور واٹس ایپ نمبر ایک بار محفوظ کریں تاکہ اگلی بار خودکار شناخت ہو سکے۔',
    saveDetailsBtn: 'تفصیلات محفوظ کریں',
    savingDetailsBtn: 'محفوظ ہو رہا ہے...',
    installAppBtn: 'سیلون ایپ انسٹال کریں',
    appInstalledMsg: 'فوری بکنگ کے لیے اپنی ہوم اسکرین پر سیلون ایپ شامل کریں۔',
    installManualHint:
      'فوری رسائی کے لیے براؤزر مینو میں "Add to Home Screen" یا "Install App" پر کلک کریں۔',
    detailsSavedMsg:
      'پروفائل محفوظ ہو گیا۔ اپنا ذاتی بکنگ لنک واٹس ایپ میں محفوظ کریں یا ایپ انسٹال کریں:',
    summaryTitle: 'بکنگ کا خلاصہ',
    clientNameRow: 'گاہک کا نام',
    phoneRow: 'فون نمبر',
    dateTimeRow: 'تاریخ اور وقت',
    barberRow: 'باربر',
    servicesRow: 'سروسز',
    totalAmountLabel: 'کل رقم',
    totalTimeLabel: 'کل وقت',
    confirmBtn: 'اپائنٹمنٹ کنفرم کریں',
    confirmingBtn: 'تصدیق ہو رہی ہے...',
    changeBtn: 'تبدیل کریں',
    noSlotsForDate: 'اس تاریخ پر کوئی وقت دستیاب نہیں۔ دوسری تاریخ منتخب کریں۔',
    closedOnDate: 'اس دن سیلون بند ہے۔',
    noBarberAtSlot:
      'اس وقت تمام اسٹائلسٹ مصروف ہیں۔ براہِ کرم اوپر سے تھوڑا پہلے یا بعد کا وقت منتخب کریں۔',
    availableLabel: 'دستیاب',
    freeShort: 'دستیاب',
    checkingSlots: 'دستیاب اوقات چیک ہو رہے ہیں...',
    confirmedTitle: 'اپائنٹمنٹ کنفرم ہو گئی',
    confirmedSubtitle:
      'آپ کی کرسی محفوظ کر دی گئی ہے۔ آپ نیچے سے کسی بھی وقت تبدیلی یا منسوخی کر سکتے ہیں۔',
    canceledTitle: 'اپائنٹمنٹ منسوخ ہو گئی',
    canceledSubtitle: 'آپ کا وقت خالی کر دیا گیا ہے اور سیلون کاؤنٹر کو اطلاع دے دی گئی ہے۔',
    rescheduledNotice: 'نیا وقت کنفرم ہو گیا اور سیلون کو اطلاع مل گئی۔',
    rescheduleBtn: 'وقت تبدیل کریں (Reschedule)',
    cancelBookingBtn: 'بکنگ منسوخ کریں (Cancel)',
    confirmRescheduleBtn: 'نیا وقت اور باربر کنفرم کریں',
    updatingRescheduleBtn: 'تبدیل ہو رہا ہے...',
    confirmCancelQuestion:
      'کیا آپ واقعی یہ اپائنٹمنٹ منسوخ کرنا چاہتے ہیں؟ کرسی فوراً خالی ہو جائے گی۔',
    yesCancelBtn: 'جی ہاں، منسوخ کریں',
    keepBookingBtn: 'بکنگ برقرار رکھیں',
    cancelingBtn: 'منسوخ ہو رہا ہے...',
    demoNoPersistNote: 'ڈیمو موڈ · اصل بکنگز میں کوئی تبدیلی نہیں کی گئی۔',
    bookingIdLabel: 'بکنگ ریفرنس',
    addToCalendarBtn: 'کیلنڈر میں شامل کریں (.ics)',
    openMapsBtn: 'گوگل میپس ڈائریکشن',
    copyLocationBtn: 'کاپی',
    copiedBtn: 'کاپی ہو گیا',
    doneBtn: 'مکمل',
    bookAnotherBtn: 'نئی بکنگ کریں',
    dealAppliedLabel: 'ڈیل لاگو',
    minShort: 'منٹ',
    todayLabel: 'آج',
    tomorrowLabel: 'کل',
    weekdaysShort: ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'],
    monthsShort: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
    errSelectService: 'براہ کرم کم از کم ایک سروس منتخب کریں۔',
    errSelectSlotBarber: 'براہ کرم دستیاب تاریخ، وقت اور باربر منتخب کریں۔',
    errEnterName: 'تصدیق سے پہلے اپنا مکمل نام درج کریں۔',
    errEnterPhone: 'درست موبائل نمبر درج کریں۔',
    callSalonLabel: 'سیلون کو براہِ راست کال کریں',
    demoHiddenBarberNote: (barber, slot) =>
      `${barber} اس وقت (${slot}) مصروف ہیں۔ آپ نیچے کسی دوسرے دستیاب اسٹائلسٹ کا انتخاب کر سکتے ہیں یا اپنا وقت تھوڑا آگے پیچھے کر لیں۔`,
  },
  ar: {
    ...EN_FLOW_COPY,
    flowTitle: 'حجز موعد',
    demoBadge: 'عرض تجريبي مباشر',
    selectServices: '1. اختر الخدمات',
    selectDate: '2. اختر التاريخ',
    selectTime: '3. وقت الوصول',
    selectBarber: '4. الحلاق المتاح',
    yourDetails: '5. بياناتك',
    yourNamePlaceholder: 'أدخل اسمك الكامل',
    yourPhoneLabel: 'رقم الهاتف',
    returningWelcome: 'أهلاً بعودتك',
    howCanIHelp: 'كيف يمكننا خدمتك اليوم؟',
    menuBookBtn: '1. حجز موعد',
    menuServicesBtn: '2. الخدمات والأسعار',
    menuHoursBtn: '3. ساعات العمل والموقع',
    menuDealsBtn: '4. العروض والخصومات الحالية',
    noActiveDealsText: 'لا توجد عروض نشطة حالياً — تطبق الأسعار الاعتيادية.',
    applyDealBtn: 'تطبيق العرض والحجز',
    visitsLabel: 'زيارات',
    rebookLastBtn: 'إعادة حجز الزيارة السابقة',
    firstTimeTitle: 'زيارتك الأولى؟ احفظ بياناتك الآن',
    firstTimeSubtitle: 'أدخل اسمك ورقم هاتفك المحمول مرة واحدة ليتم التعرف عليك في زيارتك القادمة.',
    saveDetailsBtn: 'حفظ بياناتي',
    savingDetailsBtn: 'جاري الحفظ...',
    installAppBtn: 'تثبيت تطبيق الصالون',
    appInstalledMsg: 'أضف الصالون إلى شاشتك الرئيسية للحجز بضغطة واحدة.',
    installManualHint:
      'من قائمة المتصفح، اختر "إضافة إلى الشاشة الرئيسية" أو "تثبيت التطبيق".',
    detailsSavedMsg: 'تم حفظ ملفك. انسخ رابط الحجز الشخصي أو ثبّت تطبيق الصالون:',
    summaryTitle: 'ملخص الحجز',
    clientNameRow: 'اسم العميل',
    phoneRow: 'رقم الهاتف',
    dateTimeRow: 'التاريخ والوقت',
    barberRow: 'الحلاق',
    servicesRow: 'الخدمات',
    totalAmountLabel: 'المبلغ الإجمالي',
    totalTimeLabel: 'الوقت الإجمالي',
    confirmBtn: 'تأكيد الموعد',
    confirmingBtn: 'جاري التأكيد...',
    changeBtn: 'تعديل',
    noSlotsForDate: 'لا توجد أوقات متاحة لهذا التاريخ. اختر يوماً آخر.',
    closedOnDate: 'الصالون مغلق في هذا اليوم.',
    noBarberAtSlot:
      'جميع المصففين مشغولون في هذا الوقت. يرجى اختيار موعد آخر قبل أو بعد هذا الوقت أعلاه.',
    availableLabel: 'متاح',
    freeShort: 'متاح',
    checkingSlots: 'جاري فحص المواعيد المتاحة...',
    confirmedTitle: 'تم تأكيد الموعد',
    confirmedSubtitle: 'تم تأكيد حجزك. يمكنك تعديل أو إلغاء الموعد مباشرة أدناه في أي وقت.',
    canceledTitle: 'تم إلغاء الموعد',
    canceledSubtitle: 'تم تحرير الموعد وإبلاغ الصالون فوراً.',
    rescheduledNotice: 'تم تحديث الموعد وإشعار الصالون.',
    rescheduleBtn: 'تعديل الموعد (Reschedule)',
    cancelBookingBtn: 'إلغاء الحجز (Cancel)',
    confirmRescheduleBtn: 'تأكيد الموعد والحلاق الجديد',
    updatingRescheduleBtn: 'جاري التحديث...',
    confirmCancelQuestion: 'هل أنت متأكد من إلغاء هذا الحجز؟ سيتم تحرير المقعد فوراً.',
    yesCancelBtn: 'نعم، إلغاء الحجز',
    keepBookingBtn: 'الاحتفاظ بالحجز',
    cancelingBtn: 'جاري الإلغاء...',
    demoNoPersistNote: 'وضع تجريبي · لم يتم تعديل الحجوزات الفعلية.',
    bookingIdLabel: 'رقم الحجز',
    addToCalendarBtn: 'إضافة إلى التقويم (.ics)',
    openMapsBtn: 'اتجاهات خرائط جوجل',
    copyLocationBtn: 'نسخ',
    copiedBtn: 'تم النسخ',
    doneBtn: 'تم',
    bookAnotherBtn: 'حجز موعد آخر',
    dealAppliedLabel: 'العرض المطبق',
    minShort: 'دقيقة',
    todayLabel: 'اليوم',
    tomorrowLabel: 'غداً',
    weekdaysShort: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    monthsShort: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    errSelectService: 'يرجى اختيار خدمة واحدة على الأقل.',
    errSelectSlotBarber: 'يرجى اختيار التاريخ والوقت والحلاق المتاح.',
    errEnterName: 'يرجى إدخال اسمك الكامل قبل التأكيد.',
    errEnterPhone: 'يرجى إدخال رقم هاتف صحيح.',
    callSalonLabel: 'اتصل بالصالون مباشرة',
    demoHiddenBarberNote: (barber, slot) =>
      `${barber} مشغول في تمام الساعة ${slot}. يمكنك اختيار مصفف آخر متاح أدناه، أو تعديل وقت الحجز قبل أو بعد هذا الموعد.`,
  },
  it: {
    ...EN_FLOW_COPY,
    flowTitle: 'Prenota Appuntamento',
    selectServices: '1. Scegli i Servizi',
    selectDate: '2. Scegli la Data',
    selectTime: '3. Orario di Arrivo',
    selectBarber: '4. Barbiere Disponibile',
    yourDetails: '5. I Tuoi Dati',
    yourNamePlaceholder: 'Inserisci il tuo nome completo',
    yourPhoneLabel: 'Numero di cellulare',
    returningWelcome: 'Bentornato',
    howCanIHelp: 'Come posso aiutarti oggi?',
    menuBookBtn: '1. Prenota Appuntamento',
    menuServicesBtn: '2. Servizi e Prezzi',
    menuHoursBtn: '3. Orari e Posizione',
    menuDealsBtn: '4. Offerte Attuali',
    noActiveDealsText: 'Nessuna offerta attiva al momento — tariffe standard.',
    applyDealBtn: 'Applica Offerta e Prenota',
    rebookLastBtn: 'Riprenota Ultima Visita',
    firstTimeTitle: 'Prima Visita? Salva il Profilo',
    firstTimeSubtitle:
      'Inserisci nome e numero di cellulare per essere riconosciuto alla prossima visita.',
    saveDetailsBtn: 'Salva i Miei Dati',
    savingDetailsBtn: 'Salvataggio...',
    installAppBtn: 'Installa App Salone',
    summaryTitle: 'Riepilogo Prenotazione',
    confirmBtn: 'Conferma Appuntamento',
    confirmingBtn: 'Conferma in corso...',
    changeBtn: 'Modifica',
    availableLabel: 'Disponibile',
    freeShort: 'liberi',
    checkingSlots: 'Verifica disponibilità in corso...',
    confirmedTitle: 'Appuntamento Confermato',
    confirmedSubtitle:
      'La tua poltrona è riservata. Puoi riprogrammare o annullare qui sotto in qualsiasi momento.',
    canceledTitle: 'Appuntamento Annullato',
    canceledSubtitle: 'Lo slot è stato liberato e il salone è stato avvisato.',
    rescheduledNotice: 'Appuntamento riprogrammato e salone avvisato.',
    rescheduleBtn: 'Riprogramma',
    cancelBookingBtn: 'Annulla Prenotazione',
    confirmRescheduleBtn: 'Conferma Nuovo Orario',
    updatingRescheduleBtn: 'Aggiornamento...',
    confirmCancelQuestion: 'Vuoi davvero annullare questa prenotazione?',
    yesCancelBtn: 'Sì, Annulla',
    keepBookingBtn: 'Mantieni',
    cancelingBtn: 'Annullamento...',
    openMapsBtn: 'Indicazioni Google Maps',
    copyLocationBtn: 'Copia',
    copiedBtn: 'Copiato',
    bookAnotherBtn: 'Prenota Un Altro Slot',
    todayLabel: 'Oggi',
    tomorrowLabel: 'Domani',
    weekdaysShort: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
    errSelectService: 'Seleziona almeno un servizio.',
    errSelectSlotBarber: 'Seleziona data, orario e barbiere disponibili.',
    errEnterName: 'Inserisci il tuo nome completo prima di confermare.',
    errEnterPhone: 'Inserisci un numero di telefono valido.',
  },
  ru: {
    ...EN_FLOW_COPY,
    flowTitle: 'Записаться',
    selectServices: '1. Выберите услуги',
    selectDate: '2. Выберите дату',
    selectTime: '3. Время визита',
    selectBarber: '4. Свободный мастер',
    yourDetails: '5. Ваши данные',
    yourNamePlaceholder: 'Введите полное имя',
    yourPhoneLabel: 'Номер мобильного телефона',
    returningWelcome: 'С возвращением',
    howCanIHelp: 'Чем мы можем помочь вам сегодня?',
    menuBookBtn: '1. Записаться на приём',
    menuServicesBtn: '2. Услуги и цены',
    menuHoursBtn: '3. Часы работы и адрес',
    menuDealsBtn: '4. Текущие акции',
    noActiveDealsText: 'Сейчас активных акций нет — действуют стандартные цены.',
    applyDealBtn: 'Применить акцию',
    rebookLastBtn: 'Повторить прошлый визит',
    firstTimeTitle: 'Первый визит? Сохраните профиль',
    firstTimeSubtitle:
      'Укажите имя и номер мобильного телефона, чтобы мы узнавали вас при следующем посещении.',
    saveDetailsBtn: 'Сохранить данные',
    savingDetailsBtn: 'Сохранение...',
    installAppBtn: 'Установить приложение салона',
    summaryTitle: 'Детали записи',
    confirmBtn: 'Подтвердить запись',
    confirmingBtn: 'Подтверждение...',
    changeBtn: 'Изменить',
    availableLabel: 'Свободен',
    freeShort: 'своб.',
    checkingSlots: 'Проверяем свободные окна...',
    confirmedTitle: 'Запись подтверждена',
    confirmedSubtitle:
      'Кресло зарезервировано. Вы можете перенести или отменить запись прямо ниже.',
    canceledTitle: 'Запись отменена',
    canceledSubtitle: 'Время освобождено, салон уведомлён.',
    rescheduledNotice: 'Запись перенесена, салон уведомлён.',
    rescheduleBtn: 'Перенести',
    cancelBookingBtn: 'Отменить запись',
    confirmRescheduleBtn: 'Подтвердить новое время',
    updatingRescheduleBtn: 'Обновление...',
    confirmCancelQuestion: 'Вы уверены, что хотите отменить эту запись?',
    yesCancelBtn: 'Да, отменить',
    keepBookingBtn: 'Оставить',
    cancelingBtn: 'Отмена...',
    openMapsBtn: 'Открыть Google Карты',
    copyLocationBtn: 'Копировать',
    copiedBtn: 'Скопировано',
    bookAnotherBtn: 'Записаться снова',
    minShort: 'мин',
    todayLabel: 'Сегодня',
    tomorrowLabel: 'Завтра',
    weekdaysShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    errSelectService: 'Выберите хотя бы одну услугу.',
    errSelectSlotBarber: 'Выберите доступную дату, время и мастера.',
    errEnterName: 'Введите ваше полное имя перед подтверждением.',
    errEnterPhone: 'Введите корректный номер телефона.',
  },
  fr: {
    ...EN_FLOW_COPY,
    flowTitle: 'Prendre Rendez-vous',
    selectServices: '1. Choisir les Services',
    selectDate: '2. Choisir la Date',
    selectTime: '3. Heure d’Arrivée',
    selectBarber: '4. Coiffeur Disponible',
    yourDetails: '5. Vos Coordonnées',
    yourNamePlaceholder: 'Entrez votre nom complet',
    yourPhoneLabel: 'Numéro de téléphone mobile',
    returningWelcome: 'Bon retour',
    howCanIHelp: 'Comment puis-je vous aider aujourd’hui ?',
    menuBookBtn: '1. Prendre Rendez-vous',
    menuServicesBtn: '2. Services et Tarifs',
    menuHoursBtn: '3. Horaires et Adresse',
    menuDealsBtn: '4. Offres du Moment',
    applyDealBtn: 'Appliquer l’offre et réserver',
    rebookLastBtn: 'Reprendre le dernier rendez-vous',
    firstTimeTitle: 'Première visite ? Enregistrez votre profil',
    saveDetailsBtn: 'Enregistrer mes infos',
    installAppBtn: 'Installer l’App du Salon',
    confirmBtn: 'Confirmer le Rendez-vous',
    changeBtn: 'Modifier',
    availableLabel: 'Disponible',
    freeShort: 'libres',
    confirmedTitle: 'Rendez-vous Confirmé',
    canceledTitle: 'Rendez-vous Annulé',
    rescheduleBtn: 'Reprogrammer',
    cancelBookingBtn: 'Annuler',
    confirmRescheduleBtn: 'Confirmer le nouvel horaire',
    yesCancelBtn: 'Oui, Annuler',
    keepBookingBtn: 'Garder',
    openMapsBtn: 'Itinéraire Google Maps',
    copyLocationBtn: 'Copier',
    copiedBtn: 'Copié',
    todayLabel: "Aujourd'hui",
    tomorrowLabel: 'Demain',
    weekdaysShort: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  },
  de: {
    ...EN_FLOW_COPY,
    flowTitle: 'Termin Buchen',
    selectServices: '1. Leistungen wählen',
    selectDate: '2. Datum wählen',
    selectTime: '3. Ankunftszeit',
    selectBarber: '4. Verfügbarer Barber',
    yourDetails: '5. Ihre Daten',
    yourNamePlaceholder: 'Vollständigen Namen eingeben',
    yourPhoneLabel: 'Mobilnummer',
    returningWelcome: 'Willkommen zurück',
    howCanIHelp: 'Wie kann ich Ihnen heute helfen?',
    menuBookBtn: '1. Termin buchen',
    menuServicesBtn: '2. Leistungen & Preise',
    menuHoursBtn: '3. Öffnungszeiten & Standort',
    menuDealsBtn: '4. Aktuelle Angebote',
    applyDealBtn: 'Angebot wählen & buchen',
    rebookLastBtn: 'Letzten Besuch erneut buchen',
    firstTimeTitle: 'Erster Besuch? Profil speichern',
    saveDetailsBtn: 'Meine Daten speichern',
    installAppBtn: 'Salon-App installieren',
    confirmBtn: 'Termin bestätigen',
    changeBtn: 'Ändern',
    availableLabel: 'Verfügbar',
    freeShort: 'frei',
    confirmedTitle: 'Termin bestätigt',
    canceledTitle: 'Termin storniert',
    rescheduleBtn: 'Verschieben',
    cancelBookingBtn: 'Stornieren',
    confirmRescheduleBtn: 'Neue Zeit bestätigen',
    yesCancelBtn: 'Ja, stornieren',
    keepBookingBtn: 'Behalten',
    openMapsBtn: 'Google Maps Route',
    copyLocationBtn: 'Kopieren',
    copiedBtn: 'Kopiert',
    minShort: 'Min',
    todayLabel: 'Heute',
    tomorrowLabel: 'Morgen',
    weekdaysShort: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  },
  es: {
    ...EN_FLOW_COPY,
    flowTitle: 'Reservar Cita',
    selectServices: '1. Seleccionar Servicios',
    selectDate: '2. Elegir Fecha',
    selectTime: '3. Hora de Llegada',
    selectBarber: '4. Barbero Disponible',
    yourDetails: '5. Tus Datos',
    yourNamePlaceholder: 'Ingresa tu nombre completo',
    yourPhoneLabel: 'Número de móvil',
    returningWelcome: 'Bienvenido de nuevo',
    howCanIHelp: '¿Cómo puedo ayudarte hoy?',
    menuBookBtn: '1. Reservar Cita',
    menuServicesBtn: '2. Servicios y Precios',
    menuHoursBtn: '3. Horarios y Ubicación',
    menuDealsBtn: '4. Ofertas Actuales',
    applyDealBtn: 'Aplicar oferta y reservar',
    rebookLastBtn: 'Repetir última visita',
    firstTimeTitle: '¿Primera visita? Guarda tu perfil',
    saveDetailsBtn: 'Guardar mis datos',
    installAppBtn: 'Instalar App del Salón',
    confirmBtn: 'Confirmar Cita',
    changeBtn: 'Cambiar',
    availableLabel: 'Disponible',
    freeShort: 'libres',
    confirmedTitle: 'Cita Confirmada',
    canceledTitle: 'Cita Cancelada',
    rescheduleBtn: 'Reprogramar',
    cancelBookingBtn: 'Cancelar Cita',
    confirmRescheduleBtn: 'Confirmar Nuevo Horario',
    yesCancelBtn: 'Sí, Cancelar',
    keepBookingBtn: 'Mantener',
    openMapsBtn: 'Cómo llegar en Google Maps',
    copyLocationBtn: 'Copiar',
    copiedBtn: 'Copiado',
    todayLabel: 'Hoy',
    tomorrowLabel: 'Mañana',
    weekdaysShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  },
};

function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface UpcomingDateOption {
  date: string;
  top: string;
  sub: string;
}

function buildUpcomingDates(
  baseDateStr: string,
  copy: FlowCopy,
  count = 10
): UpcomingDateOption[] {
  const parts = (baseDateStr || '').split('-').map((n) => parseInt(n, 10));
  const start =
    parts.length === 3 && !parts.some((n) => Number.isNaN(n))
      ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0))
      : new Date();
  const out: UpcomingDateOption[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(start.getTime() + i * 86400000);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    const top =
      i === 0
        ? copy.todayLabel
        : i === 1
        ? copy.tomorrowLabel
        : copy.weekdaysShort[dt.getUTCDay()] || '';
    const sub = `${dt.getUTCDate()} ${copy.monthsShort[dt.getUTCMonth()] || ''}`.trim();
    out.push({ date: iso, top, sub });
  }
  return out;
}

function buildBookingIcsDataUrl(params: {
  bookingId: string;
  salonName: string;
  service: string;
  barberName: string;
  appointmentDate: string;
  timeSlot: string;
  durationMins: number;
  address: string;
}): string {
  const [y, m, d] = (params.appointmentDate || '').split('-').map((n) => parseInt(n, 10));
  const match = params.timeSlot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let hh = 12;
  let mm = 0;
  if (match) {
    hh = parseInt(match[1], 10) % 12;
    if (match[3].toUpperCase() === 'PM') hh += 12;
    mm = parseInt(match[2], 10);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const startDt =
    y && m && d ? new Date(y, m - 1, d, hh, mm, 0) : new Date(Date.now() + 3600000);
  const endDt = new Date(startDt.getTime() + Math.max(15, params.durationMins) * 60000);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(
      dt.getMinutes()
    )}00`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Salon Concierge//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${params.bookingId}@salon-concierge`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(startDt)}`,
    `DTEND:${fmt(endDt)}`,
    `SUMMARY:${params.salonName} — ${params.service} (${params.barberName})`,
    `LOCATION:${params.address.replace(/[\r\n]+/g, ' ')}`,
    `DESCRIPTION:Booking Ref ${params.bookingId}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export const CustomerBookingFlow: React.FC<CustomerBookingFlowProps> = ({
  salonId,
  salonCode,
  cToken,
  adSource = 'DIRECT',
  initialDealId = null,
  initialLang = 'en',
  initialClientPhone = '',
  isDemo = false,
  demoForceNewCustomer,
  demoSavedCustomerName,
  demoBusyBarber,
  demoBusyTimeSlot,
  standalone = false,
  onNavigate,
  onBookingConfirmed,
  onClose,
}) => {
  const effectiveSalonCode = salonCode || salonId;

  const [config, setConfig] = useState<CustomerExperienceConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [activeLang, setActiveLang] = useState<ClientPreferredLang>(initialLang || 'en');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(initialDealId);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availability, setAvailability] = useState<CustomerAvailabilityResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [selectedBarber, setSelectedBarber] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>(initialClientPhone);
  const [clientNameInput, setClientNameInput] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [personalShareUrl, setPersonalShareUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quotaContactPhone, setQuotaContactPhone] = useState<string | null>(null);
  const [confirmedResult, setConfirmedResult] = useState<CustomerFlowBookingResponse | null>(null);
  const [availabilityReloadTick, setAvailabilityReloadTick] = useState(0);
  const [configReloadTick, setConfigReloadTick] = useState(0);
  const [copiedLocation, setCopiedLocation] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Returning Client 4-Button Interactive Menu State
  const [activeMenuPanel, setActiveMenuPanel] = useState<
    'BOOK' | 'SERVICES' | 'HOURS' | 'DEALS'
  >('BOOK');

  // PWA Install App prompt capture
  const deferredInstallPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);

  // Post-Confirmation Inline Reschedule & Cancel States
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedAvailability, setReschedAvailability] =
    useState<CustomerAvailabilityResponse | null>(null);
  const [loadingReschedSlots, setLoadingReschedSlots] = useState(false);
  const [reschedSlot, setReschedSlot] = useState('');
  const [reschedBarber, setReschedBarber] = useState('');
  const [submittingResched, setSubmittingResched] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [isCanceledInFlow, setIsCanceledInFlow] = useState(false);
  const [confirmationActionBanner, setConfirmationActionBanner] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string>(makeIdempotencyKey());
  const bookingSectionRef = useRef<HTMLDivElement | null>(null);

  // Progressive collapse chips once user confirms Services / Date / Time
  const [servicesCollapsed, setServicesCollapsed] = useState(false);
  const [dateCollapsed, setDateCollapsed] = useState(false);
  const [timeCollapsed, setTimeCollapsed] = useState(false);

  useEffect(() => {
    setSelectedDealId(initialDealId);
  }, [initialDealId]);

  useEffect(() => {
    setActiveLang(initialLang || 'en');
  }, [initialLang]);

  useEffect(() => {
    if (initialClientPhone) {
      setClientPhone(initialClientPhone);
    }
  }, [initialClientPhone]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredInstallPromptRef.current = e as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!effectiveSalonCode || !effectiveSalonCode.trim()) {
      setLoadingConfig(false);
      setErrorMsg('Invalid or missing salon booking link.');
      return;
    }
    setLoadingConfig(true);
    setErrorMsg(null);
    const params = new URLSearchParams();
    params.set('lang', activeLang);
    if (cToken) params.set('c', cToken);
    fetch(
      `/api/public/salons/${encodeURIComponent(effectiveSalonCode)}/customer-experience?${params.toString()}`,
      { credentials: 'include' }
    )
      .then(async (res) => {
        const raw = await res.text();
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
        } catch {
          parsed = null;
        }
        if (!res.ok) {
          const msg =
            (parsed && typeof parsed.error === 'string' && parsed.error) ||
            (res.status === 404
              ? 'This salon booking link could not be found or has changed.'
              : `Booking service returned HTTP ${res.status}. Please retry in a moment.`);
          throw new Error(msg);
        }
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Booking service returned an unexpected response.');
        }
        return parsed as unknown as CustomerExperienceConfig;
      })
      .then((data: CustomerExperienceConfig) => {
        if (cancelled) return;
        setConfig(data);
        setSelectedDate((prev) => prev || data.todayDate);

        if (cToken && data.publicCode) {
          setPersonalShareUrl(`/s/${data.publicCode}?c=${encodeURIComponent(cToken)}`);
        }

        if (
          data.availableLanguages.length > 0 &&
          !data.availableLanguages.some((l) => l.lang === activeLang)
        ) {
          setActiveLang(data.defaultLanguage || 'en');
        }

        setSelectedServiceIds((prev) => {
          if (prev.length > 0) return prev;
          if (selectedDealId) {
            const matchedDeal = data.activeDeals.find((d) => d.id === selectedDealId);
            if (matchedDeal && matchedDeal.serviceIds.length > 0) {
              return matchedDeal.serviceIds;
            }
          }
          const first = data.services[0];
          return first ? [first.id || first.name] : [];
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg =
            err instanceof Error && err.message
              ? err.message
              : 'Unable to load salon booking details.';
          setErrorMsg(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveSalonCode, selectedDealId, cToken, configReloadTick]);

  const activeDeal: SalonDeal | null = useMemo(() => {
    if (!config || !selectedDealId) return null;
    return config.activeDeals.find((d) => d.id === selectedDealId) || null;
  }, [config, selectedDealId]);

  const selectedServices = useMemo(() => {
    if (!config) return [];
    return config.services.filter((s) =>
      selectedServiceIds.includes(s.id || s.name)
    );
  }, [config, selectedServiceIds]);

  const { originalTotal, finalTotal, savings, totalDurationMins } = useMemo(() => {
    const orig = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const dur = Math.max(
      15,
      selectedServices.reduce((sum, s) => sum + (Number(s.durationMins) || 35), 0)
    );
    let finalAmt = orig;
    if (activeDeal && orig > 0) {
      if (activeDeal.discountType === 'PCT') {
        finalAmt = Math.max(0, Math.round(orig * (1 - activeDeal.discountValue / 100)));
      } else if (activeDeal.discountType === 'FIXED') {
        finalAmt = Math.max(0, orig - activeDeal.discountValue);
      } else if (activeDeal.discountType === 'BUNDLE_PRICE') {
        finalAmt = Math.max(0, Math.min(orig, activeDeal.discountValue));
      }
    }
    return {
      originalTotal: orig,
      finalTotal: finalAmt,
      savings: Math.max(0, orig - finalAmt),
      totalDurationMins: dur,
    };
  }, [selectedServices, activeDeal]);

  useEffect(() => {
    idempotencyKeyRef.current = makeIdempotencyKey();
  }, [selectedServiceIds, selectedDate, selectedTimeSlot, selectedBarber]);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setLoadingSlots(true);
    const params = new URLSearchParams({
      date: selectedDate,
      durationMins: String(totalDurationMins),
    });
    if (selectedServiceIds.length > 0) {
      params.set('serviceIds', selectedServiceIds.join(','));
    }
    if (isDemo) {
      params.set('isDemo', 'true');
      if (demoBusyBarber) params.set('demoBusyBarber', demoBusyBarber);
      if (demoBusyTimeSlot) params.set('demoBusyTimeSlot', demoBusyTimeSlot);
    }
    fetch(
      `/api/public/salons/${encodeURIComponent(effectiveSalonCode)}/availability?${params.toString()}`
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed availability'))))
      .then((data: CustomerAvailabilityResponse) => {
        if (cancelled) return;
        setAvailability(data);
        if (!data.isOpen || data.slots.length === 0) {
          setSelectedTimeSlot('');
          setSelectedBarber('');
          setTimeCollapsed(false);
          return;
        }
        const stillValidSlot = data.slots.find((s) => s.timeSlot === selectedTimeSlot);
        const firstOpenSlot = data.slots.find((s) => s.availableBarberCount > 0) || data.slots[0];
        const chosenSlot = stillValidSlot || firstOpenSlot;
        if (chosenSlot) {
          setSelectedTimeSlot(chosenSlot.timeSlot);
          const stillValidBarber = chosenSlot.barbers.find(
            (b) => b.name === selectedBarber && b.available
          );
          const firstAvailBarber = chosenSlot.barbers.find((b) => b.available);
          setSelectedBarber(stillValidBarber?.name || firstAvailBarber?.name || '');
          if (chosenSlot.availableBarberCount === 0) {
            setTimeCollapsed(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    effectiveSalonCode,
    selectedDate,
    totalDurationMins,
    selectedServiceIds,
    isDemo,
    demoBusyBarber,
    demoBusyTimeSlot,
    availabilityReloadTick,
  ]);

  // Inline Reschedule Availability Loader (when Reschedule is opened under confirmed appointment)
  useEffect(() => {
    if (!reschedOpen || !reschedDate || !confirmedResult?.appointment) return;
    let cancelled = false;
    setLoadingReschedSlots(true);
    const appt = confirmedResult.appointment;
    const params = new URLSearchParams({
      date: reschedDate,
      durationMins: String(appt.durationMins || totalDurationMins || 35),
    });
    if (selectedServiceIds.length > 0) {
      params.set('serviceIds', selectedServiceIds.join(','));
    }
    fetch(
      `/api/public/salons/${encodeURIComponent(effectiveSalonCode)}/availability?${params.toString()}`
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed availability'))))
      .then((data: CustomerAvailabilityResponse) => {
        if (cancelled) return;
        setReschedAvailability(data);
        const openSlots = data.slots.filter((s) => s.availableBarberCount > 0);
        const keepSlot = openSlots.find((s) => s.timeSlot === reschedSlot);
        const chosen = keepSlot || openSlots[0] || data.slots[0];
        if (chosen) {
          setReschedSlot(chosen.timeSlot);
          const freeBarbers = chosen.barbers.filter((b) => b.available);
          const keepBarber = freeBarbers.find((b) => b.name === (reschedBarber || appt.barberName));
          setReschedBarber(keepBarber?.name || freeBarbers[0]?.name || '');
        } else {
          setReschedSlot('');
          setReschedBarber('');
        }
      })
      .catch(() => {
        if (!cancelled) setReschedAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingReschedSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reschedOpen, reschedDate, effectiveSalonCode]);

  const currentSlotObj = useMemo(() => {
    if (!availability || !selectedTimeSlot) return null;
    return availability.slots.find((s) => s.timeSlot === selectedTimeSlot) || null;
  }, [availability, selectedTimeSlot]);

  const availableBarbersAtSlot = useMemo(() => {
    if (!currentSlotObj) return [];
    return currentSlotObj.barbers.filter((b) => b.available);
  }, [currentSlotObj]);

  const isDemoBusyBarberHiddenHere = useMemo(() => {
    if (!isDemo || !demoBusyBarber || !currentSlotObj) return false;
    const match = currentSlotObj.barbers.find((b) => b.name === demoBusyBarber);
    return Boolean(match && !match.available);
  }, [isDemo, demoBusyBarber, currentSlotObj]);

  const effectiveSavedName = useMemo(() => {
    if (isDemo && typeof demoForceNewCustomer === 'boolean') {
      if (demoForceNewCustomer) return null;
      return demoSavedCustomerName || config?.returningClient?.clientName || 'Bilal Ahmed';
    }
    return config?.returningClient?.clientName || null;
  }, [isDemo, demoForceNewCustomer, demoSavedCustomerName, config]);

  const copy = FLOW_COPY[activeLang] || FLOW_COPY.en;
  const dir: 'ltr' | 'rtl' = activeLang === 'ur' || activeLang === 'ar' ? 'rtl' : 'ltr';
  const upcomingDates = useMemo(
    () => buildUpcomingDates(config?.todayDate || new Date().toISOString().slice(0, 10), copy, 10),
    [config?.todayDate, activeLang]
  );

  const selectedDateMeta = useMemo(() => {
    return upcomingDates.find((d) => d.date === selectedDate) || null;
  }, [upcomingDates, selectedDate]);

  const localizedSelectedServicesText = useMemo(() => {
    return selectedServices
      .map((s) => s.translations?.[activeLang] || s.name)
      .join(' + ');
  }, [selectedServices, activeLang]);

  const toggleService = (svcId: string) => {
    setErrorMsg(null);
    setSelectedServiceIds((prev) => {
      if (prev.includes(svcId)) {
        return prev.length > 1 ? prev.filter((id) => id !== svcId) : prev;
      }
      return [...prev, svcId];
    });
  };

  const handleSelectSlot = (slotTime: string) => {
    setErrorMsg(null);
    setSelectedTimeSlot(slotTime);
    setServicesCollapsed(true);
    setDateCollapsed(true);
    const slot = availability?.slots.find((s) => s.timeSlot === slotTime);
    if (slot) {
      const avail = slot.barbers.filter((b) => b.available);
      const keepCurrent = avail.find((b) => b.name === selectedBarber);
      setSelectedBarber(keepCurrent?.name || avail[0]?.name || '');
      setTimeCollapsed(avail.length > 0);
    }
  };

  const handleInstallAppClick = async () => {
    if (deferredInstallPromptRef.current) {
      try {
        await deferredInstallPromptRef.current.prompt();
        const choice = await deferredInstallPromptRef.current.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallNotice(copy.appInstalledMsg);
          deferredInstallPromptRef.current = null;
          setCanNativeInstall(false);
        } else {
          setInstallNotice(copy.installManualHint);
        }
        return;
      } catch {
        // Fallback to manual browser instructions below
      }
    }
    setInstallNotice(copy.installManualHint);
  };

  const handleSaveClientProfile = async () => {
    if (!config) return;
    setErrorMsg(null);
    if (!clientNameInput.trim()) {
      setErrorMsg(copy.errEnterName);
      return;
    }
    if (!clientPhone.trim() || clientPhone.replace(/[^\d]/g, '').length < 7) {
      setErrorMsg(copy.errEnterPhone);
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(
        `/api/public/salons/${encodeURIComponent(effectiveSalonCode)}/client-profile`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: clientNameInput.trim(),
            phone: clientPhone.trim(),
            preferredLanguage: activeLang,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || copy.errEnterPhone);
        return;
      }
      setPersonalShareUrl(data.personalReturningShareUrl || null);
      if (data.returningClient) {
        setConfig((prev) =>
          prev
            ? {
                ...prev,
                returningClient: data.returningClient,
                availableLanguages: Array.isArray(data.availableLanguages)
                  ? data.availableLanguages
                  : prev.availableLanguages,
              }
            : prev
        );
        if (
          Array.isArray(data.availableLanguages) &&
          !data.availableLanguages.some((l: { lang: string }) => l.lang === activeLang)
        ) {
          setActiveLang('en');
        }
      }
    } catch {
      setErrorMsg('Could not save profile right now.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRebookLastVisit = () => {
    const rc = config?.returningClient;
    if (!rc || !rc.lastServiceIds?.length || !config) return;
    const validIds = rc.lastServiceIds.filter((id) =>
      config.services.some((s) => (s.id || s.name) === id)
    );
    if (validIds.length > 0) {
      setSelectedServiceIds(validIds);
      setServicesCollapsed(true);
    }
    if (rc.lastBarberName && availableBarbersAtSlot.some((b) => b.name === rc.lastBarberName)) {
      setSelectedBarber(rc.lastBarberName);
    }
    setActiveMenuPanel('BOOK');
  };

  const handleCopyLocation = async (addr: string, mapsUrl: string) => {
    const shareText = `${config?.salonName || 'Salon'} — ${addr}\n${mapsUrl}`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedLocation(true);
      setTimeout(() => setCopiedLocation(false), 2500);
    } catch {
      setCopiedLocation(false);
    }
  };

  const handleCopyPersonalLink = async (fullUrl: string) => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2500);
    } catch {
      setCopiedShareLink(false);
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setErrorMsg(null);
    setQuotaContactPhone(null);

    if (selectedServiceIds.length === 0) {
      setErrorMsg(copy.errSelectService);
      setServicesCollapsed(false);
      return;
    }
    if (!selectedDate || !selectedTimeSlot || !selectedBarber) {
      setErrorMsg(copy.errSelectSlotBarber);
      setTimeCollapsed(false);
      return;
    }
    if (!effectiveSavedName && !clientNameInput.trim()) {
      setErrorMsg(copy.errEnterName);
      return;
    }
    if (!config.returningClient && !isDemo && (!clientPhone.trim() || clientPhone.replace(/[^\d]/g, '').length < 7)) {
      setErrorMsg(copy.errEnterPhone);
      return;
    }

    setSubmitting(true);
    try {
      const bookUrl = cToken
        ? `/api/public/salons/${encodeURIComponent(effectiveSalonCode)}/flow/book?c=${encodeURIComponent(cToken)}`
        : `/api/public/salons/${encodeURIComponent(effectiveSalonCode)}/flow/book`;
      const res = await fetch(bookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientPhone: clientPhone.trim() || undefined,
          clientName: effectiveSavedName || clientNameInput.trim(),
          preferredLanguage: activeLang,
          serviceIds: selectedServiceIds,
          appointmentDate: selectedDate,
          timeSlot: selectedTimeSlot,
          barberName: selectedBarber,
          dealId: activeDeal?.id,
          adSource,
          idempotencyKey: idempotencyKeyRef.current,
          isDemo,
          demoBusyBarber: isDemo ? demoBusyBarber : undefined,
          demoBusyTimeSlot: isDemo ? demoBusyTimeSlot : undefined,
        }),
      });
      const data = (await res.json()) as CustomerFlowBookingResponse;
      if (res.status === 402 || data.code === 'QUOTA_EXCEEDED') {
        setErrorMsg(
          data.error ||
            'Online booking limit reached for this salon this month. Please call the salon directly.'
        );
        setQuotaContactPhone(data.publicContactPhone || config.publicContactPhone || null);
        return;
      }
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || copy.errSelectSlotBarber);
        setTimeCollapsed(false);
        setAvailabilityReloadTick((t) => t + 1);
        return;
      }
      if (data.personalReturningShareUrl) {
        setPersonalShareUrl(data.personalReturningShareUrl);
      }
      setConfirmedResult(data);
      setIsCanceledInFlow(false);
      setReschedOpen(false);
      setConfirmCancelOpen(false);
      setConfirmationActionBanner(null);
      onBookingConfirmed?.(data);
    } catch {
      setErrorMsg('Connection issue while confirming booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReschedulePanel = () => {
    if (!confirmedResult?.appointment) return;
    setErrorMsg(null);
    setConfirmCancelOpen(false);
    setReschedDate(confirmedResult.appointment.appointmentDate || selectedDate || config?.todayDate || '');
    setReschedSlot(confirmedResult.appointment.timeSlot);
    setReschedBarber(confirmedResult.appointment.barberName);
    setReschedOpen((prev) => !prev);
  };

  const handleConfirmInlineReschedule = async () => {
    if (!confirmedResult?.appointment || !reschedDate || !reschedSlot || !reschedBarber) return;
    setErrorMsg(null);
    setSubmittingResched(true);
    try {
      if (confirmedResult.isDemo || !confirmedResult.bookingManagementPath) {
        setConfirmedResult((prev) =>
          prev && prev.appointment
            ? {
                ...prev,
                appointment: {
                  ...prev.appointment,
                  appointmentDate: reschedDate,
                  timeSlot: reschedSlot,
                  barberName: reschedBarber,
                },
              }
            : prev
        );
        setReschedOpen(false);
        setConfirmationActionBanner(copy.rescheduledNotice);
        return;
      }
      const token = confirmedResult.bookingManagementPath.split('/b/')[1]?.split('?')[0];
      if (!token) {
        setErrorMsg('Could not verify booking token for reschedule.');
        return;
      }
      const res = await fetch(`/api/public/bookings/${encodeURIComponent(token)}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentDate: reschedDate,
          timeSlot: reschedSlot,
          barberName: reschedBarber,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || copy.errSelectSlotBarber);
        return;
      }
      setConfirmedResult((prev) =>
        prev && prev.appointment
          ? {
              ...prev,
              appointment: {
                ...prev.appointment,
                appointmentDate: data.booking?.appointmentDate || reschedDate,
                timeSlot: data.booking?.timeSlot || reschedSlot,
                barberName: data.booking?.barberName || reschedBarber,
              },
            }
          : prev
      );
      setReschedOpen(false);
      setConfirmationActionBanner(copy.rescheduledNotice);
    } catch {
      setErrorMsg('Connection issue while rescheduling. Please try again.');
    } finally {
      setSubmittingResched(false);
    }
  };

  const handleConfirmInlineCancel = async () => {
    if (!confirmedResult?.appointment) return;
    setErrorMsg(null);
    setSubmittingCancel(true);
    try {
      if (confirmedResult.isDemo || !confirmedResult.bookingManagementPath) {
        setIsCanceledInFlow(true);
        setConfirmCancelOpen(false);
        setReschedOpen(false);
        setConfirmationActionBanner(copy.canceledSubtitle);
        return;
      }
      const token = confirmedResult.bookingManagementPath.split('/b/')[1]?.split('?')[0];
      if (!token) {
        setErrorMsg('Could not verify booking token for cancellation.');
        return;
      }
      const res = await fetch(`/api/public/bookings/${encodeURIComponent(token)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Could not cancel booking right now.');
        return;
      }
      setIsCanceledInFlow(true);
      setConfirmCancelOpen(false);
      setReschedOpen(false);
      setConfirmationActionBanner(copy.canceledSubtitle);
    } catch {
      setErrorMsg('Connection issue while canceling. Please try again.');
    } finally {
      setSubmittingCancel(false);
    }
  };

  const containerClass = standalone
    ? 'min-h-screen bg-[#0D1117] text-[#F0F6FC] flex flex-col items-center justify-start sm:py-6 sm:px-4'
    : 'w-full h-full flex flex-col bg-[#0D1117] text-[#F0F6FC] rounded-2xl overflow-hidden border border-[#30363D]';

  if (loadingConfig && !config) {
    return (
      <div className={containerClass}>
        <div className="w-full max-w-md mx-auto p-6 text-center text-xs font-mono text-[#8B949E]">
          Loading booking flow...
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={containerClass}>
        <div className="w-full max-w-md mx-auto my-auto p-6">
          <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-6 text-center space-y-4 shadow-xl">
            <img
              src={LOGO_URL}
              alt="Salon Logo"
              className="size-12 mx-auto bg-transparent object-contain"
            />
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#F85149]">
                <AlertCircle className="size-4 shrink-0" />
                <span>Web Booking Unavailable</span>
              </div>
              <p className="text-sm text-[#F0F6FC] font-sans">
                {errorMsg || 'Unable to load salon booking details right now.'}
              </p>
              <p className="text-[11px] font-mono text-[#8B949E]">
                Booking Code: {effectiveSalonCode || 'Missing'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfigReloadTick((n) => n + 1)}
                className="min-h-[42px] rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-[#0D1117] px-4 py-2 text-xs font-mono font-black uppercase tracking-wide inline-flex items-center gap-1.5 transition"
              >
                <RotateCcw className="size-3.5" />
                <span>Retry Booking Flow</span>
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] rounded-xl border border-[#30363D] bg-[#1F242D] px-4 py-2 text-xs font-mono font-bold text-[#F0F6FC]"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass} dir={dir}>
      <div
        className={`w-full max-w-md flex flex-col bg-[#161B22] ${
          standalone
            ? 'min-h-screen sm:min-h-0 sm:rounded-3xl sm:border sm:border-[#30363D] sm:shadow-2xl overflow-hidden'
            : 'h-full'
        }`}
      >
        {/* Clean White-Label Top Header — NO WORKCRAFT branding text above Salon Name */}
        <header
          dir="ltr"
          className="sticky top-0 z-20 bg-[#161B22] border-b border-[#30363D] px-3.5 py-2.5 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={LOGO_URL}
              alt={config.salonName}
              className="size-10 sm:size-11 bg-transparent object-contain shrink-0"
            />
            <div className="min-w-0">
              {isDemo && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#06B6D4]">
                    {copy.demoBadge}
                  </span>
                </div>
              )}
              <h1 className="text-sm font-bold text-[#F0F6FC] truncate">
                {config.salonName} · {copy.flowTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <select
              aria-label="Language"
              value={activeLang}
              onChange={(e) => setActiveLang(e.target.value as ClientPreferredLang)}
              className="min-h-[34px] rounded-lg border border-[#30363D] bg-[#0D1117] px-2 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
            >
              {config.availableLanguages.map((l) => (
                <option key={l.lang} value={l.lang}>
                  {l.nativeLabel}
                </option>
              ))}
            </select>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close booking flow"
                className="min-h-[34px] min-w-[34px] rounded-lg border border-[#30363D] bg-[#0D1117] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </header>

        {/* Inside-Flow Success / Reschedule / Cancel Confirmation State */}
        {confirmedResult?.appointment ? (() => {
          const sharePath = confirmedResult.personalReturningShareUrl || personalShareUrl;
          const fullShareUrl =
            sharePath && typeof window !== 'undefined' ? `${window.location.origin}${sharePath}` : sharePath || '';
          const icsHref = buildBookingIcsDataUrl({
            bookingId: confirmedResult.appointment.id,
            salonName: config.salonName,
            service: localizedSelectedServicesText || confirmedResult.appointment.service,
            barberName: confirmedResult.appointment.barberName,
            appointmentDate: confirmedResult.appointment.appointmentDate || selectedDate,
            timeSlot: confirmedResult.appointment.timeSlot,
            durationMins: confirmedResult.appointment.durationMins || totalDurationMins,
            address: confirmedResult.address || config.address,
          });
          const reschedCurrentSlotObj =
            reschedAvailability?.slots.find((s) => s.timeSlot === reschedSlot) || null;
          const reschedFreeBarbers = reschedCurrentSlotObj
            ? reschedCurrentSlotObj.barbers.filter((b) => b.available)
            : [];

          return (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isCanceledInFlow ? (
                <div className="rounded-2xl border border-[#da3633] bg-[#4C1C1D] p-5 text-center space-y-2">
                  <div className="mx-auto size-12 rounded-full bg-[#F87171]/20 border border-[#F87171] grid place-items-center text-[#F87171]">
                    <XCircle className="size-6" />
                  </div>
                  <h2 className="text-lg font-bold text-[#F0F6FC]">{copy.canceledTitle}</h2>
                  <p className="text-xs text-[#FCA5A5] leading-relaxed">{copy.canceledSubtitle}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#116329] bg-[#0D3822] p-5 text-center space-y-2">
                  <div className="mx-auto size-12 rounded-full bg-[#3FB950]/20 border border-[#3FB950] grid place-items-center text-[#3FB950]">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <h2 className="text-lg font-bold text-[#F0F6FC]">{copy.confirmedTitle}</h2>
                  <p className="text-xs text-[#A7F3D0] leading-relaxed">{copy.confirmedSubtitle}</p>
                  {confirmedResult.isDemo && (
                    <p className="text-[11px] font-mono text-[#D29922] pt-1">
                      {copy.demoNoPersistNote}
                    </p>
                  )}
                </div>
              )}

              {confirmationActionBanner && !isCanceledInFlow && (
                <div className="rounded-xl border border-[#06B6D4] bg-[#0D2138] px-3.5 py-2.5 text-xs text-[#7DD3FC] flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#06B6D4] shrink-0" />
                  <span>{confirmationActionBanner}</span>
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 text-xs text-[#FCA5A5] flex items-start gap-2"
                >
                  <AlertCircle className="size-4 shrink-0 mt-0.5 text-[#F87171]" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="rounded-2xl border border-[#30363D] bg-[#1F242D] p-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between border-b border-[#30363D] pb-2">
                  <span className="text-xs font-mono text-[#8B949E]">{copy.bookingIdLabel}</span>
                  <span dir="ltr" className="font-mono font-bold text-[#06B6D4] tabular-nums">
                    {confirmedResult.appointment.id}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#8B949E]">{copy.clientNameRow}</span>
                  <span className="font-semibold text-[#F0F6FC]">
                    {confirmedResult.appointment.clientName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#8B949E]">{copy.phoneRow}</span>
                  <span dir="ltr" className="font-mono text-xs font-semibold text-[#C9D1D9] tabular-nums">
                    {confirmedResult.maskedPhone || confirmedResult.appointment.clientPhone || clientPhone || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#8B949E]">{copy.dateTimeRow}</span>
                  <span dir="ltr" className="font-mono font-semibold text-[#F0F6FC] tabular-nums">
                    {confirmedResult.appointment.appointmentDate} · {confirmedResult.appointment.timeSlot}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#8B949E]">{copy.barberRow}</span>
                  <span className="font-semibold text-[#F0F6FC]">
                    {confirmedResult.appointment.barberName}
                  </span>
                </div>
                <div className="border-t border-[#30363D] pt-2 space-y-1">
                  <span className="text-xs text-[#8B949E] block">{copy.servicesRow}</span>
                  <p className="text-xs font-medium text-[#F0F6FC]">
                    {localizedSelectedServicesText || confirmedResult.appointment.service}
                  </p>
                </div>
                {confirmedResult.appliedDeal && (
                  <div className="rounded-xl bg-[#0D1117] border border-[#30363D] px-3 py-2 text-xs flex items-center justify-between">
                    <span className="text-[#3FB950] font-semibold">
                      {activeDeal?.titleTranslations?.[activeLang] || confirmedResult.appliedDeal.title}
                    </span>
                    <span dir="ltr" className="font-mono text-[#3FB950] tabular-nums">
                      -{config.currencySymbol}
                      {confirmedResult.appliedDeal.savings.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="border-t border-[#30363D] pt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#8B949E]">{copy.totalAmountLabel}</span>
                    <span dir="ltr" className="text-base font-mono font-bold text-[#3FB950] tabular-nums">
                      {config.currencySymbol}
                      {confirmedResult.appointment.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#8B949E]">{copy.totalTimeLabel}</span>
                    <span className="text-xs font-mono font-bold text-[#F0F6FC] tabular-nums">
                      {confirmedResult.appointment.durationMins || totalDurationMins} {copy.minShort}
                    </span>
                  </div>
                </div>
              </div>

              {/* TWO DIRECT CLICKABLE BUTTONS UNDER CONFIRMATION: Reschedule & Cancel Booking */}
              {!isCanceledInFlow && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleOpenReschedulePanel}
                      className="min-h-[46px] rounded-xl border border-[#06B6D4] bg-[#0D2138] hover:bg-[#06B6D4]/20 px-3 text-xs font-bold text-[#06B6D4] flex items-center justify-center gap-1.5 transition"
                    >
                      <RefreshCw className="size-3.5" />
                      <span>{copy.rescheduleBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmCancelOpen((v) => !v);
                        setReschedOpen(false);
                      }}
                      className="min-h-[46px] rounded-xl border border-[#da3633] bg-[#4C1C1D] hover:bg-[#612324] px-3 text-xs font-bold text-[#FCA5A5] flex items-center justify-center gap-1.5 transition"
                    >
                      <XCircle className="size-3.5" />
                      <span>{copy.cancelBookingBtn}</span>
                    </button>
                  </div>

                  {/* Full Live Availability Reschedule Picker (Date + Time Slots + Available Barbers) */}
                  {reschedOpen && (
                    <div className="rounded-2xl border border-[#06B6D4]/60 bg-[#0D1117] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-[#06B6D4]">
                          {copy.selectDate}
                        </span>
                        <input
                          type="date"
                          dir="ltr"
                          min={config.todayDate}
                          value={reschedDate}
                          onChange={(e) => setReschedDate(e.target.value)}
                          className="min-h-[38px] rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 text-xs font-mono text-[#F0F6FC]"
                        />
                      </div>

                      {loadingReschedSlots ? (
                        <p className="text-xs font-mono text-[#8B949E]">{copy.checkingSlots}</p>
                      ) : reschedAvailability && !reschedAvailability.isOpen ? (
                        <p className="text-xs text-[#F87171]">{copy.closedOnDate}</p>
                      ) : !reschedAvailability || reschedAvailability.slots.length === 0 ? (
                        <p className="text-xs text-[#8B949E]">{copy.noSlotsForDate}</p>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-mono text-[#8B949E] block">
                              {copy.selectTime}
                            </span>
                            <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto">
                              {reschedAvailability.slots.map((slot) => {
                                const active = slot.timeSlot === reschedSlot;
                                const noBarbers = slot.availableBarberCount === 0;
                                return (
                                  <button
                                    key={slot.timeSlot}
                                    type="button"
                                    disabled={noBarbers}
                                    onClick={() => {
                                      setReschedSlot(slot.timeSlot);
                                      const availB =
                                        slot.barbers.find((b) => b.name === reschedBarber && b.available) ||
                                        slot.barbers.find((b) => b.available);
                                      setReschedBarber(availB?.name || '');
                                    }}
                                    className={`min-h-[42px] rounded-xl border px-2 py-1 text-[11px] font-mono font-bold tabular-nums transition ${
                                      active
                                        ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F6FC]'
                                        : noBarbers
                                        ? 'border-[#21262D] bg-[#161B22] text-[#484F58] cursor-not-allowed'
                                        : 'border-[#30363D] bg-[#161B22] text-[#F0F6FC] hover:border-[#06B6D4]'
                                    }`}
                                  >
                                    <span dir="ltr" className="block">{slot.timeSlot}</span>
                                    <span className="text-[9px] text-[#06B6D4]">
                                      {slot.availableBarberCount} {copy.freeShort}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[11px] font-mono text-[#8B949E] block">
                              {copy.selectBarber}
                            </span>
                            {reschedFreeBarbers.length === 0 ? (
                              <p className="text-xs text-[#FCA5A5]">{copy.noBarberAtSlot}</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-1.5">
                                {reschedFreeBarbers.map((b) => (
                                  <button
                                    key={b.name}
                                    type="button"
                                    onClick={() => setReschedBarber(b.name)}
                                    className={`min-h-[40px] rounded-xl border px-2.5 text-xs font-semibold transition ${
                                      reschedBarber === b.name
                                        ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F6FC]'
                                        : 'border-[#30363D] bg-[#161B22] text-[#C9D1D9]'
                                    }`}
                                  >
                                    {b.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={submittingResched || !reschedSlot || !reschedBarber}
                            onClick={() => void handleConfirmInlineReschedule()}
                            className="w-full min-h-[44px] rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] disabled:opacity-50 text-[#0D1117] text-xs font-bold uppercase transition"
                          >
                            {submittingResched
                              ? copy.updatingRescheduleBtn
                              : copy.confirmRescheduleBtn}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Inline Cancel Confirmation */}
                  {confirmCancelOpen && (
                    <div className="rounded-2xl border border-[#da3633] bg-[#4C1C1D]/70 p-4 space-y-3">
                      <p className="text-xs text-[#FCA5A5] leading-relaxed">
                        {copy.confirmCancelQuestion}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmCancelOpen(false)}
                          className="min-h-[40px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-xs font-semibold text-[#C9D1D9]"
                        >
                          {copy.keepBookingBtn}
                        </button>
                        <button
                          type="button"
                          disabled={submittingCancel}
                          onClick={() => void handleConfirmInlineCancel()}
                          className="flex-1 min-h-[40px] rounded-xl bg-[#da3633] hover:bg-[#f85149] disabled:opacity-50 text-white text-xs font-bold"
                        >
                          {submittingCancel ? copy.cancelingBtn : copy.yesCancelBtn}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Calendar download and booking management link */}
              {!isCanceledInFlow && (
                <div className="space-y-2">
                  <a
                    href={icsHref}
                    download={`booking-${confirmedResult.appointment.id}.ics`}
                    className="w-full min-h-[42px] rounded-xl border border-[#30363D] bg-[#1F242D] hover:border-[#06B6D4] text-xs font-semibold text-[#06B6D4] flex items-center justify-center gap-2 transition"
                  >
                    <CalendarPlus className="size-4" />
                    <span>{copy.addToCalendarBtn}</span>
                  </a>

                </div>
              )}

              {/* Clean Address + Directions + Copy buttons */}
              <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-[#C9D1D9]">
                  <MapPin className="size-4 text-[#06B6D4] shrink-0 mt-0.5" />
                  <span>{confirmedResult.address || config.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={confirmedResult.googleMapsUrl || config.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-h-[42px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-3 text-xs font-semibold text-[#06B6D4] flex items-center justify-center gap-1.5 transition"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>{copy.openMapsBtn}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyLocation(
                        confirmedResult.address || config.address,
                        confirmedResult.googleMapsUrl || config.googleMapsUrl
                      )
                    }
                    className="min-h-[42px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-3 text-xs font-semibold text-[#F0F6FC] flex items-center gap-1.5 transition shrink-0"
                  >
                    {copiedLocation ? (
                      <Check className="size-3.5 text-[#3FB950]" />
                    ) : (
                      <Copy className="size-3.5 text-[#8B949E]" />
                    )}
                    <span>{copiedLocation ? copy.copiedBtn : copy.copyLocationBtn}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    idempotencyKeyRef.current = makeIdempotencyKey();
                    setConfirmedResult(null);
                    setIsCanceledInFlow(false);
                    setReschedOpen(false);
                    setConfirmCancelOpen(false);
                    setConfirmationActionBanner(null);
                    setServicesCollapsed(false);
                    setDateCollapsed(false);
                    setTimeCollapsed(false);
                    setAvailabilityReloadTick((t) => t + 1);
                  }}
                  className="flex-1 min-h-[48px] rounded-xl border border-[#30363D] bg-[#1F242D] text-xs font-semibold text-[#F0F6FC] hover:border-[#06B6D4] transition"
                >
                  {copy.bookAnotherBtn}
                </button>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-[#0D1117] text-xs font-bold uppercase tracking-wide transition"
                  >
                    {copy.doneBtn}
                  </button>
                )}
              </div>
            </div>
          );
        })() : (
          /* Single Continuous Multi-Field Booking Form + Personalized 4-Option Welcome Hub */
          <form onSubmit={handleConfirmBooking} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Personalized Returning Greeting + 4 Clickable Action Buttons */}
              {effectiveSavedName && (
                <div className="rounded-xl border border-[#30363D] bg-[#1F242D] p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[#F0F6FC]">
                        {copy.returningWelcome},{' '}
                        <span className="text-[#06B6D4]">{effectiveSavedName}</span>!
                      </p>
                      <p className="text-xs text-[#C9D1D9] mt-0.5">{copy.howCanIHelp}</p>
                      <p dir="ltr" className="text-[11px] font-mono text-[#8B949E] mt-1 tabular-nums">
                        {config.returningClient?.maskedPhone || clientPhone}
                        {config.returningClient?.totalVisits
                          ? ` · ${config.returningClient.totalVisits} ${copy.visitsLabel}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  {/* 4 Interactive Web Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'BOOK', label: copy.menuBookBtn, icon: Calendar },
                        { id: 'SERVICES', label: copy.menuServicesBtn, icon: Scissors },
                        { id: 'HOURS', label: copy.menuHoursBtn, icon: MapPin },
                        { id: 'DEALS', label: copy.menuDealsBtn, icon: Tag },
                      ] as const
                    ).map((btn) => {
                      const Icon = btn.icon;
                      const active = activeMenuPanel === btn.id;
                      return (
                        <button
                          key={btn.id}
                          type="button"
                          onClick={() => {
                            setActiveMenuPanel(btn.id);
                            if (btn.id === 'BOOK') {
                              bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 transition ${
                            active
                              ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4]'
                              : 'border-[#30363D] bg-[#0D1117] text-[#F0F6FC] hover:border-[#06B6D4]'
                          }`}
                        >
                          <Icon className="size-3.5 shrink-0" />
                          <span className="truncate">{btn.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Inline Panel for 2. Services & Prices */}
                  {activeMenuPanel === 'SERVICES' && (
                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-2">
                      {config.services.map((svc) => (
                        <div
                          key={svc.id || svc.name}
                          className="flex items-center justify-between text-xs border-b border-[#21262D] last:border-none pb-1.5 last:pb-0"
                        >
                          <span className="text-[#F0F6FC] font-medium">
                            {svc.translations?.[activeLang] || svc.name} · {svc.durationMins || 35}{' '}
                            {copy.minShort}
                          </span>
                          <span dir="ltr" className="font-mono font-bold text-[#06B6D4] tabular-nums">
                            {config.currencySymbol}
                            {svc.price.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline Panel for 3. Opening Hours & Location */}
                  {activeMenuPanel === 'HOURS' && (
                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-2.5 text-xs">
                      <div className="space-y-1 text-[#C9D1D9]">
                        <p className="flex items-center justify-between">
                          <span className="text-[#8B949E]">Mon–Thu:</span>
                          <span dir="ltr" className="font-mono">
                            {config.operatingHours.monThuClosed
                              ? 'Closed'
                              : `${config.operatingHours.monThuOpen} – ${config.operatingHours.monThuClose}`}
                          </span>
                        </p>
                        <p className="flex items-center justify-between">
                          <span className="text-[#8B949E]">Friday:</span>
                          <span dir="ltr" className="font-mono">
                            {config.operatingHours.fridayClosed
                              ? 'Closed'
                              : `${config.operatingHours.fridayOpen} – ${config.operatingHours.fridayClose}`}
                          </span>
                        </p>
                        <p className="flex items-center justify-between">
                          <span className="text-[#8B949E]">Sat–Sun:</span>
                          <span dir="ltr" className="font-mono">
                            {config.operatingHours.satSunClosed
                              ? 'Closed'
                              : `${config.operatingHours.satSunOpen} – ${config.operatingHours.satSunClose}`}
                          </span>
                        </p>
                      </div>
                      <div className="border-t border-[#21262D] pt-2 space-y-2">
                        <p className="text-[#F0F6FC]">{config.address}</p>
                        <a
                          href={config.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full min-h-[36px] rounded-lg border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] text-xs font-semibold text-[#06B6D4] flex items-center justify-center gap-1.5"
                        >
                          <MapPin className="size-3.5" />
                          <span>{copy.openMapsBtn}</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Inline Panel for 4. Current Deals & Offers */}
                  {activeMenuPanel === 'DEALS' && (
                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-2">
                      {config.activeDeals.length === 0 ? (
                        <p className="text-xs text-[#8B949E]">{copy.noActiveDealsText}</p>
                      ) : (
                        config.activeDeals.map((deal) => (
                          <div
                            key={deal.id}
                            className="rounded-xl border border-[#30363D] bg-[#161B22] p-2.5 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-bold text-[#F0F6FC]">
                                {deal.titleTranslations?.[activeLang] || deal.title}
                              </p>
                              <span
                                dir="ltr"
                                className="rounded bg-[#0D3822] border border-[#116329] px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#3FB950] shrink-0"
                              >
                                {deal.discountType === 'PCT'
                                  ? `${deal.discountValue}% OFF`
                                  : deal.discountType === 'FIXED'
                                  ? `${config.currencySymbol}${deal.discountValue} OFF`
                                  : `${config.currencySymbol}${deal.discountValue}`}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDealId(deal.id);
                                if (deal.serviceIds.length > 0) {
                                  setSelectedServiceIds(deal.serviceIds);
                                }
                                setActiveMenuPanel('BOOK');
                                bookingSectionRef.current?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'start',
                                });
                              }}
                              className="w-full min-h-[34px] rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-[#0D1117] text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                            >
                              <Tag className="size-3" />
                              <span>{copy.applyDealBtn}</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {config.returningClient?.lastServiceIds &&
                    config.returningClient.lastServiceIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRebookLastVisit}
                        className="w-full min-h-[38px] rounded-lg border border-[#06B6D4]/50 bg-[#0D1117] hover:bg-[#06B6D4]/15 px-3 text-xs font-bold text-[#06B6D4] flex items-center justify-center gap-1.5 transition"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>{copy.rebookLastBtn}</span>
                      </button>
                    )}
                </div>
              )}

              {/* First-Time QR Onboarding Card — Full Name + Mobile Number */}
              {!isDemo && !config.returningClient && (
                <div className="rounded-xl border border-[#30363D] bg-[#1F242D] p-3.5 space-y-2.5">
                  <div>
                    <p className="text-xs font-bold text-[#F0F6FC]">{copy.firstTimeTitle}</p>
                    <p className="text-[11px] text-[#8B949E] leading-snug mt-0.5">
                      {copy.firstTimeSubtitle}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={clientNameInput}
                      onChange={(e) => setClientNameInput(e.target.value)}
                      placeholder={copy.yourNamePlaceholder}
                      className="min-h-[40px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-xs text-[#F0F6FC] placeholder:text-[#8B949E]/60 focus:outline-none focus:border-[#06B6D4]"
                    />
                    <input
                      type="tel"
                      dir="ltr"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+92 300 1234567"
                      className="min-h-[40px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-xs font-mono text-[#F0F6FC] placeholder:text-[#8B949E]/60 focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingProfile}
                    onClick={() => void handleSaveClientProfile()}
                    className="w-full min-h-[40px] rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] disabled:opacity-50 text-xs font-bold text-[#0D1117] flex items-center justify-center gap-1.5 transition"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>{savingProfile ? copy.savingDetailsBtn : copy.saveDetailsBtn}</span>
                  </button>
                </div>
              )}

              {/* After saving first-time details: Copy Booking Link + Install Salon App */}
              {!isDemo && personalShareUrl && typeof window !== 'undefined' && !confirmedResult && (
                <div className="rounded-xl border border-[#06B6D4]/50 bg-[#0D2138]/70 p-3 space-y-2">
                  <p className="text-[11px] text-[#7DD3FC]">{copy.detailsSavedMsg}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopyPersonalLink(`${window.location.origin}${personalShareUrl}`)
                      }
                      className="min-h-[38px] rounded-lg border border-[#30363D] bg-[#0D1117] px-2.5 text-[11px] font-semibold text-[#F0F6FC] flex items-center gap-1 shrink-0"
                    >
                      {copiedShareLink ? (
                        <Check className="size-3.5 text-[#3FB950]" />
                      ) : (
                        <Copy className="size-3.5 text-[#8B949E]" />
                      )}
                      <span>{copiedShareLink ? copy.copiedBtn : copy.copyLocationBtn}</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleInstallAppClick()}
                    className="w-full min-h-[38px] rounded-lg border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-3 text-xs font-semibold text-[#F0F6FC] flex items-center justify-center gap-1.5 transition"
                  >
                    <Download className="size-3.5 text-[#06B6D4]" />
                    <span>{copy.installAppBtn}</span>
                    {canNativeInstall && (
                      <span className="size-1.5 rounded-full bg-[#3FB950]" />
                    )}
                  </button>
                  {installNotice && (
                    <p className="text-[11px] text-[#C9D1D9] leading-snug">{installNotice}</p>
                  )}
                </div>
              )}

              {/* Applied Deal Banner */}
              {activeDeal && (
                <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono font-bold uppercase text-[#3FB950] flex items-center gap-1">
                      <Tag className="size-3" />
                      <span>{copy.dealAppliedLabel}</span>
                    </span>
                    <p className="text-xs font-bold text-[#F0F6FC]">
                      {activeDeal.titleTranslations?.[activeLang] || activeDeal.title}
                    </p>
                  </div>
                  {savings > 0 && (
                    <span dir="ltr" className="font-mono text-xs font-bold text-[#3FB950] shrink-0 tabular-nums">
                      -{config.currencySymbol}
                      {savings.toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* Inline Conflict / Validation / 402 Quota Alert */}
              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 space-y-2 text-xs text-[#FCA5A5]"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="size-4 shrink-0 mt-0.5 text-[#F87171]" />
                    <span>{errorMsg}</span>
                  </div>
                  {quotaContactPhone && (
                    <a
                      href={`tel:${quotaContactPhone.replace(/\s+/g, '')}`}
                      className="min-h-[36px] w-full rounded-lg bg-[#06B6D4] text-[#0D1117] text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Phone className="size-3.5" />
                      <span>
                        {copy.callSalonLabel}: {quotaContactPhone}
                      </span>
                    </a>
                  )}
                </div>
              )}

              <div ref={bookingSectionRef} className="space-y-4">
                {/* 1. Multi-Service Selection */}
                {servicesCollapsed ? (
                  <div className="rounded-xl border border-[#06B6D4]/50 bg-[#0D2138]/50 px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#06B6D4]">
                        <CheckCircle2 className="size-3.5 shrink-0" />
                        <span>{copy.selectServices}</span>
                      </div>
                      <p className="text-xs font-semibold text-[#F0F6FC] truncate mt-0.5">
                        {localizedSelectedServicesText}
                      </p>
                      <p className="text-[11px] font-mono text-[#8B949E] mt-0.5">
                        <span dir="ltr" className="text-[#06B6D4] font-bold">
                          {config.currencySymbol}
                          {finalTotal.toLocaleString()}
                        </span>{' '}
                        · {totalDurationMins} {copy.minShort}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setServicesCollapsed(false)}
                      className="min-h-[34px] rounded-lg border border-[#30363D] bg-[#1F242D] hover:border-[#06B6D4] px-2.5 text-[11px] font-semibold text-[#06B6D4] flex items-center gap-1 shrink-0"
                    >
                      <Edit2 className="size-3" />
                      <span>{copy.changeBtn}</span>
                    </button>
                  </div>
                ) : (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-[#8B949E] flex items-center gap-1.5">
                        <Scissors className="size-3.5 text-[#06B6D4]" />
                        <span>{copy.selectServices}</span>
                      </h2>
                      <span className="text-xs font-mono text-[#06B6D4] tabular-nums">
                        {selectedServices.length} · {totalDurationMins} {copy.minShort}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {config.services.map((svc) => {
                        const svcKey = svc.id || svc.name;
                        const checked = selectedServiceIds.includes(svcKey);
                        const displayName = svc.translations?.[activeLang] || svc.name;
                        return (
                          <button
                            key={svcKey}
                            type="button"
                            onClick={() => toggleService(svcKey)}
                            className={`w-full min-h-[52px] rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-3 transition ${
                              checked
                                ? 'border-[#06B6D4] bg-[#06B6D4]/10'
                                : 'border-[#30363D] bg-[#1F242D] hover:border-[#484F58]'
                            } ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`size-5 rounded-md border grid place-items-center shrink-0 ${
                                  checked
                                    ? 'border-[#06B6D4] bg-[#06B6D4] text-[#0D1117]'
                                    : 'border-[#8B949E]/50 bg-[#0D1117]'
                                }`}
                              >
                                {checked && <Check className="size-3.5 stroke-[3]" />}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#F0F6FC] truncate">
                                  {displayName}
                                </p>
                                <p className="text-[11px] font-mono text-[#8B949E] tabular-nums">
                                  {svc.durationMins || 35} {copy.minShort}
                                </p>
                              </div>
                            </div>
                            <span dir="ltr" className="font-mono text-sm font-bold text-[#06B6D4] shrink-0 tabular-nums">
                              {config.currencySymbol}
                              {svc.price.toLocaleString()}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8B949E]">{copy.totalAmountLabel}</span>
                        <span dir="ltr" className="font-mono font-bold text-sm text-[#06B6D4] tabular-nums">
                          {config.currencySymbol}
                          {finalTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8B949E]">{copy.totalTimeLabel}</span>
                        <span className="font-mono font-semibold text-[#F0F6FC] tabular-nums">
                          {totalDurationMins} {copy.minShort}
                        </span>
                      </div>
                    </div>
                  </section>
                )}

                {/* 2. Date Selection */}
                {dateCollapsed && selectedDate ? (
                  <div className="rounded-xl border border-[#06B6D4]/50 bg-[#0D2138]/50 px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#06B6D4]">
                        <CheckCircle2 className="size-3.5 shrink-0" />
                        <span>{copy.selectDate}</span>
                      </div>
                      <p className="text-xs font-semibold text-[#F0F6FC] mt-0.5">
                        {selectedDateMeta ? `${selectedDateMeta.top} · ${selectedDateMeta.sub}` : selectedDate}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDateCollapsed(false)}
                      className="min-h-[34px] rounded-lg border border-[#30363D] bg-[#1F242D] hover:border-[#06B6D4] px-2.5 text-[11px] font-semibold text-[#06B6D4] flex items-center gap-1 shrink-0"
                    >
                      <Edit2 className="size-3" />
                      <span>{copy.changeBtn}</span>
                    </button>
                  </div>
                ) : (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-[#8B949E] flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-[#06B6D4]" />
                        <span>{copy.selectDate}</span>
                      </h2>
                      <input
                        type="date"
                        dir="ltr"
                        min={config.todayDate}
                        value={selectedDate}
                        onChange={(e) => {
                          setErrorMsg(null);
                          setSelectedDate(e.target.value);
                          setServicesCollapsed(true);
                          setTimeCollapsed(false);
                        }}
                        className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#1F242D] px-2.5 text-xs font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                      />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {upcomingDates.map((d) => {
                        const active = d.date === selectedDate;
                        return (
                          <button
                            key={d.date}
                            type="button"
                            onClick={() => {
                              setErrorMsg(null);
                              setSelectedDate(d.date);
                              setServicesCollapsed(true);
                              setTimeCollapsed(false);
                            }}
                            className={`shrink-0 min-w-[78px] min-h-[54px] rounded-xl border px-2.5 py-1.5 flex flex-col items-center justify-center transition ${
                              active
                                ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F6FC]'
                                : 'border-[#30363D] bg-[#1F242D] text-[#8B949E] hover:text-[#F0F6FC]'
                            }`}
                          >
                            <span className="text-[11px] font-semibold">{d.top}</span>
                            <span className="text-xs font-mono font-bold tabular-nums">{d.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                    {availability?.fridayBreakText && (
                      <p className="text-[11px] font-mono text-[#D29922]">
                        {availability.fridayBreakText}
                      </p>
                    )}
                  </section>
                )}

                {/* 3. Arrival Time Slots */}
                {timeCollapsed && selectedTimeSlot && availableBarbersAtSlot.length > 0 ? (
                  <div className="rounded-xl border border-[#06B6D4]/50 bg-[#0D2138]/50 px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#06B6D4]">
                        <CheckCircle2 className="size-3.5 shrink-0" />
                        <span>{copy.selectTime}</span>
                      </div>
                      <p dir="ltr" className="text-xs font-mono font-bold text-[#F0F6FC] mt-0.5 tabular-nums">
                        {selectedTimeSlot}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTimeCollapsed(false)}
                      className="min-h-[34px] rounded-lg border border-[#30363D] bg-[#1F242D] hover:border-[#06B6D4] px-2.5 text-[11px] font-semibold text-[#06B6D4] flex items-center gap-1 shrink-0"
                    >
                      <Edit2 className="size-3" />
                      <span>{copy.changeBtn}</span>
                    </button>
                  </div>
                ) : (
                  <section className="space-y-2">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-[#8B949E] flex items-center gap-1.5">
                      <Clock className="size-3.5 text-[#06B6D4]" />
                      <span>{copy.selectTime}</span>
                    </h2>
                    {loadingSlots ? (
                      <div className="rounded-xl border border-[#30363D] bg-[#1F242D] p-4 text-center text-xs font-mono text-[#8B949E]">
                        {copy.checkingSlots}
                      </div>
                    ) : availability && !availability.isOpen ? (
                      <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3.5 text-xs text-[#FCA5A5]">
                        {copy.closedOnDate}
                      </div>
                    ) : !availability || availability.slots.length === 0 ? (
                      <div className="rounded-xl border border-[#30363D] bg-[#1F242D] p-3.5 text-xs text-[#8B949E]">
                        {copy.noSlotsForDate}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {availability.slots.map((slot) => {
                          const active = slot.timeSlot === selectedTimeSlot;
                          const noBarbers = slot.availableBarberCount === 0;
                          return (
                            <button
                              key={slot.timeSlot}
                              type="button"
                              onClick={() => handleSelectSlot(slot.timeSlot)}
                              className={`min-h-[48px] rounded-xl border px-2 py-1.5 flex flex-col items-center justify-center transition tabular-nums ${
                                active
                                  ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F6FC]'
                                  : noBarbers
                                  ? 'border-[#30363D] bg-[#0D1117] text-[#8B949E] opacity-70'
                                  : 'border-[#30363D] bg-[#1F242D] text-[#F0F6FC] hover:border-[#484F58]'
                              }`}
                            >
                              <span dir="ltr" className="text-xs font-mono font-bold">
                                {slot.timeSlot}
                              </span>
                              <span
                                className={`text-[10px] font-mono ${
                                  slot.availableBarberCount > 0 ? 'text-[#3FB950]' : 'text-[#F87171]'
                                }`}
                              >
                                {slot.availableBarberCount} {copy.freeShort}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {/* 4. Available Barber Selection */}
                {currentSlotObj && (
                  <section className="space-y-2">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-[#8B949E] flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-[#06B6D4]" />
                      <span>{copy.selectBarber}</span>
                    </h2>
                    {availableBarbersAtSlot.length === 0 ? (
                      <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 text-xs text-[#FCA5A5]">
                        {copy.noBarberAtSlot}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {availableBarbersAtSlot.map((barber) => {
                          const active = barber.name === selectedBarber;
                          return (
                            <button
                              key={barber.name}
                              type="button"
                              onClick={() => {
                                setErrorMsg(null);
                                setSelectedBarber(barber.name);
                              }}
                              className={`min-h-[50px] rounded-xl border px-3 py-2 flex items-center justify-between gap-2 transition ${
                                active
                                  ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F6FC]'
                                  : 'border-[#30363D] bg-[#1F242D] text-[#F0F6FC] hover:border-[#484F58]'
                              }`}
                            >
                              <span className="text-xs font-semibold truncate">{barber.name}</span>
                              <span className="text-[10px] font-mono font-bold text-[#3FB950] shrink-0">
                                {copy.availableLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {isDemoBusyBarberHiddenHere && demoBusyBarber && (
                      <p className="text-[11px] font-mono text-[#D29922]">
                        {copy.demoHiddenBarberNote(demoBusyBarber, selectedTimeSlot)}
                      </p>
                    )}
                  </section>
                )}

                {/* 5. Customer Name / Phone — Uses saved returning profile when available */}
                {(!effectiveSavedName || (standalone && !config.returningClient)) && (
                  <section className="space-y-2">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-[#8B949E] flex items-center gap-1.5">
                      <User className="size-3.5 text-[#06B6D4]" />
                      <span>{copy.yourDetails}</span>
                    </h2>
                    <div className="rounded-xl border border-[#30363D] bg-[#1F242D] p-3.5 space-y-3">
                      {!effectiveSavedName && (
                        <label className="block space-y-1">
                          <span className="text-[11px] font-mono text-[#8B949E]">
                            {copy.yourNamePlaceholder} *
                          </span>
                          <input
                            type="text"
                            required
                            value={clientNameInput}
                            onChange={(e) => setClientNameInput(e.target.value)}
                            placeholder={copy.yourNamePlaceholder}
                            className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm text-[#F0F6FC] placeholder:text-[#8B949E]/60 focus:outline-none focus:border-[#06B6D4]"
                          />
                        </label>
                      )}

                      {standalone && !config.returningClient && (
                        <label className="block space-y-1">
                          <span className="text-[11px] font-mono text-[#8B949E]">
                            {copy.yourPhoneLabel} *
                          </span>
                          <input
                            type="tel"
                            dir="ltr"
                            required
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            placeholder="+92 300 1234567"
                            className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                          />
                        </label>
                      )}
                    </div>
                  </section>
                )}

                {/* Final Summary Card */}
                <section className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-[#F0F6FC] border-b border-[#30363D] pb-1.5">
                    <span>{copy.summaryTitle}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#8B949E]">{copy.clientNameRow}</span>
                    <span className="font-semibold text-[#F0F6FC]">
                      {effectiveSavedName || clientNameInput.trim() || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#8B949E]">{copy.phoneRow}</span>
                    <span dir="ltr" className="font-mono text-[#C9D1D9] tabular-nums">
                      {config.returningClient?.maskedPhone || clientPhone || '—'}
                    </span>
                  </div>
                  <p className="text-[#C9D1D9] leading-snug pt-1 border-t border-[#30363D]">
                    {localizedSelectedServicesText}
                  </p>
                  <div className="flex items-center justify-between text-[#8B949E] font-mono pt-1 border-t border-[#30363D]">
                    <span dir="ltr">
                      {selectedDate || '—'} · {selectedTimeSlot || '—'}
                    </span>
                    <span>{selectedBarber || '—'}</span>
                  </div>
                  <div className="border-t border-[#30363D] pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#8B949E]">{copy.totalAmountLabel}</span>
                      <div dir="ltr" className="flex items-baseline gap-2 font-mono tabular-nums">
                        {savings > 0 && (
                          <span className="text-[11px] text-[#8B949E] line-through">
                            {config.currencySymbol}
                            {originalTotal.toLocaleString()}
                          </span>
                        )}
                        <span className="text-base font-bold text-[#3FB950]">
                          {config.currencySymbol}
                          {finalTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8B949E]">{copy.totalTimeLabel}</span>
                      <span className="font-mono font-bold text-[#F0F6FC] tabular-nums">
                        {totalDurationMins} {copy.minShort}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Compact Sticky Bottom CTA */}
            <footer className="sticky bottom-0 z-10 border-t border-[#30363D] bg-[#161B22] px-4 py-3">
              <button
                type="submit"
                disabled={submitting || !selectedTimeSlot || !selectedBarber}
                className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] disabled:opacity-45 text-[#0D1117] text-sm font-bold flex items-center justify-center gap-2 transition active:scale-[0.99]"
              >
                <CheckCircle2 className="size-4" />
                <span>
                  {submitting
                    ? copy.confirmingBtn
                    : `${copy.confirmBtn} · ${config.currencySymbol}${finalTotal.toLocaleString()}`}
                </span>
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
};
