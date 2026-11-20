import { CustomerLanguage, DayOfWeekKey } from '../types/customerExperience';

export interface CustomerLocaleCopy {
  langName: string;
  dir: 'ltr' | 'rtl';
  welcomeMessage: (salonName: string) => string;
  chooseLanguageLabel: string;
  options: {
    book: string;
    services: string;
    hoursLocation: string;
    deals: string;
  };
  inputPlaceholder: string;
  sendHiQuick: string;
  servicesHeading: string;
  durationUnit: string;
  bookNowCta: string;
  hoursLocationHeading: string;
  addressLabel: string;
  openMapsLabel: string;
  closedLabel: string;
  breakLabel: string;
  dayNames: Record<DayOfWeekKey, string>;
  dealsHeading: string;
  noActiveDeals: string;
  expiresLabel: string;
  watchVideoCta: string;
  bookThisDealCta: string;
  dealExpiredTitle: string;
  dealVideoDeletedNote: (days: number) => string;
  flow: {
    title: string;
    subtitle: string;
    selectServices: string;
    selectDate: string;
    selectTime: string;
    noSlotsForDate: string;
    selectBarber: string;
    anyBarber: string;
    unavailableLabel: string;
    customerDetails: string;
    savedCustomerNote: (name: string) => string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    summaryTitle: string;
    totalDurationLabel: string;
    discountLabel: string;
    totalPayAtSalonLabel: string;
    noOnlinePaymentNote: string;
    confirmCta: string;
    validatingCta: string;
    doubleBookError: string;
    selectServiceError: string;
    selectTimeError: string;
    selectBarberError: string;
    enterNameError: string;
    successTitle: string;
    successSubtitle: string;
    noSeparateMessageNote: string;
    bookingRefLabel: string;
    doneCta: string;
    backToChat: string;
  };
}

