import type { PackageDto, PackagePixOrderDto, UserPackageDto, SubscriptionDto } from "@/lib/back-office/product-types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchProductPackages(): Promise<{
  packages: PackageDto[];
  pixEnabled: boolean;
}> {
  const res = await fetch("/api/back-office/packages", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; packages?: PackageDto[]; pixEnabled?: boolean }>(res);
  return { packages: data?.packages ?? [], pixEnabled: data?.pixEnabled ?? false };
}

export async function fetchUserPackages(): Promise<UserPackageDto[]> {
  const res = await fetch("/api/back-office/packages/mine", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; packages?: UserPackageDto[] }>(res);
  return data?.packages ?? [];
}

export async function purchaseProductPackage(
  packageId: string,
  amount?: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/back-office/packages/purchase", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ packageId, amount }),
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível comprar o pacote." };
  }
  return { ok: true };
}

export async function purchaseProductPackagePix(
  packageId: string,
  amount?: number,
): Promise<{ ok: true; order: PackagePixOrderDto } | { ok: false; error: string }> {
  const res = await fetch("/api/back-office/packages/purchase-pix", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ packageId, amount }),
  });
  const data = await parseJson<{ ok: boolean; order?: PackagePixOrderDto; error?: string }>(res);
  if (!res.ok || !data?.ok || !data.order) {
    return { ok: false, error: data?.error ?? "Não foi possível gerar o PIX." };
  }
  return { ok: true, order: data.order };
}

export async function syncProductPackagePixOrder(
  orderId: string,
): Promise<
  | { ok: true; order: PackagePixOrderDto; userPackage?: UserPackageDto }
  | { ok: false; error: string }
> {
  const res = await fetch(`/api/back-office/packages/pix-order/${orderId}`, {
    credentials: "include",
  });
  const data = await parseJson<{
    ok: boolean;
    order?: PackagePixOrderDto;
    userPackage?: UserPackageDto;
    error?: string;
  }>(res);
  if (!res.ok || !data?.ok || !data.order) {
    return { ok: false, error: data?.error ?? "Erro ao consultar PIX." };
  }
  return { ok: true, order: data.order, userPackage: data.userPackage };
}

export async function fetchSubscription(): Promise<SubscriptionDto | null> {
  const res = await fetch("/api/back-office/subscription", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; subscription?: SubscriptionDto }>(res);
  return data?.subscription ?? null;
}

export async function paySubscription(): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/back-office/subscription/pay", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível pagar a mensalidade." };
  }
  return { ok: true };
}

export async function runDailyAutomationYield(): Promise<{
  ok: boolean;
  result?: { yieldPct: number; credited: number; missed: number };
  error?: string;
}> {
  const res = await fetch("/api/back-office/automation/daily", {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson<{
    ok: boolean;
    result?: { yieldPct: number; credited: number; missed: number };
    error?: string;
  }>(res);
  return data ?? { ok: false, error: "Erro desconhecido." };
}
