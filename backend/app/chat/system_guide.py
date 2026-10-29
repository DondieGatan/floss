"""What the assistant knows about the Floss Clinic app itself.

Trusted reference text (written here, not uploaded by anyone), included in the
system prompt so a question like "how do I reschedule?" or "what can staff do?"
is answered from facts rather than refused as off-topic or guessed at. It
describes what each person can DO in the app; how the app is secured is
deliberately absent, and the prompt tells the model security is off-limits.

Keep it in step with the real app: a feature described here that doesn't exist
is worse than a missing one.
"""

SYSTEM_GUIDE = """\
FLOSS CLINIC SYSTEM GUIDE (trusted reference about the app; use it to answer questions about how the app works; no citation numbers)

What it is: Floss Clinic's web app for a dental clinic. Patients browse dentists, book and manage their own appointments, and chat with this assistant. Staff run the clinic's directory, schedule, treatment rooms and knowledge base. It was built by Dondie Godwin Gatan as a portfolio project (React frontend, Flask backend, PostgreSQL database, Google Gemini for the assistant).

Roles: patient (anyone can create a patient account with Sign up), staff, admin, owner (staff, admin and owner accounts are granted by an admin or the owner, not by signing up). The sidebar shows only the pages that role can use, and the role is shown as a badge. There is a Light mode / Dark mode switch and a Logout button at the bottom of the sidebar.

Patients:
- There is NO page called "My Appointments". Upcoming appointments (Edit, Cancel) live on the Dashboard and past visits on the History page; if a document says "My Appointments", it means the Dashboard, so say Dashboard.
- Dashboard: shows upcoming appointments, counts of upcoming and past visits, a reminder banner for an appointment coming up, and a "Book an appointment" button.
- Dentists page: browse dentists, filter by department, and press "Book appointment" on a dentist.
- Booking: pick a date, then an open 30-minute time slot, optionally add a reason, and confirm. Times in the past can't be booked, a slot someone else already has is refused (pick another), and back-to-back appointments are fine. Dentists only have slots on the days and hours they work.
- Reschedule: on an upcoming appointment press Edit, then choose a new date and time, or even a different dentist. Cancel: press Cancel (a reason is optional); a cancelled slot becomes free again.
- History page: your past visits, read-only.
- Emails: a confirmation email right after you book, and a reminder email shortly before the appointment (within the 24 hours before it).
- Help for your own account: the sign-in page has a "Forgot password" link that emails a reset link, and the Security page in the sidebar holds your own account settings.

The assistant (this chat):
- The round chat button in the corner opens it. Ask about hours, insurance, policies, dentists and departments, how to use the app, or general dental questions. Answers that come from the clinic's own documents carry [1]-style citations; general dental knowledge and app how-to answers carry none.
- For questions about your own appointments it looks up your live account (only yours).
- Turn on "Let the assistant help me book" to have it book, move or cancel your appointments from plain language. It only proposes: a card appears and nothing changes until you press Confirm. An unanswered proposal expires after 15 minutes, and "Not now" drops it. If the assistant is busy, use the Dentists page to book directly.
- Conversations are saved per account; a conversation can be exported as a text file from the chat page.
- It is not a dentist: it can explain general dental topics but never diagnoses or recommends treatment for your own symptoms; book a visit for that.

Staff, admin and owner pages:
- Dashboard: a clinic-wide view.
- Directory: manage departments and dentists (photos, bios, weekly availability windows). Changing it updates the "Dentist & Department Directory" the assistant reads.
- All Appointments: see, cancel or reschedule any appointment across the clinic.
- Schedule: for a chosen day, every dentist's open and booked slots at a glance.
- Treatment Rooms: a board of rooms and chairs to seat a patient and check them out.
- Knowledge Base (staff and admin): upload PDF or TXT documents the assistant can cite, and delete them. Only staff-level accounts can upload or delete; everyone signed in can ask the assistant about them.
- Team & Roles (admin and owner): grant or revoke staff and admin access; every change is recorded in an audit log. You can't change your own role, and only the owner can grant or change admin and owner roles.

Limits worth knowing: uploads are PDF or TXT only; appointments are 30-minute slots; times are the clinic's local time; the assistant can only see a patient's own appointments, never anyone else's.\
"""
