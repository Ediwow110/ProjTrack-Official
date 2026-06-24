"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "../ui/alert-dialog";
import { subscribeSessionExpired, getAuthSession } from "../../lib/authSession";

export function SessionExpiredModal() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [expiredRole, setExpiredRole] = useState<string>("");

  const handleReauth = useCallback(() => {
    setOpen(false);
    navigate(`/${expiredRole}/login`, { replace: true });
  }, [navigate, expiredRole]);

  useEffect(() => {
    return subscribeSessionExpired(() => {
      const session = getAuthSession();
      setExpiredRole(session?.role ?? "admin");
      setOpen(true);
    });
  }, []);

  return (
    <AlertDialog open={open}>
      <AlertDialogOverlay />
      <AlertDialogContent className="max-w-md rounded-[24px] border p-0 shadow-[var(--shadow-shell)] sm:rounded-[30px]">
        <div className="px-6 py-6 sm:px-8 sm:py-8">
          <AlertDialogHeader className="gap-2 text-left">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
            <AlertDialogTitle className="font-display text-xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-2xl">
              Session Expired
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6 text-[var(--text-muted)]">
              Your session has expired. For security reasons, you need to sign in again to continue using ProjTrack.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel
              onClick={handleReauth}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--role-accent)] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--role-accent)] sm:w-auto"
            >
              Sign in again
            </AlertDialogCancel>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
