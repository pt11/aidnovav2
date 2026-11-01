const en = {
	meta: {
		title: "AidNova: Policy Management and Staff Training for NGOs",
		description:
			"Policy management and staff training software built for NGOs and nonprofits. Track acknowledgments, run courses and keep records for donors, in English and Myanmar.",
	},
	hero: {
		badge: "Built for NGOs",
		badgeCta: "14-day free trial",
		title: ["Policies. Training.", "One place for all of it."],
		lead: "Stop losing policies in shared drives and chasing training records across spreadsheets. One secure hub for your NGO — in English and Myanmar.",
		primary: "Start your free trial",
		secondary: "",
		setup: "Set up in under an hour",
	},
	preview: {
		label: "Product preview",
		policyUpdated: "Safeguarding 2026",
		ackText: "22 of 24 staff acknowledged",
		certificate: "Certificate issued",
		certificateCourse: "Field Safety Training",
		illustrative: "Illustrative data",
		screenAlt: "The AidNova dashboard, with policy acknowledgment, course completion and what needs attention",
	},
	trustRow: {
		title: "Built around how NGO teams actually work",
		items: ["Role-based access", "Department and PIN-protected files", "English and Myanmar", "Installs on phones", "CSV exports for donors and audits"],
	},
	problem: {
		eyebrow: "Sound familiar?",
		title: "Most NGOs still run on shared drives and group chats.",
		whoRead: "Who read it?",
		read: "Read",
		inbox: "Inbox",
		conflict: "Version conflict",
		outdated: "Outdated — 2026 exists",
		current: "Current version",
		points: [
			{
				title: "Policies buried in folders",
				text: "The latest HR policy is somewhere in a shared drive — nobody can find it, and you can't prove anyone read it.",
			},
			{
				title: "No record of who learned what",
				text: "Training happened, but you can't show a funder or auditor who completed it.",
			},
			{ title: "Zero accountability", text: "You emailed the update. You have no idea who actually read it." },
		],
	},
	features: {
		eyebrow: "Features",
		title: ["Make your team’s work", "easier to run"] as string | string[],
		lead: "Policies, training, projects and an assistant that answers from your documents — in one place.",
		illustrative: "Illustrative data",
		more: "See all features →",
		policyFloat: "22 of 24 acknowledged",
		askFloat: "Answers name the source",
		policy: {
			title: "Policy management",
			text: "Publish policies and see exactly who has acknowledged them — with reminders for the rest.",
			alt: "The Policies page, with acknowledgment progress for each policy",
		},
		learning: {
			title: "Learning Hub",
			text: "Modules, quizzes and printable certificates, structured into clear courses.",
			alt: "A course lesson, with a certificate of completion beside it",
		},
		projects: {
			title: "Projects",
			early: "Early access",
			text: "Track milestones, share files and approve reports for every programme.",
			alt: "A project overview, with milestones, budget, people reached and reports",
		},
		ask: {
			title: "Ask AidNova",
			text: "Ask about your policies and files in English or Myanmar. Answers name their sources.",
			alt: "AidNova answering a question about annual leave, with links to the source policies",
		},
	},
	benefits: {
		eyebrow: "Benefits",
		title: ["Benefits that matter", "to your team"] as string | string[],
		lead: "Less chasing, clearer records, and a team that knows where everything is.",
		items: [
			{ icon: "lock", title: "Role-based access", text: "Departments and roles set once; everyone sees only what they should." },
			{ icon: "shield", title: "Protected files", text: "Limit files to departments and lock sensitive ones with a PIN." },
			{ icon: "globe", title: "English and Myanmar", text: "Switch the whole interface between English and Myanmar anytime." },
			{ icon: "chart", title: "Reports for donors", text: "Export acknowledgment and completion reports to CSV for donors and audits." },
			{ icon: "megaphone", title: "Announcements", text: "Send urgent notices and updates to the whole team, right in the app." },
			{ icon: "clock", title: "Set up in an hour", text: "Create your workspace, add your staff and publish your first policy." },
		],
	},
	how: {
		eyebrow: "How it works",
		title: ["Up and running", "in 3 simple steps"] as string | string[],
		lead: "Most teams are set up in under an hour.",
		orgLabel: "Organization name",
		createLabel: "Create workspace",
		steps: [
			{ label: "Step 1", title: "Create your workspace", text: "Add your organization name and departments." },
			{ label: "Step 2", title: "Add your staff", text: "Invite people one by one or import a CSV, and give each a role." },
			{ label: "Step 3", title: "Publish your first policy", text: "Share it with the right departments and track who has read it." },
		],
	},
	hub: {
		eyebrow: "Employee Hub",
		title: "Everything your staff needs, right where they look",
		lead: "Policies, documents, useful links and shared Drive resources — one search, less chasing.",
		points: [] as string[],
		cta: "Explore the Hub",
		moreHref: "/employee-hub",
		screenAlt: "The Employee Hub search, showing an answer about annual leave and results from policies, courses and files",
		phoneAlt: "AidNova on a phone, showing a staff member’s to-do list and announcements",
	},
	why: {
		eyebrow: "Why AidNova",
		title: ["A clearer way to run", "your team"] as string | string[],
		lead: "Here’s the difference from shared drives and group chats.",
		beforeTitle: "Shared drives & chats",
		before: [
			"Policies buried in shared-drive folders",
			"“FINAL_v2_USE_THIS.pdf” version confusion",
			"No record of who read the update",
			"Training records across spreadsheets",
			"Hard to show funders what was done",
		],
		after: [
			"Every policy in one searchable place",
			"One current version for everyone",
			"Acknowledgments tracked for every person",
			"Courses, quizzes and certificates together",
			"CSV reports for donors and audits",
		],
	},
	pricing: {
		eyebrow: "Pricing",
		title: "Simple, honest pricing",
		lead: "Every workspace starts with a 14-day free trial of the full product. Request an upgrade from inside the app when you’re ready.",
		period: "Billing period",
		monthly: "Monthly",
		yearly: "Yearly",
		yearlySave: "2 months free",
		perMonth: "/month",
		perYear: "/year",
		cta: "Start free trial",
		included: "What’s included",
		flag: "For larger teams",
		basic: {
			description: "For growing organizations",
			items: [
				"Up to 50 users",
				"Policies and acknowledgments",
				"Courses, quizzes and certificates",
				"Hub, files and team calendar",
				"AI assistant (beta)",
				"Email support",
			],
		},
		plus: {
			description: "Everything your organization needs to scale",
			items: [
				"Up to 100 users",
				"Everything in Basic",
				"English and Myanmar",
				"Reports for donors and audits",
				"Access by department and role",
				"Priority support",
			],
		},
		addons: {
			name: "Plus + add-ons",
			users: "150 users",
			description: "For more than 100 users",
			cta: "See add-on pricing",
			items: ["Everything in Plus", "Add 25 users at a time", "+$10/month for each 25 users", "Custom quote above 300 users"],
		},
		noteMonthly: "Prices in USD per organization.",
		noteYearly: "Yearly plans cost the same as 10 months.",
		more: "Above 300 users,",
		talk: "talk to us",
		moreEnd: ".",
	},
	faq: {
		eyebrow: "FAQ",
		title: ["Common questions,", "clear answers"] as string | string[],
		items: [
			{
				question: "Who can see our staff information?",
				answer:
					"Access follows roles. Managers and admins see full profiles and learning records; staff can't open each other's. Files and policies can be limited to departments, and sensitive files locked with a PIN.",
			},
			{
				question: "Can we export reports for donors or audits?",
				answer:
					"Yes. Managers and admins can export CSV reports of policy acknowledgments and course completions anytime.",
			},
			{
				question: "How quickly can we get set up?",
				answer:
					"Most teams are up and running in under an hour: create your workspace, add your staff, and publish your first policy.",
			},
			{
				question: "How many staff can we add?",
				answer:
					"Basic covers up to 50 users and Plus up to 100. On Plus you can add 25 users at a time; for more than 300, talk to us.",
			},
			{
				question: "What happens when the trial ends?",
				answer:
					"Request an upgrade from inside the app and we'll activate your plan. Your policies, courses and records stay as you left them.",
			},
			{
				question: "Can we change plans or cancel?",
				answer: "Yes. Upgrade whenever you like, or cancel with 30 days' notice. There's no long-term contract.",
			},
		],
	},
	cta: {
		title: ["Your team is doing important work.", "Give them the tools to show for it."],
		text: "Set up your workspace in minutes with a 14-day free trial.",
		button: "Start your free trial",
	},
};

