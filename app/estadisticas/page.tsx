"use client";

import { AuthenticatedRoute } from "../components/AuthenticatedRoute";
import { ShirtCollectionApp } from "../components/ShirtCollectionApp";

export default function StatsPage() {
  return (
    <AuthenticatedRoute>
      {({ onLogout }) => (
        <ShirtCollectionApp
          onLogout={onLogout}
          defaultViewMode="stats"
        />
      )}
    </AuthenticatedRoute>
  );
}
