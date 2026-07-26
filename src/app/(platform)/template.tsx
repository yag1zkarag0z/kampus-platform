import { ViewTransition } from "react";

export default function PlatformTemplate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransition enter="route-page" exit="route-page" default="none">
      <div className="min-h-full">{children}</div>
    </ViewTransition>
  );
}
