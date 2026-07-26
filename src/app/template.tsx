import { ViewTransition } from "react";

export default function Template({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransition enter="route-page" exit="route-page" default="none">
      <div className="flex min-h-full flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
