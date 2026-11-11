# Customer Success

A daily workspace for a customer success team. It keeps the book of business, renewals, success plans, meetings, wins, and tasks in one place. The app runs as one Docker container and stores its data in SQLite.

## Run

From this directory:

```bash
docker compose up
```

Open [http://localhost:3000](http://localhost:3000).

The first visit asks you to create the owner account. That account can add teammates. The database is created on the `cs-data` volume at `/data/cs.db`. Mailbox passwords are encrypted with a key file stored next to the database. Neither file is in git.

To rebuild after a code change:

```bash
docker compose up --build
```

Stopping the container does not delete the volume. Accounts, meetings, and the owner login stay where they are.

A fresh database includes three sample accounts: Northwind, Acme, and Globex. They can be deleted in the app.

## Screens

The signed-in app uses one left-hand navigation. Home can show **Mine** or **Team**. Mine is the signed-in person's accounts and assigned tasks. Team is the whole book.

**Home.** The morning view. Counts for at-risk accounts, renewals due in 90 days, open tasks, and meetings this week. Charts for accounts by health and ARR by health. Lists for alerts, upcoming renewals, at-risk accounts, upcoming meetings, open tasks, and recent wins.

**Alerts.** One alert for each health factor that is not Healthy. Dismiss an alert you have handled. It opens again if that problem clears and returns, or if it gets worse.

**Customers.** Search and filters for health, stage, renewal window, and owner. **New account** creates the account, six success-plan phases, and an open renewal.

**Customer record.** Header with the calculated health and the five reasons. Tabs:

- Overview shows the account details and a timeline of meetings, emails, wins, and completed tasks.
- Contacts lists the people on the account. One person is primary. Calendar and mail match any of their addresses.
- Success plan is the phase list: Kickoff, Onboarding, Adoption, Value, Expansion, and Renewal. Each phase is Not started, In progress, Blocked, or Done, with an optional target date.
- Meetings, Wins, Renewal, and Tasks are edited on the account and also appear on their own pages.

**Renewals.** A stage board and an upcoming list. Stages are Not started, In progress, Negotiation, Committed, Closed won, and Closed lost. Forecast is Commit, Best case, Pipeline, or Omitted. Risk is Low, Medium, or High. Closed won keeps that deal and opens the next term one year later. Closed lost marks the account Churned and removes it from the Home book.

**Tasks.** A board of Not started, In progress, and Done. Each card has an account, due date, priority, and assignee.

**Wins.** A dated list. A win has a type (Adoption, Expansion, Executive sponsor, Reference, ROI proof, or Other), an impact, an ARR impact, and a summary.

**Sync.** Each person can save a calendar address (an `http` or `https` `.ics` feed) and an IMAP mailbox. Events and messages are matched to contact email addresses. A calendar event that matches nobody can be assigned to an account or dismissed.

**Team.** The owner adds teammates and can remove them. Anyone can change their own password.

## Health

Health is calculated when you open the app. The labels are Healthy, Needs attention, and At risk. The worst factor sets the label:

| Factor | Needs attention | At risk |
| --- | --- | --- |
| Renewal date | Inside 30 days | Overdue |
| Open renewal risk | Medium | High |
| Success plan | A phase is past its target | A phase is blocked |
| Last meeting | The last past meeting was concerned | — |
| Tasks | An open task is overdue | — |

No renewal date, a low-risk renewal, and a future meeting leave those factors Healthy.

## Local development

```bash
npm ci
npx next build
DATABASE_PATH=./data/cs.db npx next start -H 127.0.0.1 -p 3000
```

The supported run is `docker compose up`. The image listens on port 3000.

## Outside this app

This app does not include a rules engine, surveys, product-usage analytics, people maps, journey automation, AI, or CRM sync. Health is not a configurable score.
