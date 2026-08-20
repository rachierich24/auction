"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import {
  changePasswordAction,
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  updateProfileAction,
  type FormState,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const INITIAL: FormState = { ok: false };

function SubmitButton({
  children,
  pending,
  className,
}: {
  children: React.ReactNode;
  pending: boolean;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      disabled={pending}
      className={cn("w-full", className)}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Working…
        </>
      ) : (
        children
      )}
    </Button>
  );
}

function PasswordInput({
  name,
  id,
  autoComplete,
  placeholder,
  invalid,
  describedBy,
}: {
  name: string;
  id: string;
  autoComplete: string;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        required
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-ink"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />

      {state.message ? (
        <Alert tone={state.ok ? "positive" : "critical"} role="alert">
          {state.message}
        </Alert>
      ) : null}

      <Field label="Email address" htmlFor="email" error={state.errors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(state.errors?.email)}
          required
          autoFocus
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={state.errors?.password}
        hint={
          <Link
            href="/forgot-password"
            className="text-[0.75rem] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Forgot password?
          </Link>
        }
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <SubmitButton pending={pending}>Sign in</SubmitButton>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, INITIAL);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? (
        <Alert tone="critical" role="alert">
          {state.message}
        </Alert>
      ) : null}

      {/* Honeypot — hidden from people, irresistible to bots. */}
      <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Field label="Full name" htmlFor="name" error={state.errors?.name}>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Your name"
          aria-invalid={Boolean(state.errors?.name)}
          required
          autoFocus
        />
      </Field>

      <Field label="Email address" htmlFor="email" error={state.errors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(state.errors?.email)}
          required
        />
      </Field>

      <Field
        label="Phone"
        htmlFor="phone"
        error={state.errors?.phone}
        hint={<span className="text-[0.75rem] text-faint">Optional</span>}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+91 98200 00000"
          aria-invalid={Boolean(state.errors?.phone)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={state.errors?.password}
        hint={
          <span className="text-[0.75rem] text-faint">
            10+ characters, mixed case and a number
          </span>
        }
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <SubmitButton pending={pending}>Create account</SubmitButton>

      <p className="text-xs leading-relaxed text-faint">
        By registering you agree to the conditions of sale. Bids placed on this
        platform are binding.
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, INITIAL);

  if (state.ok && state.message) {
    return (
      <Alert tone="positive" title="Check your inbox">
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && !state.ok ? (
        <Alert tone="critical" role="alert">
          {state.message}
        </Alert>
      ) : null}

      <Field label="Email address" htmlFor="email" error={state.errors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(state.errors?.email)}
          required
          autoFocus
        />
      </Field>

      <SubmitButton pending={pending}>Send reset link</SubmitButton>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, INITIAL);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.message ? (
        <Alert tone="critical" role="alert">
          {state.message}
        </Alert>
      ) : null}

      <Field label="New password" htmlFor="password" error={state.errors?.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <Field label="Confirm password" htmlFor="confirm" error={state.errors?.confirm}>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          invalid={Boolean(state.errors?.confirm)}
        />
      </Field>

      <SubmitButton pending={pending}>Set new password</SubmitButton>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function ProfileDetailsForm({
  name,
  phone,
  email,
}: {
  name: string;
  phone: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, INITIAL);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? (
        <Alert tone={state.ok ? "positive" : "critical"} role="status">
          {state.message}
        </Alert>
      ) : null}

      <Field label="Full name" htmlFor="profile-name" error={state.errors?.name}>
        <Input id="profile-name" name="name" defaultValue={name} required />
      </Field>

      <Field
        label="Email address"
        htmlFor="profile-email"
        hint={
          <span className="text-[0.75rem] text-faint">
            Contact the saleroom to change this
          </span>
        }
      >
        <Input id="profile-email" defaultValue={email} disabled readOnly />
      </Field>

      <Field label="Phone" htmlFor="profile-phone" error={state.errors?.phone}>
        <Input
          id="profile-phone"
          name="phone"
          type="tel"
          defaultValue={phone}
          placeholder="+91 98200 00000"
        />
      </Field>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, INITIAL);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? (
        <Alert tone={state.ok ? "positive" : "critical"} role="status">
          {state.message}
        </Alert>
      ) : null}

      <Field
        label="Current password"
        htmlFor="current"
        error={state.errors?.current}
      >
        <PasswordInput
          id="current"
          name="current"
          autoComplete="current-password"
          invalid={Boolean(state.errors?.current)}
        />
      </Field>

      <Field label="New password" htmlFor="new-password" error={state.errors?.password}>
        <PasswordInput
          id="new-password"
          name="password"
          autoComplete="new-password"
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirm-new" error={state.errors?.confirm}>
        <PasswordInput
          id="confirm-new"
          name="confirm"
          autoComplete="new-password"
          invalid={Boolean(state.errors?.confirm)}
        />
      </Field>

      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Updating…" : "Change password"}
      </Button>
    </form>
  );
}