export const CUSTOMER_COPY: Record<CustomerLanguage, CustomerLocaleCopy> = {
  en: {
    langName: 'English',
    dir: 'ltr',
    welcomeMessage: (salonName) =>
      `Welcome to ${salonName}. How can we help you today? Choose your language or pick an option below:`,
    chooseLanguageLabel: 'Language',
    options: {
      book: 'Book Appointment',
      services: 'Services & Prices',
      hoursLocation: 'Opening Hours & Location',
      deals: 'Current Deals & Offers',
    },
    inputPlaceholder: 'Type "Hi" to start...',
    sendHiQuick: 'Send "Hi"',
    servicesHeading: 'Services, Prices & Durations',
    durationUnit: 'min',
    bookNowCta: 'Book Appointment',
    hoursLocationHeading: 'Opening Hours & Salon Location',
    addressLabel: 'Address',
    openMapsLabel: 'Open in Google Maps',
    closedLabel: 'Closed',
    breakLabel: 'Break',
    dayNames: {
      MON: 'Monday',
      TUE: 'Tuesday',
      WED: 'Wednesday',
      THU: 'Thursday',
      FRI: 'Friday',
      SAT: 'Saturday',
      SUN: 'Sunday',
    },
    dealsHeading: 'Current Active Deals & Offers',
    noActiveDeals: 'No promotional deals are active right now. Check our regular Services & Prices to book.',
    expiresLabel: 'Expires',
    watchVideoCta: 'Watch Promo Video',
    bookThisDealCta: 'Book This Deal',
    dealExpiredTitle: 'This promotional deal has expired',
    dealVideoDeletedNote: (days) =>
      `Promotional video was automatically deleted after the ${days}-day post-expiry retention period.`,
    flow: {
      title: 'Book Appointment',
      subtitle: 'Complete all details below in one step — no separate messages.',
      selectServices: '1. Select Services',
      selectDate: '2. Select Date',
      selectTime: '3. Available Time Slots',
      noSlotsForDate: 'No open slots remain for this date. Please try another day.',
      selectBarber: '4. Choose Barber / Stylist',
      anyBarber: 'First Available Barber',
      unavailableLabel: 'Unavailable',
      customerDetails: '5. Your Details',
      savedCustomerNote: (name) => `Booking under saved profile: ${name}`,
      nameLabel: 'Your Name',
      namePlaceholder: 'Enter your full name',
      phoneLabel: 'WhatsApp Number',
      summaryTitle: '6. Booking Summary',
      totalDurationLabel: 'Estimated Duration',
      discountLabel: 'Active Deal Savings',
      totalPayAtSalonLabel: 'Total (Pay at Salon)',
      noOnlinePaymentNote: 'No online payment required — pay at the salon after your service.',
      confirmCta: 'Confirm Appointment',
      validatingCta: 'Checking Availability...',
      doubleBookError:
        'That barber or time slot was just booked. Please select another available slot or barber.',
      selectServiceError: 'Please select at least one service.',
      selectTimeError: 'Please choose an available time slot.',
      selectBarberError: 'Please choose an available barber.',
      enterNameError: 'Please enter your name so we can reserve your chair.',
      successTitle: 'Appointment Confirmed',
      successSubtitle: 'Your booking has been saved directly inside this WhatsApp Flow.',
      noSeparateMessageNote: 'Confirmed here — no separate confirmation message sent.',
      bookingRefLabel: 'Booking Reference',
      doneCta: 'Done',
      backToChat: 'Back to Welcome Menu',
    },
  },
  ur: {
    langName: 'اردو',
    dir: 'rtl',
    welcomeMessage: (salonName) =>
      `${salonName} میں خوش آمدید۔ آج ہم آپ کی کیا مدد کر سکتے ہیں؟ نیچے زبان یا آپشن منتخب کریں:`,
    chooseLanguageLabel: 'زبان',
    options: {
      book: 'اپوائنٹمنٹ بک کریں',
      services: 'سروسز اور ریٹس',
      hoursLocation: 'اوقات اور لوکیشن',
      deals: 'موجودہ ڈیلز اور آفرز',
    },
    inputPlaceholder: 'شروع کرنے کے لیے "Hi" لکھیں...',
    sendHiQuick: '"Hi" بھیجیں',
    servicesHeading: 'سروسز، قیمتیں اور دورانیہ',
    durationUnit: 'منٹ',
    bookNowCta: 'اپوائنٹمنٹ بک کریں',
    hoursLocationHeading: 'سیلون کے اوقات اور لوکیشن',
    addressLabel: 'پتہ',
    openMapsLabel: 'گوگل میپس پر کھولیں',
    closedLabel: 'بند',
    breakLabel: 'وقفہ',
    dayNames: {
      MON: 'پیر',
      TUE: 'منگل',
      WED: 'بدھ',
      THU: 'جمعرات',
      FRI: 'جمعہ',
      SAT: 'ہفتہ',
      SUN: 'اتوار',
    },
    dealsHeading: 'موجودہ فعال ڈیلز اور آفرز',
    noActiveDeals: 'اس وقت کوئی پروموشنل ڈیل فعال نہیں ہے۔ باقاعدہ سروسز دیکھیں۔',
    expiresLabel: 'آخری تاریخ',
    watchVideoCta: 'پرومو ویڈیو دیکھیں',
    bookThisDealCta: 'یہ ڈیل بک کریں',
    dealExpiredTitle: 'یہ پروموشنل ڈیل ختم ہو چکی ہے',
    dealVideoDeletedNote: (days) =>
      `معیاد ختم ہونے کے ${days} دن بعد پروموشنل ویڈیو خودکار طور پر حذف کر دی گئی ہے۔`,
    flow: {
      title: 'اپوائنٹمنٹ بکنگ',
      subtitle: 'تمام معلومات اسی ایک فلو میں مکمل کریں — الگ الگ میسج کی ضرورت نہیں۔',
      selectServices: '1. سروسز منتخب کریں',
      selectDate: '2. تاریخ منتخب کریں',
      selectTime: '3. دستیاب اوقات',
      noSlotsForDate: 'اس تاریخ کے تمام اوقات بک ہو چکے ہیں۔ براہ کرم کوئی اور دن منتخب کریں۔',
      selectBarber: '4. دستیاب باربر / اسٹائلسٹ منتخب کریں',
      anyBarber: 'پہلا دستیاب باربر',
      unavailableLabel: 'دستیاب نہیں',
      customerDetails: '5. آپ کی تفصیلات',
      savedCustomerNote: (name) => `محفوظ پروفائل کے تحت بکنگ: ${name}`,
      nameLabel: 'آپ کا نام',
      namePlaceholder: 'اپنا مکمل نام درج کریں',
      phoneLabel: 'واٹس ایپ نمبر',
      summaryTitle: '6. بکنگ کا خلاصہ',
      totalDurationLabel: 'کل وقت',
      discountLabel: 'ڈیل کی بچت',
      totalPayAtSalonLabel: 'کل رقم (سیلون پر ادائیگی)',
      noOnlinePaymentNote: 'کوئی آن لائن ادائیگی نہیں — سروس کے بعد سیلون پر ادائیگی کریں۔',
      confirmCta: 'اپوائنٹمنٹ کنفرم کریں',
      validatingCta: 'دستیابی چیک ہو رہی ہے...',
      doubleBookError:
        'یہ باربر یا وقت ابھی بک ہو چکا ہے۔ براہ کرم دوسرا دستیاب وقت یا باربر منتخب کریں۔',
      selectServiceError: 'کم از کم ایک سروس منتخب کریں۔',
      selectTimeError: 'دستیاب ٹائم سلاٹ منتخب کریں۔',
      selectBarberError: 'دستیاب باربر منتخب کریں۔',
      enterNameError: 'اپوائنٹمنٹ محفوظ کرنے کے لیے اپنا نام درج کریں۔',
      successTitle: 'اپوائنٹمنٹ کنفرم ہو گئی',
      successSubtitle: 'آپ کی بکنگ اسی واٹس ایپ فلو میں محفوظ ہو چکی ہے۔',
      noSeparateMessageNote: 'تصدیق یہیں مکمل ہو گئی — الگ واٹس ایپ پیغام نہیں بھیجا گیا۔',
      bookingRefLabel: 'بکنگ نمبر',
      doneCta: 'مکمل',
      backToChat: 'مین مینو پر واپس جائیں',
    },
  },
  roman_ur: {
    langName: 'Roman Urdu',
    dir: 'ltr',
    welcomeMessage: (salonName) =>
      `${salonName} mein khush aamdeed! Aaj hum aap ki kya madad kar sakte hain? Apni zaban ya option chunein:`,
    chooseLanguageLabel: 'Zaban',
    options: {
      book: 'Appointment Book Karein',
      services: 'Services aur Rates',
      hoursLocation: 'Auqat aur Location',
      deals: 'Mojooda Deals aur Offers',
    },
    inputPlaceholder: 'Shuru karne ke liye "Hi" likhein...',
    sendHiQuick: '"Hi" Bhejein',
    servicesHeading: 'Services, Rates aur Waqt',
    durationUnit: 'min',
    bookNowCta: 'Appointment Book Karein',
    hoursLocationHeading: 'Khulne ke Auqat aur Location',
    addressLabel: 'Pata',
    openMapsLabel: 'Google Maps par kholein',
    closedLabel: 'Band',
    breakLabel: 'Break',
    dayNames: {
      MON: 'Peer (Mon)',
      TUE: 'Mangal (Tue)',
      WED: 'Budh (Wed)',
      THU: 'Jumeraat (Thu)',
      FRI: 'Juma (Fri)',
      SAT: 'Hafta (Sat)',
      SUN: 'Itwar (Sun)',
    },
    dealsHeading: 'Mojooda Active Deals aur Offers',
    noActiveDeals: 'Is waqt koi deal active nahi hai. Regular Services & Rates check karein.',
    expiresLabel: 'Aakhri Tareekh',
    watchVideoCta: 'Promo Video Dekhein',
    bookThisDealCta: 'Yeh Deal Book Karein',
    dealExpiredTitle: 'Yeh promotional deal khatam ho chuki hai',
    dealVideoDeletedNote: (days) =>
      `Expiry ke ${days} din baad promotional video khud-ba-khud delete kar di gayi hai.`,
    flow: {
      title: 'Appointment Booking',
      subtitle: 'Saari tafseel isi ek form mein bharein — alag alag message ki zaroorat nahi.',
      selectServices: '1. Services Chunein',
      selectDate: '2. Tareekh Chunein',
      selectTime: '3. Khali Time Slots',
      noSlotsForDate: 'Is tareekh ke saare slots book hain. Koi aur din chunein.',
      selectBarber: '4. Available Barber Chunein',
      anyBarber: 'Koi Bhi Available Barber',
      unavailableLabel: 'Available Nahi',
      customerDetails: '5. Aap ki Tafseel',
      savedCustomerNote: (name) => `Saved profile se booking: ${name}`,
      nameLabel: 'Aap ka Naam',
      namePlaceholder: 'Apna naam likhein',
      phoneLabel: 'WhatsApp Number',
      summaryTitle: '6. Booking Summary',
      totalDurationLabel: 'Kul Waqt',
      discountLabel: 'Deal Bachat',
      totalPayAtSalonLabel: 'Kul Bill (Salon par Adaigi)',
      noOnlinePaymentNote: 'Koi online payment nahi — service ke baad salon par adaigi karein.',
      confirmCta: 'Appointment Confirm Karein',
      validatingCta: 'Availability check ho rahi hai...',
      doubleBookError:
        'Yeh barber ya time slot abhi book ho gaya hai. Meherbani kar ke doosra slot ya barber chunein.',
      selectServiceError: 'Kam az kam ek service chunein.',
      selectTimeError: 'Available time slot chunein.',
      selectBarberError: 'Available barber chunein.',
      enterNameError: 'Appointment save karne ke liye apna naam likhein.',
      successTitle: 'Appointment Confirm Ho Gayi',
      successSubtitle: 'Aap ki booking isi WhatsApp Flow mein save ho chuki hai.',
      noSeparateMessageNote: 'Tasdeeq yahin mukammal ho gayi — alag WhatsApp message nahi bheja gaya.',
      bookingRefLabel: 'Booking Reference',
      doneCta: 'Done',
      backToChat: 'Welcome Menu par wapas',
    },
  },
  ar: {
    langName: 'العربية',
    dir: 'rtl',
    welcomeMessage: (salonName) =>
      `مرحباً بكم في ${salonName}. كيف يمكننا مساعدتكم اليوم؟ اختر اللغة أو الخدمة المطلوبة أدناه:`,
    chooseLanguageLabel: 'اللغة',
    options: {
      book: 'حجز موعد',
      services: 'الخدمات والأسعار',
      hoursLocation: 'ساعات العمل والموقع',
      deals: 'العروض والخصومات الحالية',
    },
    inputPlaceholder: 'اكتب "Hi" للبدء...',
    sendHiQuick: 'إرسال "Hi"',
    servicesHeading: 'الخدمات والأسعار والمدة',
    durationUnit: 'دقيقة',
    bookNowCta: 'حجز موعد',
    hoursLocationHeading: 'ساعات العمل وموقع الصالون',
    addressLabel: 'العنوان',
    openMapsLabel: 'فتح في خرائط جوجل',
    closedLabel: 'مغلق',
    breakLabel: 'استراحة',
    dayNames: {
      MON: 'الإثنين',
      TUE: 'الثلاثاء',
      WED: 'الأربعاء',
      THU: 'الخميس',
      FRI: 'الجمعة',
      SAT: 'السبت',
      SUN: 'الأحد',
    },
    dealsHeading: 'العروض النشطة حالياً',
    noActiveDeals: 'لا توجد عروض ترويجية نشطة حالياً. يمكنك تصفح الخدمات والأسعار.',
    expiresLabel: 'ينتهي في',
    watchVideoCta: 'مشاهدة فيديو العرض',
    bookThisDealCta: 'احجز هذا العرض',
    dealExpiredTitle: 'انتهت صلاحية هذا العرض الترويجي',
    dealVideoDeletedNote: (days) =>
      `تم حذف الفيديو الترويجي تلقائياً بعد مرور ${days} يوماً على انتهاء العرض.`,
    flow: {
      title: 'حجز موعد',
      subtitle: 'أكمل جميع تفاصيل الحجز في هذه الشاشة الواحدة دون رسائل منفصلة.',
      selectServices: '1. اختر الخدمات',
      selectDate: '2. اختر التاريخ',
      selectTime: '3. الأوقات المتاحة',
      noSlotsForDate: 'لا توجد مواعيد متاحة في هذا اليوم. يرجى اختيار تاريخ آخر.',
      selectBarber: '4. اختر الحلاق المتاح',
      anyBarber: 'أول حلاق متاح',
      unavailableLabel: 'غير متاح',
      customerDetails: '5. بيانات العميل',
      savedCustomerNote: (name) => `الحجز باسم الملف المحفوظ: ${name}`,
      nameLabel: 'الاسم الكامل',
      namePlaceholder: 'أدخل اسمك الكامل',
      phoneLabel: 'رقم الواتساب',
      summaryTitle: '6. ملخص الحجز',
      totalDurationLabel: 'المدة المقدرة',
      discountLabel: 'خصم العرض',
      totalPayAtSalonLabel: 'الإجمالي (الدفع في الصالون)',
      noOnlinePaymentNote: 'لا يوجد دفع إلكتروني — يتم الدفع في الصالون بعد الخدمة.',
      confirmCta: 'تأكيد الموعد',
      validatingCta: 'جاري التحقق من التوفر...',
      doubleBookError:
        'تم حجز هذا الحلاق أو الموعد للتو. يرجى اختيار وقت أو حلاق آخر متاح.',
      selectServiceError: 'يرجى اختيار خدمة واحدة على الأقل.',
      selectTimeError: 'يرجى اختيار وقت متاح.',
      selectBarberError: 'يرجى اختيار حلاق متاح.',
      enterNameError: 'يرجى إدخال اسمك لإتمام الحجز.',
      successTitle: 'تم تأكيد الموعد',
      successSubtitle: 'تم حفظ حجزك مباشرة داخل نموذج الواتساب.',
      noSeparateMessageNote: 'تم التأكيد هنا — لم يتم إرسال رسالة واتساب منفصلة.',
      bookingRefLabel: 'رقم الحجز',
      doneCta: 'تم',
      backToChat: 'العودة للقائمة الرئيسية',
    },
  },
};
