"use client";

import { AuthenticatedRoute } from "./components/AuthenticatedRoute";
import { ShirtCollectionApp } from "./components/ShirtCollectionApp";

export default function Home() {
  return (
    <AuthenticatedRoute>
      {({ onLogout }) => <ShirtCollectionApp onLogout={onLogout} defaultViewMode="all" />}
    </AuthenticatedRoute>
  );
}
