import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, RefreshCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { adminOpsService } from "../../lib/api/services";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { ProjTrackLogo } from "../brand/ProjTrackLogo";
import { useBranding } from "../brand/BrandingProvider";
import {
  BRANDING_UPLOAD_MAX_BYTES,
  defaultBranding,
  type BrandingAssetKind,
  type BrandingResponse,
} from "../brand/branding";
import { SettingsSection } from "./SettingsSection";

type FileSelectionState = Partial<Record<BrandingAssetKind, File | null>>;
type FileErrorState = Partial<Record<BrandingAssetKind, string>>;
type PreviewState = Partial<Record<BrandingAssetKind, string | null>>;
type SavedUrlKey = "logoUrl" | "iconUrl" | "faviconUrl";

const kindLabels: Record<BrandingAssetKind, string> = {
  logo: "Full logo",
  icon: "Icon logo",
  favicon: "Favicon",
};

const acceptedTypes: Record<BrandingAssetKind, string[]> = {
  logo: [".png", ".svg", ".webp", ".jpg", ".jpeg"],
  icon: [".png", ".svg", ".webp", ".jpg", ".jpeg"],
  favicon: [".png", ".ico"],
};

const acceptedMimeTypes: Record<BrandingAssetKind, string[]> = {
  logo: ["image/png", "image/svg+xml", "image/webp", "image/jpeg"],
  icon: ["image/png", "image/svg+xml", "image/webp", "image/jpeg"],
  favicon: ["image/png", "image/x-icon", "image/vnd.microsoft.icon"],
};

const checkerboardStyle = {
  backgroundImage:
    "linear-gradient(45deg, rgba(148,163,184,0.12) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,0.12) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.12) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.12) 75%)",
  backgroundSize: "22px 22px",
  backgroundPosition: "0 0, 0 11px, 11px -11px, -11px 0",
} as const;

const uploadedUrlKeys: Record<BrandingAssetKind, SavedUrlKey> = {
  logo: "logoUrl",
  icon: "iconUrl",
  favicon: "faviconUrl",
};

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to read the branding file."));
        return;
      }
      const [, encoded = ""] = result.split(",", 2);
      resolve(encoded);
    };
    reader.onerror = () => reject(new Error("Unable to read the branding file."));
    reader.readAsDataURL(file);
  });
}

function inferMimeType(file: File) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".svg")) return "image/svg+xml";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".ico")) return "image/x-icon";
  return file.type || "application/octet-stream";
}

function matchesAcceptedType(kind: BrandingAssetKind, file: File) {
  const lowerName = file.name.toLowerCase();
  return (
    acceptedTypes[kind].some((extension) => lowerName.endsWith(extension)) &&
    (file.type === "" || acceptedMimeTypes[kind].includes(file.type))
  );
}

function BrandingPreviewCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-slate-200/80 bg-white/75 shadow-sm dark:border-slate-700/60 dark:bg-slate-950/40">
      <div className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/60">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className={cn("p-4", className)}>{children}</div>
    </div>
  );
}

