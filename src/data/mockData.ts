import { Contact, FlowNode, MaintenanceInvoice, SalonProfile } from '../types';

export const INITIAL_SALONS: SalonProfile[] = [
  {
    id: 'salon-pk-dha',
    name: 'Royal Cut Gentlemen & Grooming',
    branch: 'DHA Phase 5, Lahore',
    city: 'Lahore',
    country: 'Pakistan',
    currency: 'PKR',
    phone: '+92 300 8472910',
    ownerName: 'Malik Tariq',
    ownerPhone: '+92 321 4455667',
    packageTier: 'growth',
    setupFeePaid: true,
    monthlyFee: 2000,
    paymentStatus: 'paid',
    dueDate: '2026-10-30',
    lastPaymentDate: '2026-09-29',
    daysOverdue: 0,
    gracePeriodDaysLeft: 3,
    isLockedOut: false,
  },
  {
    id: 'salon-ae-marina',
    name: 'Sultan Elite Hair Lounge',
    branch: 'Dubai Marina Walk',
    city: 'Dubai',
    country: 'UAE',
    currency: 'AED',
    phone: '+971 50 8923411',
    ownerName: 'Zayed Al-Hashmi',
    ownerPhone: '+971 55 1239876',
    packageTier: 'enterprise',
    setupFeePaid: true,
    monthlyFee: 100,
    paymentStatus: 'paid',
    dueDate: '2026-10-30',
    lastPaymentDate: '2026-09-30',
    daysOverdue: 0,
    gracePeriodDaysLeft: 3,
    isLockedOut: false,
  },
];

// Helper to generate 214 realistic contacts for Day-1 ingestion
export const generate214Contacts = (): Contact[] => {
  const pkNames = [
    'Hamza Tariq', 'Bilal Ahmed', 'Usman Malik', 'Daniyal Khan', 'Zaid Farooq',
    'Kamran Qureshi', 'Ali Raza', 'Shahzaib Bhatti', 'Fahad Mehmood', 'Waqas Chaudhry',
    'Saad Irfan', 'Talha Yousaf', 'Hassan Siddiqui', 'Nabeel Aslam', 'Suleman Dar',
    'Junaid Akhtar', 'Asadullah Gondal', 'Taimoor Shah', 'Umair Bashir', 'Rehan Butt',
    'Mohammad Zubair', 'Khurram Shehzad', 'Adnan Ghani', 'Adeel Bajwa', 'Babar Azam'
  ];

  const aeNames = [
    'Tariq Al-Mansoor', 'Rashid Al-Falasi', 'Zayed Bin Rashid', 'Omar Al-Ameri',
    'Khalid Al-Qasimi', 'Sultan Al-Nuaimi', 'Yousuf Al-Balooshi', 'Salem Al-Mazrouei',
    'Hamad Al-Kaabi', 'Ahmed Al-Shehhi', 'Faris Al-Zaabi', 'Majid Al-Suwaidi'
  ];

  const list: Contact[] = [];
  const baseCount = 214;

  for (let i = 1; i <= baseCount; i++) {
    const isUAE = i > 170; // 44 UAE contacts, 170 Pakistan contacts
    const country = isUAE ? 'AE' : 'PK';
    const city = isUAE 
      ? (i % 2 === 0 ? 'Dubai' : 'Abu Dhabi')
      : (i % 3 === 0 ? 'Lahore' : i % 3 === 1 ? 'Karachi' : 'Islamabad');
    
    const namePool = isUAE ? aeNames : pkNames;
    const rawName = namePool[(i - 1) % namePool.length];
    const name = `${rawName} ${i > namePool.length ? `#${Math.floor(i / namePool.length) + 1}` : ''}`.trim();
    
    const phone = isUAE
      ? `+971 5${(i % 8) + 1} ${String(100000 + i * 37).slice(0, 3)} ${String(1000 + i * 19).slice(0, 4)}`
      : `+92 3${(i % 5) + 0}${String(10000000 + i * 29481).slice(0, 8)}`;

    const language: 'en' | 'ur' | 'ar' = isUAE 
      ? (i % 3 === 0 ? 'ar' : 'en')
      : (i % 4 === 0 ? 'en' : 'ur');

    // 8 out of 214 opted out to test opt-out suppression flag
    const optOut = i === 12 || i === 47 || i === 89 || i === 134 || i === 178 || i === 195 || i === 203 || i === 211;

    const tags = ['Day-1 Import'];
    if (i % 5 === 0) tags.push('VIP Regular');
    if (i % 7 === 0) tags.push('Weekend Grooming');
    if (i % 11 === 0) tags.push('Beard Trim Only');

    list.push({
      id: `cnt-${i}`,
      name,
      phone,
      city,
      country,
      language,
      tags,
      optOut,
      lastVisit: `2026-10-${String((i % 26) + 1).padStart(2, '0')}`,
      totalVisits: (i % 12) + 1,
    });
  }

  return list;
};

