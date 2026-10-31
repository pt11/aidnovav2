export type PostBlock =
	| { h: string }
	| { p: string }
	| { ul: string[] }
	| { tip: string }
	| { figure: true }
	| { links: [string, string][] };

export interface BlogPost {
	slug: string;
	title: string;
	seoTitle: string;
	description: string;
	excerpt: string;
	category: "Guides" | "Safety" | "Language";
	date: string;
	isoDate: string;
	tags: string[];
	tone: "blue" | "green" | "violet" | "amber" | "dark" | "teal";
	layout: number;
	cta: { title: string; text: string };
	lead: string;
	blocks: PostBlock[];
}

export function postHeadingId(heading: string) {
	return heading
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function readMinutes(post: BlogPost) {
	const words = [
		post.lead,
		...post.blocks.flatMap((block) => {
			if ("h" in block) return [block.h];
			if ("p" in block) return [block.p];
			if ("ul" in block) return block.ul;
			if ("tip" in block) return [block.tip];
			return [];
		}),
	]
		.join(" ")
		.split(/\s+/).length;
	return Math.max(2, Math.round(words / 200));
}

export const POSTS: BlogPost[] = [
	{
		slug: "roll-out-a-safeguarding-policy",
		title: "How to roll out a new safeguarding policy in 5 steps",
		seoTitle: "How to Roll Out an NGO Safeguarding Policy in 5 Steps",
		description:
			"A simple plan to take a new safeguarding policy from draft to every staff member confirming they've read it, for small NGO teams.",
		excerpt: "From the first draft to every staff member confirming they’ve read it — a simple plan for small teams.",
		category: "Guides",
		date: "28 Oct 2026",
		isoDate: "2026-10-28",
		tags: ["Safeguarding", "Policies", "Rollout", "Myanmar"],
		tone: "blue",
		layout: 0,
		cta: { title: "Roll out your next policy in AidNova", text: "Publish once, in English and Myanmar, and see who has read it." },
		lead: "A safeguarding policy only protects people if staff know what’s in it. Here’s a simple plan to get a new policy from draft to “everyone has read it” — without endless email chains.",
		blocks: [
			{ h: "Why rollouts stall" },
			{ p: "Most policies don’t fail because they’re badly written. They fail because they’re sent as an attachment, saved in five folders, and nobody can say who actually read them. When an incident happens or a donor asks, there’s no record to show." },
			{ h: "1. Write it for the reader" },
			{ p: "Start with a short summary: what this policy means for a field officer, a driver or a volunteer. Keep sections short and use plain words. Put the reporting steps where people can find them in ten seconds." },
			{ ul: ["One-paragraph “what this means for you”", "Who to contact, and how", "What happens after a report is made"] },
			{ h: "2. Translate before you publish" },
			{ p: "If most of your team reads Myanmar first, publish in Myanmar at the same time as English — not weeks later. Ask a colleague who wasn’t involved in drafting to read the translation and flag anything unclear." },
			{ tip: "Use the same section numbers in both languages, so people can point to “section 3” whichever version they read." },
			{ h: "3. Decide who must read it" },
			{ p: "Safeguarding usually applies to everyone, including volunteers. Mark it as mandatory, and set it for all departments — or for the ones it covers if you have a separate version for different roles." },
			{ h: "4. Publish and track" },
			{ p: "Publish it in one place and ask everyone to confirm they’ve read it. You’ll see who has and who hasn’t, without chasing replies." },
			{ figure: true },
			{ h: "5. Follow up and keep records" },
			{ p: "Send a reminder to the people who haven’t confirmed, and talk to anyone who is still stuck — often it’s a phone or language issue, not unwillingness. When you’re done, export the record for your files and your donor." },
			{ p: "Next year, update the policy as a new version. Everyone is asked to confirm again, and their earlier acknowledgments stay on record, so you can show who confirmed which version." },
		],
	},
	{
		slug: "nonprofit-policy-management-software",
		title: "Nonprofit policy management software: what to look for",
		seoTitle: "Nonprofit Policy Management Software: What to Look For",
		description:
			"What small NGOs and nonprofits should check before choosing policy management software, from acknowledgment tracking to language support and access control.",
		excerpt: "The features that matter for a small NGO, the ones you can skip, and the questions to ask before you choose.",
		category: "Guides",
		date: "31 Oct 2026",
		isoDate: "2026-10-31",
		tags: ["Policies", "Software", "Compliance"],
		tone: "green",
		layout: 1,
		cta: { title: "Try it with one real policy", text: "Publish a policy in AidNova and see who has acknowledged it. 14 days free." },
		lead: "Most small NGOs start with a shared drive, and that works until someone asks who read the current version. Policy management software solves that one problem well. Here’s how to tell which tool fits an organization your size.",
		blocks: [
			{ h: "The problem you’re actually solving" },
			{ p: "You probably don’t need a large compliance system. You need three things: one current version of each policy, proof that the right people read it, and a way to show that proof when a donor or auditor asks." },
			{ p: "Keep those three in mind when you compare tools. Many products built for banks or hospitals do far more than that, and cost and complexity grow with every feature your team won’t use." },
			{ h: "What to check first" },
			{ ul: [
				"Acknowledgment tracking: can you see, per policy, who has confirmed and who hasn’t?",
				"Versions: does a new version ask people to confirm again, and do earlier confirmations stay on record?",
				"Reminders: can you remind only the people who are still pending?",
				"Audience: can you make a policy mandatory for some departments and optional for others?",
				"Export: can you get the records out as a file for a donor or auditor?",
			] },
			{ h: "What matters more for NGOs" },
			{ p: "Staff access is usually the deciding factor. Field teams may read on a phone, on a slow connection, and in a language other than English. If they can’t easily open and confirm a policy, your records won’t be complete however good the reporting is." },
			{ ul: [
				"Works on a phone without training",
				"Available in the language your staff read first",
				"Priced per organization, or at a per-user rate you can afford as you grow",
				"Set up by your own team, without an IT department",
			] },
			{ tip: "Before you buy, test one real policy with your hardest-to-reach staff member. If it works for them, it will work for everyone." },
			{ h: "Questions to ask before you choose" },
			{ ul: [
				"How is our data kept separate from other organizations?",
				"Who can see which staff member’s records?",
				"What happens to our records if we stop paying?",
				"How long does it take to get our existing policies in?",
			] },
			{ h: "Where AidNova fits" },
			{ p: "AidNova is built for this size of organization: publish a policy, choose who it applies to, see who has acknowledged it, remind those who haven’t, and export a CSV. The interface works in English and Myanmar, and it installs on phones. It also includes courses and a staff hub, so it may be more than you need if policies are your only concern." },
		],
	},
	{
		slug: "lms-for-ngos",
		title: "LMS for NGOs: how to choose training software for a small team",
		seoTitle: "LMS for NGOs: How to Choose Training Software for a Small Team",
		description:
			"A practical guide to choosing a learning management system for an NGO or nonprofit: what you need, what you can skip and how to run a useful trial.",
		excerpt: "What a small NGO really needs from a learning management system, and how to test one with your own content.",
		category: "Guides",
		date: "31 Oct 2026",
		isoDate: "2026-10-31",
		tags: ["Training", "LMS", "Software"],
		tone: "violet",
		layout: 2,
		cta: { title: "Build your first course this week", text: "Lessons, quizzes and certificates in one place. 14-day free trial." },
		lead: "A learning management system, or LMS, lets you build courses, assign them to staff and see who finished. For a small NGO, the risk isn’t choosing too little. It’s choosing something so big that nobody ever finishes setting it up.",
		blocks: [
			{ h: "Start with what you need to prove" },
			{ p: "Write down the training you must be able to show: safeguarding, security, code of conduct, onboarding. Then write down who needs each one. That short list tells you more than any feature comparison, because it shows how many courses, people and reports you’ll really have." },
			{ h: "The features that matter" },
			{ ul: [
				"Simple course building from the videos, PDFs and slides you already have",
				"Quizzes with a pass mark, so completion means something",
				"Certificates people can print or keep",
				"Mandatory courses, and courses assigned to chosen people",
				"Reports you can export: enrolled, in progress, completed, scores",
			] },
			{ h: "What you can probably skip" },
			{ p: "Many LMS comparisons focus on features aimed at larger organizations: SCORM packages, course marketplaces, gamification and connections to fundraising systems. They’re useful if you have a learning team or existing SCORM content. If you’re one HR lead with a safeguarding course to run, you can usually leave them out." },
			{ p: "Open-source options such as Moodle can keep software costs low, but someone has to host and maintain them. Count that time as part of the price." },
			{ h: "Check the things comparison lists miss" },
			{ ul: [
				"Does it work on the phones your field staff actually use?",
				"Can staff use it in their first language, including Myanmar text that displays correctly?",
				"Can large videos be avoided or replaced where connections are slow?",
				"Is the price per person or per organization, and what happens as you grow?",
			] },
			{ h: "Run a trial with real content" },
			{ p: "Don’t judge an LMS from its demo. Use the free trial to build one short course that you actually need, assign it to five people across different locations, and ask them what got in the way. Then export the report as if a donor had asked for it." },
			{ tip: "Choose your shortest mandatory training for the trial. You’ll learn just as much, and you’ll have something useful to keep." },
			{ h: "Where AidNova fits" },
			{ p: "AidNova includes courses with lessons, quizzes and certificates alongside your policies and files, in English and Myanmar. It suits teams who want training and policies in one place. If you need SCORM or a large course marketplace, a dedicated LMS will serve you better." },
		],
	},
	{
		slug: "ngo-staff-onboarding-checklist",
		title: "NGO staff onboarding checklist: the first day, week and month",
		seoTitle: "NGO Staff Onboarding Checklist: First Day, Week and Month",
		description:
			"A practical onboarding checklist for NGO and nonprofit staff, covering what to prepare before day one and what to complete in the first week and month.",
		excerpt: "What to prepare before someone starts, and what they should finish in their first week and first month.",
		category: "Guides",
		date: "31 Oct 2026",
		isoDate: "2026-10-31",
		tags: ["Onboarding", "HR", "Training"],
		tone: "amber",
		layout: 0,
		cta: { title: "Turn this checklist into a course", text: "Assign onboarding to new staff and see how far they’ve got." },
		lead: "New staff join an NGO wanting to be useful quickly, and they’re often sent to the field soon after. A short, clear onboarding plan makes sure they know the policies that keep people safe before they need them.",
		blocks: [
			{ h: "Before the first day" },
			{ ul: [
				"Complete your safer recruitment checks and keep the record",
				"Prepare the contract and payroll details",
				"Set up their account, email and any equipment",
				"Choose a colleague they can ask everyday questions",
				"Tell the team who is starting, and when",
			] },
			{ h: "The first day" },
			{ ul: [
				"Welcome them, and walk through the mission and how teams work together",
				"Show them where to find policies, forms and files",
				"Explain how to report a safeguarding concern, and who to tell",
				"Agree what the first week looks like",
			] },
			{ h: "The first week" },
			{ p: "This is when the mandatory reading should happen, while the person still has time. Keep it small enough to finish." },
			{ ul: [
				"Read and acknowledge the code of conduct and safeguarding policy",
				"Read the security policy for their location",
				"Finish the onboarding course, with a short quiz",
				"Meet the people they’ll work with most",
				"Check in at the end of the week: what’s still unclear?",
			] },
			{ tip: "Put the most important policies first. If someone only reads two things this week, it should be how to stay safe and how to report a concern." },
			{ h: "The first month" },
			{ ul: [
				"Complete any role-specific training",
				"Agree goals for the first three months",
				"Have a proper check-in, and ask what you should improve for the next person",
				"Confirm that all acknowledgments and course records are complete",
			] },
			{ h: "Keep the records together" },
			{ p: "Onboarding creates the evidence auditors later ask for: who read which policy, and who completed which training. Keep it with the person’s profile instead of in separate spreadsheets, so nothing is missing when they change roles or leave." },
			{ h: "Doing this in AidNova" },
			{ p: "You can publish your mandatory policies, build the onboarding course once, and open any person’s profile to see what they’ve acknowledged and completed. New staff see what to do first when they sign in, on a phone or a computer." },
		],
	},
	{
		slug: "donor-audit-checklist-training-records",
		title: "Donor audit checklist: getting policy and training records ready",
		seoTitle: "Donor Audit Checklist for NGOs: Policy and Training Records",
		description:
			"How NGOs can prepare policy acknowledgment and training records before a donor audit or due diligence check, with a simple checklist and a mock audit.",
		excerpt: "What to gather before a donor audit or due diligence check, and how to find the gaps while you can still fix them.",
		category: "Guides",
		date: "31 Oct 2026",
		isoDate: "2026-10-31",
		tags: ["Audit", "Donors", "Compliance"],
		tone: "dark",
		layout: 1,
		cta: { title: "Have your records ready before anyone asks", text: "Export policy acknowledgments and course completions any time." },
		lead: "When a donor or auditor asks about staff policies and training, the hard part is rarely the policy itself. It’s showing who received it, who completed the training, and when. Getting that ready early turns a stressful week into an afternoon.",
		blocks: [
			{ h: "Start with your agreement" },
			{ p: "Requirements differ between donors, and no single checklist covers them all. Read your grant agreement and any due diligence questions first, and note exactly what they ask you to show. Treat the list below as a starting point, and let the donor’s own requirements come first." },
			{ h: "Policy records" },
			{ ul: [
				"The current version of each policy, with its effective and review dates",
				"Who each policy applies to",
				"Who has acknowledged it, and on what date",
				"Who is still pending, and what you’ve done about it",
				"Past versions, and who acknowledged them",
			] },
			{ h: "Training records" },
			{ ul: [
				"The list of mandatory training, and who it applies to",
				"Completion dates per person",
				"Quiz results or certificates where training was assessed",
				"Attendance records for any in-person sessions",
				"Records for staff who have left, if they worked on the grant",
			] },
			{ h: "Run a mock audit" },
			{ p: "Pick one staff member at random and try to answer, in ten minutes: which policies did they acknowledge, which training did they complete, and when? Then pick one policy and list everyone who should have read it. Whatever you can’t answer quickly is your to-do list." },
			{ tip: "Choose someone from a field office for the test. Gaps tend to appear furthest from head office." },
			{ h: "Common gaps to fix now" },
			{ ul: [
				"New joiners who never acknowledged anything",
				"A policy updated without asking people to confirm again",
				"Training attended, but with no record kept",
				"Records in a spreadsheet only one person understands",
			] },
			{ h: "Be honest about what you can show" },
			{ p: "An acknowledgment shows that someone confirmed they read a policy. A completed course shows they finished it. Neither proves a person will always act on it, so describe your records as what they are. If there’s a gap, say so, and show how you’re closing it." },
			{ h: "Exporting from AidNova" },
			{ p: "Managers and admins can export CSV reports of policy acknowledgments and course completions at any time, and open any person’s profile to answer the “one staff member” question directly." },
		],
	},
	{
		slug: "training-records-high-risk-contexts",
		title: "Keeping staff training records safe in high-risk contexts",
		seoTitle: "Keeping NGO Staff Training Records Safe in High-Risk Contexts",
		description:
			"Why NGO training records can put staff at risk in high-risk contexts, and practical ways to collect less, limit access and keep people safe.",
		excerpt: "A training list can reveal who works with whom, and where. How to keep useful records without putting staff at risk.",
		category: "Safety",
		date: "31 Oct 2026",
		isoDate: "2026-10-31",
		tags: ["Safety", "Data protection", "Training"],
		tone: "teal",
		layout: 2,
		cta: { title: "See how we think about staff privacy", text: "Read how Capacity Building is being designed for high-risk contexts." },
		lead: "To a donor, a training record is evidence. In some places, it could also reveal that a person works with a particular organization, attended a sensitive workshop, or travelled on a certain date. Good records protect people as well as prove the work.",
		blocks: [
			{ h: "Why it matters" },
			{ p: "In high-risk contexts, details that seem ordinary can be sensitive: the topic of a workshop, who provided it, where it took place, and who attended. Put together, those details can show who is connected to whom. Your staff are the people who would carry the risk if that information reached the wrong hands." },
			{ h: "Talk to local staff first" },
			{ p: "Staff working in a place understand its risks better than a head office or a software company. Before you decide what to record, ask local colleagues what would worry them if it were seen by someone outside the organization. Write down what you decide, and review it when the situation changes." },
			{ h: "Collect less" },
			{ ul: [
				"Ask whether you really need each field before adding it",
				"Record a broad area, or nothing, instead of an exact venue",
				"Make location and provider optional",
				"Never collect GPS data for training",
				"Avoid naming sensitive topics in file names and titles",
			] },
			{ tip: "If a donor asks for participant details you’re worried about, ask whether totals or anonymized lists would meet the requirement. Many reporting needs can be met with less." },
			{ h: "Limit who can see it" },
			{ ul: [
				"Give access by role, and only to people who need it",
				"Keep staff records from being visible to colleagues by default",
				"Keep a log of who opens the most sensitive records",
				"Remove access as soon as someone leaves",
			] },
			{ h: "Be careful with messages and exports" },
			{ p: "Notifications and spreadsheets travel further than the system they came from. A reminder shouldn’t say who is attending what, or where. An exported list should be stored as carefully as the original, and deleted once it has done its job." },
			{ h: "Plan for the worst day" },
			{ p: "Decide in advance what you’d do if a device was taken or an account was compromised: who gets told, how passwords and sessions are reset, and which records you’d restrict first. A one-page plan is enough, as long as people know where to find it." },
			{ h: "Where to read more" },
			{ links: [
				["Keeping People Safe: a guide to safeguarding for NGOs", "https://cooperation.ca/documents/keeping-people-safe-a-guide-to-safeguarding-for-non-governmental-organizations-and-platforms/"],
				["GlobalGiving safeguarding checklist", "https://www.globalgiving.org/learn/safeguarding-checklist-essential-steps-to-protect-your-community/"],
			] },
		],
	},
	{
		slug: "zawgyi-unicode-myanmar-training",
		title: "Zawgyi and Unicode: running NGO policies and training in Myanmar",
		seoTitle: "Zawgyi and Unicode: Running NGO Policies and Training in Myanmar",
		description:
			"A practical guide for NGOs publishing policies and training in Myanmar language: Zawgyi and Unicode, checking your content, and publishing in two languages.",
		excerpt: "Why Myanmar text sometimes turns unreadable, and how to publish policies and training that display properly for everyone.",
		category: "Language",
		date: "31 Oct 2026",
		isoDate: "2026-10-31",
		tags: ["Myanmar", "Unicode", "Translation"],
		tone: "blue",
		layout: 1,
		cta: { title: "Publish in English and Myanmar", text: "AidNova’s whole interface switches between the two, on any phone." },
		lead: "If you’ve ever sent a Myanmar document and heard back that it looks broken, you’ve met the Zawgyi and Unicode problem. It’s easy to avoid once you know what to check, and it makes a real difference to whether staff can read what you publish.",
		blocks: [
			{ h: "What’s the difference?" },
			{ p: "Zawgyi is a font that became very widely used for Burmese but doesn’t follow the Unicode standard. Text written in one and read in the other can look garbled. Myanmar officially moved to Unicode on 1 October 2019, but older documents, some devices and many archived files still use Zawgyi." },
			{ h: "Check your old documents" },
			{ p: "Long-standing NGOs often have policies, forms and training materials written years ago. Before publishing any of them, open them on a phone set up for Unicode. If the text looks wrong, convert it, then have a fluent reader check it, because automatic conversion can make mistakes." },
			{ ul: [
				"Check the policies, forms and slides you’re reusing",
				"Convert to Unicode, and keep the original until it has been checked",
				"Have a fluent reader proofread the converted version",
				"Check PDFs too, as they may contain Zawgyi text or images of text",
			] },
			{ h: "Test on real phones" },
			{ p: "Staff phones vary, and some may still be set up for Zawgyi. Ask a few colleagues in different locations to open your content before you roll it out. Their settings will show you problems your office computer won’t." },
			{ tip: "Avoid putting Myanmar text inside images where you can. Real text can be searched, copied and resized on a small screen." },
			{ h: "Publishing in two languages" },
			{ ul: [
				"Publish both languages together, not weeks apart",
				"Use the same section numbers, so people can refer to them in either language",
				"Decide which version applies if they differ, and say so",
				"Update both when the policy changes",
			] },
			{ h: "Write Myanmar that people actually use" },
			{ p: "A translation can be correct and still feel stiff. Ask someone who wasn’t involved in drafting to read it as staff would. Keep common English work terms in English where that’s how your team says them, and explain any term people might not know." },
			{ h: "What to expect from software" },
			{ p: "Ask any vendor whether Myanmar is supported throughout the interface, not just in your content, and test it. AidNova uses Unicode, and the interface switches between English and Myanmar. Our own translations still get reviewed by fluent readers, and we’d recommend the same for yours." },
			{ h: "Where to read more" },
			{ links: [
				["Zawgyi font (Wikipedia)", "https://en.wikipedia.org/wiki/Zawgyi_font"],
				["Global Voices: Myanmar prepares to migrate from Zawgyi to Unicode", "https://rising.globalvoices.org/blog/2019/09/06/unified-under-one-font-system-as-myanmar-prepares-to-migrate-from-zawgyi-to-unicode/"],
			] },
		],
	},
];
