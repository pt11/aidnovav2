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
	{
		key: "policies",
		title: { en: "Policies", my: "Policies" },
		summary: {
			en: "Write policies and see who has read them.",
			my: "Policy ရေးပြီး ဘယ်သူဖတ်ပြီးလဲ ကြည့်ပါ။",
		},
	},
	{
		key: "courses",
		title: { en: "Courses", my: "Courses" },
		summary: {
			en: "Build training, and take it.",
			my: "သင်တန်းလုပ်ပြီး တက်ပါ။",
		},
	},
	{
		key: "everyday",
		title: { en: "Everyday tools", my: "နေ့စဉ်သုံးတာတွေ" },
		summary: {
			en: "Files, news, the calendar, Ask AidNova and notifications.",
			my: "File၊ သတင်း၊ Calendar၊ Ask AidNova နဲ့ Notification။",
		},
	},
	{
		key: "capacity",
		title: { en: "Capacity Building and People & Skills", my: "Capacity Building နဲ့ People & Skills" },
		summary: {
			en: "Report training, review it, and share your skills.",
			my: "သင်တန်း Report တင်၊ စစ်ပြီး ကျွမ်းကျင်မှု မျှဝေပါ။",
		},
	},
	{
		key: "projects",
		title: { en: "Projects", my: "Projects" },
		summary: {
			en: "Plan projects and collect their reports.",
			my: "Project စီစဉ်ပြီး Report တွေ စုပါ။",
		},
	},
	{
		key: "admin",
		title: { en: "Admin and account", my: "Admin နဲ့ အကောင့်" },
		summary: {
			en: "Reports, your plan and settings.",
			my: "Report၊ Plan နဲ့ Settings။",
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
	{
		slug: "publish-a-policy",
		category: "policies",
		title: { en: "Write and publish a policy", my: "Policy ရေးပြီး Publish လုပ်ရန်" },
		summary: { en: "Create a policy, choose who it's for, and see who has acknowledged it.", my: "Policy ရေးပါ၊ ဘယ်သူ့အတွက်လဲ ရွေးပါ၊ ဘယ်သူတွေ Acknowledge လုပ်ပြီးပြီလဲ ကြည့်ပါ။" },
		body: {
			en: [
				{ p: "Admins and managers can write policies. Staff only see a policy once it's published." },
				{ h: "Write it" },
				{ steps: ["Go to **Policies** and select **New policy**.", "Add a **Title** and **Category**, and type the **Content**. You can also attach one file or link.", "Under **Who it's for**, tick **Staff must acknowledge it** if everyone has to confirm they've read it.", "Leave **All departments** selected, or choose **Only some departments**.", "Select **Save draft** to finish later, or **Publish**."] },
				{ shot: "policy-editor", alt: "The policy editor, with a title, content and the Who it's for options." },
				{ h: "See who has acknowledged it" },
				{ p: "Open the policy and go to **Compliance**. It lists who has acknowledged it and who hasn't. Select **Remind** for one person, or **Remind everyone pending**." },
				{ h: "Change it later" },
				{ p: "If you change a published policy's wording, it becomes a new version and people have to acknowledge it again. Everyone it applies to gets a notification." },
			],
			my: [
				{ p: "Admin နဲ့ Manager တွေ Policy ရေးလို့ရပါတယ်။ Publish လုပ်ပြီးမှ Staff တွေ မြင်ရပါတယ်။" },
				{ h: "ရေးရန်" },
				{ steps: ["**Policies** ကိုသွားပြီး **Policy အသစ်** ကို နှိပ်ပါ။", "ခေါင်းစဉ်၊ အမျိုးအစား ထည့်ပြီး အကြောင်းအရာ ရေးပါ။ ဖိုင် ဒါမှမဟုတ် Link တစ်ခုလည်း တွဲလို့ရပါတယ်။", "လူတိုင်း ဖတ်ပြီးကြောင်း အတည်ပြုရမယ်ဆိုရင် Staff must acknowledge it ကို အမှန်ခြစ်ပါ။", "ဌာနအားလုံး ထားပါ၊ ဒါမှမဟုတ် ဌာနတချို့ကို ရွေးပါ။", "နောက်မှ ဆက်ရေးမယ်ဆိုရင် Draft သိမ်းပါ၊ ပြီးရင် **Publish လုပ်ရန်** ကို နှိပ်ပါ။"] },
				{ shot: "policy-editor", alt: "ခေါင်းစဉ်၊ အကြောင်းအရာနဲ့ ဘယ်သူ့အတွက်လဲ ရွေးတဲ့ Policy စာမျက်နှာ" },
				{ h: "ဘယ်သူတွေ အတည်ပြုပြီးပြီလဲ ကြည့်ရန်" },
				{ p: "Policy ကိုဖွင့်ပြီး **Compliance** ကို သွားပါ။ ဖတ်ပြီးသူနဲ့ မဖတ်ရသေးသူ စာရင်း ပြပါတယ်။ တစ်ယောက်ချင်း **သတိပေးရန်** ဒါမှမဟုတ် **မဖတ်ရသေးသူအားလုံး သတိပေးရန်** ကို နှိပ်ပါ။" },
				{ h: "နောက်မှ ပြင်ရင်" },
				{ p: "Publish လုပ်ပြီးသား Policy ရဲ့ စာသားကို ပြင်ရင် ဗားရှင်းအသစ်ဖြစ်ပြီး ပြန်အတည်ပြုရပါမယ်။ သက်ဆိုင်သူတွေဆီ Notification ရောက်ပါမယ်။" },
			],
		},
	},
	{
		slug: "acknowledge-a-policy",
		category: "policies",
		title: { en: "Read and acknowledge a policy", my: "Policy ဖတ်ပြီး အတည်ပြုရန်" },
		summary: { en: "How staff confirm they've read a mandatory policy.", my: "မဖြစ်မနေဖတ်ရမယ့် Policy ကို ဖတ်ပြီးကြောင်း ဘယ်လိုအတည်ပြုမလဲ။" },
		body: {
			en: [
				{ p: "When a policy needs your confirmation, it appears in **Your to-do** on the Dashboard and in your notifications." },
				{ steps: ["Open the policy from **Your to-do**, or from **Policies**.", "Read it to the end.", "Tick the box to confirm you've read it.", "Select **Acknowledge policy**."] },
				{ shot: "policy-read", alt: "A policy open for reading, with its acknowledgment at the end." },
				{ p: "It then leaves your to-do list. If the policy's wording changes later, you'll be asked to read the new version." },
			],
			my: [
				{ p: "Policy က အတည်ပြုဖို့ လိုရင် Dashboard ရဲ့ လုပ်ရန်စာရင်းနဲ့ Notification မှာ ပေါ်ပါတယ်။" },
				{ steps: ["လုပ်ရန်စာရင်း ဒါမှမဟုတ် **Policies** ကနေ ဖွင့်ပါ။", "အဆုံးထိ ဖတ်ပါ။", "ဖတ်ပြီးကြောင်း အကွက်ကို အမှန်ခြစ်ပါ။", "ဖတ်ပြီးကြောင်း အတည်ပြုရန် ခလုတ်ကို နှိပ်ပါ။"] },
				{ shot: "policy-read", alt: "ဖတ်ဖို့ဖွင့်ထားတဲ့ Policy" },
				{ p: "ပြီးရင် လုပ်ရန်စာရင်းက ပျောက်သွားပါမယ်။ နောက်မှ စာသားပြောင်းရင် ဗားရှင်းအသစ်ကို ပြန်ဖတ်ခိုင်းပါမယ်။" },
			],
		},
	},
	{
		slug: "build-a-course",
		category: "courses",
		title: { en: "Build and assign a course", my: "Course လုပ်ပြီး ဝန်ထမ်းတွေကို ပေးရန်" },
		summary: { en: "Add lessons and a quiz, publish, then assign it to staff.", my: "သင်ခန်းစာနဲ့ Quiz ထည့်၊ Publish လုပ်ပြီး ဝန်ထမ်းတွေကို ပေးပါ။" },
		body: {
			en: [
				{ steps: ["Go to **Courses** and select **New course**.", "Give it a name. Tick **Mandatory for all staff** if everyone has to take it.", "Select **Create course**.", "Select **Add lesson** and add your content. You need at least one lesson with content before you can publish.", "To test people at the end, add a **Final quiz**.", "Select **Publish**.", "Select **Assign to staff** and choose who should take it."] },
				{ shot: "courses", alt: "The Courses page." },
				{ p: "People you assign get a notification. To check progress, open the course and view its learners." },
			],
			my: [
				{ steps: ["**Courses** ကိုသွားပြီး **သင်တန်းအသစ်** ကို နှိပ်ပါ။", "အမည်ပေးပါ။ လူတိုင်းတက်ရမယ်ဆိုရင် **ဝန်ထမ်းအားလုံး မဖြစ်မနေ တက်ရပါမယ်** ကို အမှန်ခြစ်ပါ။", "**သင်တန်းဖွင့်ရန်** ကို နှိပ်ပါ။", "**သင်ခန်းစာထည့်ရန်** ကိုနှိပ်ပြီး အကြောင်းအရာ ထည့်ပါ။ Publish မလုပ်ခင် သင်ခန်းစာ အနည်းဆုံး တစ်ခု လိုပါတယ်။", "အဆုံးမှာ စစ်ချင်ရင် **နောက်ဆုံး Quiz** ထည့်ပါ။", "**Publish လုပ်ရန်** ကို နှိပ်ပါ။", "**ဝန်ထမ်းတွေကို ပေးရန်** ကိုနှိပ်ပြီး လူရွေးပါ။"] },
				{ shot: "courses", alt: "Courses စာမျက်နှာ" },
				{ p: "ပေးလိုက်တဲ့သူတွေဆီ Notification ရောက်ပါမယ်။ တိုးတက်မှုကို Course ထဲမှာ ကြည့်လို့ရပါတယ်။" },
			],
		},
	},
	{
		slug: "take-a-course",
		category: "courses",
		title: { en: "Take a course and get your certificate", my: "Course တက်ပြီး Certificate ရယူရန်" },
		summary: { en: "Work through the lessons and find your certificate.", my: "သင်ခန်းစာတွေ တက်ပြီး Certificate ကို ရှာပါ။" },
		body: {
			en: [
				{ steps: ["Go to **Courses**, or open it from **Your to-do**.", "Open the course and work through each lesson.", "If it has a final quiz, take it at the end.", "When you finish, select **View certificate** if the course gives one."] },
				{ p: "Your progress saves as you go, so you can stop and come back on your phone or computer." },
			],
			my: [
				{ steps: ["**Courses** ကို သွားပါ၊ ဒါမှမဟုတ် လုပ်ရန်စာရင်းကနေ ဖွင့်ပါ။", "Course ကိုဖွင့်ပြီး သင်ခန်းစာတစ်ခုချင်း တက်ပါ။", "နောက်ဆုံး Quiz ရှိရင် အဆုံးမှာ ဖြေပါ။", "ပြီးရင် Certificate ပါတဲ့ Course ဆိုရင် **Certificate ကြည့်ရန်** ကို နှိပ်ပါ။"] },
				{ p: "တက်ထားတာတွေ အလိုအလျောက် သိမ်းပါတယ်။ ရပ်ထားပြီး ဖုန်း ဒါမှမဟုတ် ကွန်ပျူတာကနေ ပြန်ဆက်လို့ရပါတယ်။" },
			],
		},
	},
	{
		slug: "files-and-folders",
		category: "everyday",
		title: { en: "Share files and folders", my: "File နဲ့ Folder မျှဝေရန်" },
		summary: { en: "Upload files, add links, and choose who can see them.", my: "File တင်၊ Link ထည့်ပြီး ဘယ်သူကြည့်လို့ရမလဲ ရွေးပါ။" },
		body: {
			en: [
				{ p: "Everyone can open the files they're allowed to see. Admins and managers can add and organize them." },
				{ steps: ["Go to **Files**.", "To group files, select **New folder**. Under **Who can see this**, leave everything unticked to include everyone, or tick departments.", "Select **Add files or links**. You can add up to 20 files at a time, at 50 MB each.", "For extra protection, a folder can have a PIN. Share the PIN separately with the people who need it."] },
				{ shot: "files", alt: "The Files page with folders." },
			],
			my: [
				{ p: "ကြည့်ခွင့်ရှိတဲ့ File တွေကို လူတိုင်း ဖွင့်လို့ရပါတယ်။ Admin နဲ့ Manager တွေ ထည့်ပြီး စီမံလို့ရပါတယ်။" },
				{ steps: ["**Files** ကို သွားပါ။", "စုထားချင်ရင် **Folder အသစ်** ကို နှိပ်ပါ။ လူတိုင်းအတွက်ဆိုရင် ဘာမှမခြစ်ပါနဲ့၊ ဒါမှမဟုတ် ဌာနတွေ ရွေးပါ။", "**ဖိုင် ဒါမှမဟုတ် Link ထည့်ရန်** ကို နှိပ်ပါ။ တစ်ခါမှာ ဖိုင် ၂၀ အထိ၊ တစ်ခုကို 50 MB အထိ ရပါတယ်။", "ပိုလုံခြုံချင်ရင် Folder မှာ PIN ထားလို့ရပါတယ်။ လိုအပ်သူတွေကို သီးခြား ပြောပြပါ။"] },
				{ shot: "files", alt: "Folder တွေပါတဲ့ Files စာမျက်နှာ" },
			],
		},
	},
	{
		slug: "announcements-and-calendar",
		category: "everyday",
		title: { en: "Announcements and the calendar", my: "Announcement နဲ့ Calendar" },
		summary: { en: "Share news and dates with your team.", my: "သတင်းနဲ့ ရက်စွဲတွေကို အဖွဲ့ထဲ မျှဝေပါ။" },
		body: {
			en: [
				{ p: "Admins and managers can post these. Everyone in your organization can read them and gets a notification, unless an admin has turned that off." },
				{ h: "Post an announcement" },
				{ steps: ["Go to **Announcements**.", "Add a title and message.", "Choose a priority. Urgent announcements stay pinned at the top.", "Select **Post announcement**."] },
				{ h: "Add an event" },
				{ steps: ["Go to **Calendar** and select **New event**.", "Add the title and time, and save.", "Anyone can select **Add to my calendar** to copy it to their own calendar."] },
			],
			my: [
				{ p: "Admin နဲ့ Manager တွေ တင်လို့ရပါတယ်။ အဖွဲ့ထဲက လူတိုင်း ဖတ်လို့ရပြီး Admin မပိတ်ထားရင် Notification ရပါတယ်။" },
				{ h: "Announcement တင်ရန်" },
				{ steps: ["**Announcements** ကို သွားပါ။", "ခေါင်းစဉ်နဲ့ စာ ထည့်ပါ။", "Priority ရွေးပါ။ Urgent က အပေါ်ဆုံးမှာ ရှိနေပါမယ်။", "Post announcement ကို နှိပ်ပါ။"] },
				{ h: "Event ထည့်ရန်" },
				{ steps: ["**Calendar** ကိုသွားပြီး **Event အသစ်** ကို နှိပ်ပါ။", "ခေါင်းစဉ်နဲ့ အချိန်ထည့်ပြီး သိမ်းပါ။", "**ကိုယ့် Calendar ထဲ ထည့်ရန်** ကိုနှိပ်ပြီး ကိုယ့် Calendar ထဲ ကူးလို့ရပါတယ်။"] },
			],
		},
	},
	{
		slug: "ask-aidnova",
		category: "everyday",
		title: { en: "Ask AidNova", my: "Ask AidNova သုံးရန်" },
		summary: { en: "Ask a question and get an answer from your organization's content.", my: "မေးခွန်းမေးရင် အဖွဲ့အစည်းရဲ့ အချက်အလက်ကနေ ဖြေပေးပါတယ်။" },
		body: {
			en: [
				{ steps: ["Select **Ask AidNova** at the top of the page.", "Type your question in English or Myanmar.", "Read the answer, and open its source link to check anything important."] },
				{ ul: ["It only uses what you're allowed to open: your policies, file names and announcements, plus these guides.", "If it can't find an answer, it says so and suggests asking a manager.", "Training records aren't used."] },
				{ tip: "It can make mistakes, especially with long policies. Check important answers against the source." },
				{ p: "An admin can turn Ask AidNova off in **Settings**, under **Integrations**." },
			],
			my: [
				{ steps: ["စာမျက်နှာအပေါ်က **AidNova ကို မေးရန်** ကို နှိပ်ပါ။", "English ဒါမှမဟုတ် မြန်မာလို မေးပါ။", "အဖြေကိုဖတ်ပြီး အရေးကြီးတာတွေကို ရင်းမြစ် Link မှာ စစ်ပါ။"] },
				{ ul: ["ကြည့်ခွင့်ရှိတာတွေကိုပဲ သုံးပါတယ် - Policy၊ File အမည်၊ Announcement နဲ့ ဒီလမ်းညွှန်တွေ။", "အဖြေမတွေ့ရင် မတွေ့ကြောင်း ပြောပြီး Manager ကို မေးခိုင်းပါတယ်။", "သင်တန်းမှတ်တမ်းတွေ မသုံးပါဘူး။"] },
				{ tip: "မှားနိုင်ပါတယ်၊ အထူးသဖြင့် Policy ရှည်ရင်ပါ။ အရေးကြီးတာတွေကို ရင်းမြစ်မှာ ပြန်စစ်ပါ။" },
				{ p: "Admin က **Settings** ထဲက **Integrations** မှာ ပိတ်လို့ရပါတယ်။" },
			],
		},
	},
	{
		slug: "notifications",
		category: "everyday",
		title: { en: "Notifications", my: "Notifications" },
		summary: { en: "See what's new, and choose what your organization is told about.", my: "အသစ်တွေကြည့်ပြီး ဘာတွေ အကြောင်းကြားမလဲ ရွေးပါ။" },
		body: {
			en: [
				{ p: "The bell at the top shows how many notifications you haven't read. Select it to see the latest, or **View all notifications** for the last 90 days." },
				{ shot: "notifications", alt: "The Notifications page, with unread items highlighted." },
				{ h: "For admins" },
				{ p: "Go to **Settings**, then **Notifications**, to choose whether people are told about mandatory policies, course assignments, announcements, new events and new joiners. Each switch saves straight away. Decisions on someone's own work always arrive." },
			],
			my: [
				{ p: "အပေါ်က ခေါင်းလောင်းက မဖတ်ရသေးတဲ့ အရေအတွက် ပြပါတယ်။ နှိပ်ပြီး နောက်ဆုံးတွေကြည့်ပါ၊ ဒါမှမဟုတ် **Notifications အားလုံး ကြည့်ရန်** မှာ ရက် ၉၀ စာ ကြည့်ပါ။" },
				{ shot: "notifications", alt: "မဖတ်ရသေးတာတွေ အရောင်ပြထားတဲ့ Notifications စာမျက်နှာ" },
				{ h: "Admin တွေအတွက်" },
				{ p: "**Settings** ထဲက **Notifications** မှာ Policy၊ Course၊ Announcement၊ Event နဲ့ လူသစ်အကြောင်း အကြောင်းကြားမလား ရွေးပါ။ နှိပ်တာနဲ့ သိမ်းပါတယ်။ ကိုယ့်အလုပ်အတွက် ဆုံးဖြတ်ချက်တွေက အမြဲရောက်ပါတယ်။" },
			],
		},
	},
	{
		slug: "report-training",
		category: "capacity",
		title: { en: "Report your training", my: "သင်တန်း Report တင်ရန်" },
		summary: { en: "Record a workshop or course, and send it for review.", my: "Workshop ဒါမှမဟုတ် သင်တန်းကို မှတ်တမ်းတင်ပြီး စစ်ဖို့ ပို့ပါ။" },
		body: {
			en: [
				{ p: "Capacity Building is a separate module that an admin turns on." },
				{ steps: ["Go to **Capacity Building**, then **Submit training**.", "Fill in what it was, when, and where you are with it. It takes about 3 minutes, and you can select **Save draft** at any time.", "Add evidence such as a certificate if you have it.", "Select **Submit for review**."] },
				{ shot: "training-form", alt: "The Report training form." },
				{ p: "Your reviewer decides, and you get a notification. If they ask for changes, it appears in **Your to-do**. Only verified training counts in official totals." },
				{ tip: "Your details are seen only by you and your reviewer. Sensitive categories such as safeguarding appear to others only as Restricted, and nothing is shared with colleagues." },
			],
			my: [
				{ p: "Capacity Building က Admin ဖွင့်ပေးရတဲ့ သီးခြား Module ပါ။" },
				{ steps: ["**Capacity Building** ထဲက **Submit training** ကို သွားပါ။", "ဘာသင်တန်းလဲ၊ ဘယ်အချိန်လဲ၊ ဘယ်အဆင့်ရောက်ပြီလဲ ဖြည့်ပါ။ ၃ မိနစ်လောက် ကြာပါတယ်၊ Draft သိမ်းထားလို့ရပါတယ်။", "Certificate လို အထောက်အထား ရှိရင် ထည့်ပါ။", "စစ်ဖို့ ပို့ရန် ခလုတ်ကို နှိပ်ပါ။"] },
				{ shot: "training-form", alt: "သင်တန်း Report တင်တဲ့ ဖောင်" },
				{ p: "Reviewer ဆုံးဖြတ်ပြီး Notification ရောက်ပါမယ်။ ပြင်ခိုင်းရင် လုပ်ရန်စာရင်းမှာ ပေါ်ပါမယ်။ Verified ဖြစ်တာတွေပဲ တရားဝင် ရေတွက်ပါတယ်။" },
				{ tip: "အသေးစိတ်ကို သင်နဲ့ Reviewer ပဲ မြင်ရပါတယ်။ Safeguarding လို Sensitive အမျိုးအစားတွေကို တခြားသူတွေ Restricted လို့ပဲ မြင်ရပြီး လုပ်ဖော်ကိုင်ဖက်တွေကို မမျှဝေပါဘူး။" },
			],
		},
	},
	{
		slug: "review-training",
		category: "capacity",
		title: { en: "Review your team's training", my: "အဖွဲ့ရဲ့ သင်တန်းတွေ စစ်ရန်" },
		summary: { en: "Verify reports, ask for changes, and see your team's picture.", my: "Report တွေ Verify လုပ်၊ ပြင်ခိုင်းပြီး အဖွဲ့ရဲ့ အခြေအနေ ကြည့်ပါ။" },
		body: {
			en: [
				{ p: "An admin chooses who reviews each department, in **Capacity Building**, under **Module settings**." },
				{ steps: ["Go to **Capacity Building**, then **Reviews**. It also shows in your to-do list.", "Choose a report and check its dates and evidence.", "Verify it, ask for changes, or decline it. Changes and declines need a reason, which the person sees."] },
				{ shot: "reviews", alt: "The Reviews queue." },
				{ p: "**Team overview** shows your team's training by category. Groups of fewer than 3 people are hidden so nobody can be identified, and opening a sensitive record is logged." },
			],
			my: [
				{ p: "Admin က **Capacity Building** ထဲက **Module settings** မှာ ဌာနတစ်ခုချင်းရဲ့ Reviewer ကို ရွေးပါတယ်။" },
				{ steps: ["**Capacity Building** ထဲက **Reviews** ကို သွားပါ။ လုပ်ရန်စာရင်းမှာလည်း ပေါ်ပါတယ်။", "Report ရွေးပြီး ရက်စွဲနဲ့ အထောက်အထား စစ်ပါ။", "Verify လုပ်ပါ၊ ပြင်ခိုင်းပါ၊ ဒါမှမဟုတ် ငြင်းပါ။ ပြင်ခိုင်းရင်နဲ့ ငြင်းရင် အကြောင်းပြချက် လိုပြီး သူ မြင်ရပါတယ်။"] },
				{ shot: "reviews", alt: "Reviews စာရင်း" },
				{ p: "**Team overview** မှာ အမျိုးအစားအလိုက် ကြည့်လို့ရပါတယ်။ ဘယ်သူလဲ မသိနိုင်အောင် ၃ ဦးအောက်အုပ်စုတွေကို ဖျောက်ထားပြီး Sensitive မှတ်တမ်းဖွင့်တာကို Log မှတ်ပါတယ်။" },
			],
		},
	},
	{
		slug: "skills-and-badges",
		category: "capacity",
		title: { en: "Skills and badges", my: "Skills နဲ့ Badges" },
		summary: { en: "Nominate a skill, have it assessed, and choose what to share.", my: "ကျွမ်းကျင်မှု တင်ပြ၊ စစ်ခိုင်းပြီး ဘာမျှဝေမလဲ ရွေးပါ။" },
		body: {
			en: [
				{ steps: ["Go to **Capacity Building**, then **Skills & badges**, and select **Nominate a skill**.", "Choose a skill from the list. If it isn't there, select **Add a skill that isn't listed**.", "Choose the level you think you're at, and say what shows it.", "Select **Send for assessment**."] },
				{ shot: "skills", alt: "The Skills & badges page." },
				{ p: "Only your assessor can set a level, and finishing a workshop doesn't raise it. You can edit or remove a skill at any time. Once it's verified, its switch lets you show it in People & Skills." },
			],
			my: [
				{ steps: ["**Capacity Building** ထဲက **Skills & badges** ကိုသွားပြီး **ကျွမ်းကျင်မှု တင်ပြရန်** ကို နှိပ်ပါ။", "စာရင်းထဲက ရွေးပါ။ မပါရင် **စာရင်းထဲ မပါတဲ့ ကျွမ်းကျင်မှု ထည့်ရန်** ကို နှိပ်ပါ။", "ကိုယ်ထင်တဲ့ အဆင့်ရွေးပြီး ဘာက ပြနိုင်လဲ ရေးပါ။", "**စစ်ဖို့ ပို့ရန်** ကို နှိပ်ပါ။"] },
				{ shot: "skills", alt: "Skills & badges စာမျက်နှာ" },
				{ p: "အဆင့်ကို Assessor ပဲ သတ်မှတ်လို့ရပြီး Workshop ပြီးရုံနဲ့ မတက်ပါဘူး။ အချိန်မရွေး ပြင်တာ၊ ဖယ်တာ လုပ်လို့ရပါတယ်။ Verified ဖြစ်ရင် People & Skills မှာ ပြဖို့ ခလုတ်ဖွင့်လို့ရပါတယ်။" },
			],
		},
	},
	{
		slug: "run-a-project",
		category: "projects",
		title: { en: "Set up and run a project", my: "Project စတင်ပြီး လုပ်ဆောင်ရန်" },
		summary: { en: "Create a project, add your team and track progress.", my: "Project ဖွင့်၊ အဖွဲ့ထည့်ပြီး တိုးတက်မှု ကြည့်ပါ။" },
		body: {
			en: [
				{ p: "Projects is a separate module that an admin turns on. Admins and managers can create projects." },
				{ steps: ["Go to **Projects** and select **New project**.", "Add its name, code, dates, budget and how often it reports.", "Open the project and add people under **Team**.", "On **Overview**, select **Add milestone** for each key date, and **Set health** to say how it's going."] },
				{ shot: "project", alt: "A project's Overview, with progress, milestones and reports." },
				{ p: "Project **Status** and **Health** are separate, so a project can be In progress and At risk at once. **Portfolio** compares all your projects. When it's finished, select **Complete project**." },
			],
			my: [
				{ p: "Projects က Admin ဖွင့်ပေးရတဲ့ သီးခြား Module ပါ။ Admin နဲ့ Manager တွေ Project ဖွင့်လို့ရပါတယ်။" },
				{ steps: ["**Projects** ကိုသွားပြီး Project အသစ် ဖွင့်ပါ။", "အမည်၊ Code၊ ရက်စွဲ၊ Budget နဲ့ Report ကြိမ်နှုန်း ထည့်ပါ။", "Project ကိုဖွင့်ပြီး **Team** မှာ လူထည့်ပါ။", "**Overview** မှာ ရက်စွဲအရေးကြီးတွေအတွက် **Milestone ထည့်ရန်** ကို နှိပ်ပြီး **Health သတ်မှတ်ရန်** နဲ့ အခြေအနေ ပြပါ။"] },
				{ shot: "project", alt: "တိုးတက်မှု၊ Milestone နဲ့ Report ပြတဲ့ Project Overview" },
				{ p: "Status နဲ့ Health က သီးခြားစီမို့ In progress ဖြစ်ပြီး At risk လည်း ဖြစ်နိုင်ပါတယ်။ **Portfolio** မှာ Project အားလုံး နှိုင်းယှဉ်ပါ။ ပြီးရင် **Project ပြီးဆုံးရန်** ကို နှိပ်ပါ။" },
			],
		},
	},
	{
		slug: "project-reports",
		category: "projects",
		title: { en: "Write and approve project reports", my: "Project Report ရေးပြီး အတည်ပြုရန်" },
		summary: { en: "Submit progress for each period, and review it.", my: "ကာလအလိုက် တိုးတက်မှုတင်ပြီး စစ်ပါ။" },
		body: {
			en: [
				{ steps: ["Open the project and go to **Reports**.", "Select **New report** and choose the period.", "Say what was done, any challenges and what's next, plus people reached and money spent.", "Submit it for review."] },
				{ p: "The project's owner or manager then selects **Approve** or **Send back for revision**, and you get a notification. You can't approve your own report." },
				{ tip: "Only approved reports count toward the numbers on the project's Overview." },
			],
			my: [
				{ steps: ["Project ကိုဖွင့်ပြီး **Reports** ကို သွားပါ။", "**Report အသစ်** ကိုနှိပ်ပြီး ကာလ ရွေးပါ။", "လုပ်ခဲ့တာ၊ အခက်အခဲ၊ နောက်လုပ်မှာနဲ့ လူဦးရေ၊ သုံးငွေ ရေးပါ။", "စစ်ဖို့ ပို့ပါ။"] },
				{ p: "Project Owner ဒါမှမဟုတ် Manager က **Approve လုပ်ရန်** ဒါမှမဟုတ် **ပြင်ဖို့ ပြန်ပို့ရန်** ကို ရွေးပြီး Notification ရောက်ပါမယ်။ ကိုယ့် Report ကို ကိုယ် အတည်မပြုနိုင်ပါဘူး။" },
				{ tip: "အတည်ပြုပြီး Report တွေပဲ Overview ဂဏန်းတွေမှာ ပေါင်းပါတယ်။" },
			],
		},
	},
	{
		slug: "people-and-skills",
		category: "capacity",
		title: { en: "People & Skills directory", my: "People & Skills" },
		summary: { en: "Find colleagues by skill, and choose whether to be listed.", my: "ကျွမ်းကျင်မှုနဲ့ လုပ်ဖော်ကိုင်ဖက် ရှာပြီး ပါဝင်မလား ရွေးပါ။" },
		body: {
			en: [
				{ p: "Nobody is listed unless they choose to be, and only you can list yourself." },
				{ steps: ["Go to **People & Skills** and select **Edit what I share**.", "Turn on **Show me in People & Skills**. This saves straight away.", "Choose your picture, job title and a short bio, then select **Save**."] },
				{ shot: "directory", alt: "The People & Skills directory." },
				{ p: "You can use a display name instead of your real name. You stay hidden until an admin approves it, so your real name never shows by accident. Training history, locations and contact details are never shown." },
			],
			my: [
				{ p: "ကိုယ်တိုင်ရွေးမှ ပါဝင်ပါတယ်။ ကိုယ့်ကိုယ်ကိုပဲ ထည့်လို့ရပါတယ်။" },
				{ steps: ["**People & Skills** ကိုသွားပြီး **ကိုယ်မျှဝေတာ ပြင်ရန်** ကို နှိပ်ပါ။", "**People & Skills မှာ ပြရန်** ကို ဖွင့်ပါ။ နှိပ်တာနဲ့ သိမ်းပါတယ်။", "ပုံ၊ ရာထူးနဲ့ အကျဉ်း ရွေးပြီး သိမ်းပါ။"] },
				{ shot: "directory", alt: "People & Skills စာမျက်နှာ" },
				{ p: "အမည်အမှန်အစား Display name သုံးလို့ရပါတယ်။ Admin အတည်မပြုမချင်း ဖျောက်ထားလို့ အမည်အမှန် မပေါ်ပါဘူး။ သင်တန်းမှတ်တမ်း၊ နေရာနဲ့ ဆက်သွယ်ရန် ဘယ်တော့မှ မပြပါဘူး။" },
			],
		},
	},
	{
		slug: "reports-and-plan",
		category: "admin",
		title: { en: "Reports, your plan and settings", my: "Reports၊ Plan နဲ့ Settings" },
		summary: { en: "See how your organization is doing, and manage your plan.", my: "အဖွဲ့အစည်းအခြေအနေ ကြည့်ပြီး Plan စီမံပါ။" },
		body: {
			en: [
				{ h: "Reports" },
				{ p: "Admins and managers can go to **Reports** to see overview figures, plus tabs for courses, policies, announcements, files and departments." },
				{ h: "Your plan" },
				{ steps: ["Go to **Settings**, then **Plan & usage**, to see your users and storage.", "To change plan, choose one and select **Send upgrade request**.", "We confirm it and activate your plan."] },
				{ h: "Other settings" },
				{ ul: ["**Settings**, then **Modules**: turn on Projects, Capacity Building and People & Skills when they're available.", "**Integrations**: turn Ask AidNova on or off, and send a test email.", "**My profile** and **Account & security**: your own details, password and two-step sign-in."] },
			],
			my: [
				{ h: "Reports" },
				{ p: "Admin နဲ့ Manager တွေ **Reports** မှာ Overview နဲ့ Course၊ Policy၊ Announcement၊ File၊ ဌာန အလိုက် ကြည့်လို့ရပါတယ်။" },
				{ h: "Plan" },
				{ steps: ["**Settings** ထဲက **Plan & usage** မှာ User နဲ့ Storage ကြည့်ပါ။", "Plan ပြောင်းချင်ရင် ရွေးပြီး **Upgrade တောင်းဆိုရန်** ကို နှိပ်ပါ။", "ကျွန်တော်တို့ အတည်ပြုပြီး ဖွင့်ပေးပါမယ်။"] },
				{ h: "တခြား Settings" },
				{ ul: ["**Settings** ထဲက **Modules**: ရနိုင်ပြီဆိုရင် Projects၊ Capacity Building နဲ့ People & Skills ဖွင့်ပါ။", "**Integrations**: Ask AidNova ဖွင့်၊ ပိတ်ပြီး Test email ပို့ပါ။", "**My profile** နဲ့ **Account & security**: ကိုယ့်အချက်အလက်၊ Password နဲ့ Two-step sign-in။"] },
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
