import { Suspense } from "react";
import { ExpoMapPage } from "@/components/map/expo-map-page";

export default function MapPage() {
  return (
    <Suspense>
      <ExpoMapPage />
    </Suspense>
  );
}
