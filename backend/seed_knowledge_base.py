"""Seed the shared knowledge base with real clinic content — hours, policies,
insurance, a new-patient guide, and an FAQ — so the "Ask Floss Clinic"
assistant has something to actually answer from beyond the auto-generated
dentist/department directory. Runs the same chunk -> embed -> persist
pipeline as a staff file upload (see app/documents/ingestion.py).

Safe to re-run — skips any document whose filename already exists exactly
like seed.py does for users/departments/doctors. To push edited content,
delete the affected document first (via the Knowledge Base page as staff,
or DELETE /api/documents/<id>) and re-run this script.

Usage: venv/Scripts/python.exe seed_knowledge_base.py
"""
from app import create_app
from app.extensions import db
from app.models import Document, User
from app.documents.ingestion import ingest_document

DOCUMENTS = [
    (
        "Clinic Hours.txt",
        "policy",
        """
Floss Clinic hours of operation.

What time is Floss Clinic open? We're open for appointments Monday,
Wednesday, and Friday, from 9:00 AM to 1:00 PM and again from 2:00 PM to
5:00 PM. We are closed for appointments on Tuesday, Thursday, and on
weekends (Saturday and Sunday).

What are the clinic's business hours? Monday, Wednesday, Friday: 9:00 AM -
1:00 PM and 2:00 PM - 5:00 PM. Tuesday, Thursday, Saturday, Sunday: closed.

Is the clinic open on weekends? No, Floss Clinic is closed on Saturday and
Sunday.

What time does the clinic close? On the days we're open (Monday, Wednesday,
Friday), we close for a lunch break at 1:00 PM, reopen at 2:00 PM, and close
for the day at 5:00 PM.

Can I call the front desk on days you're closed to patients? Yes — the front
desk answers phone calls Monday through Friday, 9:00 AM to 5:00 PM, even on
Tuesday and Thursday when we aren't seeing patients, for billing questions,
rescheduling, and general inquiries.

Note that an individual dentist's actual available booking slots can be
narrower than the clinic's general hours — check that dentist's profile on
the Dentists page for their specific schedule before booking.
""".strip(),
    ),
    (
        "Location & Parking.txt",
        "general",
        """
Floss Clinic location and parking.

Where is Floss Clinic located, and which room will I be seen in? Floss
Clinic operates three treatment spaces: General Treatment (Room A) for
routine dental care, an Orthodontics suite (Room B), and a Surgical Suite
for oral surgery and extractions. You don't need to know which room ahead
of time — reception will direct you to the correct room when you check in.

Is there parking at Floss Clinic? Yes, free patient parking is available
on-site.

How early should I arrive for my appointment? Please arrive 10 minutes
before your scheduled appointment time to check in, or 15 minutes early if
it's your first visit so there's time to complete new-patient paperwork.
""".strip(),
    ),
    (
        "Insurance & Payment Policy.txt",
        "policy",
        """
Floss Clinic — Insurance & Payment Policy

We accept most major dental PPO insurance plans. Bring your insurance card
(physical or digital) to your first appointment so our front desk can verify
your coverage and estimate your out-of-pocket cost before treatment begins.
We do not currently accept dental HMO or DMO plans that require a specific
in-network primary dentist assignment outside our practice.

If you don't have dental insurance, we offer a self-pay rate that's provided
at check-in, and payment plans are available for treatment plans over $500 —
ask the front desk about setting one up before your procedure.

Accepted payment methods: credit and debit cards, HSA/FSA cards, and cash.
Payment (or your insurance co-pay) is due at the time of service unless a
payment plan has been arranged in advance.

Billing questions after a visit should go to the front desk during business
hours rather than through the Ask Floss Clinic assistant, since account-
specific balance and claim details aren't in the assistant's knowledge base.
""".strip(),
    ),
    (
        "Appointment & Cancellation Policy.txt",
        "policy",
        """
Floss Clinic — Appointment & Cancellation Policy

Booking: Patients can book, view, and manage appointments directly from the
My Appointments page after creating an account. Select a dentist, pick an
open time from their published availability, and your appointment is
confirmed immediately — no phone call needed for standard bookings.

Cancellations: We ask for at least 24 hours' notice to cancel or reschedule
an appointment. Cancel or reschedule directly from My Appointments, or call
the front desk during business hours.

Late arrivals: If you arrive more than 15 minutes late, we may need to
reschedule your appointment to keep the rest of the day's schedule on time
for other patients.

No-shows: Missing an appointment without any notice may result in a $50
no-show fee for future bookings and can affect your ability to book same-day
availability going forward.

New patients: Please arrive 15 minutes early for your first visit to
complete intake paperwork, rather than the standard 10 minutes for returning
patients.
""".strip(),
    ),
    (
        "New Patient Guide.txt",
        "general",
        """
Floss Clinic — New Patient Guide

Getting started: Create an account on the Floss Clinic website, then use the
Dentists page to browse by department and pick an available time with the
dentist of your choice. You'll receive a confirmation immediately.

What to bring to your first visit: a photo ID, your insurance card if you
have one, a list of any current medications, and a summary of your dental
history if you're transferring from a previous dentist.

What to expect: your first appointment typically includes a full oral exam,
X-rays if needed, a cleaning, and a conversation with your dentist about any
treatment recommendations. First visits usually run 60-90 minutes, longer
than a routine follow-up cleaning.

Children and pediatric care: our Pediatric Dentistry department sees
patients from infancy through the teenage years. A parent or guardian must
accompany any patient under 18 to their appointment and complete intake
paperwork on their behalf.

Records transfer: if you're switching from another dental office, you can
request your prior records be sent to us — bring the name and contact info
of your previous dentist to your first visit and our front desk will help
with the transfer request.
""".strip(),
    ),
    (
        "Frequently Asked Questions.txt",
        "faq",
        """
Floss Clinic — Frequently Asked Questions

Do you treat children? Yes — our Pediatric Dentistry department, led by
Dr. Marcus Webb, treats patients from infancy through the teenage years.

Do you accept walk-ins? We're appointment-based rather than walk-in. Same-day
availability does open up sometimes from cancellations — check the Dentists
page for the soonest open slot, or call the front desk to ask about same-day
openings.

Do you offer sedation? Sedation options vary by procedure and dentist,
particularly for oral surgery and extractions. Ask your dentist about
sedation options when you book a procedure that may need it.

Can the Ask Floss Clinic assistant give me medical or dental advice? No —
the assistant answers questions about our hours, policies, insurance, and
services, and can point you to the right dentist or department, but it will
never diagnose a condition or recommend treatment. For anything about your
own symptoms or care, please book an appointment or call the clinic.

What if I have a dental emergency? See the "Emergency Dental Care" document
in the knowledge base — it covers what counts as an emergency and what to do
during and after business hours.

How do I cancel or reschedule? From the My Appointments page in your
account, or by calling the front desk at least 24 hours before your
appointment — see the Appointment & Cancellation Policy document for details.

Which insurance do you accept? Most major dental PPO plans — see the
Insurance & Payment Policy document for full details.
""".strip(),
    ),
    (
        "Emergency Dental Care.txt",
        "faq",
        """
Floss Clinic — Emergency Dental Care

What counts as a dental emergency: severe or worsening tooth pain, a
knocked-out or badly broken tooth, uncontrolled bleeding from the mouth,
significant facial swelling, or a jaw injury.

During business hours (Monday, Wednesday, Friday 9:00 AM-5:00 PM): call the
front desk right away. We prioritize same-day emergency slots ahead of
routine bookings whenever possible.

Outside business hours or if you can't reach us: for uncontrolled bleeding,
significant facial swelling, or a jaw injury, go to the nearest emergency
room rather than waiting for the clinic to reopen. For a knocked-out tooth,
time matters — if possible, keep the tooth moist (in milk or held gently in
place) and seek emergency dental or medical care immediately rather than
waiting.

The Ask Floss Clinic assistant cannot triage an emergency or tell you
whether your specific situation needs urgent care — if you're unsure whether
something counts as an emergency, treat it as one and seek care right away
rather than waiting for a chat answer.
""".strip(),
    ),
]


def seed_knowledge_base():
    app = create_app()
    with app.app_context():
        staff = User.query.filter_by(role="staff").first() or User.query.filter_by(role="admin").first()
        if staff is None:
            raise RuntimeError("No staff/admin user found — run seed.py first.")

        created = []
        for filename, document_type, text in DOCUMENTS:
            if Document.query.filter_by(filename=filename).first() is not None:
                continue

            document = Document(
                uploaded_by=staff.id, filename=filename, document_type=document_type, status="pending"
            )
            db.session.add(document)
            db.session.commit()

            ingest_document(document, text.encode("utf-8"), filename)
            created.append((filename, document.status))

        if created:
            print("Seeded knowledge base documents:")
            for filename, status in created:
                print(f"  {filename} -> {status}")
        else:
            print("Knowledge base documents already present — nothing to do.")


if __name__ == "__main__":
    seed_knowledge_base()
