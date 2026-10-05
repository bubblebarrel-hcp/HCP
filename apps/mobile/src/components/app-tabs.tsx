import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';

// The tab group's screens (Home, Runs, Kennels, Menu). Its own bar is hidden: the
// visible bottom navigation is BottomNav, drawn once by the shared frame in
// app/_layout.tsx so it sits under every screen, pushed ones included, as the web
// app's fixed bar does. The triggers stay so the group still knows its routes.
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="kennels" href="/kennels" />
        <TabTrigger name="runs" href="/runs" />
        <TabTrigger name="account" href="/account" />
      </TabList>
    </Tabs>
  );
}
