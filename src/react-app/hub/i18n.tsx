import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { v1Translations } from "./i18n-v1";

export type Language = "en" | "my";

const STORAGE_KEY = "aidnova_lang";

const translations: Record<string, { en: string; my?: string }> = {
	...v1Translations,
	"loading.app": { en: "Loading AidNova…", my: "AidNova ကို ဖွင့်နေသည်…" },
	"loading.slow": {
		en: "This is taking longer than expected. Please try again.",
		my: "ပုံမှန်ထက် ကြာနေပါသည်။ ထပ်မံကြိုးစားပါ။",
	},
	"error.load": {
		en: "We couldn't load this. Please try again.",
		my: "ဤအရာကို ဖွင့်၍မရပါ။ ထပ်မံကြိုးစားပါ။",
	},
	"error.generic": {
		en: "Something went wrong. Please try again.",
		my: "တစ်ခုခု မှားယွင်းနေပါသည်။ ထပ်မံကြိုးစားပါ။",
	},
	"auth.sign_in": { en: "Sign in", my: "အကောင့်ဝင်ရန်" },
	"auth.sign_in_title": {
		en: "Sign in to AidNova",
		my: "AidNova သို့ အကောင့်ဝင်ပါ",
	},
	"auth.sign_up": { en: "Create account", my: "အကောင့်ဖွင့်ရန်" },
	"auth.sign_up_title": {
		en: "Create your account",
		my: "သင့်အကောင့်ကို ဖွင့်ပါ",
	},
	"auth.sign_up_subtitle": {
		en: "Start with a 14-day free trial. No card needed.",
		my: "၁၄ ရက် အခမဲ့ စမ်းသုံးပါ။ ကတ် မလိုအပ်ပါ။",
	},
	"auth.name": { en: "Full name", my: "အမည်အပြည့်အစုံ" },
	"auth.email": { en: "Email", my: "အီးမေးလ်" },
	"auth.password": { en: "Password", my: "စကားဝှက်" },
	"auth.password_hint": {
		en: "At least 8 characters.",
		my: "အနည်းဆုံး စာလုံး ၈ လုံး။",
	},
	"auth.forgot": { en: "Forgot password?", my: "စကားဝှက် မေ့နေပါသလား။" },
	"auth.no_account": { en: "New to AidNova?", my: "AidNova ကို အသစ်သုံးမှာလား။" },
	"auth.has_account": {
		en: "Already have an account?",
		my: "အကောင့်ရှိပြီးသားလား။",
	},
	"auth.invalid": {
		en: "That email or password isn't right.",
		my: "အီးမေးလ် သို့မဟုတ် စကားဝှက် မမှန်ပါ။",
	},
	"auth.too_many": {
		en: "Too many attempts. Please wait a moment and try again.",
		my: "ကြိုးစားမှု များလွန်းနေပါသည်။ ခဏစောင့်ပြီး ထပ်မံကြိုးစားပါ။",
	},
	"auth.email_exists": {
		en: "An account with this email already exists.",
		my: "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးသားဖြစ်ပါသည်။",
	},
	"auth.unverified": {
		en: "Please confirm your email first.",
		my: "သင့်အီးမေးလ်ကို ဦးစွာ အတည်ပြုပါ။",
	},
	"auth.resend": {
		en: "Send the confirmation email again",
		my: "အတည်ပြုအီးမေးလ် ထပ်ပို့ရန်",
	},
	"auth.check_email_title": {
		en: "Check your email",
		my: "သင့်အီးမေးလ်ကို စစ်ဆေးပါ",
	},
	"auth.check_email": {
		en: "We sent a confirmation link to {email}. Open it to finish creating your account.",
		my: "{email} သို့ အတည်ပြုလင့်ခ် ပို့ထားပါသည်။ အကောင့်ဖွင့်ခြင်း ပြီးဆုံးရန် ၎င်းကို ဖွင့်ပါ။",
	},
	"auth.forgot_title": {
		en: "Reset your password",
		my: "စကားဝှက် ပြန်သတ်မှတ်ပါ",
	},
	"auth.forgot_button": {
		en: "Send reset link",
		my: "ပြန်သတ်မှတ်ရန် လင့်ခ် ပို့ပါ",
	},
	"auth.forgot_sent": {
		en: "If an account exists for {email}, we've sent a reset link.",
		my: "{email} အတွက် အကောင့်ရှိပါက လင့်ခ် ပို့ထားပါသည်။",
	},
	"auth.reset_title": {
		en: "Choose a new password",
		my: "စကားဝှက်အသစ် ရွေးချယ်ပါ",
	},
	"auth.reset_button": {
		en: "Save new password",
		my: "စကားဝှက်အသစ် သိမ်းပါ",
	},
	"auth.reset_invalid": {
		en: "This reset link is invalid or has expired.",
		my: "ဤလင့်ခ် မမှန်ပါ သို့မဟုတ် သက်တမ်းကုန်သွားပါပြီ။",
	},
	"auth.back_to_sign_in": {
		en: "Back to sign in",
		my: "အကောင့်ဝင်ရန် ပြန်သွားပါ",
	},
	"org.slug_taken": {
		en: "That URL identifier is already taken.",
		my: "ဤ URL သတ်မှတ်ချက်ကို အသုံးပြုပြီးဖြစ်ပါသည်။",
	},
	"org.already_owner": {
		en: "You already own an organization.",
		my: "သင်သည် အဖွဲ့အစည်းတစ်ခုကို ပိုင်ဆိုင်ပြီးဖြစ်ပါသည်။",
	},
	"org.switch": { en: "Switch organization", my: "အဖွဲ့အစည်း ပြောင်းရန်" },
	"org.blocked_title": {
		en: "This organization isn't active",
		my: "ဤအဖွဲ့အစည်း အသုံးမပြုနိုင်သေးပါ",
	},
	"org.blocked_desc": {
		en: "Contact AidNova to reactivate it. Your policies, courses and records stay as you left them.",
		my: "ပြန်လည်အသုံးပြုရန် AidNova ကို ဆက်သွယ်ပါ။ သင့်မူဝါဒများ၊ သင်တန်းများနှင့် မှတ်တမ်းများ ရှိမြဲအတိုင်း ရှိနေပါမည်။",
	},
	"org.trial_ended_desc": {
		en: "Your 14-day free trial has ended. Contact AidNova to request an upgrade. Your policies, courses and records stay as you left them.",
		my: "သင်၏ ၁၄ ရက် အခမဲ့စမ်းသုံးကာလ ကုန်ဆုံးပါပြီ။ အဆင့်မြှင့်ရန် AidNova ကို ဆက်သွယ်ပါ။ သင့်မူဝါဒများ၊ သင်တန်းများနှင့် မှတ်တမ်းများ ရှိမြဲအတိုင်း ရှိနေပါမည်။",
	},
	"org.contact": { en: "Contact AidNova", my: "AidNova ကို ဆက်သွယ်ပါ" },
	"shell.language": { en: "Language", my: "ဘာသာစကား" },
	"shell.theme_dark": { en: "Use dark theme", my: "အမှောင်အပြင်အဆင် သုံးရန်" },
	"shell.theme_light": { en: "Use light theme", my: "အလင်းအပြင်အဆင် သုံးရန်" },
	"shell.notifications": { en: "Notifications", my: "အသိပေးချက်များ" },
	"shell.menu": { en: "Open menu", my: "မီနူး ဖွင့်ရန်" },
	"shell.more": { en: "More", my: "နောက်ထပ်" },
	"shell.main_nav": { en: "Main", my: "ပင်မ" },
	"page.later_title": { en: "Not built yet", my: "မတည်ဆောက်ရသေးပါ" },
	"page.later_desc": {
		en: "{page} is coming in a later v2 build stage.",
		my: "{page} ကို နောက်အဆင့်တွင် ထည့်သွင်းပါမည်။",
	},
	"page.no_access_title": { en: "No access", my: "ဝင်ရောက်ခွင့် မရှိပါ" },
	"page.no_access_desc": {
		en: "Your role in this organization doesn't include this page.",
		my: "ဤအဖွဲ့အစည်းရှိ သင့်အခန်းကဏ္ဍတွင် ဤစာမျက်နှာ မပါဝင်ပါ။",
	},
	"page.not_found_title": { en: "Page not found", my: "စာမျက်နှာ မတွေ့ပါ" },
	"page.not_found_desc": {
		en: "This page doesn't exist.",
		my: "ဤစာမျက်နှာ မရှိပါ။",
	},
	"users.subtitle": {
		en: "People in this organization.",
		my: "ဤအဖွဲ့အစည်းရှိ လူများ။",
	},
	"users.name": { en: "Name", my: "အမည်" },
	"users.email": { en: "Email", my: "အီးမေးလ်" },
	"users.role": { en: "Role", my: "အခန်းကဏ္ဍ" },
	"users.department": { en: "Department", my: "ဌာန" },
	"users.status": { en: "Status", my: "အခြေအနေ" },
	"users.owner": { en: "Owner", my: "ပိုင်ရှင်" },
	"users.active": { en: "Active", my: "အသုံးပြုနေသည်" },
	"users.inactive": { en: "Inactive", my: "အသုံးမပြုတော့ပါ" },
	"users.only_you": {
		en: "You're the only person here so far.",
		my: "ယခုအချိန်တွင် သင်တစ်ဦးတည်းသာ ရှိပါသည်။",
	},
	"users.role_failed": {
		en: "We couldn't change that role. Please try again.",
		my: "အခန်းကဏ္ဍကို ပြောင်း၍မရပါ။ ထပ်မံကြိုးစားပါ။",
	},
	"role.staff": { en: "Staff", my: "ဝန်ထမ်း" },
	"role.manager": { en: "Manager", my: "မန်နေဂျာ" },
	"role.admin": { en: "Admin", my: "အက်ဒမင်" },
	"superadmin.title": {
		en: "Platform administration",
		my: "ပလက်ဖောင်း စီမံခန့်ခွဲမှု",
	},
	"superadmin.organizations": { en: "Organizations", my: "အဖွဲ့အစည်းများ" },
	"superadmin.users": { en: "Users", my: "အသုံးပြုသူများ" },
};

interface I18nValue {
	language: Language;
	setLanguage: (language: Language) => void;
	t: (key: string, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLanguage(): Language {
	try {
		return localStorage.getItem(STORAGE_KEY) === "my" ? "my" : "en";
	} catch {
		return "en";
	}
}

export function I18nProvider({ children }: { children: ReactNode }) {
	const [language, setLanguageState] = useState(readStoredLanguage);

	const setLanguage = useCallback((next: Language) => {
		setLanguageState(next);
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// The choice just won't persist, for example in a private window.
		}
	}, []);

	useEffect(() => {
		document.documentElement.lang = language;
	}, [language]);

	const value = useMemo<I18nValue>(
		() => ({
			language,
			setLanguage,
			t: (key, values) => {
				const entry = translations[key];
				let text = entry?.[language] ?? entry?.en ?? key;
				for (const [name, replacement] of Object.entries(values ?? {})) {
					text = text.replace(`{${name}}`, String(replacement));
				}
				return text;
			},
		}),
		[language, setLanguage],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
	const value = useContext(I18nContext);
	if (!value) throw new Error("useI18n must be used inside I18nProvider");
	return value;
}