export function BrandingSettingsSection() {
  const { branding, replaceBranding, reloadBranding } = useBranding();
  const [selectedFiles, setSelectedFiles] = useState<FileSelectionState>({});
  const [previewUrls, setPreviewUrls] = useState<PreviewState>({});
  const [fileErrors, setFileErrors] = useState<FileErrorState>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [previewUrls]);

  const effectiveBranding: BrandingResponse = useMemo(
    () => ({
      ...defaultBranding,
      ...branding,
      logoUrl: previewUrls.logo ?? branding.logoUrl,
      iconUrl: previewUrls.icon ?? branding.iconUrl,
      faviconUrl: previewUrls.favicon ?? branding.faviconUrl,
    }),
    [branding, previewUrls],
  );

  const hasPendingChanges = Object.values(selectedFiles).some(Boolean);
  const hasPersistedUploads = Boolean(
    branding.logoUrl ||
      branding.iconUrl ||
      (branding.faviconUrl && branding.faviconUrl !== defaultBranding.faviconUrl),
  );
  const jpgSelected = [selectedFiles.logo, selectedFiles.icon].some((file) => {
    const name = file?.name.toLowerCase() ?? "";
    return name.endsWith(".jpg") || name.endsWith(".jpeg");
  });

  const clearTransientState = () => {
    setSelectedFiles({});
    setPreviewUrls((current) => {
      Object.values(current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      return {};
    });
    setFileErrors({});
  };

  const handleFileChange = (kind: BrandingAssetKind, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setStatusMessage(null);
    setFileErrors((current) => ({ ...current, [kind]: undefined }));
    if (!file) {
      setSelectedFiles((current) => ({ ...current, [kind]: null }));
      return;
    }
    if (file.size > BRANDING_UPLOAD_MAX_BYTES) {
      setFileErrors((current) => ({
        ...current,
        [kind]: "File is too large. Branding uploads must be 2MB or smaller.",
      }));
      return;
    }
    if (!matchesAcceptedType(kind, file)) {
      setFileErrors((current) => ({
        ...current,
        [kind]: `Invalid file type. ${kindLabels[kind]} supports ${acceptedTypes[kind].join(", ")}.`,
      }));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrls((current) => {
      const next = { ...current };
      if (next[kind]) {
        URL.revokeObjectURL(next[kind] as string);
      }
      next[kind] = objectUrl;
      return next;
    });
    setSelectedFiles((current) => ({ ...current, [kind]: file }));
  };

  const handleSaveBranding = async () => {
    if (saving || !hasPendingChanges) return;
    setSaving(true);
    setStatusMessage(null);
    setFileErrors({});

    try {
      const pendingKinds = (["logo", "icon", "favicon"] as BrandingAssetKind[]).filter(
        (kind) => selectedFiles[kind],
      );
      let nextBranding = branding;

      for (let index = 0; index < pendingKinds.length; index += 1) {
        const kind = pendingKinds[index];
        const file = selectedFiles[kind];
        if (!file) continue;
        setSaveProgress(Math.round((index / Math.max(pendingKinds.length, 1)) * 100));
        const contentBase64 = await fileToBase64(file);
        nextBranding = await adminOpsService.uploadBrandingAsset(kind, {
          fileName: file.name,
          mimeType: inferMimeType(file),
          contentBase64,
        });
        if (!nextBranding[uploadedUrlKeys[kind]]) {
          throw new Error(`${kindLabels[kind]} uploaded, but the API did not return an uploaded asset URL.`);
        }
      }

      setSaveProgress(100);
      nextBranding = await adminOpsService.saveBranding({ brandName: branding.brandName });
      for (const kind of pendingKinds) {
        if (!nextBranding[uploadedUrlKeys[kind]]) {
          throw new Error(`${kindLabels[kind]} was not present in the saved branding response.`);
        }
      }
      replaceBranding(nextBranding);
      const refreshedBranding = await reloadBranding();
      for (const kind of pendingKinds) {
        if (!refreshedBranding[uploadedUrlKeys[kind]]) {
          throw new Error(`${kindLabels[kind]} was not returned after refreshing branding.`);
        }
      }
      if (import.meta.env.DEV) {
        console.info("[branding] saved branding response", {
          logoUrl: refreshedBranding.logoUrl,
          iconUrl: refreshedBranding.iconUrl,
          faviconUrl: refreshedBranding.faviconUrl,
          updatedAt: refreshedBranding.updatedAt,
        });
      }
      clearTransientState();
      setStatusMessage("Branding saved successfully.");
      toast.success("Branding saved successfully.");
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Unable to save branding right now.";
      setStatusMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
      setSaveProgress(0);
    }
  };

  const handleResetBranding = async () => {
    if (saving) return;
    const confirmed = window.confirm("Reset branding to the default ProjTrack logo set?");
    if (!confirmed) return;

    setSaving(true);
    setStatusMessage(null);
    try {
      const nextBranding = await adminOpsService.resetBranding();
      replaceBranding(nextBranding);
      await reloadBranding();
      clearTransientState();
      setStatusMessage("Branding reset to the default ProjTrack assets.");
      toast.success("Branding reset to default.");
    } catch (resetError) {
      const message =
        resetError instanceof Error ? resetError.message : "Unable to reset branding right now.";
      setStatusMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
      setSaveProgress(0);
    }
  };

  return (
    <SettingsSection
      title="Branding"
      description="Upload transparent-ready logo assets for login screens, portal chrome, and shared browser branding."
      contentClassName="space-y-5"
    >
      <div className="rounded-[var(--radius-card)] border border-blue-200/70 bg-blue-50/80 px-4 py-4 text-sm leading-6 text-blue-900 dark:border-blue-400/25 dark:bg-blue-500/12 dark:text-blue-100">
        <p className="font-semibold">Recommended branding files</p>
        <p>PNG, SVG, and WEBP preserve transparent backgrounds. JPG does not support transparent backgrounds. Use PNG, SVG, or WEBP for transparent logos. Max file size is 2MB.</p>
      </div>

      {jpgSelected ? (
        <div className="inline-flex items-start gap-2 rounded-[var(--radius-card)] border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/12 dark:text-amber-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>JPG does not support transparent backgrounds. Use PNG, SVG, or WEBP for transparent logos.</span>
        </div>
      ) : null}

      {statusMessage ? (
        <div className="inline-flex items-start gap-2 rounded-[var(--radius-card)] border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {(["logo", "icon", "favicon"] as BrandingAssetKind[]).map((kind) => (
          <div
            key={kind}
            className="rounded-[var(--radius-card)] border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-950/35"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{kindLabels[kind]}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {kind === "favicon"
                    ? "PNG or ICO, 2MB max."
                    : "PNG, SVG, WEBP, or JPG, 2MB max."}
                </p>
              </div>
              <ImagePlus size={16} className="text-slate-400" />
            </div>

            <div
              className="flex h-28 items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-dashed border-slate-300/80 bg-slate-50/90 p-3 dark:border-slate-600/70 dark:bg-slate-900/70"
              style={checkerboardStyle}
            >
              {kind === "favicon" ? (
                effectiveBranding.faviconUrl ? (
                  <img
                    src={effectiveBranding.faviconUrl}
                    alt="Current favicon preview"
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    No favicon
                  </span>
                )
              ) : (
                <ProjTrackLogo
                  role="admin"
                  compact={kind === "icon"}
                  subtitle={kind === "icon" ? "Icon Logo" : "Current Upload"}
                  brandingOverride={effectiveBranding}
                  className={kind === "icon" ? "justify-center" : "max-w-full"}
                  imageClassName="object-contain"
                />
              )}
            </div>

            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800">
              <Upload size={15} />
              <span>{`Upload ${kindLabels[kind]}`}</span>
              <input
                type="file"
                className="sr-only"
                accept={acceptedTypes[kind].join(",")}
                aria-label={`Upload ${kindLabels[kind]}`}
                onChange={(event) => handleFileChange(kind, event)}
              />
            </label>

            {selectedFiles[kind] ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Ready to save: {selectedFiles[kind]?.name}
              </p>
            ) : null}
            {fileErrors[kind] ? (
              <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-300">
                {fileErrors[kind]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BrandingPreviewCard
          title="Admin Login"
          description="Shared login/logo preview on a dark role shell."
          className="rounded-[calc(var(--radius-card)-0.25rem)] bg-[linear-gradient(135deg,#0f172a,#1e293b_55%,#334155)]"
        >
          <div className="flex min-h-[11rem] items-center justify-center rounded-[var(--radius-card)] border border-white/10 p-5" style={checkerboardStyle}>
            <ProjTrackLogo
              role="admin"
              subtitle="Admin Portal"
              inverse
              brandingOverride={effectiveBranding}
              className="max-w-full"
            />
          </div>
        </BrandingPreviewCard>

        <BrandingPreviewCard
          title="Sidebar Expanded"
          description="Portal sidebar branding with full logo treatment."
          className="bg-slate-900/95"
        >
          <div className="min-h-[11rem] rounded-[var(--radius-card)] border border-slate-700/70 p-5" style={checkerboardStyle}>
            <div className="flex min-h-[7rem] items-center rounded-[var(--radius-card)] border border-white/10 bg-white/5 px-4">
              <ProjTrackLogo
                role="admin"
                subtitle="Admin Workspace"
                showRoleDot
                inverse
                brandingOverride={effectiveBranding}
                className="max-w-full"
              />
            </div>
          </div>
        </BrandingPreviewCard>

        <BrandingPreviewCard
          title="Sidebar Collapsed"
          description="Compact icon-only state for collapsed navigation."
          className="bg-slate-900/95"
        >
          <div className="min-h-[11rem] rounded-[var(--radius-card)] border border-slate-700/70 p-5" style={checkerboardStyle}>
            <div className="flex min-h-[7rem] w-24 items-center justify-center rounded-[var(--radius-card)] border border-white/10 bg-white/5">
              <ProjTrackLogo
                role="admin"
                compact
                brandingOverride={effectiveBranding}
              />
            </div>
          </div>
        </BrandingPreviewCard>

        <BrandingPreviewCard
          title="Light and Dark Backgrounds"
          description="Contrast check for transparent assets."
          className="grid gap-3 md:grid-cols-2"
        >
          <div className="rounded-[var(--radius-card)] border border-slate-200/80 bg-white p-4" style={checkerboardStyle}>
            <ProjTrackLogo
              role="student"
              subtitle="Light Background"
              brandingOverride={effectiveBranding}
              className="max-w-full"
            />
          </div>
          <div className="rounded-[var(--radius-card)] border border-slate-700/60 bg-slate-950 p-4" style={checkerboardStyle}>
            <ProjTrackLogo
              role="teacher"
              subtitle="Dark Background"
              inverse
              brandingOverride={effectiveBranding}
              className="max-w-full"
            />
          </div>
        </BrandingPreviewCard>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 dark:border-slate-700/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {saving
            ? `Saving branding... ${saveProgress}%`
            : hasPendingChanges
              ? "Preview is local until you save branding."
              : "Uploaded branding persists through refresh and backend restart."}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={saving || (!hasPersistedUploads && !hasPendingChanges)}
            onClick={handleResetBranding}
          >
            <RefreshCcw size={14} />
            Reset to Default
          </Button>
          <Button
            type="button"
            disabled={saving || !hasPendingChanges}
            onClick={() => {
              void handleSaveBranding();
            }}
          >
            <Upload size={14} />
            Save Branding
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
