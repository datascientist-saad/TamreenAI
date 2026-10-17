import { SignupForm } from "@/features/auth/auth-forms";

export default function SignupPage() {
  return <SignupForm googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"} />;
}
