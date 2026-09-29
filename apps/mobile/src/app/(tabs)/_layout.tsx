import AppTabs from '@/components/app-tabs';

// The tab group. Screens pushed from here (run detail, notifications,
// passport, officers...) live as siblings in app/ and stack on top, since the
// root layout wraps this whole group in a Stack.
export default function TabsLayout() {
  return <AppTabs />;
}