export const SAMPLE_CONTACTS = generate214Contacts();

export const FLOW_NODES: FlowNode[] = [
  {
    id: 'NODE-01',
    code: 'TRIGGER_INBOUND',
    category: 'trigger',
    title: {
      en: 'Missed Call / WhatsApp Inbound',
      ur: 'مس کال یا نیا پیغام',
      ar: 'المكالمة الفائتة أو رسالة واردة'
    },
    description: {
      en: 'Android SIM Gateway or Meta Cloud API intercepts inbound ping at $0 cost.',
      ur: 'اینڈرائڈ سم گیٹ وے خودکار طور پر بغیر کسی لاگت کے مس کال کو ڈیٹیکٹ کرتا ہے۔',
      ar: 'بوابة الشريحة أو واجهة ميتا تلتقط المكالمة الفائتة بتكلفة صفرية فوراً.'
    },
    messageCard: {
      en: {
        body: 'Sorry we missed your call! WORKCRAFT Automated Concierge is ready to book your slot.',
        buttons: ['Book Appointment', 'Salon Location & Hours', 'Urdu / عربی']
      },
      ur: {
        body: 'معذرت، ہم آپ کی کال اٹینڈ نہیں کر سکے۔ ورک کرافٹ خودکار سسٹم پر اپنی بکنگ منتخب کریں۔',
        buttons: ['اپوائنٹمنٹ بک کریں', 'لوکیشن اور اوقات', 'Change Language']
      },
      ar: {
        body: 'نعتذر عن تفويت مكالمتكم! المساعد الآلي مستعد لحجز موعدكم الفوري في ثوانٍ.',
        buttons: ['حجز موعد فوري', 'موقع الصالون والمواعيد', 'English']
      }
    },
    nextStates: ['NODE-02']
  },
  {
    id: 'NODE-02',
    code: 'TRI_STATE_ROUTER',
    category: 'router',
    title: {
      en: 'Tri-Lingual State Router',
      ur: 'سہ لسانی اسٹیٹ راؤٹر',
      ar: 'موجه اللغات الثلاثي'
    },
    description: {
      en: 'Seamlessly preserves user session context in EN, UR, or AR across goroutines.',
      ur: 'صارف کی زبان (انگریزی، اردو، یا عربی) کو سیشن میں محفوظ رکھتا ہے۔',
      ar: 'يوجه العميل فوراً إلى لغته المفضلة مع حفظ السياق في الذاكرة.'
    },
    messageCard: {
      en: {
        header: 'Welcome to Royal Cut Gentlemen Lounge',
        body: 'Please select your preferred language to proceed with instant slot booking:',
        buttons: ['1. English 🇬🇧', '2. اردو (Urdu) 🇵🇰', '3. العربية (Arabic) 🇦🇪']
      },
      ur: {
        header: 'رائل کٹ جنٹلمینز سیلون میں خوش آمدید',
        body: 'براہ کرم اپنی پسندیدہ زبان منتخب کریں تاکہ آپ کا سلاٹ بک کیا جا سکے:',
        buttons: ['1. English 🇬🇧', '2. اردو 🇵🇰', '3. العربية 🇦🇪']
      },
      ar: {
        header: 'أهلاً بكم في صالون النخبة',
        body: 'يرجى اختيار لغتكم المفضلة للمتابعة واختيار الموعد المناسب:',
        buttons: ['1. العربية 🇦🇪', '2. English 🇬🇧', '3. اردو 🇵🇰']
      }
    },
    nextStates: ['NODE-03']
  },
  {
    id: 'NODE-03',
    code: '1SCREEN_ANTI_CROP_MENU',
    category: 'booking',
    title: {
      en: '1-Screen Anti-Cropping Booking Card',
      ur: 'ون اسکرین اینٹی کراپ بکنگ مینو',
      ar: 'بطاقة الحجز المدمجة بدون قص'
    },
    description: {
      en: 'Compresses Category + Stylist + Slot in 1 view. Eliminates scroll fatigue on 5.5"-6.7" screens.',
      ur: 'ایک ہی مینو کارڈ میں کیٹیگری، اسٹائلسٹ اور ٹائم سلاٹ دکھاتا ہے تاکہ کسٹمر کنفیوز نہ ہو۔',
      ar: 'تدمج الخدمة والحلاق والوقت في شاشة واحدة لتفادي التمرير والقص على شاشات الجوال.'
    },
    messageCard: {
      en: {
        header: 'Select Service & Slot (1-Tap)',
        body: 'Choose your desired service combo below. Slot is held for 5 minutes:',
        sections: [
          {
            title: 'Popular Services',
            rows: [
              { title: 'Haircut + Styling (PKR 1,200)', description: 'Master Stylist Kamran · 35 min' },
              { title: 'Royal Beard Sculpt & Steam (PKR 800)', description: 'Stylist Bilal · 25 min' },
              { title: 'Full VIP Executive Grooming (PKR 2,800)', description: 'VIP Suite · 60 min' }
            ]
          },
          {
            title: 'Today Available Slots',
            rows: [
              { title: 'Slot A: 04:30 PM Today', description: 'Chair 2 Available' },
              { title: 'Slot B: 06:15 PM Today', description: 'Chair 1 Available' },
              { title: 'Slot C: 08:00 PM Today', description: 'Chair 3 Available' }
            ]
          }
        ]
      },
      ur: {
        header: 'سروس اور ٹائم منتخب کریں (ایک کلک)',
        body: 'براہ کرم سروس اور دستیاب ٹائم سلاٹ منتخب کریں۔ سلاٹ 5 منٹ کے لیے محفوظ ہے:',
        sections: [
          {
            title: 'مقبول سروسز',
            rows: [
              { title: 'ہیئر کٹ + اسٹائلنگ (1,200 روپے)', description: 'ماسٹر کامران · 35 منٹ' },
              { title: 'داڑھی شیپ + ہاٹ فیشل اسٹیم (800 روپے)', description: 'اسٹائلسٹ بلال · 25 منٹ' },
              { title: 'مکمل ایگزیکٹو وی آئی پی پیکیج (2,800 روپے)', description: 'وی آئی پی کیبن · 60 منٹ' }
            ]
          },
          {
            title: 'آج کے دستیاب اوقات',
            rows: [
              { title: 'ٹائم سلاٹ A: شام 04:30 بجے', description: 'کرسی نمبر 2 خالی ہے' },
              { title: 'ٹائم سلاٹ B: شام 06:15 بجے', description: 'کرسی نمبر 1 خالی ہے' },
              { title: 'ٹائم سلاٹ C: رات 08:00 بجے', description: 'کرسی نمبر 3 خالی ہے' }
            ]
          }
        ]
      },
      ar: {
        header: 'اختر الخدمة والموعد بلمسة واحدة',
        body: 'حدد الباقة والموعد المطلوب. يتم حجز المقعد مؤقتاً لمدة 5 دقائق:',
        sections: [
          {
            title: 'الخدمات المميزة',
            rows: [
              { title: 'قص شعر ملكي + سشوار (75 درهم)', description: 'الحلاق المحترف كامران · 35 دقيقة' },
              { title: 'تحديد لحية وبخار أوزون (50 درهم)', description: 'الحلاق بلال · 25 دقيقة' },
              { title: 'باقة VIP الملكية الشاملة (150 درهم)', description: 'جناح كبار الشخصيات · 60 دقيقة' }
            ]
          },
          {
            title: 'المواعيد المتاحة اليوم',
            rows: [
              { title: 'الموعد الأول: 04:30 مساءً', description: 'الكرسي 2 متاح' },
              { title: 'الموعد الثاني: 06:15 مساءً', description: 'الكرسي 1 متاح' },
              { title: 'الموعد الثالث: 08:00 مساءً', description: 'الكرسي 3 متاح' }
            ]
          }
        ]
      }
    },
    nextStates: ['NODE-04']
  },
  {
    id: 'NODE-04',
    code: 'CONCURRENCY_LOCK_OWNER_ALERT',
    category: 'concurrency',
    title: {
      en: 'Slot Lock & Owner WhatsApp Alert',
      ur: 'سلاٹ لاک اور مالک کو فوری واٹس ایپ الرٹ',
      ar: 'تأكيد الحجز وتنبيه مالك الصالون'
    },
    description: {
      en: 'Supabase atomic row lock prevents double-booking. Owner receives instant push alert.',
      ur: 'ڈیٹابیس میں ڈبل بکنگ ناممکن بناتا ہے اور دکان کے مالک کو واٹس ایپ پر الرٹ بھیجتا ہے۔',
      ar: 'قفل فوري للمقعد في قاعدة البيانات لمنع التضارب وإشعار مباشر لهاتف المالك.'
    },
    messageCard: {
      en: {
        header: '✅ Appointment Confirmed! #RC-8924',
        body: "You are booked for Today at 04:30 PM with Stylist Kamran. Salon Google Map Pin: https://maps.app.goo.gl/sample\n\nNeed to reschedule? Reply 'RESCHEDULE' anytime.",
        footer: 'WORKCRAFT Zero-Dashboard Engine'
      },
      ur: {
        header: '✅ اپوائنٹمنٹ کنفرم ہو گئی ہے! #RC-8924',
        body: "آپ کی بکنگ آج شام 04:30 بجے اسٹائلسٹ کامران کے ساتھ طے ہے۔ گوگل میپ لوکیشن پن:\nhttps://maps.app.goo.gl/sample\n\nوقت تبدیل کرنے کے لیے صرف 'RESCHEDULE' لکھ کر بھیجیں۔",
        footer: 'ورک کرافٹ لوکل آٹومیشن'
      },
      ar: {
        header: '✅ تم تأكيد حجز موعدكم بنجاح! #RC-8924',
        body: "موعدكم اليوم الساعة 04:30 مساءً مع الحلاق كامران. موقع الصالون على خرائط جوجل:\nhttps://maps.app.goo.gl/sample\n\nلتعديل الموعد أرسل كلمة 'تعديل' في أي وقت.",
        footer: 'نظام ورك كرافت الذكي'
      }
    },
    nextStates: ['NODE-05']
  },
  {
    id: 'NODE-05',
    code: 'SMART_REVIEW_BOOSTER',
    category: 'review',
    title: {
      en: 'Smart 2-Step Google Review Booster',
      ur: 'اسمارٹ 2-اسٹیپ گوگل ریویو بوسٹر',
      ar: 'معزز تقييمات جوجل الذكي'
    },
    description: {
      en: 'Dispatched 2 hours post-appointment. 5★ redirects to Google Maps; 1-4★ intercepted privately.',
      ur: 'سروس کے 2 گھنٹے بعد خودکار پیغام۔ 5 اسٹار گوگل میپس پر، جبکہ 1 تا 4 اسٹار مالک کے پرائیویٹ چیٹ پر۔',
      ar: 'يرسل بعد ساعتين من الموعد. تقييم 5 نجوم يوجه لخرائط جوجل، والتقييم الأقل يوجه لمالك الصالون سراً.'
    },
    messageCard: {
      en: {
        header: 'How was your experience today at Royal Cut?',
        body: 'Please rate your haircut & grooming session with Stylist Kamran:',
        buttons: ['⭐⭐⭐⭐⭐ (5 Stars - Excellent)', '⭐⭐⭐⭐ (4 Stars)', '⭐ - ⭐⭐⭐ (Needs Improvement)']
      },
      ur: {
        header: 'رائل کٹ پر آپ کا تجربہ کیسا رہا؟',
        body: 'براہ کرم اسٹائلسٹ کامران کے ساتھ اپنی ہیئر کٹ اور گرومنگ سروس کو ریٹ کریں:',
        buttons: ['⭐⭐⭐⭐⭐ (شاندار تجربہ)', '⭐⭐⭐⭐ (بہتر)', '⭐ - ⭐⭐⭐ (شکایت / اصلاح)']
      },
      ar: {
        header: 'كيف كانت تجربتكم اليوم في الصالون؟',
        body: 'يرجى تقييم تجربة الحلاقة والعناية مع الحلاق كامران:',
        buttons: ['⭐⭐⭐⭐⭐ (ممتاز جداً)', '⭐⭐⭐⭐ (جيد جداً)', '⭐ - ⭐⭐⭐ (ملاحظات خاصة للإدارة)']
      }
    },
    nextStates: []
  }
];

export const INITIAL_INVOICES: MaintenanceInvoice[] = [
  {
    id: 'INV-2026-10',
    month: 'October 2026',
    amount: 2000,
    currency: 'PKR',
    issueDate: '2026-10-28',
    dueDate: '2026-10-30',
    status: 'paid',
    paidOn: '2026-10-29',
    paymentMethod: 'EasyPaisa Auto-Debit',
    transactionRef: 'EP-9982410293'
  },
  {
    id: 'INV-2026-09',
    month: 'September 2026',
    amount: 2000,
    currency: 'PKR',
    issueDate: '2026-09-28',
    dueDate: '2026-09-30',
    status: 'paid',
    paidOn: '2026-09-29',
    paymentMethod: 'JazzCash Wallet',
    transactionRef: 'JC-8812903120'
  },
  {
    id: 'INV-2026-08',
    month: 'August 2026',
    amount: 2000,
    currency: 'PKR',
    issueDate: '2026-08-28',
    dueDate: '2026-08-30',
    status: 'paid',
    paidOn: '2026-08-30',
    paymentMethod: 'Habib Bank Online',
    transactionRef: 'HBL-7712398410'
  }
];
