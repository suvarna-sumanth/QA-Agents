# **App Name**: AudioPulse Verify

## Core Features:

- Dashboard Overview & Metrics: Provides a high-level view of QA progress, overall success rates for player functionality and audio quality, and status of active agents, by aggregating data from the PostgreSQL database.
- Publisher Site & Test Management: Allows QA engineers to view and manage registered publisher websites, trigger new QA runs for specific sites or batches, and review test coverage by interacting with backend services to update the PostgreSQL database.
- Real-time QA Run Monitoring: Displays the status and progress of ongoing QA runs, including the current stage of processing by worker agents, with data streamed or fetched from the PostgreSQL database via the API.
- Detailed Bug Report Analysis: Provides access to comprehensive bug reports generated from test failures, including identified issues, associated metadata (site, URL, browser), detailed error logs, and severity levels, all retrieved from the PostgreSQL database.
- Artifact Review: Enables convenient viewing of captured screenshots for various player states (e.g., page loaded, ad playing, error states), console logs, network logs, and audio transcripts stored in AWS S3 and referenced within the PostgreSQL database.
- AI-Powered Audio Quality Insights Display: Visualizes detailed results from the AI audio analysis tool (performed by Honey Grace Master Agent's workers), including Word Error Rate, semantic similarity, speech confidence scores, and specific issues like mispronounced words or missing segments. These insights are derived using the OpenAI Whisper API and stored in the PostgreSQL database.
- Test Rerun Functionality: Allows QA engineers to easily re-queue individual failed tests or entire test suites directly from the dashboard interface, sending commands via the API to the QA Orchestrator and updating test configurations in the PostgreSQL database.

## Style Guidelines:

- Primary color: A deep, professional blue (#264DE5), chosen to convey clarity, reliability, and precision, reflecting the technical nature of the QA automation platform.
- Background color: A very light, subtly desaturated blue (#ECF0F5), providing a clean, spacious backdrop that enhances readability and prevents eye strain in data-intensive dashboard views.
- Accent color: A vibrant, cool cyan-aqua (#1497CC), serving as a contrasting highlight for interactive elements, calls-to-action, and crucial data points, while maintaining a cohesive professional aesthetic.
- Headline and body text font: 'Inter', a grotesque-style sans-serif. Its modern, neutral, and objective appearance ensures exceptional legibility for displaying extensive logs, reports, and data tables across the dashboard.
- Code display font: 'Source Code Pro', a monospaced sans-serif. This font is specifically designated for the clear and structured presentation of console output, network logs, and any code snippets within bug reports.
- Employ clear, minimalist vector-based icons that visually communicate complex technical concepts, system statuses (e.g., success, failure, pending), and navigational cues with immediate clarity and a contemporary feel.
- Implement a structured, responsive grid-based layout for the dashboard. Utilize clearly defined sections, card-based components, and sortable data tables to organize information hierarchically and ensure adaptability across various screen sizes.
- Integrate subtle, smooth functional animations for loading states, data updates, and seamless transitions between different dashboard views or sections, aimed at improving perceived performance and user experience without visual distraction.