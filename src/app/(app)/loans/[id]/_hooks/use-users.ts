"use client";

import { useEffect, useState } from "react";
import { userService } from "@/services";
import type { User } from "@/types";

// Loads the list of active users — used for Account Officer assignment.
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchUsers() {
      try {
        const res = await userService.list();
        const list = Array.isArray(res)
          ? res
          : (res as unknown as { data: User[] }).data ?? [];
        if (!cancelled) {
          setUsers(list.filter((u) => u.status === "active"));
        }
      } catch {
        /* non-critical */
      }
    }
    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  return users;
}
