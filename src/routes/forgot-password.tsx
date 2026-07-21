import { createFileRoute, Navigate } from "@tanstack/react-router";

// Public password reset is disabled in the DFD internal build.
// Owners reset passwords via the Supabase dashboard.
export const Route = createFileRoute("/forgot-password")({ component: () => <Navigate to="/login" /> });
