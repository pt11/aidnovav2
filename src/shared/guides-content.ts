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
					"အဖွဲ့အစည်းက Invite လုပ်ထားတာဆိုရင် [အဖွဲ့အစည်းထဲ ဝင်ရန်](guide:join-your-organization) ကို ကြည့်ပါ။",
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
				{ p: "ဒါက အဖွဲ့အစည်းအတွက် AidNova ကို စတင်ပြင်ဆင်မယ့်သူအတွက်ပါ။ အခမဲ့ Trial က ၁၄ ရက်ရပြီး Card မလိုပါဘူး။ သင့်အဖွဲ့အစည်းက AidNova သုံးနေပြီဆိုရင် Invite တောင်းပြီး [အဖွဲ့အစည်းထဲ ဝင်ရန်](guide:join-your-organization) ကို ကြည့်ပါ။" },
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
				{ p: "Dashboard မှာ အရင်လုပ်သင့်တာတွေကို ပြထားပါတယ်။ အများစုက ဌာနထည့်ပြီး ဝန်ထမ်းတွေ Invite လုပ်ကြပါတယ်။ [ဝန်ထမ်းတွေ ထည့်ရန်](guide:add-your-team) မှာ ကြည့်ပါ။" },
			],
		},
	},
	{
		slug: "add-your-team",
		category: "getting-started",
		title: { en: "Add your team", my: "ဝန်ထမ်းတွေ ထည့်ရန်" },
		summary: {
			en: "Set up departments and invite people, one at a time or from a list.",
			my: "ဌာနတွေ ထည့်ပြီး ဝန်ထမ်းတွေကို တစ်ယောက်ချင်း ဒါမှမဟုတ် စာရင်းနဲ့ Invite လုပ်ပါ။",
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
				{ p: "Invite လုပ်တဲ့အခါ မှန်ကန်တဲ့အဖွဲ့ထဲ ထည့်လို့ရအောင် ဌာနတွေကို အရင်ထည့်ပါ။ Admin နဲ့ Manager တွေ Invite လုပ်လို့ရပါတယ်။" },
				{ h: "ဌာန ထည့်ရန်" },
				{ steps: [
					"**Settings** ထဲက **Departments** ကို သွားပါ။",
					"Programs ဒါမှမဟုတ် Finance လို အမည်ထည့်ပါ။ ဖော်ပြချက်က မထည့်လည်းရပါတယ်။",
					"**ဌာန ထည့်ရန်** ကို နှိပ်ပါ။",
				] },
				{ shot: "departments", alt: "Settings ထဲက ဌာနစာရင်း" },
				{ h: "တစ်ယောက် Invite လုပ်ရန်" },
				{ steps: [
					"**Users** ကို သွားပြီး **ဝန်ထမ်းထည့်ရန်** ကို နှိပ်ပါ။",
					"သူ့ Email ထည့်ပြီး Role နဲ့ ဌာန ရွေးပါ။",
					"**Invite ပို့ရန်** ကို နှိပ်ပါ။",
				] },
				{ shot: "invite", alt: "People စာမျက်နှာက Invite ပို့တဲ့ Window" },
				{ p: "သူ့ဆီ Email နဲ့ Link ရောက်သွားပါမယ်။ Link က ၇ ရက် အသုံးပြုလို့ရပါတယ်။ လက်မခံရသေးရင် **Invite လုပ်ထားသူများ** မှာ ပေါ်ပြီး **ပြန်ပို့ရန်** ဒါမှမဟုတ် **Invite ပယ်ရန်** လုပ်လို့ရပါတယ်။" },
				{ tip: "ဘယ် Role ရွေးရမလဲ မသေချာရင် [Role တွေ ဘာလုပ်လို့ရလဲ](guide:roles) ကို ကြည့်ပါ။ Manager နဲ့ Admin ကို Admin ပဲ Invite လုပ်လို့ရပါတယ်။" },
				{ h: "စာရင်းနဲ့ Invite လုပ်ရန်" },
				{ steps: [
					"**Users** ကို သွားပြီး **CSV တင်ရန်** ကို နှိပ်ပါ။",
					"CSV File ရွေးပါ၊ ဒါမှမဟုတ် စာရင်းကို Paste လုပ်ပါ။ တစ်ကြောင်းမှာ တစ်ယောက်၊ Email ရေးပြီး လိုရင် Role နဲ့ ဌာန ထည့်ပါ။",
					"အရေအတွက် စစ်ပြီး ပို့ရန် ခလုတ်ကို နှိပ်ပါ။",
				] },
				{ p: "တစ်ခါမှာ ၁၀၀ ထိ Invite လုပ်လို့ရပါတယ်။ Role မထည့်ရင် Staff အဖြစ် ဝင်ပါမယ်။ မအောင်မြင်တဲ့ Invite ရှိရင် ပြန်ကြိုးစားလို့ရအောင် စာရင်းပြပေးပါတယ်။" },
				{ table: { head: ["စာရင်းထဲက စာကြောင်း", "ရလဒ်"], rows: [
					["`aye.aye@example.org`", "Staff အဖြစ် Invite လုပ်ပါတယ်၊ ဌာနမပါပါ"],
					["`ko.min@example.org, manager`", "Manager အဖြစ် Invite လုပ်ပါတယ်"],
					["`nilar@example.org, staff, Programs`", "Programs ထဲက Staff အဖြစ် Invite လုပ်ပါတယ်"],
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
					["Staff Invite လုပ်တာ", "မရ", "ရ", "ရ"],
					["Manager နဲ့ Admin Invite လုပ်တာ", "မရ", "မရ", "ရ"],
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
			my: "Email နဲ့ Invite ရထားရင် ဒီလိုလက်ခံပါ။",
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
				{ p: "အဖွဲ့အစည်းက Invite လုပ်ရင် AidNova ဆီက Email နဲ့ Link ရောက်လာပါမယ်။ Link က ၇ ရက် အသုံးပြုလို့ရပါတယ်။" },
				{ steps: [
					"Email ကိုဖွင့်ပြီး Link ကို နှိပ်ပါ။",
					"**အကောင့်ဖွင့်ရန်** ကို နှိပ်ပါ။ အကောင့်ရှိပြီးသားဆိုရင် **အကောင့် ရှိပြီးသားပါ** ကို နှိပ်ပါ။",
					"Invite ရောက်တဲ့ Email အတိုင်း သုံးပါ။",
					"**Invite ကို လက်ခံရန်** ကို နှိပ်ပါ။",
				] },
				{ shot: "join", alt: "အကောင့်ဖွင့်ရန်နဲ့ အကောင့်ဝင်ရန် ခလုတ်တွေပါတဲ့ Invite စာမျက်နှာ" },
				{ h: "အဆင်မပြေရင်" },
				{ ul: [
					"**Link သက်တမ်းကုန်သွားရင်:** Admin ဒါမှမဟုတ် Manager ကို ပြန်ပို့ခိုင်းပါ။",
					"**Invite က တခြား Email အတွက်လို့ ပြရင်:** အကောင့်ထွက်ပြီး Link ကို ပြန်ဖွင့်ပါ။ Invite လုပ်ထားတဲ့ Email ကို သုံးပါ။",
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
		slug: "your-dashboard",
		category: "getting-started",
		title: { en: "What is the Dashboard?", my: "Dashboard ဆိုတာ ဘာလဲ" },
		summary: { en: "Your starting point, with everything that's waiting for you.", my: "ကိုယ့်ကို စောင့်နေတာတွေ စုပြတဲ့ စမှတ်ပါ။" },
		body: {
			en: [
				{ p: "The **Dashboard** is where you start each day. **Your to-do** collects what's waiting for you, such as policies to acknowledge, courses to complete and reports to fix or review. Select an item to go straight to it." },
				{ shot: "dashboard", alt: "The Dashboard, with figures and a to-do list." },
				{ p: "Admins and managers also see how the organization is doing, and **Needs your attention** lists things like people with no department and policies due for review." },
			],
			my: [
				{ p: "**Dashboard** က နေ့တိုင်း စကြည့်ရမယ့်နေရာပါ။ **သင်လုပ်ရန်** မှာ အတည်ပြုရမယ့် Policy၊ တက်ရမယ့် Course၊ ပြင်ရမယ့် ဒါမှမဟုတ် စစ်ရမယ့် Report တွေ စုပြထားပါတယ်။ တစ်ခုကို နှိပ်ရင် အဲဒီနေရာ တန်းရောက်ပါတယ်။" },
				{ shot: "dashboard", alt: "ကိန်းဂဏန်းတွေနဲ့ လုပ်ရန်စာရင်းပါတဲ့ Dashboard" },
				{ p: "Admin နဲ့ Manager တွေက အဖွဲ့အစည်းအခြေအနေကိုပါ မြင်ရပါတယ်။ **ကြည့်ပေးဖို့ လိုနေတာတွေ** မှာ ဌာနမရှိသေးသူနဲ့ Review ရောက်ပြီဖြစ်တဲ့ Policy တွေ ပြပါတယ်။" },
			],
		},
	},
	{
		slug: "what-are-policies",
		category: "policies",
		title: { en: "What are Policies?", my: "Policies ဆိုတာ ဘာလဲ" },
		summary: { en: "One place to publish your organization's rules, and see who has read them.", my: "အဖွဲ့အစည်းရဲ့ စည်းမျဉ်းတွေ တင်ပြီး ဘယ်သူဖတ်ပြီးလဲ ကြည့်တဲ့နေရာပါ။" },
		body: {
			en: [
				{ p: "**Policies** keeps your organization's rules and procedures in one place, such as leave, safeguarding and finance, so staff always read the current version." },
				{ shot: "policy-read", alt: "A policy open for reading." },
				{ ul: ["Admins and managers write and publish policies, for everyone or for some departments.", "A policy can require staff to confirm they've read it, which gives you a record of who has and who hasn't.", "Staff can read policies on a phone or computer, and mandatory ones appear in their to-do list."] },
				{ p: "Next: [Write and publish a policy](guide:publish-a-policy) or [Read and acknowledge a policy](guide:acknowledge-a-policy)." },
			],
			my: [
				{ p: "**Policies** က ခွင့်၊ Safeguarding၊ ငွေကြေးလို အဖွဲ့အစည်းရဲ့ စည်းမျဉ်းတွေကို တစ်နေရာတည်းမှာ ထားတာပါ။ ဝန်ထမ်းတွေ နောက်ဆုံးဗားရှင်းကို အမြဲဖတ်ရပါတယ်။" },
				{ shot: "policy-read", alt: "ဖတ်ဖို့ဖွင့်ထားတဲ့ Policy" },
				{ ul: ["Admin နဲ့ Manager တွေ ရေးပြီး လူတိုင်းအတွက် ဒါမှမဟုတ် ဌာနတချို့အတွက် Publish လုပ်ပါတယ်။", "ဖတ်ပြီးကြောင်း အတည်ပြုခိုင်းလို့ရပြီး ဘယ်သူဖတ်ပြီး၊ ဘယ်သူမဖတ်ရသေးလဲ မှတ်တမ်းရပါတယ်။", "ဖုန်း ဒါမှမဟုတ် ကွန်ပျူတာကနေ ဖတ်လို့ရပြီး မဖြစ်မနေဖတ်ရမယ့်ဟာတွေ လုပ်ရန်စာရင်းမှာ ပေါ်ပါတယ်။"] },
				{ p: "ဆက်ဖတ်ရန်: [Policy ရေးပြီး Publish လုပ်ရန်](guide:publish-a-policy) ဒါမှမဟုတ် [Policy ဖတ်ပြီး အတည်ပြုရန်](guide:acknowledge-a-policy)။" },
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
		slug: "track-policy-acknowledgments",
		category: "policies",
		title: { en: "Policy versions, reminders and reviews", my: "Policy ဗားရှင်း၊ သတိပေးချက်နဲ့ Review" },
		summary: { en: "What happens when a policy changes, and how to keep it up to date.", my: "Policy ပြောင်းရင် ဘာဖြစ်လဲ၊ နောက်ဆုံးအခြေအနေအတိုင်း ဘယ်လိုထားမလဲ။" },
		body: {
			en: [
				{ h: "Versions" },
				{ p: "If you change the wording of a published policy, AidNova warns you, then saves a new version. **Compliance** only counts acknowledgments of the latest version, so everyone it applies to has to acknowledge it again." },
				{ h: "Reminders" },
				{ p: "In **Compliance**, select **Remind** or **Remind everyone pending**. Each person can be reminded once in 24 hours, so anyone reminded recently is skipped. If some are still to send, select it again." },
				{ h: "Reviews" },
				{ p: "Add a **Review date** to a policy. When it arrives, the policy shows as **Review due**, and admins and managers see it on the Dashboard and Calendar." },
				{ h: "Retiring a policy" },
				{ p: "Select **Archive** when a policy no longer applies. Staff stop seeing it, and its acknowledgment records are kept." },
			],
			my: [
				{ h: "ဗားရှင်း" },
				{ p: "Publish လုပ်ပြီးသား Policy ရဲ့ စာသားကို ပြင်ရင် အရင်သတိပေးပြီး ဗားရှင်းအသစ် သိမ်းပါတယ်။ **Compliance** က နောက်ဆုံးဗားရှင်းကိုပဲ ရေတွက်လို့ သက်ဆိုင်သူတွေ ပြန်အတည်ပြုရပါမယ်။" },
				{ h: "သတိပေးချက်" },
				{ p: "**Compliance** မှာ **သတိပေးရန်** ဒါမှမဟုတ် **မဖတ်ရသေးသူအားလုံး သတိပေးရန်** ကို နှိပ်ပါ။ တစ်ယောက်ကို ၂၄ နာရီမှာ တစ်ခါပဲ သတိပေးလို့ရလို့ မကြာသေးခင် သတိပေးပြီးသူတွေကို ကျော်သွားပါတယ်။ ပို့ဖို့ ကျန်သေးရင် ထပ်နှိပ်ပါ။" },
				{ h: "Review" },
				{ p: "Policy မှာ **Review ရက်** ထည့်ပါ။ ရက်ရောက်ရင် **Review ရောက်ပြီ** လို့ ပြပြီး Admin နဲ့ Manager တွေ Dashboard နဲ့ Calendar မှာ မြင်ရပါတယ်။" },
				{ h: "မသုံးတော့တဲ့ Policy" },
				{ p: "မသက်ဆိုင်တော့ရင် **Archive လုပ်ရန်** ကို နှိပ်ပါ။ Staff တွေ မမြင်ရတော့ပေမဲ့ အတည်ပြုမှတ်တမ်းတွေ ကျန်ပါတယ်။" },
			],
		},
	},
	{
		slug: "what-are-courses",
		category: "courses",
		title: { en: "What are Courses?", my: "Courses ဆိုတာ ဘာလဲ" },
		summary: { en: "Your own online training, with lessons, quizzes and certificates.", my: "သင်ခန်းစာ၊ Quiz နဲ့ Certificate ပါတဲ့ ကိုယ်ပိုင် Online သင်တန်းပါ။" },
		body: {
			en: [
				{ p: "**Courses** lets your organization build its own online training, such as onboarding or safeguarding, and see who has finished it." },
				{ shot: "courses", alt: "The Courses page." },
				{ ul: ["Admins and managers build courses from text, videos and PDFs, and can add a final quiz.", "A course can be mandatory for everyone, or assigned to chosen people.", "Staff work at their own pace and their progress saves, and a course can give a certificate at the end."] },
				{ p: "Next: [Build and assign a course](guide:build-a-course) or [Take a course and get your certificate](guide:take-a-course)." },
			],
			my: [
				{ p: "**Courses** က Onboarding ဒါမှမဟုတ် Safeguarding လို ကိုယ်ပိုင် Online သင်တန်းတွေ လုပ်ပြီး ဘယ်သူပြီးပြီလဲ ကြည့်လို့ရတဲ့နေရာပါ။" },
				{ shot: "courses", alt: "Courses စာမျက်နှာ" },
				{ ul: ["Admin နဲ့ Manager တွေ စာသား၊ ဗီဒီယိုနဲ့ PDF တွေနဲ့ လုပ်ပြီး နောက်ဆုံး Quiz ထည့်လို့ရပါတယ်။", "လူတိုင်း မဖြစ်မနေတက်ရအောင် ထားလို့ရပြီး ရွေးထားတဲ့သူတွေကိုလည်း ပေးလို့ရပါတယ်။", "ဝန်ထမ်းတွေ ကိုယ့်အချိန်နဲ့ကိုယ် တက်လို့ရပြီး တက်ထားတာ သိမ်းပါတယ်။ ပြီးရင် Certificate ရနိုင်ပါတယ်။"] },
				{ p: "ဆက်ဖတ်ရန်: [Course လုပ်ပြီး ဝန်ထမ်းတွေကို ပေးရန်](guide:build-a-course) ဒါမှမဟုတ် [Course တက်ပြီး Certificate ရယူရန်](guide:take-a-course)။" },
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
		slug: "course-lessons",
		category: "courses",
		title: { en: "Lesson types and materials", my: "သင်ခန်းစာအမျိုးအစားနဲ့ Materials" },
		summary: { en: "The two kinds of lesson, and what Required means.", my: "သင်ခန်းစာ နှစ်မျိုးနဲ့ Required ရဲ့ အဓိပ္ပာယ်။" },
		body: {
			en: [
				{ ul: ["**Reading**: text, with an optional YouTube or Vimeo video and supporting files.", "**Document**: one main PDF that staff read page by page."] },
				{ p: "**Materials** holds a lesson's files. If a file is marked **Required**, staff must finish it before they can complete the lesson." },
				{ tip: "A file with a PIN or department limits in Files can't be opened by some learners. AidNova warns you when this happens." },
			],
			my: [
				{ ul: ["**Reading**: စာသား၊ YouTube ဒါမှမဟုတ် Vimeo ဗီဒီယိုနဲ့ ထောက်ကူဖိုင်တွေ။", "**Document**: ဝန်ထမ်းတွေ တစ်မျက်နှာချင်း ဖတ်ရမယ့် PDF တစ်ခု။"] },
				{ p: "**Materials** မှာ သင်ခန်းစာရဲ့ ဖိုင်တွေ ရှိပါတယ်။ **Required** မှတ်ထားရင် အဲဒီဖိုင်ပြီးမှ သင်ခန်းစာ ပြီးလို့ရပါတယ်။" },
				{ tip: "Files မှာ PIN ဒါမှမဟုတ် ဌာနကန့်သတ်ချက်ရှိတဲ့ ဖိုင်ကို တချို့ သင်တန်းသားတွေ ဖွင့်လို့မရပါဘူး။ ဒီလိုဖြစ်ရင် AidNova က သတိပေးပါတယ်။" },
			],
		},
	},
	{
		slug: "course-quizzes",
		category: "courses",
		title: { en: "How course quizzes work", my: "Course Quiz ဘယ်လိုအလုပ်လုပ်လဲ" },
		summary: { en: "Pass marks, retries and when a quiz unlocks.", my: "အောင်မှတ်၊ ပြန်ဖြေခြင်းနဲ့ Quiz ဘယ်အချိန်ဖွင့်လဲ။" },
		body: {
			en: [
				{ p: "A **Final quiz** tests people at the end of a course. Questions can have **One correct answer**, **Several correct answers** or **True / False**." },
				{ ul: ["The pass mark starts at 80%, and you can change it under **Quiz settings**.", "The quiz unlocks after every required lesson is finished.", "People must answer every question, and can select **Try again** if they don't pass.", "Deleting a question later doesn't change past results."] },
			],
			my: [
				{ p: "**နောက်ဆုံး Quiz** က Course အဆုံးမှာ စစ်တာပါ။ မေးခွန်းတွေက **အဖြေမှန် တစ်ခု**၊ **အဖြေမှန် အများကြီး** ဒါမှမဟုတ် **မှန် / မှား** ဖြစ်နိုင်ပါတယ်။" },
				{ ul: ["အောင်မှတ်က ၈၀% နဲ့ စပြီး **Quiz Settings** မှာ ပြောင်းလို့ရပါတယ်။", "Required သင်ခန်းစာအားလုံး ပြီးမှ Quiz ဖွင့်လို့ရပါတယ်။", "မေးခွန်းအားလုံး ဖြေရပြီး မအောင်ရင် **ပြန်ဖြေရန်** ကို နှိပ်လို့ရပါတယ်။", "နောက်မှ မေးခွန်းဖျက်ရင် အရင်ရလဒ်တွေ မပြောင်းပါဘူး။"] },
			],
		},
	},
	{
		slug: "what-are-files",
		category: "everyday",
		title: { en: "What is Files?", my: "Files ဆိုတာ ဘာလဲ" },
		summary: { en: "A shared library for your organization's documents and links.", my: "အဖွဲ့အစည်းရဲ့ စာရွက်စာတမ်းနဲ့ Link တွေ စုထားတဲ့နေရာပါ။" },
		body: {
			en: [
				{ p: "**Files** is your organization's shared library of documents and links, such as forms and templates. Everyone sees only what they're allowed to open." },
				{ shot: "files", alt: "The Files page with folders." },
				{ ul: ["Admins and managers add files and organize them in folders.", "A file or folder can be for everyone or for chosen departments, and a folder can also have a PIN.", "Files can be linked into courses and projects, so you don't need to keep several copies."] },
				{ p: "Next: [Share files and folders](guide:files-and-folders)." },
			],
			my: [
				{ p: "**Files** က ဖောင်နဲ့ Template လို အဖွဲ့အစည်းရဲ့ စာရွက်စာတမ်းနဲ့ Link တွေ စုထားတဲ့နေရာပါ။ ကိုယ်ဖွင့်ခွင့်ရှိတာကိုပဲ မြင်ရပါတယ်။" },
				{ shot: "files", alt: "Folder တွေပါတဲ့ Files စာမျက်နှာ" },
				{ ul: ["Admin နဲ့ Manager တွေ ဖိုင်ထည့်ပြီး Folder တွေနဲ့ စီမံပါတယ်။", "ဖိုင် ဒါမှမဟုတ် Folder ကို လူတိုင်းအတွက် ဒါမှမဟုတ် ဌာနတချို့အတွက် ထားလို့ရပြီး Folder မှာ PIN လည်း ထားလို့ရပါတယ်။", "Course နဲ့ Project တွေမှာ ချိတ်သုံးလို့ရလို့ ဖိုင်ကို အများကြီး ကူးထားစရာ မလိုပါဘူး။"] },
				{ p: "ဆက်ဖတ်ရန်: [File နဲ့ Folder မျှဝေရန်](guide:files-and-folders)။" },
			],
		},
	},
	{
		slug: "what-are-announcements",
		category: "everyday",
		title: { en: "What are Announcements?", my: "Announcements ဆိုတာ ဘာလဲ" },
		summary: { en: "A news feed for your organization, so updates don't get lost in chats.", my: "Chat ထဲမှာ မပျောက်အောင် အဖွဲ့အစည်းသတင်းတွေ တင်တဲ့နေရာပါ။" },
		body: {
			en: [
				{ p: "**Announcements** is your organization's news feed, for things like an office closure or a new rule. Everyone sees the same updates in one place." },
				{ shot: "announcements", alt: "The Announcements feed." },
				{ ul: ["Admins and managers post updates as **Normal**, **High** or **Urgent**. Urgent ones stay pinned at the top.", "Staff can select **Got it**, so you know the message has reached them.", "Each announcement shows how many people viewed it and how many got it."] },
				{ p: "Next: [Announcements and the calendar](guide:announcements-and-calendar)." },
			],
			my: [
				{ p: "**Announcements** က ရုံးပိတ်ရက် ဒါမှမဟုတ် စည်းမျဉ်းအသစ်လို သတင်းတွေ တင်တဲ့နေရာပါ။ လူတိုင်း တစ်နေရာတည်းမှာ ဖတ်ရပါတယ်။" },
				{ shot: "announcements", alt: "Announcements စာမျက်နှာ" },
				{ ul: ["Admin နဲ့ Manager တွေ Normal၊ High ဒါမှမဟုတ် Urgent နဲ့ တင်ပါတယ်။ Urgent က အပေါ်ဆုံးမှာ ရှိနေပါတယ်။", "Staff တွေ Got it ကိုနှိပ်ရင် သတင်းရောက်ကြောင်း သိရပါတယ်။", "Announcement တစ်ခုချင်းမှာ ကြည့်သူနဲ့ Got it နှိပ်သူ အရေအတွက် ပြပါတယ်။"] },
				{ p: "ဆက်ဖတ်ရန်: [Announcement နဲ့ Calendar](guide:announcements-and-calendar)။" },
			],
		},
	},
	{
		slug: "what-is-the-calendar",
		category: "everyday",
		title: { en: "What is the Calendar?", my: "Calendar ဆိုတာ ဘာလဲ" },
		summary: { en: "Your organization's trainings, meetings, deadlines and holidays in one view.", my: "Training၊ Meeting၊ Deadline နဲ့ Holiday တွေကို တစ်နေရာတည်း ကြည့်ပါ။" },
		body: {
			en: [
				{ p: "The **Calendar** shows your organization's trainings, meetings, deadlines and holidays. Everyone in your organization can see every event, so keep sensitive details out of them." },
				{ shot: "calendar", alt: "The Calendar in month view." },
				{ ul: ["Admins and managers add events.", "Anyone can switch between **Month** and **Agenda**, which is easier to read on a phone.", "Anyone can copy an event to their own calendar with **Add to my calendar**."] },
				{ p: "Next: [Announcements and the calendar](guide:announcements-and-calendar)." },
			],
			my: [
				{ p: "**Calendar** မှာ အဖွဲ့အစည်းရဲ့ Training၊ Meeting၊ Deadline နဲ့ Holiday တွေ ပြပါတယ်။ Event တိုင်းကို လူတိုင်း မြင်ရလို့ လျှို့ဝှက်အချက်အလက်တွေ မထည့်ပါနဲ့။" },
				{ shot: "calendar", alt: "လအလိုက် Calendar" },
				{ ul: ["Admin နဲ့ Manager တွေ Event ထည့်ပါတယ်။", "**Month** နဲ့ **Agenda** ပြောင်းကြည့်လို့ရပါတယ်။ ဖုန်းမှာ Agenda က ဖတ်ရပိုလွယ်ပါတယ်။", "**ကိုယ့် Calendar ထဲ ထည့်ရန်** နဲ့ ကိုယ့် Calendar ထဲ ကူးလို့ရပါတယ်။"] },
				{ p: "ဆက်ဖတ်ရန်: [Announcement နဲ့ Calendar](guide:announcements-and-calendar)။" },
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
		slug: "search-the-hub",
		category: "everyday",
		title: { en: "What is the Hub?", my: "Hub ဆိုတာ ဘာလဲ" },
		summary: { en: "One search for your policies, courses, files and links.", my: "Policy၊ Course၊ File နဲ့ Link တွေကို တစ်နေရာတည်းက ရှာပါ။" },
		body: {
			en: [
				{ p: "The **Hub** is one search box for everything your organization has shared with you: policies, courses, files and links. Type what you're looking for, or press Enter to put your words to [Ask AidNova](guide:ask-aidnova)." },
				{ p: "You only see what you're allowed to open, so two colleagues can get different results. Capacity Building records never appear." },
			],
			my: [
				{ p: "**Hub** က အဖွဲ့အစည်းက ကိုယ့်ကို မျှဝေထားတဲ့ Policy၊ Course၊ File နဲ့ Link အားလုံးကို ရှာပေးတဲ့နေရာပါ။ ရှာချင်တာ ရိုက်ပါ၊ ဒါမှမဟုတ် Enter နှိပ်ပြီး [Ask AidNova](guide:ask-aidnova) ကို မေးပါ။" },
				{ p: "ဖွင့်ခွင့်ရှိတာတွေကိုပဲ မြင်ရလို့ လုပ်ဖော်ကိုင်ဖက် နှစ်ယောက် ရလဒ်မတူနိုင်ပါဘူး။ Capacity Building မှတ်တမ်းတွေ ဘယ်တော့မှ မပေါ်ပါဘူး။" },
			],
		},
	},
	{
		slug: "what-is-capacity-building",
		category: "capacity",
		title: { en: "What is Capacity Building?", my: "Capacity Building ဆိုတာ ဘာလဲ" },
		summary: { en: "A private record of each person's training and skills.", my: "ဝန်ထမ်းတစ်ယောက်ချင်းရဲ့ သင်တန်းနဲ့ ကျွမ်းကျင်မှု မှတ်တမ်းပါ။" },
		body: {
			en: [
				{ p: "**Capacity Building** records the training your staff do outside AidNova, such as workshops and external courses, and the skills they build. It's separate from **Courses**, which is training you create yourself." },
				{ shot: "reviews", alt: "The Reviews queue in Capacity Building." },
				{ ul: ["Staff report their training and can add evidence, such as a certificate.", "A reviewer checks each report. Only verified training counts in official totals.", "Staff can nominate skills for an assessor to check."] },
				{ tip: "It's private by default, because who attends what can put people at risk in some places. Training details stay with the person and their reviewer, and aren't used in organization reports, Hub search or Ask AidNova." },
				{ p: "Next: [Set up Capacity Building](guide:set-up-capacity-building) or [Report your training](guide:report-training)." },
			],
			my: [
				{ p: "**Capacity Building** က Workshop နဲ့ ပြင်ပသင်တန်းလို AidNova အပြင်မှာ တက်တဲ့ သင်တန်းတွေနဲ့ ကျွမ်းကျင်မှုတွေကို မှတ်တမ်းတင်တာပါ။ ကိုယ်တိုင်လုပ်တဲ့ သင်တန်းဖြစ်တဲ့ **Courses** နဲ့ မတူပါဘူး။" },
				{ shot: "reviews", alt: "Capacity Building ထဲက Reviews စာရင်း" },
				{ ul: ["ဝန်ထမ်းတွေ သင်တန်း Report တင်ပြီး Certificate လို အထောက်အထား ထည့်လို့ရပါတယ်။", "Reviewer က စစ်ပါတယ်။ Verified ဖြစ်တာတွေပဲ တရားဝင် ရေတွက်ပါတယ်။", "ကျွမ်းကျင်မှုတွေကို Assessor စစ်ဖို့ တင်ပြလို့ရပါတယ်။"] },
				{ tip: "ဘယ်သူ ဘာတက်လဲဆိုတာ တချို့နေရာတွေမှာ အန္တရာယ်ဖြစ်စေနိုင်လို့ မူလကတည်းက Private ပါ။ အသေးစိတ်ကို ကိုယ်တိုင်နဲ့ Reviewer ပဲ သိပြီး အဖွဲ့အစည်း Report၊ Hub ရှာဖွေမှုနဲ့ Ask AidNova မှာ မသုံးပါဘူး။" },
				{ p: "ဆက်ဖတ်ရန်: [Capacity Building စတင်ပြင်ဆင်ရန်](guide:set-up-capacity-building) ဒါမှမဟုတ် [သင်တန်း Report တင်ရန်](guide:report-training)။" },
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
		slug: "set-up-capacity-building",
		category: "capacity",
		title: { en: "Set up Capacity Building", my: "Capacity Building စတင်ပြင်ဆင်ရန်" },
		summary: { en: "For admins: choose reviewers, manage the skills list and use the training report.", my: "Admin တွေအတွက် - Reviewer ရွေး၊ Skill စာရင်းစီမံပြီး Training report သုံးပါ။" },
		body: {
			en: [
				{ p: "First, turn the module on. See [Turn modules on or off](guide:turn-on-modules)." },
				{ h: "Choose reviewers" },
				{ steps: ["Go to **Capacity Building**, then **Module settings**.", "Open **Reviewers & audit log**.", "For each department, choose a **Reviewer**, and a **Backup** if you have one. The backup must be a different person."] },
				{ shot: "capacity-settings", alt: "Capacity Building settings, with a reviewer for each department." },
				{ p: "If a department has no reviewer, its reports wait until you choose one. Reviewer changes are logged." },
				{ h: "Audit log" },
				{ p: "The **Audit log** records decisions, sensitive views and reviewer changes. Training names and places are never written there." },
				{ h: "Other settings" },
				{ ul: ["**Skills catalog**: the list of skills people can nominate.", "**Directory rules**: what your organization allows on People & Skills cards."] },
				{ h: "Training report" },
				{ p: "**Training report** lists submitted training: who applied, who's in progress and who completed. Reviewers see the staff assigned to them, managers see their department, and admins see the whole organization." },
				{ p: "Sensitive training shows as Restricted to everyone except the assigned reviewer, in the list and in the export. Select **Export CSV (logged)** to download it. Each export is logged." },
			],
			my: [
				{ p: "အရင်ဆုံး Module ကို ဖွင့်ပါ။ [Module ဖွင့်၊ ပိတ်ရန်](guide:turn-on-modules) ကို ကြည့်ပါ။" },
				{ h: "Reviewer ရွေးရန်" },
				{ steps: ["**Capacity Building** ထဲက **Module settings** ကို သွားပါ။", "**Reviewers & audit log** ကို ဖွင့်ပါ။", "ဌာနတစ်ခုချင်းအတွက် **Reviewer** ရွေးပါ၊ ရှိရင် **Backup** ပါ ရွေးပါ။ Backup က တခြားတစ်ယောက် ဖြစ်ရပါမယ်။"] },
				{ shot: "capacity-settings", alt: "ဌာနအလိုက် Reviewer ပြတဲ့ Capacity Building Settings" },
				{ p: "ဌာနမှာ Reviewer မရှိရင် ရွေးပေးတဲ့အထိ Report တွေ စောင့်နေပါမယ်။ Reviewer ပြောင်းတာကို မှတ်တမ်းတင်ပါတယ်။" },
				{ h: "Audit log" },
				{ p: "**Audit log** မှာ ဆုံးဖြတ်ချက်၊ Sensitive မှတ်တမ်းဖွင့်တာနဲ့ Reviewer ပြောင်းတာတွေ မှတ်ပါတယ်။ သင်တန်းအမည်နဲ့ နေရာတွေ မမှတ်ပါဘူး။" },
				{ h: "တခြား Settings" },
				{ ul: ["**Skills catalog**: လူတွေ တင်ပြလို့ရတဲ့ Skill စာရင်း။", "**Directory rules**: People & Skills ကတ်တွေမှာ ဘာပြခွင့်ပေးမလဲ။"] },
				{ h: "Training report" },
				{ p: "**Training report** မှာ တင်ပြီးသား သင်တန်းတွေ ပြပါတယ် - ဘယ်သူလျှောက်ထားလဲ၊ ဘယ်သူတက်နေလဲ၊ ဘယ်သူပြီးပြီလဲ။ Reviewer က သူ့ကို တာဝန်ပေးထားတဲ့ ဝန်ထမ်းတွေ၊ Manager က သူ့ဌာန၊ Admin က အဖွဲ့အစည်းတစ်ခုလုံး မြင်ရပါတယ်။" },
				{ p: "Sensitive သင်တန်းတွေကို တာဝန်ကျ Reviewer ကလွဲပြီး ကျန်သူတွေ Restricted လို့ပဲ မြင်ရပါတယ်၊ စာရင်းမှာရော CSV မှာပါ။ **CSV ထုတ်ရန် (မှတ်တမ်းတင်)** ကို နှိပ်ပါ။ ထုတ်တိုင်း မှတ်တမ်းတင်ပါတယ်။" },
			],
		},
	},
	{
		slug: "what-is-projects",
		category: "projects",
		title: { en: "What is Projects?", my: "Projects ဆိုတာ ဘာလဲ" },
		summary: { en: "One workspace for each project's plan, team, files and reports.", my: "Project တစ်ခုချင်းရဲ့ အစီအစဉ်၊ အဖွဲ့၊ ဖိုင်နဲ့ Report တွေ စုထားတဲ့နေရာပါ။" },
		body: {
			en: [
				{ p: "**Projects** gives each of your projects its own workspace, with its plan, people, files and progress reports in one place." },
				{ shot: "project", alt: "A project's Overview, with progress, milestones and reports." },
				{ ul: ["Track milestones, and show whether a project is healthy or at risk.", "Keep project documents in folders, with older versions saved.", "Collect progress reports for each period, and have them approved.", "Compare all your projects in **Portfolio**."] },
				{ p: "Next: [Set up and run a project](guide:run-a-project)." },
			],
			my: [
				{ p: "**Projects** က Project တစ်ခုချင်းအတွက် သီးသန့်နေရာ ပေးပြီး အစီအစဉ်၊ လူ၊ ဖိုင်နဲ့ တိုးတက်မှု Report တွေကို စုထားပေးပါတယ်။" },
				{ shot: "project", alt: "တိုးတက်မှု၊ Milestone နဲ့ Report ပြတဲ့ Project Overview" },
				{ ul: ["Milestone တွေ ကြည့်ပြီး Project အခြေအနေ ကောင်းလား၊ အန္တရာယ်ရှိလား ပြပါ။", "စာရွက်စာတမ်းတွေကို Folder နဲ့ထားပြီး ဗားရှင်းဟောင်းတွေ သိမ်းထားပါတယ်။", "ကာလအလိုက် Report တွေ စုပြီး အတည်ပြုလို့ရပါတယ်။", "**Portfolio** မှာ Project အားလုံး နှိုင်းယှဉ်ပါ။"] },
				{ p: "ဆက်ဖတ်ရန်: [Project စတင်ပြီး လုပ်ဆောင်ရန်](guide:run-a-project)။" },
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
		slug: "project-team-and-access",
		category: "projects",
		title: { en: "Project team and who can see what", my: "Project အဖွဲ့နဲ့ ဘယ်သူ ဘာမြင်ရလဲ" },
		summary: { en: "Add people to a project, and choose what each of them can do.", my: "Project ထဲ လူထည့်ပြီး တစ်ယောက်ချင်း ဘာလုပ်လို့ရလဲ ရွေးပါ။" },
		body: {
			en: [
				{ h: "Who can see the project" },
				{ p: "Under **Who can see the project**, choose **Team members only** or **Everyone in the organization**. Admins can always see every project. A draft stays with the person setting it up, and admins." },
				{ h: "Add the team" },
				{ steps: ["Open the project and go to **Team**.", "Select **Add a team member** and choose someone.", "Choose **Member** or **Viewer**."] },
				{ h: "What each person can do" },
				{ table: { head: ["Person", "What they can do"], rows: [["**Owner** and **Manager**", "Edit the project, manage its team and approve reports."], ["**Member**", "Add files and write reports."], ["**Viewer**", "Read the project's files and reports."], ["Everyone else", "Read it, only if the project is open to everyone."]] } },
				{ tip: "Open **Activity** to see who changed what, including team, file and report changes." },
			],
			my: [
				{ h: "ဘယ်သူတွေ မြင်ရမလဲ" },
				{ p: "**ဘယ်သူတွေ မြင်ရမလဲ** မှာ **အဖွဲ့ဝင်တွေပဲ** ဒါမှမဟုတ် **အဖွဲ့အစည်းထဲက လူတိုင်း** ကို ရွေးပါ။ Admin တွေက Project အားလုံး မြင်ရပါတယ်။ Draft ကို ဖန်တီးသူနဲ့ Admin ပဲ မြင်ရပါတယ်။" },
				{ h: "အဖွဲ့ဝင် ထည့်ရန်" },
				{ steps: ["Project ကိုဖွင့်ပြီး **Team** ကို သွားပါ။", "**အဖွဲ့ဝင် ထည့်ရန်** ကိုနှိပ်ပြီး လူရွေးပါ။", "**Member** ဒါမှမဟုတ် **Viewer** ရွေးပါ။"] },
				{ h: "ဘယ်သူ ဘာလုပ်လို့ရလဲ" },
				{ table: { head: ["လူ", "လုပ်လို့ရတာ"], rows: [["**Owner** နဲ့ **Manager**", "Project ပြင်၊ အဖွဲ့စီမံပြီး Report အတည်ပြုလို့ရပါတယ်။"], ["**Member**", "ဖိုင်ထည့်ပြီး Report ရေးလို့ရပါတယ်။"], ["**Viewer**", "Project ရဲ့ ဖိုင်နဲ့ Report တွေ ဖတ်လို့ရပါတယ်။"], ["ကျန်သူတွေ", "လူတိုင်းအတွက် ဖွင့်ထားရင်ပဲ ဖတ်လို့ရပါတယ်။"]] } },
				{ tip: "**Activity** မှာ ဘယ်သူ ဘာပြောင်းလဲ ကြည့်လို့ရပါတယ်။ အဖွဲ့၊ ဖိုင်နဲ့ Report ပြောင်းတာတွေ ပါပါတယ်။" },
			],
		},
	},
	{
		slug: "project-files",
		category: "projects",
		title: { en: "How project files and versions work", my: "Project ဖိုင်နဲ့ ဗားရှင်း ဘယ်လိုအလုပ်လုပ်လဲ" },
		summary: { en: "Linking from Files, and why older versions are never lost.", my: "Files ကနေ ချိတ်ခြင်းနဲ့ ဗားရှင်းဟောင်းတွေ ဘာကြောင့် မပျောက်လဲ။" },
		body: {
			en: [
				{ p: "Each project has its own files. Everyone on the project can open them, and owners, managers and members can add them." },
				{ ul: ["**Link from Files** uses something already in your organization's Files. It stays where it is, and isn't counted twice in storage.", "**New version** replaces a file and keeps the old one. **Restore** brings an old version back as a new copy, so nothing is overwritten.", "A file used by a submitted report can't be deleted. Deleting any other file removes all its versions, and can't be undone."] },
			],
			my: [
				{ p: "Project တစ်ခုချင်းမှာ ကိုယ်ပိုင်ဖိုင်တွေ ရှိပါတယ်။ Project မှာ ပါသူတိုင်း ဖွင့်လို့ရပြီး Owner၊ Manager နဲ့ Member တွေ ထည့်လို့ရပါတယ်။" },
				{ ul: ["**Files ကနေ ချိတ်ရန်** က အဖွဲ့အစည်းရဲ့ Files ထဲက ဖိုင်ကို သုံးတာပါ။ မူရင်းနေရာမှာပဲ ရှိပြီး Storage နှစ်ခါ မတွက်ပါဘူး။", "**ဗားရှင်းအသစ်** က ဖိုင်ကို အသစ်လဲပြီး အဟောင်းကို သိမ်းထားပါတယ်။ **ပြန်ယူရန်** က အဟောင်းကို ဗားရှင်းအသစ်အဖြစ် ကူးပေးလို့ ဘာမှ မပျောက်ပါဘူး။", "တင်ပြီးသား Report က သုံးထားတဲ့ ဖိုင်ကို ဖျက်လို့မရပါဘူး။ တခြားဖိုင်ဖျက်ရင် ဗားရှင်းအားလုံး ပျောက်ပြီး ပြန်ယူလို့ မရပါဘူး။"] },
			],
		},
	},
	{
		slug: "project-dashboards",
		category: "projects",
		title: { en: "Dashboards, Portfolio and completing a project", my: "Dashboard၊ Portfolio နဲ့ Project ပြီးဆုံးခြင်း" },
		summary: { en: "Turn a CSV into dashboard numbers, compare projects and close one properly.", my: "CSV ကနေ Dashboard ဂဏန်းလုပ်၊ Project တွေ နှိုင်းယှဉ်ပြီး မှန်မှန်ကန်ကန် ပိတ်ပါ။" },
		body: {
			en: [
				{ h: "Add numbers to a project's Dashboard" },
				{ steps: ["Upload your CSV to the project's **Files**. The limit is 2 MB, 2,000 rows and 30 columns.", "Go to **Dashboard** and select **Build from a data file**.", "Choose the **Label column**, the number columns and your **Widgets**.", "Check the numbers, then select **Publish to the dashboard**."] },
				{ p: "Published numbers stay as you checked them. If the file gets a new version, the Dashboard says so and keeps the old numbers until someone checks and publishes again." },
				{ h: "Compare projects" },
				{ p: "**Portfolio** shows all the projects you're allowed to see, including health by program. Spending comes from approved reports. Drafts and archived projects aren't counted." },
				{ h: "Complete a project" },
				{ p: "Select **Complete project**, and AidNova checks what's still open." },
				{ ul: ["Open milestones and reports that aren't approved stop you completing it, so fix those first.", "A project with no milestones or no report file gets a warning, but you can continue."] },
				{ p: "Completing it records who did it and when, and keeps every file, version and report. Only admins can **Reopen** it." },
			],
			my: [
				{ h: "Project Dashboard မှာ ဂဏန်းထည့်ရန်" },
				{ steps: ["CSV ကို Project ရဲ့ **Files** ထဲ တင်ပါ။ 2 MB၊ ၂,၀၀၀ တန်း၊ ကော်လံ ၃၀ အထိ ရပါတယ်။", "**Dashboard** ကိုသွားပြီး **Data ဖိုင်ကနေ ဖန်တီးရန်** ကို နှိပ်ပါ။", "**Label column**၊ ဂဏန်းကော်လံတွေနဲ့ Widget တွေ ရွေးပါ။", "ဂဏန်းတွေ စစ်ပြီး **Dashboard သို့ တင်ရန်** ကို နှိပ်ပါ။"] },
				{ p: "တင်ပြီးသား ဂဏန်းတွေက စစ်ထားတဲ့အတိုင်း ရှိနေပါတယ်။ ဖိုင်ဗားရှင်းအသစ်ရောက်ရင် Dashboard က ပြောပြပြီး တစ်ယောက်ယောက် ပြန်စစ်၊ ပြန်တင်တဲ့အထိ ဂဏန်းဟောင်းတွေ ပြနေပါမယ်။" },
				{ h: "Project တွေ နှိုင်းယှဉ်ရန်" },
				{ p: "**Portfolio** မှာ ကြည့်ခွင့်ရှိတဲ့ Project အားလုံးကို Program အလိုက် Health နဲ့ ပြပါတယ်။ သုံးငွေက အတည်ပြုပြီး Report တွေကနေ လာပါတယ်။ Draft နဲ့ Archive လုပ်ထားတာတွေ မပေါင်းပါဘူး။" },
				{ h: "Project ပြီးဆုံးရန်" },
				{ p: "**Project ပြီးဆုံးရန်** ကိုနှိပ်ရင် ဘာတွေကျန်သေးလဲ AidNova က စစ်ပါတယ်။" },
				{ ul: ["မပြီးသေးတဲ့ Milestone နဲ့ အတည်မပြုရသေးတဲ့ Report တွေ ရှိရင် ပြီးဆုံးလို့ မရလို့ အရင်ရှင်းပါ။", "Milestone ဒါမှမဟုတ် Report ဖိုင် မရှိရင် သတိပေးပေမဲ့ ဆက်လုပ်လို့ရပါတယ်။"] },
				{ p: "ဘယ်သူ ဘယ်အချိန် ပိတ်လဲ မှတ်ပြီး ဖိုင်၊ ဗားရှင်းနဲ့ Report အားလုံး ကျန်ပါတယ်။ Admin ပဲ **ပြန်ဖွင့်ရန်** လုပ်လို့ရပါတယ်။" },
			],
		},
	},
	{
		slug: "what-is-people-and-skills",
		category: "capacity",
		title: { en: "What is People & Skills?", my: "People & Skills ဆိုတာ ဘာလဲ" },
		summary: { en: "A directory for finding colleagues who know what you need.", my: "လိုအပ်တာ တတ်တဲ့ လုပ်ဖော်ကိုင်ဖက်တွေ ရှာတဲ့နေရာပါ။" },
		body: {
			en: [
				{ p: "**People & Skills** helps you find colleagues who know something you need, such as someone with M&E or first aid experience." },
				{ shot: "directory", alt: "The People & Skills directory." },
				{ ul: ["Only people who choose to be listed appear.", "Each person decides what to show on their card.", "Skills shown here have been verified through Capacity Building."] },
				{ p: "Next: [People & Skills directory](guide:people-and-skills)." },
			],
			my: [
				{ p: "**People & Skills** က M&E ဒါမှမဟုတ် First aid အတွေ့အကြုံရှိသူလို လိုအပ်တာ တတ်တဲ့ လုပ်ဖော်ကိုင်ဖက်တွေ ရှာဖို့ပါ။" },
				{ shot: "directory", alt: "People & Skills စာမျက်နှာ" },
				{ ul: ["ကိုယ်တိုင်ရွေးတဲ့သူတွေပဲ ပါဝင်ပါတယ်။", "ကိုယ့်ကတ်မှာ ဘာပြမလဲ ကိုယ်တိုင် ဆုံးဖြတ်ပါတယ်။", "ဒီမှာပြတဲ့ Skill တွေက Capacity Building မှာ Verified ဖြစ်ပြီးသားတွေပါ။"] },
				{ p: "ဆက်ဖတ်ရန်: [People & Skills](guide:people-and-skills)။" },
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
		slug: "what-are-reports",
		category: "admin",
		title: { en: "What are Reports?", my: "Reports ဆိုတာ ဘာလဲ" },
		summary: { en: "Figures on courses, policies and files for donors, audits and board meetings.", my: "အလှူရှင်၊ Audit နဲ့ Board Meeting တွေအတွက် Course၊ Policy၊ File ကိန်းဂဏန်းတွေပါ။" },
		body: {
			en: [
				{ p: "**Reports** shows admins and managers how your organization is doing, in a form that's ready for donors, audits and board meetings." },
				{ shot: "reports", alt: "The Reports page, with figures and a chart." },
				{ ul: ["See course completion, policy acknowledgments, announcements and file activity.", "Look at any **Period**, and compare departments.", "See who opened something, person by person, if an admin allows it. They can choose under **Settings**, then **General**."] },
				{ p: "Capacity Building records are never part of these reports." },
				{ p: "Next: [Reports, your plan and settings](guide:reports-and-plan)." },
			],
			my: [
				{ p: "**Reports** က အဖွဲ့အစည်းအခြေအနေကို Admin နဲ့ Manager တွေကို ပြပေးတာပါ။ အလှူရှင်၊ Audit နဲ့ Board Meeting တွေမှာ သုံးလို့ရပါတယ်။" },
				{ shot: "reports", alt: "ကိန်းဂဏန်းနဲ့ Chart ပါတဲ့ Reports စာမျက်နှာ" },
				{ ul: ["Course ပြီးမှု၊ Policy အတည်ပြုမှု၊ Announcement နဲ့ File အသုံးပြုမှု ကြည့်ပါ။", "**ကာလ** ရွေးပြီး ဌာနတွေ နှိုင်းယှဉ်ပါ။", "Admin ခွင့်ပြုထားရင် ဘယ်သူဖွင့်လဲ တစ်ယောက်ချင်း ကြည့်လို့ရပါတယ်။ **Settings** ထဲက **General** မှာ ရွေးပါတယ်။"] },
				{ p: "Capacity Building မှတ်တမ်းတွေ ဒီ Report မှာ ဘယ်တော့မှ မပါပါဘူး။" },
				{ p: "ဆက်ဖတ်ရန်: [Reports၊ Plan နဲ့ Settings](guide:reports-and-plan)။" },
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
	{
		slug: "manage-people",
		category: "admin",
		title: { en: "Roles, locked-out staff and leavers", my: "Role၊ အကောင့်ဝင်မရသူနဲ့ ထွက်သွားသူ" },
		summary: { en: "Help someone who can't sign in, and remove access when someone leaves.", my: "အကောင့်ဝင်မရသူကို ကူညီပြီး ထွက်သွားသူရဲ့ ဝင်ခွင့် ပိတ်ပါ။" },
		body: {
			en: [
				{ p: "Go to **Users** and open the menu beside a person. Admins can select **Change role**, but not for themselves or the organization's owner. See [Roles: who can do what](guide:roles)." },
				{ h: "Help someone who's locked out" },
				{ steps: ["An admin goes to **Settings**, then **Staff sign-in**.", "Choose the person and select **Send reset link**.", "Ask them to use it soon, because it expires in an hour."] },
				{ p: "They choose their own new password, and you never see it. It changes their sign-in everywhere, including any other organization they belong to." },
				{ h: "When someone leaves" },
				{ p: "An admin can select **Deactivate**. The person loses access to this organization straight away. To bring them back, select **Reactivate**." },
			],
			my: [
				{ p: "**Users** ကိုသွားပြီး လူတစ်ယောက်ဘေးက Menu ကို ဖွင့်ပါ။ Admin တွေ **Role ပြောင်းရန်** ကို ရွေးလို့ရပေမဲ့ ကိုယ့်ကိုယ်ကိုယ်နဲ့ အဖွဲ့အစည်း Owner ကို ပြောင်းလို့ မရပါဘူး။ [Role တွေ ဘာလုပ်လို့ရလဲ](guide:roles) ကို ကြည့်ပါ။" },
				{ h: "အကောင့်ဝင်မရသူကို ကူညီရန်" },
				{ steps: ["Admin က **Settings** ထဲက **ဝန်ထမ်း အကောင့်ဝင်ရောက်မှု** ကို သွားပါ။", "လူရွေးပြီး **Link ပို့ရန်** ကို နှိပ်ပါ။", "Link က တစ်နာရီနဲ့ သက်တမ်းကုန်လို့ မြန်မြန်သုံးဖို့ ပြောပါ။"] },
				{ p: "Password အသစ်ကို သူကိုယ်တိုင် ရွေးပြီး သင် မမြင်ရပါဘူး။ သူပါဝင်တဲ့ တခြားအဖွဲ့အစည်းတွေမှာပါ ပြောင်းသွားပါတယ်။" },
				{ h: "လူထွက်သွားရင်" },
				{ p: "Admin က **Deactivate လုပ်ရန်** ကို နှိပ်လို့ရပါတယ်။ ချက်ချင်း ဝင်လို့မရတော့ပါဘူး။ ပြန်ထည့်ချင်ရင် **ပြန်ဖွင့်ရန်** ကို နှိပ်ပါ။" },
			],
		},
	},
	{
		slug: "turn-on-modules",
		category: "admin",
		title: { en: "Turn modules on or off", my: "Module ဖွင့်၊ ပိတ်ရန်" },
		summary: { en: "Add Projects, Capacity Building and People & Skills for your organization.", my: "Projects၊ Capacity Building နဲ့ People & Skills ကို ဖွင့်ပါ။" },
		body: {
			en: [
				{ p: "Admins can go to **Settings**, then **Modules**. Everyday tools such as Policies, Courses and **Files & Hub** are always on. Projects, Capacity Building and People & Skills are optional." },
				{ shot: "modules", alt: "The Modules page, with each module and its status." },
				{ h: "Turn one on" },
				{ steps: ["Find the module. If it says **Not in your plan** or **Coming soon**, it can't be turned on yet.", "For Capacity Building and People & Skills, talk through the risks to staff with local colleagues, because who attends what or who has which skills can put people at risk in some places.", "Select **Record**, then add the **Date of the review** and **Who took part**. Names or roles are enough. Until this is done, **Turn on for staff** stays unavailable.", "Use the module's switch to turn it on."] },
				{ p: "Projects doesn't need a review." },
				{ h: "Turn one off" },
				{ p: "Use the module's switch, then select **Turn off** to confirm. The module disappears from everyone's menu right away. Its records and files are kept and still count toward storage, and everything comes back when you turn it on again." },
			],
			my: [
				{ p: "Admin တွေ **Settings** ထဲက **Modules** ကို သွားလို့ရပါတယ်။ Policies၊ Courses၊ Files & Hub လို နေ့စဉ်သုံးတာတွေက အမြဲဖွင့်ထားပါတယ်။ Projects၊ Capacity Building နဲ့ People & Skills ကို ရွေးဖွင့်လို့ရပါတယ်။" },
				{ shot: "modules", alt: "Module တစ်ခုချင်းနဲ့ အခြေအနေပြတဲ့ Modules စာမျက်နှာ" },
				{ h: "ဖွင့်ရန်" },
				{ steps: ["Module ကို ရှာပါ။ Plan မှာ မပါရင် ဒါမှမဟုတ် Coming soon ဆိုရင် အခုဖွင့်လို့ မရသေးပါဘူး။", "Capacity Building နဲ့ People & Skills အတွက် ဝန်ထမ်းတွေအပေါ် အန္တရာယ်ကို ဒေသခံလုပ်ဖော်ကိုင်ဖက်တွေနဲ့ ဆွေးနွေးပါ။ ဘယ်သူ ဘာတက်လဲ၊ ဘယ်သူ ဘာတတ်လဲဆိုတာ တချို့နေရာတွေမှာ အန္တရာယ်ဖြစ်စေနိုင်လို့ပါ။", "**မှတ်တမ်းတင်ရန်** ကိုနှိပ်ပြီး **Review ရက်** နဲ့ **ပါဝင်သူများ** ထည့်ပါ။ အမည် ဒါမှမဟုတ် Role ထည့်ရင် ရပါပြီ။ ဒါမပြီးသေးရင် **ဝန်ထမ်းတွေအတွက် ဖွင့်ရန်** ကို နှိပ်လို့ မရပါဘူး။", "Module ရဲ့ ခလုတ်ကို နှိပ်ပြီး ဖွင့်ပါ။"] },
				{ p: "Projects အတွက် Review မလိုပါဘူး။" },
				{ h: "ပိတ်ရန်" },
				{ p: "Module ရဲ့ ခလုတ်ကိုနှိပ်ပြီး **ပိတ်ရန်** နဲ့ အတည်ပြုပါ။ လူတိုင်းရဲ့ Menu က ချက်ချင်းပျောက်ပါတယ်။ မှတ်တမ်းနဲ့ ဖိုင်တွေ ကျန်ပြီး Storage ထဲ ဆက်တွက်ပါတယ်။ ပြန်ဖွင့်ရင် အားလုံး ပြန်ရပါတယ်။" },
			],
		},
	},
	{
		slug: "account-and-security",
		category: "admin",
		title: { en: "Turn on two-step verification", my: "Two-step verification ဖွင့်ရန်" },
		summary: { en: "Protect your account with a code from your phone, and what to do if you lose it.", my: "ဖုန်းက ကုဒ်နဲ့ အကောင့်ကာကွယ်ပါ၊ ဖုန်းပျောက်ရင် ဘာလုပ်ရမလဲ။" },
		body: {
			en: [
				{ p: "This asks for a code from your phone when you sign in. We recommend it for admins." },
				{ steps: ["Go to **Settings**, then **Account & security**.", "Under **Two-step verification**, select **Turn on**.", "Scan the code with an authenticator app, such as Google Authenticator or Microsoft Authenticator.", "Enter the 6-digit code and select **Verify**.", "Save your backup codes somewhere safe, then select **Finish**."] },
				{ tip: "Each backup code works once, and they won't be shown again. If you lose your phone, select **Use a backup code instead** when you sign in." },
				{ p: "If a phone is lost or shared, select **Sign out of other devices** on the same page." },
			],
			my: [
				{ p: "အကောင့်ဝင်တဲ့အခါ ဖုန်းက ကုဒ်ကို တောင်းပါတယ်။ Admin တွေအတွက် အကြံပြုပါတယ်။" },
				{ steps: ["**Settings** ထဲက **Account & security** ကို သွားပါ။", "**Two-step verification** မှာ **ဖွင့်ရန်** ကို နှိပ်ပါ။", "Google Authenticator ဒါမှမဟုတ် Microsoft Authenticator လို App နဲ့ ကုဒ်ကို Scan လုပ်ပါ။", "ဂဏန်း ၆ လုံး ထည့်ပြီး **အတည်ပြုရန်** ကို နှိပ်ပါ။", "Backup ကုဒ်တွေကို လုံခြုံတဲ့နေရာ သိမ်းပြီး **ပြီးပါပြီ** ကို နှိပ်ပါ။"] },
				{ tip: "Backup ကုဒ်တစ်ခုကို တစ်ခါပဲ သုံးလို့ရပြီး နောက်ထပ် ပြန်မပြပါဘူး။ ဖုန်းပျောက်ရင် အကောင့်ဝင်တဲ့အခါ **Backup ကုဒ် သုံးရန်** ကို နှိပ်ပါ။" },
				{ p: "ဖုန်းပျောက်ရင် ဒါမှမဟုတ် မျှသုံးခဲ့ရင် ဒီစာမျက်နှာက **တခြားစက်တွေက ထွက်ရန်** ကို နှိပ်ပါ။" },
			],
		},
	},
];

export const guidesHome = (lang: GuideLang) => (lang === "my" ? "/my/guides" : "/guides");
export const guidePath = (guide: Guide, lang: GuideLang) => `${guidesHome(lang)}/${guide.category}/${guide.slug}`;

// People still search in Burmese for words the guides keep in English.
export const guideSearchWord = (word: string) => (word.startsWith("ဖိတ်") ? "invite" : word);

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
