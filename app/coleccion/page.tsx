"use client";

import { AuthenticatedRoute } from "../components/AuthenticatedRoute";
import { ShirtCollectionApp } from "../components/ShirtCollectionApp";

export default function CollectionPage() {
  return (
    <AuthenticatedRoute>
      {({ onLogout }) => <ShirtCollectionApp onLogout={onLogout} defaultViewMode="collection" />}
    </AuthenticatedRoute>
  );
}