export type HomeCopy = typeof en;

// The copywriter's translation. Plan limits and a few product claims differ from
// the source so the page matches the quotation and what the app does. Sections
// the translation doesn't cover (benefits heading, steps, comparison, add-ons)
// use wording from the Myanmar design.
const my: HomeCopy = {
	...en,
	meta: {
		title: "AidNova | NGO နှင့် ကုမ္ပဏီများအတွက် Policy၊ SOP နှင့် ဝန်ထမ်းသင်တန်း စီမံခန့်ခွဲမှုစနစ်",
		description:
			"ရုံးတွင်း မူဝါဒ (Policy & SOP) ထုတ်ပြန်ခြင်း၊ ဝန်ထမ်းသင်တန်း (Staff Training) ပို့ချခြင်းနှင့် Donor Audit စစ်ဆေးမှုအတွက် အထောက်အထားမှတ်တမ်းများကို တစ်နေရာတည်းတွင် စနစ်တကျ စီမံခန့်ခွဲနိုင်သော မြန်မာ-အင်္ဂလိပ် နှစ်ဘာသာသုံး Digital Platform။",
	},
	hero: {
		badge: "NGO များ၊ INGO များနှင့် ခေတ်မီအဖွဲ့အစည်းများအတွက်",
		badgeCta: "၁၄ ရက် အခမဲ့ စမ်းသပ်ခွင့်",
		title: ["ရုံးတွင်းမူဝါဒ (Policy) နဲ့ ဝန်ထမ်းသင်တန်းတွေကို", "တစ်နေရာတည်းမှာ အလွယ်ကူဆုံး စီမံခန့်ခွဲလိုက်ပါ။"],
		lead: "Google Drive ဖိုင်တွဲတွေ၊ Viber နဲ့ Telegram Group တွေထဲမှာ ရုံးတွင်းစည်းမျဉ်းနဲ့ သင်တန်းဖိုင်တွေ ပျောက်ဆုံးနေတတ်ပါသလား? AidNova က မူဝါဒအသစ် ထုတ်ပြန်တာ၊ ဝန်ထမ်းတွေ ဖတ်ရှုကြောင်း လက်မှတ်ယူတာနဲ့ Audit စစ်ဆေးမှုအတွက် အစီရင်ခံစာ ထုတ်ယူတာတွေကို အချိန်ကုန်သက်သာစွာ တာဝန်ယူပေးနိုင်ပါတယ်။",
		primary: "၁၄ ရက် အခမဲ့ စမ်းသုံးကြည့်ပါ",
		secondary: "စနစ်အလုပ်လုပ်ပုံ ကြည့်ရန်",
		setup: "တစ်နာရီအတွင်း စတင်အသုံးပြုနိုင်",
	},
	preview: {
		...en.preview,
		label: "ပလက်ဖောင်း နမူနာ",
		policyUpdated: "မူဝါဒအသစ် ထုတ်ပြန်ချက်",
		certificate: "သင်တန်းဆင်းလက်မှတ် ရရှိပြီး",
	},
	trustRow: {
		title: "NGO အဖွဲ့များ၏ အမှန်တကယ် လုပ်ကိုင်ပုံအတိုင်း တည်ဆောက်ထားသည်",
		items: ["ဘဏ်ကတ်ချိတ်ဆက်ရန် မလိုပါ", "၁၄ ရက် အခမဲ့ စမ်းသပ်ခွင့်", "မြန်မာ (Unicode) + အင်္ဂလိပ် နှစ်ဘာသာသုံး", "Donor & Audit စစ်ဆေးမှုအတွက် အသင့်သုံး"],
	},
	problem: {
		...en.problem,
		eyebrow: "ရုံးတိုင်းလိုလို ကြုံတွေ့နေရသည့် အခက်အခဲ",
		title: "မူဝါဒဖိုင်တွေနဲ့ သင်တန်းမှတ်တမ်းတွေကို Drive တွေ၊ Chat Group တွေထဲမှာပဲ လိုက်ရှာနေရတုန်းပဲလား?",
		points: [
			{
				title: "ဖိုင်ဗားရှင်းအမှန်ကို ရှာမတွေ့တော့ခြင်း",
				text: "အီးမေးလ်၊ Google Drive နဲ့ Chat Group အမျိုးမျိုးကြားမှာ ဘယ်ဖိုင်က နောက်ဆုံးအတည်ပြုထားတဲ့ Policy အသစ်လဲဆိုတာ ဝန်ထမ်းတွေ အမြဲဇဝေဇဝါဖြစ်ပြီး ရှာဖွေရခက်ခဲနေတတ်ပါတယ်။",
			},
			{
				title: "ဝန်ထမ်းတွေ တကယ်ဖတ်၊ မဖတ် မသိနိုင်ခြင်း",
				text: "ရုံးတွင်းစည်းမျဉ်းအသစ် (SOP/Policy) ပို့လိုက်ပေမယ့် ဘယ်ဝန်ထမ်းက သေချာဖတ်ရှုနားလည်ပြီးပြီလဲ၊ ဘယ်သူက မဖတ်ရသေးဘူးလဲဆိုတာ HR နဲ့ စီမံခန့်ခွဲသူတွေ အတိအကျ မသိနိုင်ပါဘူး။",
			},
			{
				title: "Audit ဝင်ခါနီးမှ အပူတပြင်း လိုက်စုနေရခြင်း",
				text: "Donor (အလှူရှင်) နဲ့ Audit စစ်ဆေးရေးအဖွဲ့တွေ လာခါနီးမှ ဝန်ထမ်းလက်မှတ်တွေ၊ PSEA နဲ့ Safeguarding သင်တန်းဆင်းမှတ်တမ်းတွေကို အချိန်လုပြီး စာရွက်ပုံကြားထဲ လိုက်ရှာနေရတတ်ပါတယ်။",
			},
		],
	},
	features: {
		...en.features,
		eyebrow: "AidNova ၏ အဓိက လုပ်ဆောင်ချက်များ",
		title: "HR နဲ့ စီမံခန့်ခွဲရေးအဖွဲ့တွေ အချိန်ကုန်သက်သာစေဖို့ လိုအပ်သမျှ တစ်နေရာတည်းမှာ ပြည့်စုံစွာ ပါဝင်ပါတယ်။",
		lead: "နည်းပညာရှုပ်ထွေးမှု လုံးဝမရှိဘဲ မူဝါဒဖြန့်ဝေခြင်းမှစ၍ သင်တန်းပို့ချခြင်းနှင့် Audit Report ထုတ်ယူခြင်းအထိ လွယ်ကူချောမွေ့စွာ လုပ်ဆောင်နိုင်ပါတယ်။",
		more: "See all features (English) →",
		policy: {
			...en.features.policy,
			title: "မူဝါဒနှင့် SOP များ စနစ်တကျ ထိန်းသိမ်းခြင်း",
			text: "ရုံးတွင်းမူဝါဒ (Policy) နဲ့ လုပ်ငန်းလမ်းညွှန် (SOP) ဖိုင်တွေကို ဗားရှင်းအလိုက် စနစ်တကျ သိမ်းဆည်းပြီး ဝန်ထမ်းအားလုံးဆီ တစ်ချက်နှိပ်ရုံနဲ့ အသိပေးဖြန့်ဝေနိုင်ပါတယ်။",
		},
		learning: {
			...en.features.learning,
			title: "ဝန်ထမ်းသင်တန်းများ (Staff Training) စီစဉ်ပို့ချခြင်း",
			text: "ဝန်ထမ်းသစ် မိတ်ဆက်သင်တန်း (Onboarding) နဲ့ မသင်မနေရ သင်တန်းတွေကို အဆင့်ဆင့် စီစဉ်ပြီး အွန်လိုင်းမှတစ်ဆင့် လွယ်ကူစွာ ပို့ချနိုင်ပါတယ်။",
		},
		projects: {
			...en.features.projects,
			title: "ပရောဂျက်များ",
			text: "အစီအစဉ်တိုင်းအတွက် မှတ်တိုင်များ ခြေရာခံ၊ ဖိုင်မျှဝေပြီး အစီရင်ခံစာများကို အတည်ပြုနိုင်ပါတယ်။",
		},
		ask: {
			...en.features.ask,
			text: "သင့်မူဝါဒနဲ့ ဖိုင်တွေအကြောင်း မေးမြန်းနိုင်ပြီး အဖြေတိုင်းမှာ ရင်းမြစ်ကို ဖော်ပြပေးပါတယ်။",
		},
	},
	benefits: {
		eyebrow: "အကျိုးကျေးဇူးများ",
		title: ["သင့်အဖွဲ့အတွက် အရေးပါသော", "အကျိုးကျေးဇူးများ"],
		lead: "လိုက်ရှာရတာ နည်းပြီး မှတ်တမ်းများ ရှင်းလင်းကာ အရာအားလုံး ဘယ်မှာရှိလဲ အဖွဲ့တစ်ခုလုံး သိသည်။",
		items: [
			{ icon: "check", title: "ဖတ်ရှုပြီးကြောင်း အတည်ပြုလက်မှတ် ရယူခြင်း", text: "ဘယ်ဝန်ထမ်းက မူဝါဒအသစ်ကို ဖတ်ရှုအတည်ပြုပြီးပြီလဲ၊ ဘယ်သူတွေ ကျန်နေသေးလဲဆိုတာ Dashboard ပေါ်မှာ အချိန်နှင့်တစ်ပြေးညီ ရှင်းလင်းစွာ ကြည့်ရှုနိုင်ပါတယ်။" },
			{ icon: "lock", title: "ဌာနနှင့် ရာထူးအလိုက် သီးသန့်တာဝန်ပေးခြင်း", text: "ဌာနနဲ့ ရာထူးအလိုက် သက်ဆိုင်ရာ ဝန်ထမ်းဖတ်ရှုရမယ့် မူဝါဒနဲ့ ဖိုင်တွေကိုသာ တိကျစွာ ခွဲခြားသတ်မှတ်ပေးနိုင်ပါတယ်။" },
			{ icon: "shield", title: "ကာကွယ်ထားသော ဖိုင်များ", text: "ဖိုင်တွေကို ဌာနအလိုက် ကန့်သတ်ပြီး အရေးကြီးဖိုင်တွေကို PIN နဲ့ ပိတ်ထားနိုင်ပါတယ်။" },
			{ icon: "globe", title: "မြန်မာ - အင်္ဂလိပ် နှစ်ဘာသာ သုံးစွဲနိုင်မှု", text: "နိုင်ငံတကာအဖွဲ့အစည်းနဲ့ ပြည်တွင်းဝန်ထမ်း အားလုံး အဆင်ပြေစေဖို့ မူဝါဒနဲ့ သင်တန်းတွေကို မြန်မာဘာသာရော အင်္ဂလိပ်ဘာသာဖြင့်ပါ တစ်ပြိုင်နက် ထားရှိပေးနိုင်ပါတယ်။" },
			{ icon: "chart", title: "Audit နှင့် Donor အတွက် အသင့်သုံး Report များ", text: "အလှူရှင်နဲ့ စာရင်းစစ်အဖွဲ့တွေ တောင်းခံလာတဲ့အခါ ဝန်ထမ်းလိုက်နာမှုမှတ်တမ်း (Compliance Report) အပြည့်အစုံကို စက္ကန့်ပိုင်းအတွင်း ဒေါင်းလုဒ်ဆွဲယူနိုင်ပါတယ်။" },
			{ icon: "quote", title: "ဉာဏ်စမ်းမေးခွန်းများဖြင့် နားလည်မှု စစ်ဆေးခြင်း", text: "သင်တန်းပြီးဆုံးချိန်မှာ ဝန်ထမ်းတွေ အမှန်တကယ် နားလည်သဘောပေါက်မှု ရှိ၊ မရှိ Quiz မေးခွန်းတိုများဖြင့် ပြန်လည်စစ်ဆေး အကဲဖြတ်နိုင်ပါတယ်။" },
			{ icon: "star", title: "သင်တန်းဆင်းလက်မှတ် အလိုအလျောက် ထုတ်ပေးခြင်း", text: "သင်တန်းတက်ရောက်ပြီး သတ်မှတ်အမှတ် ပြည့်မီသူတိုင်းအတွက် အဖွဲ့အစည်းအမည်နှင့် ရက်စွဲပါသော Certificate ကို စနစ်မှ အလိုအလျောက် ထုတ်ပေးပါတယ်။" },
			{ icon: "calendar", title: "သတ်မှတ်ရက်နှင့် သတိပေးချက် ပေးပို့ခြင်း", text: "HR က တစ်ယောက်ချင်း လိုက်သတိပေးနေစရာ မလိုဘဲ ဖတ်ရှုရန် ကျန်နေသူများအားလုံးထံ တစ်ချက်နှိပ်ရုံနဲ့ သတိပေးချက် ပို့နိုင်ပါတယ်။" },
			{ icon: "megaphone", title: "ကြေညာချက်များ", text: "အရေးပေါ် အသိပေးချက်နဲ့ အပ်ဒိတ်တွေကို အဖွဲ့တစ်ခုလုံးဆီ app ထဲကနေ ပို့နိုင်ပါတယ်။" },
		],
	},
	how: {
		eyebrow: "အသုံးပြုပုံ",
		title: ["ရိုးရှင်းသော အဆင့် ၃ ဆင့်ဖြင့်", "စတင်အသုံးပြုပါ"],
		lead: "အဖွဲ့အများစုသည် တစ်နာရီအတွင်း စတင်အသုံးပြုနိုင်ပါသည်။",
		orgLabel: "Organization name",
		createLabel: "Create workspace",
		steps: [
			{ label: "အဆင့် ၁", title: "workspace ဖန်တီးပါ", text: "အဖွဲ့အစည်းအမည်နှင့် ဌာနများကို ထည့်ပါ။" },
			{ label: "အဆင့် ၂", title: "ဝန်ထမ်းများ ထည့်ပါ", text: "တစ်ဦးချင်း Invite လုပ်ပါ သို့မဟုတ် CSV ဖြင့် ထည့်သွင်းပြီး တစ်ဦးချင်းစီကို ရာထူး သတ်မှတ်ပါ။" },
			{ label: "အဆင့် ၃", title: "ပထမဆုံး မူဝါဒကို ထုတ်ပြန်ပါ", text: "သက်ဆိုင်ရာ ဌာနများနှင့် မျှဝေပြီး မည်သူ ဖတ်ပြီးကြောင်း ခြေရာခံပါ။" },
		],
	},
	hub: {
		...en.hub,
		eyebrow: "ဝန်ထမ်းသုံး မျက်နှာပြင် (Staff Portal)",
		title: "နည်းပညာ ကျွမ်းကျင်စရာမလိုဘဲ ဝန်ထမ်းတိုင်း အလွယ်တကူ အသုံးပြုနိုင်မယ့် ဒီဇိုင်း။",
		lead: "ရုံးချုပ်ဝန်ထမ်းဖြစ်စေ၊ နယ်မြေကွင်းဆင်း (Field Staff) ဝန်ထမ်းဖြစ်စေ ဖုန်း သို့မဟုတ် ကွန်ပျူတာဖြင့် အကောင့်ဝင်လိုက်ရုံနှင့် မိမိဖတ်ရမည့် မူဝါဒ၊ တက်ရောက်ရမည့် သင်တန်းနှင့် ရရှိထားသော လက်မှတ်များကို တစ်နေရာတည်းတွင် ရှင်းလင်းစွာ မြင်တွေ့နိုင်ပါတယ်။",
		points: [
			"ရှင်းလင်းပြီး မျက်စိရှုပ်ထွေးမှုမရှိသော ဝန်ထမ်းသုံး Dashboard",
			"မိုဘိုင်းဖုန်းရော ကွန်ပျူတာမှာပါ အဆင်ပြေစွာ သုံးနိုင်ခြင်း",
			"သင်တန်းအောင်မြင်သည်နှင့် မိမိ၏ Certificate ကို ချက်ချင်း ထုတ်ယူနိုင်ခြင်း",
		],
		cta: "ဝန်ထမ်းမြင်ကွင်းကို လက်တွေ့စမ်းကြည့်ရန်",
	},
	why: {
		...en.why,
		eyebrow: "AidNova ကို ဘာကြောင့်ရွေးသင့်လဲ",
		title: ["သင့်အဖွဲ့ကို ပိုမိုရှင်းလင်းစွာ", "စီမံနိုင်သော နည်းလမ်း"],
		lead: "Shared Drive နှင့် Group Chat များနှင့် ကွာခြားချက်။",
		beforeTitle: "Shared Drive နှင့် Chat များ",
		before: [
			"မူဝါဒများ ဖိုင်တွဲများထဲ မြုပ်နေခြင်း",
			"“FINAL_v2_USE_THIS.pdf” ဗားရှင်း ရှုပ်ထွေးမှု",
			"မည်သူ ဖတ်ပြီးကြောင်း မှတ်တမ်းမရှိခြင်း",
			"သင်တန်းမှတ်တမ်းများ spreadsheet များတွင် ပြန့်ကျဲနေခြင်း",
			"ဆောင်ရွက်ခဲ့သည်များကို အလှူရှင်အား ပြသရန် ခက်ခဲခြင်း",
		],
		after: [
			"မူဝါဒအားလုံး ရှာဖွေနိုင်သော တစ်နေရာတည်းတွင်",
			"လက်ရှိဗားရှင်း တစ်ခုတည်း၊ မှတ်တမ်းနှင့်အတူ",
			"လူတိုင်း၏ အတည်ပြုမှုကို မှတ်တမ်းတင်ထားသည်",
			"သင်တန်း၊ ဉာဏ်စမ်းနှင့် လက်မှတ်များ အတူတကွ",
			"အလှူရှင်နှင့် စာရင်းစစ်အတွက် CSV အစီရင်ခံစာ",
		],
	},
	pricing: {
		...en.pricing,
		eyebrow: "ဝန်ဆောင်ခ နှုန်းထားများ",
		title: "အဖွဲ့အစည်းအရွယ်အစားအလိုက် ရွေးချယ်နိုင်သော ပွင့်လင်းမြင်သာသည့် နှုန်းထားများ။",
		lead: "လျှို့ဝှက်အပိုကြေးများ လုံးဝမရှိပါ။ ၁၄ ရက် အခမဲ့ စမ်းသပ်သုံးစွဲကြည့်ပြီး စိတ်တိုင်းကျမှ ဆက်လက်အသုံးပြုနိုင်ပါတယ်။",
		monthly: "လစဉ်ကြေး",
		yearly: "နှစ်စဉ်ကြေး",
		yearlySave: "၂ လ အခမဲ့",
		perMonth: "/ တစ်လလျှင်",
		perYear: "/ တစ်နှစ်လျှင်",
		cta: "၁၄ ရက် အခမဲ့ စမ်းသုံးရန်",
		included: "ပါဝင်သည့်အရာများ",
		flag: "အဖွဲ့ကြီးများအတွက်",
		basic: {
			description: "စတင်ဖွဲ့စည်းထားသော အဖွဲ့များနှင့် ဝန်ထမ်းအင်အား အသင့်အတင့်ရှိသော ရုံးများအတွက် အသင့်တော်ဆုံး။",
			items: [
				"ဝန်ထမ်း ၅၀ ဦးအထိ အသုံးပြုနိုင်ခြင်း",
				"မူဝါဒ (Policy & SOP) ဖိုင်များ တင်နိုင်ခြင်း",
				"သင်တန်းနှင့် ဉာဏ်စမ်းမေးခွန်းများ စိတ်ကြိုက်ဖန်တီးနိုင်ခြင်း",
				"ဝန်ထမ်းဖတ်ရှုကြောင်း အတည်ပြုလက်မှတ် မှတ်တမ်းယူခြင်း",
				"သင်တန်းဆင်းလက်မှတ် (Certificate) အလိုအလျောက်ထုတ်ပေးခြင်း",
				"အီးမေးလ်ဖြင့် နည်းပညာအကူအညီ ရယူနိုင်ခြင်း",
			],
		},
		plus: {
			description: "ဝန်ထမ်းအင်အား များပြားပြီး ဌာနခွဲ၊ ရုံးခွဲများဖြင့် လည်ပတ်နေသော NGO နှင့် ကုမ္ပဏီများအတွက်။",
			items: [
				"ဝန်ထမ်း ၁၀၀ ဦးအထိ အသုံးပြုနိုင်ခြင်း",
				"Basic Plan ပါ လုပ်ဆောင်ချက်အားလုံး အပြည့်အဝ ပါဝင်ခြင်း",
				"မြန်မာ - အင်္ဂလိပ် နှစ်ဘာသာဖြင့် မူဝါဒနှင့် သင်တန်းများ ထားရှိနိုင်ခြင်း",
				"Donor နှင့် Audit စစ်ဆေးရေးအတွက် အသေးစိတ် Report များ ထုတ်ယူနိုင်ခြင်း",
				"ဌာနနှင့် ရာထူးအလိုက် သီးသန့်ခွင့်ပြုချက် (Role-based Access) သတ်မှတ်ခြင်း",
				"ဦးစားပေး အထူးနည်းပညာ ဝန်ဆောင်မှု (Priority Support) ရရှိခြင်း",
			],
		},
		addons: {
			name: "Plus + ထပ်တိုး",
			users: "၁၅၀ ဦး",
			description: "ဝန်ထမ်း ၁၀၀ ဦးထက် ပိုသော အဖွဲ့များအတွက်",
			cta: "ထပ်တိုး ဈေးနှုန်း ကြည့်ရန်",
			items: ["Plus ပါ လုပ်ဆောင်ချက်အားလုံး", "တစ်ကြိမ်လျှင် ၂၅ ဦးစီ ထပ်တိုးနိုင်", "၂၅ ဦးတိုင်းအတွက် လစဉ် +$10", "၃၀၀ ဦးထက်ပိုပါက သီးသန့် ဈေးနှုန်း"],
		},
		noteMonthly: "အစီအစဉ်တိုင်းတွင် ၁၄ ရက် အခမဲ့ စမ်းသပ်ခွင့် ပါဝင်ပြီး၊ ရက် ၃၀ ကြိုတင်အကြောင်းကြား၍ ပယ်ဖျက်နိုင်ပါတယ်။",
		noteYearly: "နှစ်စဉ်ကြေးသည် ၁၀ လစာသာ ကျသင့်ပါတယ်။",
		more: "၃၀၀ ဦးကျော်ပါက",
		talk: "ဆက်သွယ်ပါ",
		moreEnd: "။",
	},
	faq: {
		eyebrow: "FAQ",
		title: "အမေးများသော မေးခွန်းများ (FAQ)",
		items: [
			{
				question: "AidNova စနစ်ကို စတင်အသုံးပြုဖို့ အချိန်ဘယ်လောက်ပေးရမလဲ?",
				answer:
					"နည်းပညာအဖွဲ့ သီးသန့်မလိုဘဲ မိနစ်ပိုင်းအတွင်း စတင်သုံးစွဲနိုင်ပါတယ်။ အဖွဲ့အစည်းအကောင့် ဖွင့်ပြီးတာနဲ့ လက်ရှိသုံးနေတဲ့ PDF ဒါမှမဟုတ် Word မူဝါဒဖိုင်တွေကို တင်ပြီး ဝန်ထမ်းတွေကို အီးမေးလ်ကနေ ချက်ချင်း Invite လုပ်နိုင်ပါတယ်။",
			},
			{
				question: "မူဝါဒဖိုင်တွေနဲ့ သင်တန်းမေးခွန်းတွေကို မြန်မာလို အပြည့်အဝ သုံးလို့ရပါသလား?",
				answer:
					"အပြည့်အဝ သုံးနိုင်ပါတယ်။ မြန်မာစာ (Unicode) ရော အင်္ဂလိပ်ဘာသာကိုပါ စနစ်တကျ ပံ့ပိုးပေးထားတဲ့အတွက် ပြည်တွင်းဝန်ထမ်းရော နိုင်ငံတကာဝန်ထမ်းပါ မိမိအဆင်ပြေတဲ့ ဘာသာစကားနဲ့ ဖတ်ရှုလေ့လာနိုင်ပါတယ်။",
			},
			{
				question: "သင်တန်းဆင်းလက်မှတ် (Certificate) က ဘယ်လိုထုတ်ပေးတာပါလဲ?",
				answer:
					"ဝန်ထမ်းတစ်ဦးက သင်တန်းသင်ခန်းစာတွေကို ဖတ်ရှုပြီး သတ်မှတ်ထားတဲ့ ဉာဏ်စမ်းမေးခွန်း (Quiz) အောင်မှတ် ပြည့်မီတာနဲ့ စနစ်ကနေ ဝန်ထမ်းအမည်၊ အောင်မြင်သည့်ရက်စွဲနဲ့ အဖွဲ့အစည်းအမှတ်တံဆိပ်ပါတဲ့ လက်မှတ်ကို အလိုအလျောက် ထုတ်ပေးပါတယ်။",
			},
			{
				question: "ကျွန်ုပ်တို့ အဖွဲ့အစည်းရဲ့ စာရွက်စာတမ်းနဲ့ အချက်အလက်တွေ လုံခြုံမှုရှိပါသလား?",
				answer:
					"အဖွဲ့အစည်းတစ်ခုချင်းစီရဲ့ အချက်အလက်တွေကို သီးခြားစီ လုံခြုံစွာ သိမ်းဆည်းထားပြီး (Multi-tenant data isolation) ခွင့်ပြုချက်ပေးထားသူများသာ ဝင်ရောက်ကြည့်ရှုနိုင်အောင် ကာကွယ်ထားပါတယ်။",
			},
			{
				question: "နောက်ပိုင်းမှ Plan ပြောင်းချင်တာ ဒါမှမဟုတ် ရပ်နားချင်တာဆိုရင် လုပ်လို့ရလား?",
				answer:
					"အချိန်မရွေး အဆင့်မြှင့်တင်တာ (Upgrade) လုပ်နိုင်ပြီး သုံးစွဲမှု ရပ်နားတာ (Cancel) ကို ရက် ၃၀ ကြိုတင်အကြောင်းကြား၍ ပြုလုပ်နိုင်ပါတယ်။ နှစ်ရှည်စာချုပ်ချုပ်ဆိုစရာ မလိုပါဘူး။",
			},
		],
	},
	cta: {
		title: ["သင့်အဖွဲ့အစည်းရဲ့ မူဝါဒနဲ့ ဝန်ထမ်းသင်တန်း စီမံခန့်ခွဲမှုကို အချိန်ကုန်သက်သာပြီး စနစ်ကျအောင် အခုပဲ ပြောင်းလဲလိုက်ပါ။", ""],
		text: "၁၄ ရက် အခမဲ့ စမ်းသပ်သုံးစွဲနိုင်ပါတယ်။ ဘဏ်ကတ်အချက်အလက် ထည့်သွင်းရန် မလိုအပ်ပါ။",
		button: "အခမဲ့ စတင်သုံးကြည့်ပါ",
	},
};

export const HOME_COPY = { en, my };
