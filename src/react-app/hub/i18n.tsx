import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { pageTranslations } from "./i18n-pages";
import { v1Translations } from "./i18n-v1";

export type Language = "en" | "my";

const STORAGE_KEY = "aidnova_lang";

const translations: Record<string, { en: string; my?: string }> = {
	...v1Translations,
	...pageTranslations,
	"loading.app": { en: "Loading AidNova…", my: "AidNova ကို ဖွင့်နေပါတယ်…" },
	"loading.slow": {
		en: "This is taking longer than expected. Please try again.",
		my: "ပုံမှန်ထက် ကြာနေပါတယ်။ ထပ်စမ်းကြည့်ပါ။",
	},
	"auth.security_check": {
		en: "Please complete the security check and try again.",
		my: "လုံခြုံရေးစစ်ဆေးမှုကို ပြီးအောင်လုပ်ပြီး ထပ်စမ်းကြည့်ပါ။",
	},
	"error.load": {
		en: "We couldn't load this. Please try again.",
		my: "ဒီအရာကို ဖွင့်၍မရပါ။ ထပ်စမ်းကြည့်ပါ။",
	},
	"error.generic": {
		en: "Something went wrong. Please try again.",
		my: "တစ်ခုခု မှားယွင်းနေပါတယ်။ ထပ်စမ်းကြည့်ပါ။",
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
	"auth.name": { en: "Full name", my: "အမည်" },
	"auth.email": { en: "Email", my: "Email" },
	"auth.password": { en: "Password", my: "Password" },
	"auth.password_hint": {
		en: "At least 8 characters.",
		my: "အနည်းဆုံး စာလုံး ၈ လုံး။",
	},
	"auth.forgot": { en: "Forgot password?", my: "Password မေ့သွားပြီလား?" },
	"auth.no_account": { en: "New to AidNova?", my: "AidNova ကို အခုမှ စသုံးမှာလား?" },
	"auth.has_account": {
		en: "Already have an account?",
		my: "အကောင့်ရှိပြီးသားလား။",
	},
	"auth.invalid": {
		en: "That email or password isn't right.",
		my: "Email သို့မဟုတ် Password မမှန်ပါ။",
	},
	"auth.too_many": {
		en: "Too many attempts. Please wait a moment and try again.",
		my: "စမ်းကြည့်မှု တွေလွန်းနေပါတယ်။ ခဏစောင့်ပြီး ထပ်စမ်းကြည့်ပါ။",
	},
	"auth.email_exists": {
		en: "An account with this email already exists.",
		my: "ဒီ Email နဲ့ အကောင့်ရှိပြီးသားဖြစ်ပါတယ်။",
	},
	"auth.unverified": {
		en: "Please confirm your email first.",
		my: "သင့် Email ကို ဦးစွာ အတည်ပြုပါ။",
	},
	"auth.resend": {
		en: "Send the confirmation email again",
		my: "အတည်ပြု Email ထပ်ပို့ရန်",
	},
	"auth.check_email_title": {
		en: "Check your email",
		my: "သင့် Email ကို စစ်ဆေးပါ",
	},
	"auth.check_email": {
		en: "We sent a confirmation link to {email}. Open it to finish creating your account.",
		my: "{email} သို့ အတည်ပြု Link ပို့ထားပါတယ်။ အကောင့်ဖွင့်ခြင်း ပြီးဆုံးရန် ဒါကို ဖွင့်ပါ။",
	},
	"auth.forgot_title": {
		en: "Reset your password",
		my: "Password ပြန်သတ်မှတ်ပါ",
	},
	"auth.forgot_button": {
		en: "Send reset link",
		my: "ပြန်သတ်မှတ်ရန် Link ပို့ပါ",
	},
	"auth.forgot_sent": {
		en: "If an account exists for {email}, we've sent a reset link.",
		my: "{email} အတွက် အကောင့်ရှိရင် Link ပို့ထားပါတယ်။",
	},
	"auth.reset_title": {
		en: "Choose a new password",
		my: "Password အသစ် ရွေးချယ်ပါ",
	},
	"auth.reset_button": {
		en: "Save new password",
		my: "Password အသစ် သိမ်းပါ",
	},
	"auth.reset_invalid": {
		en: "This reset link is invalid or has expired.",
		my: "ဒီ Link မမှန်ပါ သို့မဟုတ် သက်တမ်းကုန်သွားပါပြီ။",
	},
	"auth.back_to_sign_in": {
		en: "Back to sign in",
		my: "အကောင့်ဝင်ရန် ပြန်သွားပါ",
	},
	"org.slug_taken": {
		en: "That URL identifier is already taken.",
		my: "ဒီ URL သတ်မှတ်ချက်ကို အသုံးပြုပြီးဖြစ်ပါတယ်။",
	},
	"org.already_owner": {
		en: "You already own an organization.",
		my: "သင်က အဖွဲ့အစည်းတစ်ခုကို ပိုင်ဆိုင်ပြီးဖြစ်ပါတယ်။",
	},
	"org.switch": { en: "Switch organization", my: "အဖွဲ့အစည်း ပြောင်းရန်" },
	"org.blocked_title": {
		en: "This organization isn't active",
		my: "ဒီအဖွဲ့အစည်း အသုံးမပြုနိုင်သေးပါ",
	},
	"org.blocked_desc": {
		en: "Contact AidNova to reactivate it. Your policies, courses and records stay as you left them.",
		my: "ပြန်အသုံးပြုရန် AidNova ကို ဆက်သွယ်ပါ။ သင့် Policy၊ သင်တန်းတွေနဲ့ မှတ်တမ်းတွေ ရှိမြဲအတိုင်း ရှိနေပါမယ်။",
	},
	"org.trial_ended_desc": {
		en: "Your 14-day free trial has ended. Contact AidNova to request an upgrade. Your policies, courses and records stay as you left them.",
		my: "သင်ရဲ့ ၁၄ ရက် အခမဲ့စမ်းသုံးကာလ ကုန်ဆုံးပါပြီ။ အဆင့်မြှင့်ရန် AidNova ကို ဆက်သွယ်ပါ။ သင့် Policy၊ သင်တန်းတွေနဲ့ မှတ်တမ်းတွေ ရှိမြဲအတိုင်း ရှိနေပါမယ်။",
	},
	"org.contact": { en: "Contact AidNova", my: "AidNova ကို ဆက်သွယ်ရန်" },
	"shell.language": { en: "Language", my: "ဘာသာစကား" },
	"shell.theme_dark": { en: "Use dark theme", my: "Dark mode သုံးရန်" },
	"shell.theme_light": { en: "Use light theme", my: "Light mode သုံးရန်" },
	"shell.notifications": { en: "Notifications", my: "Notifications" },
	"shell.menu": { en: "Open menu", my: "Menu ဖွင့်ရန်" },
	"shell.more": { en: "More", my: "More" },
	"shell.main_nav": { en: "Main", my: "Main menu" },
	"page.later_title": { en: "Not built yet", my: "မကြာခင် ရပါမယ်" },
	"page.later_desc": {
		en: "{page} is coming in a later v2 build stage.",
		my: "{page} ကို နောက်အဆင့်မှာ ထည့်သွင်းပါမယ်။",
	},
	"page.no_access_title": { en: "No access", my: "ဒီစာမျက်နှာကို ကြည့်ခွင့် မရှိပါ" },
	"page.no_access_desc": {
		en: "Your role in this organization doesn't include this page.",
		my: "ဒီအဖွဲ့အစည်းရှိ သင့် Role မှာ ဒီစာမျက်နှာ မပါဝင်ပါ။",
	},
	"page.not_found_title": { en: "Page not found", my: "စာမျက်နှာ ရှာမတွေ့ပါ" },
	"page.not_found_desc": {
		en: "This page doesn't exist.",
		my: "ဒီစာမျက်နှာ မရှိပါ။",
	},
	"users.subtitle": {
		en: "People in this organization.",
		my: "ဒီအဖွဲ့အစည်းရှိ လူများ။",
	},
	"users.name": { en: "Name", my: "အမည်" },
	"users.email": { en: "Email", my: "Email" },
	"users.role": { en: "Role", my: "Role" },
	"users.department": { en: "Department", my: "ဌာန" },
	"users.status": { en: "Status", my: "Status" },
	"users.owner": { en: "Owner", my: "Owner" },
	"users.active": { en: "Active", my: "Active" },
	"users.inactive": { en: "Inactive", my: "Inactive" },
	"users.only_you": {
		en: "You're the only person here so far.",
		my: "ယခုအချိန်မှာ သင်တစ်ဦးတည်းသာ ရှိပါတယ်။",
	},
	"users.role_failed": {
		en: "We couldn't change that role. Please try again.",
		my: "Role ကို ပြောင်း၍မရပါ။ ထပ်စမ်းကြည့်ပါ။",
	},
	"role.staff": { en: "Staff", my: "Staff" },
	"role.manager": { en: "Manager", my: "Manager" },
	"role.admin": { en: "Admin", my: "Admin" },
	"superadmin.title": {
		en: "Platform administration",
		my: "ပလက်ဖောင်း စီမံခန့်ခွဲမှု",
	},
	"superadmin.organizations": { en: "Organizations", my: "အဖွဲ့အစည်းများ" },
	"superadmin.users": { en: "Users", my: "User" },
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
