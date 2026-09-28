import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Language = 'en' | 'hi' | 'gu' | 'mr';

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'barber-i18n-storage',
    }
  )
);

const translations = {
  en: {
    // Shared
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    done: "Done",
    
    // Barber Dashboard
    schedule: "Schedule",
    appointments: "Appointments",
    publicPage: "Public Page",
    settings: "Settings",
    logout: "Logout",
    generateSlots: "Generate Today's Slots",
    noSchedule: "No schedule created",
    noScheduleDesc: "You haven't generated any slots for this date yet.",
    allDone: "You're all done for today! 🎉",
    allDoneDesc: "All your appointments for today have been completed and safely stored.",
    focusTomorrow: "Focus on Tomorrow",
    available: "Available",
    booked: "Booked",
    blocked: "Blocked",
    blockSlot: "Block Slot",
    unblock: "Unblock",
    viewDetails: "View Details",
    bookingsPerSlot: "Bookings per slot:",
    
    // Customer Booking
    chooseDate: "Choose a date",
    availableTimes: "Available Times",
    noSlots: "No slots available for this date.",
    bookAppointment: "Book Appointment",
    yourName: "Your Name",
    yourPhone: "Phone Number",
    confirmBooking: "Confirm Booking",
    appointmentConfirmed: "Appointment Confirmed!",
    bookingSuccess: "Your appointment has been successfully booked.",
    bookingId: "Booking ID",
    date: "Date",
    time: "Time",
    customer: "Customer",
    barberNotFound: "Barber Not Found",
    checkUrl: "Please check the URL and try again.",
    cancelPrompt: "Booking cancelled! Would you like to send a WhatsApp message to {name} to let them know you are unavailable?",
    cancelMessage: "Hi {name}, sorry but we had to cancel your appointment at {time}. We are unavailable right now. Please book another time!"
  },
  hi: {
    loading: "लोड हो रहा है...",
    save: "सहेजें",
    cancel: "रद्द करें",
    done: "हो गया",
    schedule: "अनुसूची",
    appointments: "अपॉइंटमेंट",
    publicPage: "सार्वजनिक पृष्ठ",
    settings: "सेटिंग्स",
    logout: "लॉग आउट",
    generateSlots: "आज के स्लॉट बनाएं",
    noSchedule: "कोई अनुसूची नहीं बनाई गई",
    noScheduleDesc: "आपने अभी तक इस तिथि के लिए कोई स्लॉट नहीं बनाया है।",
    allDone: "आज के लिए सब हो गया! 🎉",
    allDoneDesc: "आज के लिए आपके सभी अपॉइंटमेंट पूरे हो गए हैं।",
    focusTomorrow: "कल पर ध्यान दें",
    available: "उपलब्ध",
    booked: "बुक किया गया",
    blocked: "ब्लॉक किया गया",
    blockSlot: "स्लॉट ब्लॉक करें",
    unblock: "अनब्लॉक करें",
    viewDetails: "विवरण देखें",
    bookingsPerSlot: "प्रति स्लॉट बुकिंग:",
    chooseDate: "तारीख चुनें",
    availableTimes: "उपलब्ध समय",
    noSlots: "इस तारीख के लिए कोई स्लॉट उपलब्ध नहीं है।",
    bookAppointment: "अपॉइंटमेंट बुक करें",
    yourName: "आपका नाम",
    yourPhone: "फ़ोन नंबर",
    confirmBooking: "बुकिंग पक्की करें",
    appointmentConfirmed: "अपॉइंटमेंट पक्की हो गई!",
    bookingSuccess: "आपका अपॉइंटमेंट सफलतापूर्वक बुक हो गया है।",
    bookingId: "बुकिंग आईडी",
    date: "तारीख",
    time: "समय",
    customer: "ग्राहक",
    barberNotFound: "नाई नहीं मिला",
    checkUrl: "कृपया URL जांचें और पुनः प्रयास करें।",
    cancelPrompt: "बुकिंग रद्द हो गई! क्या आप {name} को व्हाट्सएप संदेश भेजना चाहेंगे कि आप अनुपलब्ध हैं?",
    cancelMessage: "नमस्ते {name}, क्षमा करें लेकिन हमें {time} का आपका अपॉइंटमेंट रद्द करना पड़ा। हम अभी अनुपलब्ध हैं। कृपया दूसरी बार बुक करें!"
  },
  gu: {
    loading: "લોડ થઈ રહ્યું છે...",
    save: "સાચવો",
    cancel: "રદ કરો",
    done: "થઈ ગયું",
    schedule: "સમયપત્રક",
    appointments: "એપોઇન્ટમેન્ટ્સ",
    publicPage: "જાહેર પૃષ્ઠ",
    settings: "સેટિંગ્સ",
    logout: "લૉગ આઉટ",
    generateSlots: "આજના સ્લોટ્સ બનાવો",
    noSchedule: "કોઈ સમયપત્રક બનાવ્યું નથી",
    noScheduleDesc: "તમે હજુ સુધી આ તારીખ માટે કોઈ સ્લોટ બનાવ્યા નથી.",
    allDone: "આજ માટે બધું થઈ ગયું! 🎉",
    allDoneDesc: "આજ માટે તમારી બધી એપોઇન્ટમેન્ટ પૂર્ણ થઈ ગઈ છે.",
    focusTomorrow: "આવતીકાલ પર ધ્યાન કેન્દ્રિત કરો",
    available: "ઉપલબ્ધ",
    booked: "બુક કરેલ",
    blocked: "બ્લોક કરેલ",
    blockSlot: "સ્લોટ બ્લોક કરો",
    unblock: "અનબ્લોક કરો",
    viewDetails: "વિગતો જુઓ",
    bookingsPerSlot: "સ્લોટ દીઠ બુકિંગ:",
    chooseDate: "તારીખ પસંદ કરો",
    availableTimes: "ઉપલબ્ધ સમય",
    noSlots: "આ તારીખ માટે કોઈ સ્લોટ ઉપલબ્ધ નથી.",
    bookAppointment: "એપોઇન્ટમેન્ટ બુક કરો",
    yourName: "તમારું નામ",
    yourPhone: "ફોન નંબર",
    confirmBooking: "બુકિંગ કન્ફર્મ કરો",
    appointmentConfirmed: "એપોઇન્ટમેન્ટ કન્ફર્મ થઈ ગઈ!",
    bookingSuccess: "તમારી એપોઇન્ટમેન્ટ સફળતાપૂર્વક બુક થઈ ગઈ છે.",
    bookingId: "બુકિંગ ID",
    date: "તારીખ",
    time: "સમય",
    customer: "ગ્રાહક",
    barberNotFound: "વાળંદ મળ્યો નથી",
    checkUrl: "કૃપા કરીને URL તપાસો અને ફરી પ્રયાસ કરો.",
    cancelPrompt: "બુકિંગ રદ થયું! શું તમે {name} ને વૉટ્સએપ મેસેજ મોકલવા માંગો છો કે તમે અનુપલબ્ધ છો?",
    cancelMessage: "નમસ્તે {name}, માફ કરશો પરંતુ અમારે {time} ની તમારી એપોઇન્ટમેન્ટ રદ કરવી પડી. અમે અત્યારે અનુપલબ્ધ છીએ. કૃપા કરીને બીજી વાર બુક કરો!"
  },
  mr: {
    loading: "लोड होत आहे...",
    save: "जतन करा",
    cancel: "रद्द करा",
    done: "झाले",
    schedule: "वेळापत्रक",
    appointments: "अपॉइंटमेंट्स",
    publicPage: "सार्वजनिक पृष्ठ",
    settings: "सेटिंग्ज",
    logout: "लॉग आउट",
    generateSlots: "आजचे स्लॉट तयार करा",
    noSchedule: "कोणतेही वेळापत्रक तयार केले नाही",
    noScheduleDesc: "तुम्ही अद्याप या तारखेसाठी कोणतेही स्लॉट तयार केलेले नाहीत.",
    allDone: "आजचे सर्व काम झाले! 🎉",
    allDoneDesc: "आजच्या तुमच्या सर्व अपॉइंटमेंट्स पूर्ण झाल्या आहेत.",
    focusTomorrow: "उद्यावर लक्ष केंद्रित करा",
    available: "उपलब्ध",
    booked: "बुक केले",
    blocked: "अवरोधित केले",
    blockSlot: "स्लॉट ब्लॉक करा",
    unblock: "अनब्लॉक करा",
    viewDetails: "तपशील पहा",
    bookingsPerSlot: "प्रति स्लॉट बुकिंग:",
    chooseDate: "तारीख निवडा",
    availableTimes: "उपलब्ध वेळा",
    noSlots: "या तारखेसाठी कोणतेही स्लॉट उपलब्ध नाहीत.",
    bookAppointment: "अपॉइंटमेंट बुक करा",
    yourName: "तुमचे नाव",
    yourPhone: "फोन नंबर",
    confirmBooking: "बुकिंग निश्चित करा",
    appointmentConfirmed: "अपॉइंटमेंट निश्चित झाली!",
    bookingSuccess: "तुमची अपॉइंटमेंट यशस्वीरित्या बुक झाली आहे.",
    bookingId: "बुकिंग आयडी",
    date: "तारीख",
    time: "वेळ",
    customer: "ग्राहक",
    barberNotFound: "न्हावी सापडला नाही",
    checkUrl: "कृपया URL तपासा आणि पुन्हा प्रयत्न करा.",
    cancelPrompt: "बुकिंग रद्द केले! तुम्ही {name} ला व्हॉट्सॲप संदेश पाठवू इच्छिता की तुम्ही अनुपलब्ध आहात?",
    cancelMessage: "नमस्कार {name}, क्षमस्व पण आम्हाला तुमची {time} ची अपॉइंटमेंट रद्द करावी लागली. आम्ही सध्या अनुपलब्ध आहोत. कृपया दुसऱ्या वेळी बुक करा!"
  }
};

export function useTranslation() {
  const language = useI18nStore((state) => state.language);
  
  const t = (key: keyof typeof translations['en']) => {
    return translations[language][key] || translations['en'][key];
  };

  return { t, language, setLanguage: useI18nStore.getState().setLanguage };
}
