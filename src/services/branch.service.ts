import { api } from "@/lib/api-client";

export interface ApiBranch {
  id: number;
  name: string;
  code: string;
}

export const branchService = {
  list: () => api.get<ApiBranch[]>("/branches"),
};
