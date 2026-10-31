import { useEffect, type ReactNode } from "react";
import "./legal.css";

const LOGO = "/aidnova-logo.webp";
const CONTACT_EMAIL = "helloaidnova@gmail.com";
const LAST_UPDATED = "October 31, 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section>
			<h2>{title}</h2>
			{children}
		</section>
	);
}

function Subsection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<>
			<h3>{title}</h3>
			{children}
		</>
	);
}

function ContactCard() {
	return (
		<div className="legal-contact">
			<p>
				<strong>AidNova</strong>
			</p>
			<p>
				Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
			</p>
		</div>
	);
}

function LegalPage({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	useEffect(() => {
		document.title = `${title} - AidNova`;
	}, [title]);

	return (
		<div className="legal-page">
			<header className="legal-nav">
				<div className="legal-container">
					<a href="/">← Back to AidNova</a>
					<a href="/" className="legal-brand">
						<img src={LOGO} alt="" width="24" height="24" />
						AidNova
					</a>
				</div>
			</header>
			<div className="legal-hero">
				<div className="legal-container">
					<p className="legal-eyebrow">Legal</p>
					<h1>{title}</h1>
					<p className="legal-updated">Last updated: {LAST_UPDATED}</p>
				</div>
			</div>
			<main className="legal-container legal-body">{children}</main>
			<footer className="legal-footer">
				<div className="legal-container">
					<p>© 2026 AidNova. All rights reserved.</p>
					<nav aria-label="Legal">
						<a href="/privacy-policy">Privacy Policy</a>
						<a href="/terms-of-service">Terms of Service</a>
					</nav>
				</div>
			</footer>
		</div>
	);
}

export function PrivacyPolicyPage() {
	return (
		<LegalPage title="Privacy Policy">
			<section>
				<p>
					AidNova ("we", "our", or "us") is committed to protecting your personal information. This Privacy Policy explains
					how we collect, use, disclose, and safeguard information when you use our platform — including our web application,
					APIs, and related services (collectively, the "Service"). Please read it carefully.
				</p>
			</section>

			<Section title="1. Information We Collect">
				<Subsection title="1.1 Information you provide">
					<ul>
						<li><strong>Account data:</strong> name, email address, password (hashed), job title, and profile photo when you register.</li>
						<li><strong>Organization data:</strong> organization name, logo, and contact details entered during onboarding.</li>
						<li><strong>Content:</strong> policies, course materials, announcements, calendar events, and files you upload or create.</li>
						<li><strong>Communications:</strong> messages or support requests you send to us.</li>
					</ul>
				</Subsection>
				<Subsection title="1.2 Information collected automatically">
					<ul>
						<li><strong>Usage data:</strong> pages visited, features used, and actions taken within the Service.</li>
						<li><strong>Content activity:</strong> which policies, announcements, files, links and courses each person opens, downloads, acknowledges or completes. Managers and administrators of that person's organization can see this in reports.</li>
						<li><strong>Log data:</strong> IP address, browser type, operating system, referring URL, and timestamps.</li>
						<li><strong>Cookies &amp; similar technologies:</strong> session cookies required for authentication and preference cookies for language/theme settings.</li>
					</ul>
				</Subsection>
				<Subsection title="1.3 Third-party integrations">
					<p>If you connect third-party services (e.g. Google Drive), we receive only the data necessary to operate that integration, such as OAuth tokens and the email address associated with the connected account. We do not store the contents of your external Drive beyond files explicitly synced to AidNova.</p>
				</Subsection>
			</Section>

			<Section title="2. How We Use Your Information">
				<ul>
					<li>Provide, operate, and improve the Service.</li>
					<li>Authenticate users and manage organization access controls.</li>
					<li>Send transactional emails (account verification, password resets, policy compliance reminders) that you or your administrator configure.</li>
					<li>Analyze aggregated, anonymized usage to improve product features.</li>
					<li>Respond to support requests and communicate service-related notices.</li>
					<li>Comply with legal obligations.</li>
				</ul>
				<p>We do not sell your personal data or use it to serve third-party advertising.</p>
			</Section>

			<Section title="3. Data Sharing and Disclosure">
				<p>We share your information only in the following circumstances:</p>
				<ul>
					<li><strong>Within your organization:</strong> Admins and managers in your organization can view member profiles, activity, and content as permitted by their role.</li>
					<li><strong>Service providers:</strong> We use trusted sub-processors (cloud hosting, email delivery, AI inference) under data processing agreements that restrict them to using data only to deliver services to us.</li>
					<li><strong>Legal requirements:</strong> We may disclose data if required by law, regulation, legal process, or governmental request.</li>
					<li><strong>Business transfers:</strong> If AidNova is involved in a merger, acquisition, or asset sale, we will notify affected users before data is transferred or becomes subject to a different privacy policy.</li>
				</ul>
			</Section>

			<Section title="4. Data Retention">
				<p>
					We retain your data for as long as your organization's account is active or as needed to provide the Service.
					Organization owners may request deletion of their organization's data at any time by contacting us. After account
					closure, we delete or anonymize personal data within 90 days, except where retention is required by law.
				</p>
			</Section>

			<Section title="5. Security">
				<p>
					We implement industry-standard safeguards including encryption in transit (TLS), encrypted storage for sensitive
					credentials, and role-based access controls. No method of transmission or storage is 100% secure. We encourage
					you to use a strong, unique password and to notify us immediately if you suspect unauthorized access to your account.
				</p>
			</Section>

			<Section title="6. Your Rights">
				<p>Depending on your location, you may have the right to:</p>
				<ul>
					<li>Access the personal data we hold about you.</li>
					<li>Request correction of inaccurate data.</li>
					<li>Request deletion of your personal data (subject to legal retention obligations).</li>
					<li>Object to or restrict certain processing activities.</li>
					<li>Data portability — receive your data in a machine-readable format.</li>
				</ul>
				<p>To exercise any of these rights, please contact us at the address below. We will respond within 30 days.</p>
			</Section>

			<Section title="7. Cookies">
				<p>
					AidNova uses strictly necessary session cookies to keep you logged in, and functional cookies to remember your
					language and theme preferences. We do not use advertising or cross-site tracking cookies. You can disable cookies
					in your browser settings, but this will prevent authentication from working.
				</p>
			</Section>

			<Section title="8. Children's Privacy">
				<p>
					The Service is intended for use by organizations and their adult staff members. We do not knowingly collect personal
					information from children under 13. If you believe a child has provided us with personal data, please contact us
					and we will delete it promptly.
				</p>
			</Section>

			<Section title="9. Changes to This Policy">
				<p>
					We may update this Privacy Policy from time to time. We will notify organization administrators by email and post
					a notice within the Service at least 14 days before material changes take effect. Continued use of the Service
					after the effective date constitutes acceptance of the revised policy.
				</p>
			</Section>

			<Section title="10. Contact Us">
				<p>If you have questions or concerns about this Privacy Policy, please contact us at:</p>
				<ContactCard />
			</Section>
		</LegalPage>
	);
}

export function TermsOfServicePage() {
	return (
		<LegalPage title="Terms of Service">
			<section>
				<p>
					Please read these Terms of Service ("Terms") carefully before using AidNova ("the Service"), operated by AidNova
					("we", "us", or "our"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree,
					you may not use the Service.
				</p>
			</section>

			<Section title="1. Acceptance of Terms">
				<p>
					These Terms constitute a legally binding agreement between you (either as an individual or on behalf of an
					organization) and AidNova. If you are accepting on behalf of an organization, you represent that you have the
					authority to bind that organization to these Terms.
				</p>
			</Section>

			<Section title="2. Description of Service">
				<p>
					AidNova is a cloud-based policy and learning management platform designed for NGOs and mission-driven organizations.
					The Service includes policy management, staff training and course delivery, file storage, team management,
					announcements, calendar, and AI-powered tools, along with related APIs and integrations.
				</p>
			</Section>

			<Section title="3. Accounts and Organizations">
				<ul>
					<li>You must provide accurate and complete information when creating an account.</li>
					<li>You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.</li>
					<li>One organization account may be used by multiple staff members as permitted by your subscription plan.</li>
					<li>You must notify us immediately of any unauthorized use of your account at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</li>
					<li>You may not share login credentials between individuals or use the Service to create accounts for automated bots.</li>
				</ul>
			</Section>

			<Section title="4. Subscriptions and Payment">
				<ul>
					<li>The Service is offered on a subscription basis. Pricing and plan features are described on our Pricing page.</li>
					<li>Subscriptions are billed in advance on a monthly or annual cycle, depending on your selection.</li>
					<li>All fees are non-refundable except where required by law or as described in our refund policy.</li>
					<li>We reserve the right to modify pricing with at least 30 days' written notice. Continued use after the effective date constitutes acceptance of the new pricing.</li>
					<li>Failure to pay may result in suspension or termination of your account.</li>
				</ul>
			</Section>

			<Section title="5. Free Trial">
				<p>
					We may offer a free trial period for new organizations. At the end of the trial, you must subscribe to a paid plan
					to continue using the Service. We reserve the right to modify or discontinue free trials at any time without notice.
				</p>
			</Section>

			<Section title="6. Acceptable Use">
				<p>You agree not to use the Service to:</p>
				<ul>
					<li>Violate any applicable laws or regulations.</li>
					<li>Upload or distribute malware, viruses, or other harmful code.</li>
					<li>Infringe the intellectual property rights of any third party.</li>
					<li>Upload content that is defamatory, obscene, harassing, or otherwise objectionable.</li>
					<li>Attempt to gain unauthorized access to any part of the Service or its infrastructure.</li>
					<li>Reverse-engineer, decompile, or disassemble any part of the Service.</li>
					<li>Resell or sublicense the Service to third parties without our written consent.</li>
				</ul>
				<p>We reserve the right to suspend or terminate accounts that violate these restrictions.</p>
			</Section>

			<Section title="7. Your Content">
				<p>
					You retain ownership of all content you upload or create within the Service ("Your Content"). By using the Service,
					you grant AidNova a limited, non-exclusive, worldwide licence to host, store, and display Your Content solely to
					provide and operate the Service for your organization.
				</p>
				<p>
					You are solely responsible for the accuracy, legality, and appropriateness of Your Content. You represent that
					you have all necessary rights to upload and use the content you provide.
				</p>
			</Section>

			<Section title="8. Intellectual Property">
				<p>
					The Service, including its design, code, trademarks, logos, and documentation, is owned by AidNova and protected
					by applicable intellectual property laws. Nothing in these Terms grants you ownership of any AidNova intellectual
					property. You may not use our name, logo, or branding without prior written consent.
				</p>
			</Section>

			<Section title="9. Third-Party Integrations">
				<p>
					The Service may integrate with third-party platforms (e.g. Google Drive, email providers). Your use of such
					integrations is subject to the third party's own terms and privacy policies. AidNova is not responsible for the
					practices or content of third-party services.
				</p>
			</Section>

			<Section title="10. Service Availability">
				<p>
					We strive to maintain high availability but do not guarantee uninterrupted access. We may perform scheduled or
					emergency maintenance that temporarily limits access. We are not liable for any downtime, data loss, or damages
					resulting from outages beyond our reasonable control.
				</p>
			</Section>

			<Section title="11. Disclaimer of Warranties">
				<p>
					THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
					WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT
					THE SERVICE WILL BE ERROR-FREE OR THAT DEFECTS WILL BE CORRECTED.
				</p>
			</Section>

			<Section title="12. Limitation of Liability">
				<p>
					TO THE FULLEST EXTENT PERMITTED BY LAW, AIDNOVA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
					CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH
					YOUR USE OF THE SERVICE. IN NO EVENT SHALL OUR TOTAL LIABILITY EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO
					US IN THE 12 MONTHS PRECEDING THE CLAIM OR (B) USD 100.
				</p>
			</Section>

			<Section title="13. Indemnification">
				<p>
					You agree to indemnify, defend, and hold harmless AidNova and its officers, directors, employees, and agents from
					any claims, liabilities, damages, and expenses (including legal fees) arising from your use of the Service, Your
					Content, or your violation of these Terms.
				</p>
			</Section>

			<Section title="14. Termination">
				<p>
					You may cancel your subscription by giving us 30 days' notice, by contacting us at any time. We may suspend or
					terminate your access immediately if you breach these Terms or if your payment fails after reasonable notice.
					Upon termination, your right to use the Service ceases. We will retain Your Content for 90 days after termination
					to allow data export, after which it will be deleted.
				</p>
			</Section>

			<Section title="15. Changes to These Terms">
				<p>
					We may update these Terms from time to time. We will notify organization administrators via email and in-app notice
					at least 14 days before material changes take effect. Your continued use of the Service after the effective date
					constitutes acceptance of the revised Terms.
				</p>
			</Section>

			<Section title="16. Governing Law">
				<p>
					These Terms are governed by and construed in accordance with applicable law. Any disputes arising under or in
					connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts in the
					applicable jurisdiction.
				</p>
			</Section>

			<Section title="17. Contact Us">
				<p>If you have questions about these Terms, please contact us at:</p>
				<ContactCard />
			</Section>
		</LegalPage>
	);
}
