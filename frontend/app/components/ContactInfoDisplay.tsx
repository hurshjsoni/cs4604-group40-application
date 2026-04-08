"use client";

import { useState } from "react";
import {
  Mail,
  Phone,
  Copy,
  Check,
  X,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ContactInfo, ContactType } from "@/lib/types";

// Icon components for each contact type
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function SnapchatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.21-.015.449.24.689.164.164.299.33.404.463.29.346.555.676.747 1.017.449.763.584 1.575.18 2.153-.269.42-.752.635-1.418.675-.09 0-.179.015-.267.015-.148 0-.267-.015-.404-.03a6.8 6.8 0 0 1-.63-.134 3.996 3.996 0 0 1-.384-.135 1.2 1.2 0 0 0-.36-.12c-.164 0-.239.045-.269.15-.105.45-.45 1.05-1.77 1.32-.06.015-.134.015-.209.03-.09.015-.164.015-.254.015h-.06c-.54 0-1.029-.18-1.469-.45-.39-.24-.72-.45-1.079-.45h-.06c-.36 0-.69.21-1.079.45-.42.27-.914.449-1.469.449h-.06c-.09 0-.164 0-.254-.015-.075-.015-.149-.015-.209-.03-1.319-.27-1.664-.869-1.77-1.32-.029-.104-.104-.149-.269-.149-.09 0-.194.044-.359.119a4.68 4.68 0 0 1-.39.135 6.8 6.8 0 0 1-.629.134c-.135.015-.254.03-.404.03-.089 0-.179-.015-.267-.015-.659-.045-1.148-.255-1.418-.674-.404-.584-.269-1.39.18-2.154.192-.345.456-.674.746-1.016.106-.134.24-.3.404-.464.254-.24.33-.479.24-.689-.194-.449-.884-.674-1.333-.809a8.56 8.56 0 0 1-.344-.12c-.823-.328-1.228-.718-1.213-1.168 0-.359.284-.689.734-.838.15-.06.327-.09.509-.09.12 0 .299.015.464.104.374.18.734.286 1.034.301.198 0 .326-.045.401-.09a9.34 9.34 0 0 1-.03-.509l-.003-.06c-.104-1.628-.229-3.654.3-4.847C7.858 1.07 11.212.793 12.206.793z"/>
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

const contactConfig: Record<ContactType, { icon: React.ElementType; label: string; color: string; placeholder: string }> = {
  email: { icon: Mail, label: "Email", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", placeholder: "name@email.com" },
  phone: { icon: Phone, label: "Phone", color: "bg-green-500/10 text-green-600 dark:text-green-400", placeholder: "(555) 123-4567" },
  instagram: { icon: InstagramIcon, label: "Instagram", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400", placeholder: "@username" },
  snapchat: { icon: SnapchatIcon, label: "Snapchat", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", placeholder: "username" },
  discord: { icon: DiscordIcon, label: "Discord", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", placeholder: "username#1234" },
  twitter: { icon: TwitterIcon, label: "X / Twitter", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400", placeholder: "@username" },
  linkedin: { icon: LinkedInIcon, label: "LinkedIn", color: "bg-blue-600/10 text-blue-700 dark:text-blue-400", placeholder: "linkedin.com/in/username" },
  other: { icon: Globe, label: "Other", color: "bg-muted text-muted-foreground", placeholder: "https://..." },
};

interface ContactInfoDisplayProps {
  contacts: ContactInfo[];
  showPrivate?: boolean;
  compact?: boolean;
}

export function ContactInfoDisplay({ contacts, showPrivate = false, compact = false }: ContactInfoDisplayProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const visibleContacts = showPrivate ? contacts : contacts.filter((c) => c.isPublic);

  const handleCopy = async (value: string, id: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (visibleContacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No contact info available</p>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {visibleContacts.map((contact, idx) => {
          const config = contactConfig[contact.type];
          const Icon = config.icon;
          return (
            <Badge
              key={idx}
              variant="secondary"
              className={`gap-1.5 py-1 ${config.color}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs">{contact.value}</span>
            </Badge>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visibleContacts.map((contact, idx) => {
        const config = contactConfig[contact.type];
        const Icon = config.icon;
        const id = `${contact.type}-${idx}`;
        const label = contact.type === "other" && contact.customLabel ? contact.customLabel : config.label;
        
        return (
          <div
            key={idx}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-sm font-medium">{contact.value}</p>
              </div>
            </div>
            <button
              onClick={() => handleCopy(contact.value, id)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Copy"
            >
              {copiedId === id ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Edit form for contact info
interface ContactInfoFormProps {
  contacts: ContactInfo[];
  onChange: (contacts: ContactInfo[]) => void;
}

export function ContactInfoForm({ contacts, onChange }: ContactInfoFormProps) {
  const addContact = (type: ContactType) => {
    onChange([
      ...contacts,
      { _id: crypto.randomUUID(), userId: "", type, value: "", customLabel: null, isPublic: true },
    ]);
  };

  const updateContact = (index: number, updates: Partial<ContactInfo>) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], ...updates };
    onChange(newContacts);
  };

  const removeContact = (index: number) => {
    onChange(contacts.filter((_, i) => i !== index));
  };

  const availableTypes: ContactType[] = ["email", "phone", "instagram", "snapchat", "discord", "twitter", "linkedin", "other"];

  return (
    <div className="space-y-3">
      {contacts.map((contact, idx) => {
        const config = contactConfig[contact.type];
        const Icon = config.icon;
        
        return (
          <div key={idx} className="flex items-center gap-2 rounded-lg border border-border p-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{config.label}</span>
                {contact.type === "other" && (
                  <input
                    type="text"
                    placeholder="Enter your custom label"
                    value={contact.customLabel || ""}
                    onChange={(e) => updateContact(idx, { customLabel: e.target.value })}
                    className="form-input h-8 max-w-[120px] text-xs"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={config.placeholder}
                  value={contact.value}
                  onChange={(e) => updateContact(idx, { value: e.target.value })}
                  className="form-input flex-1"
                />
                <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={contact.isPublic}
                    onChange={(e) => updateContact(idx, { isPublic: e.target.checked })}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  Public
                </label>
              </div>
            </div>
            <button
              onClick={() => removeContact(idx)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      {/* Add Contact Buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        {availableTypes.map((type) => {
          const config = contactConfig[type];
          const Icon = config.icon;
          const alreadyAdded = type !== "other" && contacts.some((c) => c.type === type);
          
          return (
            <Button
              key={type}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addContact(type)}
              disabled={alreadyAdded}
              className="gap-1.5"
            >
              <Icon className="h-4 w-4" />
              {config.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
