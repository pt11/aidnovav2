export type GuideLang = "en" | "my";

// **bold** names something on screen. [text](guide:slug) links to another guide.
export type GuideBlock =
	| { h: string }
	| { p: string }
	| { steps: string[] }
	| { ul: string[] }
	| { tip: string }
	| { shot: string; alt: string }
	| { table: { head: string[]; rows: string[][] } };

export interface Guide {
	slug: string;
	category: string;
	title: Record<GuideLang, string>;
	summary: Record<GuideLang, string>;
	body: Record<GuideLang, GuideBlock[]>;
}

export interface GuideCategory {
	key: string;
	title: Record<GuideLang, string>;
	summary: Record<GuideLang, string>;
}

export const CATEGORIES: GuideCategory[] = [
	{
		key: "getting-started",
		title: { en: "Getting started", my: "စတင်အသုံးပြုရန်" },
		summary: {
			en: "Set up your organization, bring in your team and learn your way around.",
			my: "အဖွဲ့အစည်းဖွင့်၊ ဝန်ထမ်းတွေ ထည့်ပြီး AidNova ကို စသုံးကြည့်ပါ။",
		},
	},
];

export const GUIDES: Guide[] = [
	{
		slug: "what-is-aidnova",
		category: "getting-started",
		title: { en: "What is AidNova?", my: "AidNova ဆိုတာ ဘာလဲ" },
		summary: {
			en: "What AidNova does, and what you'll find in it.",
			my: "AidNova က ဘာလုပ်ပေးလဲ၊ ထဲမှာ ဘာတွေ ရှိလဲ။",
		},
		body: {
			en: [
				{ p: "AidNova is one place for your organization's policies, staff training and shared files. It's built for NGOs and mission-driven teams, and works in English and Myanmar." },
				{ shot: "dashboard", alt: "The AidNova Dashboard, with a list of things that need attention." },
				{ h: "What's in it" },
				{ ul: [
					"**Policies:** write and publish policies, then see who has read and acknowledged them.",
					"**Courses:** build lessons and quizzes, assign them to staff and give certificates.",
					"**Files:** keep documents in folders, and choose who can open them.",
					"**Announcements and Calendar:** share news and dates with your team.",
					"**Hub:** search across your policies, courses and files in one place.",
					"**Ask AidNova:** ask a question and get an answer from your organization's own content, with links to its sources.",
				] },
				{ tip: "Ask AidNova can make mistakes, so check anything important against the source it links to." },
				{ h: "Extra modules" },
				{ p: "**Projects**, **Capacity Building** and **People & Skills** are separate modules. When they're available for your organization, an admin turns them on in **Settings**, under **Modules**. Until then, they don't appear in the menu." },
				{ h: "Where to start" },
				{ ul: [
					"Setting up for your organization? Start with [Create your organization](guide:create-your-organization).",
					"Invited by your organization? Go to [Join your organization](guide:join-your-organization).",
				] },
			],
			my: [
				{ p: "AidNova က အဖွဲ့အစည်းရဲ့ Policy တွေ၊ ဝန်ထမ်းသင်တန်းတွေနဲ့ File တွေကို တစ်နေရာတည်းမှာ စုထားပေးတာပါ။ NGO တွေနဲ့ လူမှုရေးအဖွဲ့တွေအတွက် လုပ်ထားပြီး English နဲ့ မြန်မာ နှစ်မျိုးလုံး သုံးလို့ရပါတယ်။" },
				{ shot: "dashboard", alt: "လုပ်စရာတွေ ပြထားတဲ့ AidNova Dashboard" },
				{ h: "ထဲမှာ ဘာတွေ ရှိလဲ" },
				{ ul: [
					"**Policies:** Policy ရေးပြီး Publish လုပ်ပါ။ ဘယ်သူတွေ ဖတ်ပြီး Acknowledge လုပ်ပြီးပြီလဲ ကြည့်လို့ရပါတယ်။",
					"**Courses:** Lesson နဲ့ Quiz လုပ်ပြီး ဝန်ထမ်းတွေကို Assign လုပ်ပါ။ ပြီးရင် Certificate ပေးလို့ရပါတယ်။",
					"**Files:** စာရွက်စာတမ်းတွေကို Folder နဲ့ သိမ်းပြီး ဘယ်သူဖွင့်လို့ရမလဲ ရွေးပါ။",
					"**Announcements နဲ့ Calendar:** သတင်းနဲ့ ရက်စွဲတွေကို အဖွဲ့ထဲ မျှဝေပါ။",
					"**Hub:** Policy၊ Course၊ File တွေကို တစ်နေရာတည်းကနေ ရှာပါ။",
					"**Ask AidNova:** မေးခွန်းမေးရင် အဖွဲ့အစည်းရဲ့ အချက်အလက်ထဲကနေ ဖြေပေးပြီး ရင်းမြစ် Link တွေ ပြပေးပါတယ်။",
				] },
				{ tip: "Ask AidNova က မှားနိုင်ပါတယ်။ အရေးကြီးတာတွေကို ပြထားတဲ့ ရင်းမြစ်မှာ ပြန်စစ်ပါ။" },
				{ h: "ထပ်ဖွင့်လို့ရတဲ့ Module တွေ" },
				{ p: "**Projects**၊ **Capacity Building** နဲ့ **People & Skills** က သီးခြား Module တွေပါ။ သင့်အဖွဲ့အစည်းအတွက် ရနိုင်ပြီဆိုရင် Admin က **Settings** ထဲက **Modules** မှာ ဖွင့်ပေးရပါတယ်။ မဖွင့်ရသေးရင် Menu မှာ မပေါ်ပါဘူး။" },
				{ h: "ဘယ်ကစမလဲ" },
				{ ul: [
					"အဖွဲ့အစည်းအတွက် စတင်ပြင်ဆင်မယ်ဆိုရင် [အဖွဲ့အစည်းဖွင့်ရန်](guide:create-your-organization) ကနေ စပါ။",
					"အဖွဲ့အစည်းက ဖိတ်ထားတာဆိုရင် [အဖွဲ့အစည်းထဲ ဝင်ရန်](guide:join-your-organization) ကို ကြည့်ပါ။",
				] },
			],
		},
	},
	{
		slug: "create-your-organization",
		category: "getting-started",
		title: { en: "Create your organization", my: "အဖွဲ့အစည်းဖွင့်ရန်" },
		summary: {
			en: "Make an account and start your 14-day free trial.",
			my: "အကောင့်ဖွင့်ပြီး ၁၄ ရက် အခမဲ့ Trial ကို စပါ။",
		},
		body: {
			en: [
				{ p: "This is for the person setting up AidNova for an organization. Your free trial lasts 14 days, and you don't need a card. If your organization already uses AidNova, ask for an invitation and see [Join your organization](guide:join-your-organization) instead." },
				{ h: "1. Create your account" },
				{ steps: [
					"Go to [hub.aidnova.app/sign-up](https://hub.aidnova.app/sign-up).",
					"Enter your **Full name**, **Email** and a **Password** of at least 8 characters.",
					"Select **Create account**.",
					"Open the email we send you and use the link to confirm your address.",
				] },
				{ shot: "sign-up", alt: "The Create your account form." },
				{ tip: "No email after a few minutes? Check your spam folder, or try signing in and select **Send the confirmation email again**." },
				{ h: "2. Create your organization" },
				{ steps: [
					"Enter your **Organization name**.",
					"Enter a **Workspace address**, using lowercase letters, numbers and hyphens. For example, `riverside-aid`.",
					"Select **Create Organization**.",
				] },
				{ shot: "create-organization", alt: "The Create Your Organization form, with a name and workspace address filled in." },
				{ p: "You're now the organization's admin, and your trial has started. One account can own one organization." },
				{ h: "What to do next" },
				{ p: "Your Dashboard lists what to do first under **Needs your attention**. Most people start by adding departments and inviting their team, which is covered in [Add your team](guide:add-your-team)." },
			],
			my: [
				{ p: "ဒါက အဖွဲ့အစည်းအတွက် AidNova ကို စတင်ပြင်ဆင်မယ့်သူအတွက်ပါ။ အခမဲ့ Trial က ၁၄ ရက်ရပြီး Card မလိုပါဘူး။ သင့်အဖွဲ့အစည်းက AidNova သုံးနေပြီဆိုရင် ဖိတ်စာတောင်းပြီး [အဖွဲ့အစည်းထဲ ဝင်ရန်](guide:join-your-organization) ကို ကြည့်ပါ။" },
				{ h: "၁။ အကောင့်ဖွင့်ပါ" },
				{ steps: [
					"[hub.aidnova.app/sign-up](https://hub.aidnova.app/sign-up) ကို သွားပါ။",
					"**အမည်**၊ **Email** နဲ့ အနည်းဆုံး ၈ လုံးပါတဲ့ **Password** ထည့်ပါ။",
					"**အကောင့်ဖွင့်ရန်** ကို နှိပ်ပါ။",
					"ရောက်လာတဲ့ Email ထဲက Link ကိုနှိပ်ပြီး အတည်ပြုပါ။",
				] },
				{ shot: "sign-up", alt: "အကောင့်ဖွင့်တဲ့ ဖောင်" },
				{ tip: "Email မရောက်ဘူးဆိုရင် Spam ထဲ ကြည့်ပါ။ ဒါမှမဟုတ် Sign in ဝင်ကြည့်ပြီး အတည်ပြု Email ပြန်ပို့ခိုင်းပါ။" },
				{ h: "၂။ အဖွဲ့အစည်းဖွင့်ပါ" },
				{ steps: [
					"**အဖွဲ့အစည်းအမည်** ထည့်ပါ။",
					"**Workspace လိပ်စာ** ထည့်ပါ။ English အသေး၊ ဂဏန်းနဲ့ `-` ပဲ သုံးလို့ရပါတယ်။ ဥပမာ `riverside-aid`။",
					"**အဖွဲ့အစည်း ဖွင့်ရန်** ကို နှိပ်ပါ။",
				] },
				{ shot: "create-organization", alt: "အမည်နဲ့ Workspace လိပ်စာ ဖြည့်ထားတဲ့ ဖောင်" },
				{ p: "အခု သင်က အဖွဲ့အစည်းရဲ့ Admin ဖြစ်သွားပြီး Trial စပါပြီ။ အကောင့်တစ်ခုက အဖွဲ့အစည်းတစ်ခုပဲ ပိုင်လို့ရပါတယ်။" },
				{ h: "နောက်ဘာလုပ်မလဲ" },
				{ p: "Dashboard မှာ အရင်လုပ်သင့်တာတွေကို ပြထားပါတယ်။ အများစုက ဌာနထည့်ပြီး ဝန်ထမ်းတွေ ဖိတ်ကြပါတယ်။ [ဝန်ထမ်းတွေ ထည့်ရန်](guide:add-your-team) မှာ ကြည့်ပါ။" },
			],
		},
	},
	{
		slug: "add-your-team",
		category: "getting-started",
		title: { en: "Add your team", my: "ဝန်ထမ်းတွေ ထည့်ရန်" },
		summary: {
			en: "Set up departments and invite people, one at a time or from a list.",
			my: "ဌာနတွေ ထည့်ပြီး ဝန်ထမ်းတွေကို တစ်ယောက်ချင်း ဒါမှမဟုတ် စာရင်းနဲ့ ဖိတ်ပါ။",
		},
		body: {
			en: [
				{ p: "Add your departments first, so you can put people in the right team as you invite them. Admins and managers can invite people." },
				{ h: "Add departments" },
				{ steps: [
					"Go to **Settings**, then **Departments**.",
					"Enter a name such as Programs or Finance. A description is optional.",
					"Select **Add department**.",
				] },
				{ shot: "departments", alt: "The Departments page in Settings, listing the organization's teams." },
				{ h: "Invite one person" },
				{ steps: [
					"Go to **Users** and select **Add staff**.",
					"Enter their email, then choose a role and department.",
					"Select **Send invitation**.",
				] },
				{ shot: "invite", alt: "The Invite someone to your team window on the People page." },
				{ p: "They'll get an email with a link to join, which works for 7 days. Until they accept, they appear under **Pending invitations**, where you can **Resend** or **Revoke** the invitation." },
				{ tip: "Not sure which role to choose? See [Roles: who can do what](guide:roles). Only admins can invite managers and other admins." },
				{ h: "Invite a list of people" },
				{ steps: [
					"Go to **Users** and select **Import CSV**.",
					"Choose a CSV file, or paste the list. Put one person on each line: their email, then their role and department if you like.",
					"Check the number of people, then select the button to send the invitations.",
				] },
				{ p: "You can invite up to 100 people at a time. Anyone without a role in the list joins as Staff. If any invitations fail, AidNova lists which ones so you can try them again." },
				{ table: { head: ["Line in your list", "What it does"], rows: [
					["`aye.aye@example.org`", "Invites them as Staff, with no department"],
					["`ko.min@example.org, manager`", "Invites them as a Manager"],
					["`nilar@example.org, staff, Programs`", "Invites them as Staff in Programs"],
				] } },
			],
			my: [
				{ p: "ဖိတ်တဲ့အခါ မှန်ကန်တဲ့အဖွဲ့ထဲ ထည့်လို့ရအောင် ဌာနတွေကို အရင်ထည့်ပါ။ Admin နဲ့ Manager တွေ ဖိတ်လို့ရပါတယ်။" },
				{ h: "ဌာန ထည့်ရန်" },
				{ steps: [
					"**Settings** ထဲက **Departments** ကို သွားပါ။",
					"Programs ဒါမှမဟုတ် Finance လို အမည်ထည့်ပါ။ ဖော်ပြချက်က မထည့်လည်းရပါတယ်။",
					"**ဌာန ထည့်ရန်** ကို နှိပ်ပါ။",
				] },
				{ shot: "departments", alt: "Settings ထဲက ဌာနစာရင်း" },
				{ h: "တစ်ယောက် ဖိတ်ရန်" },
				{ steps: [
					"**Users** ကို သွားပြီး **ဝန်ထမ်းထည့်ရန်** ကို နှိပ်ပါ။",
					"သူ့ Email ထည့်ပြီး Role နဲ့ ဌာန ရွေးပါ။",
					"**ဖိတ်စာပို့ရန်** ကို နှိပ်ပါ။",
				] },
				{ shot: "invite", alt: "People စာမျက်နှာက ဖိတ်စာပို့တဲ့ Window" },
				{ p: "သူ့ဆီ Email နဲ့ Link ရောက်သွားပါမယ်။ Link က ၇ ရက် အသုံးပြုလို့ရပါတယ်။ လက်မခံရသေးရင် **ဖိတ်ထားသူများ** မှာ ပေါ်ပြီး **ပြန်ပို့ရန်** ဒါမှမဟုတ် **ဖိတ်စာ ပယ်ရန်** လုပ်လို့ရပါတယ်။" },
				{ tip: "ဘယ် Role ရွေးရမလဲ မသေချာရင် [Role တွေ ဘာလုပ်လို့ရလဲ](guide:roles) ကို ကြည့်ပါ။ Manager နဲ့ Admin ကို Admin ပဲ ဖိတ်လို့ရပါတယ်။" },
				{ h: "စာရင်းနဲ့ ဖိတ်ရန်" },
				{ steps: [
					"**Users** ကို သွားပြီး **CSV တင်ရန်** ကို နှိပ်ပါ။",
					"CSV File ရွေးပါ၊ ဒါမှမဟုတ် စာရင်းကို Paste လုပ်ပါ။ တစ်ကြောင်းမှာ တစ်ယောက်၊ Email ရေးပြီး လိုရင် Role နဲ့ ဌာန ထည့်ပါ။",
					"အရေအတွက် စစ်ပြီး ပို့ရန် ခလုတ်ကို နှိပ်ပါ။",
				] },
				{ p: "တစ်ခါမှာ ၁၀၀ ထိ ဖိတ်လို့ရပါတယ်။ Role မထည့်ရင် Staff အဖြစ် ဝင်ပါမယ်။ မအောင်မြင်တဲ့ ဖိတ်စာရှိရင် ပြန်ကြိုးစားလို့ရအောင် စာရင်းပြပေးပါတယ်။" },
				{ table: { head: ["စာရင်းထဲက စာကြောင်း", "ရလဒ်"], rows: [
					["`aye.aye@example.org`", "Staff အဖြစ် ဖိတ်ပါတယ်၊ ဌာနမပါပါ"],
					["`ko.min@example.org, manager`", "Manager အဖြစ် ဖိတ်ပါတယ်"],
					["`nilar@example.org, staff, Programs`", "Programs ထဲက Staff အဖြစ် ဖိတ်ပါတယ်"],
				] } },
			],
		},
	},
	{
		slug: "roles",
		category: "getting-started",
		title: { en: "Roles: who can do what", my: "Role တွေ ဘာလုပ်လို့ရလဲ" },
		summary: {
			en: "The difference between Staff, Manager and Admin.",
			my: "Staff၊ Manager နဲ့ Admin ဘာကွာလဲ။",
		},
		body: {
			en: [
				{ p: "Everyone in your organization has one of three roles. Choose the lowest role that lets someone do their work." },
				{ table: { head: ["What they can do", "Staff", "Manager", "Admin"], rows: [
					["Read and acknowledge policies, and take courses", "Yes", "Yes", "Yes"],
					["Open files, announcements and the calendar", "Yes", "Yes", "Yes"],
					["Use Hub search and Ask AidNova", "Yes", "Yes", "Yes"],
					["Create policies, courses, announcements and events", "No", "Yes", "Yes"],
					["Upload and organize files", "No", "Yes", "Yes"],
					["See reports", "No", "Yes", "Yes"],
					["Invite staff", "No", "Yes", "Yes"],
					["Invite managers and admins", "No", "No", "Yes"],
					["Change someone's role", "No", "No", "Yes"],
					["Turn modules on or off", "No", "No", "Yes"],
				] } },
				{ tip: "Each person still sees only what they're allowed to. A policy or file limited to one department stays hidden from people in other departments." },
				{ h: "Change someone's role" },
				{ steps: [
					"Go to **Users** and find the person.",
					"Open the actions menu on their row and select **Change role**.",
					"Choose the new role.",
				] },
				{ p: "You need to be an admin to do this." },
			],
			my: [
				{ p: "အဖွဲ့အစည်းထဲက လူတိုင်းမှာ Role သုံးမျိုးထဲက တစ်ခု ရှိပါတယ်။ အလုပ်လုပ်ဖို့ လုံလောက်တဲ့ အနိမ့်ဆုံး Role ကို ရွေးပါ။" },
				{ table: { head: ["လုပ်လို့ရတာ", "Staff", "Manager", "Admin"], rows: [
					["Policy ဖတ်ပြီး Acknowledge လုပ်တာ၊ Course တက်တာ", "ရ", "ရ", "ရ"],
					["File၊ Announcement၊ Calendar ကြည့်တာ", "ရ", "ရ", "ရ"],
					["Hub မှာ ရှာတာ၊ Ask AidNova သုံးတာ", "ရ", "ရ", "ရ"],
					["Policy၊ Course၊ Announcement၊ Event ဖန်တီးတာ", "မရ", "ရ", "ရ"],
					["File တင်ပြီး စီမံတာ", "မရ", "ရ", "ရ"],
					["Report ကြည့်တာ", "မရ", "ရ", "ရ"],
					["Staff ဖိတ်တာ", "မရ", "ရ", "ရ"],
					["Manager နဲ့ Admin ဖိတ်တာ", "မရ", "မရ", "ရ"],
					["Role ပြောင်းတာ", "မရ", "မရ", "ရ"],
					["Module ဖွင့်တာ၊ ပိတ်တာ", "မရ", "မရ", "ရ"],
				] } },
				{ tip: "လူတိုင်းက ကြည့်ခွင့်ရှိတာကိုပဲ မြင်ရပါတယ်။ ဌာနတစ်ခုအတွက်ပဲ ပေးထားတဲ့ Policy ဒါမှမဟုတ် File ကို တခြားဌာနက မမြင်ရပါဘူး။" },
				{ h: "Role ပြောင်းရန်" },
				{ steps: [
					"**Users** ကို သွားပြီး အဲဒီလူကို ရှာပါ။",
					"သူ့အတန်းက Actions Menu ကိုဖွင့်ပြီး **Role ပြောင်းရန်** ကို ရွေးပါ။",
					"Role အသစ် ရွေးပါ။",
				] },
				{ p: "ဒါကို Admin ပဲ လုပ်လို့ရပါတယ်။" },
			],
		},
	},
	{
		slug: "join-your-organization",
		category: "getting-started",
		title: { en: "Join your organization", my: "အဖွဲ့အစည်းထဲ ဝင်ရန်" },
		summary: {
			en: "Got an invitation by email? Here's how to accept it.",
			my: "Email နဲ့ ဖိတ်စာရထားရင် ဒီလိုလက်ခံပါ။",
		},
		body: {
			en: [
				{ p: "When your organization invites you, you'll get an email from AidNova with a link. The link works for 7 days." },
				{ steps: [
					"Open the email and select the link.",
					"Select **Create an account**, or **I already have an account** if you have one.",
					"Use the same email address the invitation was sent to.",
					"Select **Accept invitation**.",
				] },
				{ shot: "join", alt: "The invitation page, with buttons to create an account or sign in." },
				{ h: "If something goes wrong" },
				{ ul: [
					"**The link has expired:** ask your admin or manager to send it again.",
					"**It says the invitation is for a different email:** sign out, then open the link again and use the invited address.",
					"**You can't find the email:** check your spam folder, or ask them to resend it.",
				] },
				{ tip: "To read AidNova in Myanmar, use the language switch at the top of the page." },
			],
			my: [
				{ p: "အဖွဲ့အစည်းက ဖိတ်ရင် AidNova ဆီက Email နဲ့ Link ရောက်လာပါမယ်။ Link က ၇ ရက် အသုံးပြုလို့ရပါတယ်။" },
				{ steps: [
					"Email ကိုဖွင့်ပြီး Link ကို နှိပ်ပါ။",
					"**အကောင့်ဖွင့်ရန်** ကို နှိပ်ပါ။ အကောင့်ရှိပြီးသားဆိုရင် **အကောင့် ရှိပြီးသားပါ** ကို နှိပ်ပါ။",
					"ဖိတ်စာရောက်တဲ့ Email အတိုင်း သုံးပါ။",
					"**ဖိတ်စာကို လက်ခံရန်** ကို နှိပ်ပါ။",
				] },
				{ shot: "join", alt: "အကောင့်ဖွင့်ရန်နဲ့ အကောင့်ဝင်ရန် ခလုတ်တွေပါတဲ့ ဖိတ်စာစာမျက်နှာ" },
				{ h: "အဆင်မပြေရင်" },
				{ ul: [
					"**Link သက်တမ်းကုန်သွားရင်:** Admin ဒါမှမဟုတ် Manager ကို ပြန်ပို့ခိုင်းပါ။",
					"**ဖိတ်စာက တခြား Email အတွက်လို့ ပြရင်:** အကောင့်ထွက်ပြီး Link ကို ပြန်ဖွင့်ပါ။ ဖိတ်ထားတဲ့ Email ကို သုံးပါ။",
					"**Email ရှာမတွေ့ရင်:** Spam ထဲ ကြည့်ပါ။ ဒါမှမဟုတ် ပြန်ပို့ခိုင်းပါ။",
				] },
				{ tip: "AidNova ကို မြန်မာလို ဖတ်ချင်ရင် စာမျက်နှာအပေါ်က ဘာသာစကားခလုတ်ကို သုံးပါ။" },
			],
		},
	},
	{
		slug: "install-the-app",
		category: "getting-started",
		title: { en: "Install AidNova on your phone or computer", my: "ဖုန်း၊ ကွန်ပျူတာမှာ AidNova ထည့်ရန်" },
		summary: {
			en: "Add AidNova to your home screen and open it like an app.",
			my: "Home Screen မှာ ထည့်ပြီး App လို ဖွင့်ပါ။",
		},
		body: {
			en: [
				{ p: "You don't need an app store. AidNova installs from your browser, then opens from your home screen or desktop like any other app." },
				{ h: "iPhone or iPad" },
				{ steps: [
					"Open [hub.aidnova.app](https://hub.aidnova.app) in **Safari** and sign in.",
					"Tap **Share**.",
					"Tap **Add to Home Screen**.",
				] },
				{ h: "Android or computer" },
				{ steps: [
					"Open [hub.aidnova.app](https://hub.aidnova.app) in your browser and sign in.",
					"Go to **My profile**, then **Account & security**.",
					"Under **Install the app**, select **Install**.",
				] },
				{ tip: "Don't see **Install the app**? Your browser may not support installing, or AidNova may already be installed. You can keep using it in the browser, and everything works the same." },
			],
			my: [
				{ p: "App Store မလိုပါဘူး။ Browser ကနေ ထည့်ပြီး Home Screen ဒါမှမဟုတ် Desktop ကနေ App လို ဖွင့်လို့ရပါတယ်။" },
				{ h: "iPhone ဒါမှမဟုတ် iPad" },
				{ steps: [
					"**Safari** မှာ [hub.aidnova.app](https://hub.aidnova.app) ကိုဖွင့်ပြီး အကောင့်ဝင်ပါ။",
					"**Share** ကို နှိပ်ပါ။",
					"**Add to Home Screen** ကို နှိပ်ပါ။",
				] },
				{ h: "Android ဒါမှမဟုတ် ကွန်ပျူတာ" },
				{ steps: [
					"Browser မှာ [hub.aidnova.app](https://hub.aidnova.app) ကိုဖွင့်ပြီး အကောင့်ဝင်ပါ။",
					"**My profile** ထဲက **Account & security** ကို သွားပါ။",
					"**App ထည့်ရန်** အောက်က **Install လုပ်ရန်** ကို နှိပ်ပါ။",
				] },
				{ tip: "**App ထည့်ရန်** မတွေ့ရင် Browser က မပံ့ပိုးတာ ဒါမှမဟုတ် ထည့်ပြီးသား ဖြစ်နိုင်ပါတယ်။ Browser မှာပဲ ဆက်သုံးလည်း အတူတူပါပဲ။" },
			],
		},
	},
];

export const guidesHome = (lang: GuideLang) => (lang === "my" ? "/my/guides" : "/guides");
export const guidePath = (guide: Guide, lang: GuideLang) => `${guidesHome(lang)}/${guide.category}/${guide.slug}`;

// A guide's words without its markup, for search and for Ask AidNova.
export function guidePlainText(blocks: GuideBlock[]) {
	const strip = (text: string) => text.replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
	return blocks
		.flatMap((block) => {
			if ("h" in block) return [`\n${block.h}`];
			if ("p" in block) return [block.p];
			if ("tip" in block) return [block.tip];
			if ("steps" in block) return block.steps.map((step, index) => `${index + 1}. ${step}`);
			if ("ul" in block) return block.ul.map((item) => `- ${item}`);
			if ("table" in block) return [block.table.head, ...block.table.rows].map((row) => row.join(" | "));
			return [];
		})
		.map(strip)
		.join("\n")
		.trim();
}
