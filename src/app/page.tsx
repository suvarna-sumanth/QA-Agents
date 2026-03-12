import { redirect } from 'next/navigation';

/**
 * Root page - redirect to QA Dashboard
 */
export default function Home() {
  redirect('/qa-dashboard');
}
