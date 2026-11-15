import { person } from "./parties";

/**
 * Release rule: a payment can leave once the approvers include someone whose limit covers it.
 * If the first approver's limit is too low, a SECOND, different person with a high enough limit
 * must also sign. Nobody counts twice.
 */
export interface ReleaseCheck {
  canRelease: boolean;
  approvers: string[];
  needs: string;
}

export function releaseCheck(totalEur: number, approverIds: readonly string[]): ReleaseCheck {
  const unique = [...new Set(approverIds)];
  if (unique.length === 0) return { canRelease: false, approvers: [], needs: "First signature needed" };
  const first = person(unique[0]!);
  const firstLimit = first.limitEur ?? 0;
  if (totalEur <= firstLimit) return { canRelease: true, approvers: unique, needs: "" };
  const covered = unique.slice(1).some((id) => (person(id).limitEur ?? 0) >= totalEur);
  return covered
    ? { canRelease: true, approvers: unique, needs: "" }
    : {
        canRelease: false,
        approvers: unique,
        needs: `Above ${first.name.split(" ")[0]}'s €${firstLimit.toLocaleString("en-GB")} limit: a second signer with a higher limit must approve`,
      };
}

export function canApprove(approverId: string, approverIds: readonly string[]): { ok: boolean; why: string } {
  if (approverIds.includes(approverId)) return { ok: false, why: "You already signed. A different person must give the second signature." };
  return { ok: true, why: "" };
}
